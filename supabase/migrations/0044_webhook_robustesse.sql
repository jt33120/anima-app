-- Migration forward-only — REVUE DE CODE du 2026-08-11, lot 2. Trouvailles M7, M8, M11.
--
-- Trois défauts du chemin webhook, sans rapport entre eux sauf qu'ils vivent tous dans des RPC et
-- qu'aucun ne se voit avant la production.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M7 — UN COMPTE SUPPRIMÉ FAIT BOUCLER LE WEBHOOK PENDANT TROIS JOURS
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- `abonnement.utilisatrice_id` et `information_reconduction.utilisatrice_id` référencent
-- `utilisatrice(id)` en `not null`. Quand le compte est effacé (`auth.admin.deleteUser`, cascade),
-- un événement Stripe arrivant ensuite — et il en arrive : `customer.subscription.updated` au
-- moment où l'on pose `cancel_at`, puis `deleted` à l'échéance — viole la clé étrangère. La RPC
-- lève, la transaction est annulée (donc `evenements_traites` aussi), la route rend 500, et
-- **chaque rejeu refait exactement la même chose**. Stripe rejoue jusqu'à trois jours, alerte, puis
-- peut DÉSACTIVER l'endpoint — et là ce sont les abonnements de TOUT LE MONDE qui cessent d'être
-- projetés.
--
-- Le commentaire de la route dit « Stripe rejouera (idempotent) ». C'est vrai d'une panne
-- transitoire ; une violation de clé étrangère, elle, ne le sera jamais.
--
-- LE CORRECTIF EST AU BON ÉTAGE : la RPC consomme l'événement (pour que Stripe cesse), puis rend
-- `compte_absent` au lieu de lever. La route rend alors 200 sans rien changer d'autre. Traiter ça
-- dans le `catch` de la route en reniflant le code `23503` marcherait aussi — et serait un
-- rustinage : le fait « ce compte n'existe plus, aucun rejeu n'y changera rien » appartient à la
-- couche qui connaît la table.
--
-- ⚠️ Ceci ne dispense PAS d'annuler l'abonnement Stripe à la suppression du compte — sans quoi la
-- carte continue d'être débitée. C'est corrigé côté TypeScript, dans `effacerCompteCourant`.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M8 — DEUX ÉVÉNEMENTS DE LA MÊME SECONDE, LIVRÉS DANS LE DÉSORDRE
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- `source_maj_le` vient d'`event.created`, dont la résolution est LA SECONDE. L'anti-régression
-- était `ab.source_maj_le > p_source_maj_le` — strictement supérieur, donc l'égalité passait, et le
-- DERNIER LIVRÉ gagnait. Or Stripe ne garantit aucun ordre de livraison.
--
-- Cas réel : un Checkout par carte sans 3DS émet `customer.subscription.created` (`incomplete`) et
-- `customer.subscription.updated` (`active`) dans la même seconde. Livrés à l'envers, `incomplete`
-- écrase `active` → `etat = 'expire'` → elle a payé 69 € et n'est pas premium. Rien ne répare : sur
-- un abonnement ANNUEL, le prochain `customer.subscription.*` est dans un an.
--
-- Départage par RANG D'ÉTAT, et seulement en cas d'égalité stricte d'horodatage :
--     expire (0) < actif (1) < resilie (2)
-- On garde l'état le plus avancé dans le cycle de vie. `>` strict et non `>=` : à rang ÉGAL on
-- laisse le dernier écrire, parce que deux `updated` de la même seconde peuvent différer par
-- `resiliation_demandee_le` sans changer l'état, et que les ignorer figerait l'affichage.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M11 — UNE PREUVE D'ENVOI QUI ATTESTE D'UN ENVOI QUI N'A PAS EU LIEU
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- `reserver_information_reconduction` commit AVANT l'envoi du courriel (transactions séparées). Si
-- l'envoi lève — Resend en 429, adresse introuvable, port non configuré, simple timeout — la route
-- rend 500 et Stripe rejoue. Mais les DEUX barrières refusent alors : `evenements_traites` connaît
-- l'`event.id`, et `information_reconduction` connaît le couple `(utilisatrice, échéance)`.
-- **Aucun courriel ne partira jamais**, et `information_reconduction.envoye_le` — la seule table qui
-- atteste de l'obligation de l'art. L215-1 — dit qu'il est parti. En contentieux, c'est la pire des
-- positions : une preuve qui contredit les journaux du prestataire d'envoi.
--
-- La justification écrite dans `lib/courriel/reconduction.ts` pour ne pas libérer la réservation
-- (« `invoice.upcoming` est réémis par Stripe tant que la facture n'est pas réglée ») est FAUSSE :
-- cet événement est émis UNE FOIS par cycle, avant que la facture n'existe. Ce sont
-- `invoice.created` et `invoice.payment_failed` qui se répètent, et ce code les ignore.
--
-- D'où `liberer_information_reconduction` : elle défait les deux barrières pour que le rejeu Stripe
-- serve à quelque chose. Appelée UNIQUEMENT dans le chemin d'échec d'envoi.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Le rang d'état, pour départager l'égalité à la seconde
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create function public.rang_etat_abonnement(p_etat text)
  returns integer
  language sql
  immutable
  set search_path = ''
as $$
  select case p_etat
    when 'expire'  then 0
    when 'actif'   then 1
    when 'resilie' then 2
    else 0
  end;
$$;

revoke all on function public.rang_etat_abonnement(text) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- La projection : compte absent + départage
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.traiter_evenement_abonnement(
  cible uuid, p_provider_event_id text, p_type text, p_stripe_customer_id text,
  p_stripe_subscription_id text, p_etat text, p_periode_fin timestamptz,
  p_source_maj_le timestamptz, p_debut_le timestamptz, p_resiliation_demandee_le timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
  ab       public.abonnement;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(cible::text, 0));

  -- 1) Dédup idempotente par event.id : un rejeu Stripe ne produit AUCUN second effet.
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return 'deja_traite';
  end if;

  -- 1bis) LE COMPTE N'EXISTE PLUS (M7). On consomme l'événement — c'est ce qui fait cesser le rejeu —
  --       puis on rend une réponse au lieu de lever sur la clé étrangère. Rejouer ne ressusciterait
  --       pas le compte : il n'y a rien à projeter, et le dire est la seule chose juste.
  if not exists (select 1 from public.utilisatrice u where u.id = cible) then
    return 'compte_absent';
  end if;

  -- 2) Verrou de ligne (désormais garanti sérialisé par le verrou consultatif ci-dessus).
  select * into ab from public.abonnement where utilisatrice_id = cible for update;

  -- 3) Anti-régression : un event PLUS ANCIEN ne régresse jamais l'état (Stripe n'ordonne pas).
  --    ÉGALITÉ À LA SECONDE (M8) : on départage par rang d'état, en gardant le plus avancé.
  if found and (
       ab.source_maj_le > p_source_maj_le
       or (ab.source_maj_le = p_source_maj_le
           and public.rang_etat_abonnement(ab.etat) > public.rang_etat_abonnement(p_etat))
     ) then
    return 'ignore_obsolete';
  end if;

  -- 4) Projection écrivain-unique (upsert une-ligne-par-utilisatrice). La clause WHERE rend
  --    l'anti-régression atomique avec l'écriture. `periode_fin`/ids Stripe : conservés si absents.
  insert into public.abonnement (
    utilisatrice_id, etat, stripe_customer_id, stripe_subscription_id, periode_fin, source_maj_le, mis_a_jour_le,
    debut_le, resiliation_demandee_le
  ) values (
    cible, p_etat, p_stripe_customer_id, p_stripe_subscription_id, p_periode_fin, p_source_maj_le, now(),
    p_debut_le, p_resiliation_demandee_le
  )
  on conflict (utilisatrice_id) do update set
    etat                   = excluded.etat,
    stripe_customer_id     = coalesce(excluded.stripe_customer_id, public.abonnement.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.abonnement.stripe_subscription_id),
    periode_fin            = coalesce(excluded.periode_fin, public.abonnement.periode_fin),
    source_maj_le          = excluded.source_maj_le,
    mis_a_jour_le          = now(),
    -- `debut_le` en COALESCE (patron `periode_fin`) : un event qui ne le porte pas ne doit pas effacer la
    -- date de première souscription — ce serait remettre le compteur de la garantie à zéro.
    debut_le               = coalesce(excluded.debut_le, public.abonnement.debut_le),
    -- `resiliation_demandee_le` en écrasement FRANC, et c'est la différence qui compte : une résiliation
    -- ANNULÉE (Stripe rend `cancel_at = null`) doit effacer la date, sinon l'écran dirait éternellement
    -- « résilié » à quelqu'un qui est revenu. Un coalesce ici rendrait le geste irréversible à l'affichage.
    resiliation_demandee_le = excluded.resiliation_demandee_le
  where public.abonnement.source_maj_le <= excluded.source_maj_le;

  return 'traite';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- L'information avant reconduction : compte absent + libération sur échec d'envoi
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.reserver_information_reconduction(
  p_utilisatrice uuid, p_provider_event_id text, p_echeance timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
begin
  if p_echeance is null then
    raise exception 'reconduction_echeance_absente';
  end if;

  -- Première barrière : l'événement Stripe lui-même (rejeu at-least-once).
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, 'invoice.upcoming')
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return false;
  end if;

  -- Compte effacé (M7) : événement consommé, rien à annoncer, aucune clé étrangère violée.
  if not exists (select 1 from public.utilisatrice u where u.id = p_utilisatrice) then
    return false;
  end if;

  -- Seconde barrière : la reconduction annoncée. Deux événements DIFFÉRENTS peuvent porter la même
  -- échéance (facture re-générée après un changement de moyen de paiement) — la première barrière ne les
  -- verrait pas passer.
  insert into public.information_reconduction (utilisatrice_id, echeance)
  values (p_utilisatrice, p_echeance)
  on conflict (utilisatrice_id, echeance) do nothing;
  get diagnostics v_insere = row_count;

  return v_insere > 0;
end;
$$;

/**
 * LIBÈRE la réservation quand l'ENVOI a échoué (M11).
 *
 * Défait les DEUX barrières, sans quoi le rejeu Stripe ne sert à rien : la première (`event.id`)
 * refuserait le même événement, la seconde (`utilisatrice, échéance`) refuserait tout autre
 * événement portant la même échéance.
 *
 * ⚠️ À N'APPELER QUE DEPUIS LE CHEMIN D'ÉCHEC D'ENVOI. L'appeler après un succès rouvrirait la porte
 * à un second courriel — et une information légale envoyée en double est un incident, pas un détail.
 */
create function public.liberer_information_reconduction(
  p_utilisatrice uuid, p_provider_event_id text, p_echeance timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.information_reconduction
    where utilisatrice_id = p_utilisatrice and echeance = p_echeance;
  delete from public.evenements_traites
    where provider_event_id = p_provider_event_id;
end;
$$;

revoke all     on function public.liberer_information_reconduction(uuid, text, timestamptz) from public, anon, authenticated;
grant  execute on function public.liberer_information_reconduction(uuid, text, timestamptz) to service_role;

comment on function public.rang_etat_abonnement(text) is
  'Revue 2026-08-11 (M8) : départage deux événements Stripe de la MÊME seconde. event.created a une résolution d''une seconde et Stripe n''ordonne pas ses livraisons.';
comment on function public.liberer_information_reconduction(uuid, text, timestamptz) is
  'Revue 2026-08-11 (M11) : sans elle, un courriel légal en échec laissait une preuve d''envoi et aucun rattrapage possible.';
