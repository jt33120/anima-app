-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 0077 — L'ACCÈS OFFERT : un premium sans Stripe, pour celles qui font l'application
-- ══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── LE BESOIN, ET POURQUOI IL N'EST PAS UN CONFORT ─────────────────────────────────────────────
--
-- Anima écrit le corpus et doit VOIR ce qu'elle écrit. Or les branches — donc l'arbre habité, donc
-- la moitié de ce que le produit promet — vivent derrière l'abonnement. Sans accès offert, la
-- co-autrice du produit ne peut pas relire son propre travail, et le tour de QA sur l'arbre reste
-- fermé (« sept lignes non mesurables au stade graine »). Le paiement de test n'est pas une
-- réponse : il fabrique de faux contrats chez Stripe qu'il faudra démêler.
--
-- ── LA FORME CHOISIE, ET CELLE QUI A ÉTÉ ÉCARTÉE ───────────────────────────────────────────────
--
-- ÉCARTÉ : une table `acces_offert` à côté, et chaque lecture de premium qui la consulte en plus.
-- Le premium se lit dans HUIT endroits (`eligible_au_periodique`, la synthèse, l'arbitrage, le
-- socle quotidien, la poussée…). En ajouter une neuvième condition partout, c'est huit chances
-- d'en oublier une — et l'oubli serait invisible jusqu'au jour où quelqu'un s'en sert. C'est le
-- patron de défaut le plus fréquent de ce dépôt : la règle corrigée à un endroit, le jumeau qu'on
-- n'a pas regardé.
--
-- RETENU : une ligne d'`abonnement` ordinaire, `etat = 'actif'`, sans identifiant Stripe. Les huit
-- lectures marchent SANS UNE LIGNE DE CHANGEMENT, parce qu'elles disent toutes `etat = 'actif'`.
-- Ce qu'il faut ajouter n'est pas de l'accès, c'est une MARQUE — pour que le produit ne propose pas
-- de résilier chez Stripe un contrat qui n'y existe pas.
--
-- ── LA GARDE, ET OÙ ELLE VIT ───────────────────────────────────────────────────────────────────
--
-- `authenticated` détient les sept privilèges DML sur toutes les tables : une garde qui vivrait
-- dans une route ou dans le corps d'une RPC ne garderait rien. Ici, `abonnement` n'a AUCUNE policy
-- d'écriture depuis la 0013 — RLS forcée, donc écriture refusée à tout le monde sauf au
-- propriétaire de la table. Les deux fonctions ci-dessous sont `security definer` et leur exécution
-- est RETIRÉE à `authenticated` et `anon`. Personne ne peut s'offrir un accès.

alter table public.abonnement add column offert_le timestamptz;

comment on column public.abonnement.offert_le is
  'Non nul : accès OFFERT (Anima, comptes de test) — aucun contrat Stripe derrière. Nul : contrat payant ordinaire. Posé uniquement par offrir_acces() (service_role).';

-- ⚠️ LA CONTRAINTE EST CE QUI EMPÊCHE LES DEUX MONDES DE SE MÉLANGER. Un accès offert qui porterait
-- un identifiant Stripe ferait proposer « Résilier » sur un contrat inexistant, et l'appel partirait
-- chez Stripe avec un identifiant qui n'est pas à nous.
alter table public.abonnement
  add constraint abonnement_offert_sans_stripe
  check (offert_le is null or (stripe_customer_id is null and stripe_subscription_id is null));

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- Le webhook Stripe doit pouvoir REMPLACER un accès offert
-- ══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ SANS CE MORCEAU, LA MIGRATION CASSE UNE VRAIE CLIENTE. Quelqu'un à qui on a offert l'accès et
-- qui s'abonne pour de bon reçoit un event Stripe : l'upsert poserait les identifiants Stripe sur
-- une ligne dont `offert_le` est non nul, la contrainte ci-dessus rejetterait l'écriture, et le
-- webhook échouerait en boucle. Elle aurait payé sans rien recevoir.
--
-- La règle est simple et se lit d'une phrase : **un contrat réel efface l'accès offert.** On ne
-- garde pas les deux, parce qu'il n'y a rien à garder — l'accès offert n'a ni date de début ni
-- garantie ni période payée. C'est un cadeau, pas un contrat.
--
-- ⚠️ CE CORPS EST DÉRIVÉ DE LA 0044, PAS RETAPÉ, ET C'EST DÉLIBÉRÉ. Le premier jet de cette
-- migration l'a recopié depuis la 0038 et a PERDU DEUX AMENDEMENTS postérieurs : `compte_absent`
-- (M7 — un event visant un compte effacé faisait boucler le webhook sur une violation de clé
-- étrangère) et le départage à égalité de `source_maj_le` par rang d'état (M8). Trois tests l'ont
-- dit tout de suite. C'est le même piège que `reserver_notification` en juillet : une fonction
-- amendée plusieurs fois ne se réécrit JAMAIS de mémoire — on part de sa dernière définition.
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
    resiliation_demandee_le = excluded.resiliation_demandee_le,
    -- ⚠️ L'ACCÈS OFFERT S'EFFACE DÈS QU'UN CONTRAT RÉEL ARRIVE (0077). Écrit en dur plutôt qu'en
    -- `coalesce` : c'est le seul ordre qui laisse passer l'écriture sans violer
    -- `abonnement_offert_sans_stripe`, et c'est aussi le seul qui dise la vérité — à partir de
    -- là, elle paie. Sans cette ligne, quelqu'un à qui l'accès avait été offert et qui s'abonne
    -- pour de bon verrait le webhook échouer en boucle : elle aurait payé sans rien recevoir.
    offert_le              = null
  where public.abonnement.source_maj_le <= excluded.source_maj_le;

  return 'traite';
end;
$$;

revoke all on function public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz)
  to service_role;

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- Offrir, et reprendre
-- ══════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.offrir_acces(p_email text, p_motif text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_actuel  public.abonnement;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_id is null then
    return 'compte_inconnu';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text, 0));
  select * into v_actuel from public.abonnement where utilisatrice_id = v_id for update;

  -- ⚠️ ON NE RECOUVRE JAMAIS UN CONTRAT STRIPE. Offrir l'accès à quelqu'un qui paie effacerait les
  -- identifiants de son contrat (la contrainte l'exige) : le webhook suivant ne saurait plus à quelle
  -- ligne s'appliquer, et elle continuerait d'être débitée pour un abonnement que le produit aurait
  -- oublié. Le refus est explicite, jamais silencieux.
  if found and v_actuel.stripe_subscription_id is not null then
    return 'contrat_stripe_existant';
  end if;

  insert into public.abonnement (
    utilisatrice_id, etat, offert_le, source_maj_le, mis_a_jour_le, debut_le
  ) values (
    v_id, 'actif', now(), now(), now(), now()
  )
  on conflict (utilisatrice_id) do update set
    etat          = 'actif',
    offert_le     = now(),
    source_maj_le = now(),
    mis_a_jour_le = now(),
    debut_le      = coalesce(public.abonnement.debut_le, now()),
    resiliation_demandee_le = null;

  return 'offert';
end;
$$;

comment on function public.offrir_acces(text, text) is
  'Ouvre un accès premium SANS Stripe (Anima, comptes de test). service_role uniquement. Refuse si un contrat Stripe existe.';

create or replace function public.reprendre_acces_offert(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_ab public.abonnement;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_id is null then
    return 'compte_inconnu';
  end if;

  select * into v_ab from public.abonnement where utilisatrice_id = v_id for update;
  if not found then
    return 'aucun_abonnement';
  end if;

  -- ⚠️ NE TOUCHE QU'À CE QUI A ÉTÉ OFFERT. Sans cette condition, une faute de frappe sur l'adresse
  -- couperait l'accès de quelqu'un qui paie — et le produit n'aurait aucun moyen de s'en apercevoir,
  -- puisque Stripe, lui, continuerait de prélever.
  if v_ab.offert_le is null then
    return 'contrat_payant_intouche';
  end if;

  update public.abonnement
     set etat = 'expire', offert_le = null, source_maj_le = now(), mis_a_jour_le = now()
   where utilisatrice_id = v_id;

  return 'repris';
end;
$$;

comment on function public.reprendre_acces_offert(text) is
  'Referme un accès OFFERT. Ne touche jamais un contrat payant. service_role uniquement.';

revoke all on function public.offrir_acces(text, text) from public, anon, authenticated;
revoke all on function public.reprendre_acces_offert(text) from public, anon, authenticated;
grant execute on function public.offrir_acces(text, text) to service_role;
grant execute on function public.reprendre_acces_offert(text) to service_role;
