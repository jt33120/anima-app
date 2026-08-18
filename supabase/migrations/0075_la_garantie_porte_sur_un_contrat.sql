-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0075 — LA GARANTIE PORTE SUR UN CONTRAT, PAS SUR UNE VIE
-- (revue adversariale du 2026-08-18, R3 · FR-089 · FR-071)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ══ CE QUI SE PASSAIT, ET CE QUE L'ÉCRAN AFFIRMAIT PENDANT CE TEMPS ═══════════════════════════
--
-- `remboursement` a `utilisatrice_id` en CLÉ PRIMAIRE et n'est jamais purgée. Le commentaire de la
-- table le justifiait ainsi : « Un compte, un remboursement intégral — après quoi il n'y a plus
-- rien à rendre. » La phrase est vraie D'UN CONTRAT. Elle cesse de l'être à la seconde où elle
-- repaie.
--
-- Le déroulé, avec des dates :
--
--   janvier 2026 — elle s'abonne (69 €), ne pose aucune branche ;
--   mai 2026     — elle exerce la garantie : `confirme_le` est posée, les 69 € reviennent ;
--   janvier 2027 — la souscription meurt ;
--   février 2027 — elle se RÉABONNE. Le Checkout l'autorise (`contratStripeVivant('canceled')` est
--                  faux), le webhook réécrit `debut_le` avec le `start_date` de la nouvelle
--                  souscription. 69 € sont débités une seconde fois ;
--   juin 2027    — `eligible_au_remboursement()` rend `true` (actif, trois mois, aucune branche).
--                  La page affiche : « Aucune branche n'a été posée depuis trois mois. Tu peux
--                  demander le remboursement, sans avoir à te justifier. »
--
-- Au clic, `demander_remboursement` retrouve LA LIGNE DE 2026 — `deja_demande = true`,
-- `confirme_le` non nul — et la route court-circuite Stripe :
--
--     if (reservation.dejaDemande && reservation.confirmeLe) return vers("rembourse");
--
-- L'écran affiche « C'est demandé. Le remboursement arrive sur ton moyen de paiement. », puis, en
-- permanence, « Ton remboursement est parti sur ton moyen de paiement » — celui d'il y a un an.
-- Aucun `console.error`, aucune trace, aucun signal : elle attend 69 € qui ne partiront jamais, et
-- le produit affirme qu'ils sont partis.
--
-- ⚠️ CE N'EST PAS UN REFUS MAL FORMULÉ, C'EST UNE FAUSSE CONFIRMATION. Un refus honnête aurait
-- laissé une prise : écrire à l'aide, insister. Une confirmation ferme la question.
--
-- ══ POURQUOI PAR CONTRAT, ET PAS « UNE FOIS DANS SA VIE » ═════════════════════════════════════
--
-- L'autre correctif possible était de resserrer l'ÉLIGIBILITÉ : plus jamais de garantie à qui l'a
-- déjà exercée. Il est rejeté, et pour une raison qui vient du texte :
--
--   • FR-089 attache la garantie à « trois mois D'ABONNEMENT » — un contrat, pas une existence ;
--   • la garantie « est annoncée AU MOMENT DE L'ABONNEMENT ». Le produit la promet donc à nouveau
--     au second Checkout. La refuser ensuite serait un mensonge au point de vente ;
--   • son critère est un ARTEFACT : aucune branche posée, c'est-à-dire « le produit ne t'a rien
--     produit ». Ce constat est aussi vrai la seconde fois que la première, et elle a repayé.
--
-- ⚠️ CONSÉQUENCE ASSUMÉE, ÉCRITE ICI POUR QU'ELLE NE SOIT PAS DÉCOUVERTE PLUS TARD. Une boucle
-- devient possible : s'abonner, attendre trois mois sans poser de branche, se faire rembourser,
-- se réabonner. C'est exactement ce que FR-089 promet, appliqué en série — le coût est celui de la
-- promesse, pas d'un défaut. Chaque tour coûte 69 € avancés et trois mois d'attente à qui le tente.
-- Si le produit veut un jour y mettre une borne, elle sera un CHOIX écrit dans le PRD, pas la
-- conséquence silencieuse d'une clé primaire.
--
-- ══ CE QUI NE CHANGE PAS, ET C'ÉTAIT LA CRAINTE ═══════════════════════════════════════════════
--
-- 0038 faisait converger les deux chemins — la GARANTIE (elle la demande) et la MINORITÉ (le
-- système la décide, FR-071) — sur une seule ligne, « et c'est ce qui rend l'idempotence vraie :
-- deux tables, ou deux clés, et une mineure ayant déjà obtenu la garantie serait remboursée deux
-- fois ». Cette propriété est CONSERVÉE, simplement portée au bon grain : la clé devient
-- (utilisatrice, contrat). Une mineure ayant obtenu la garantie sur SON contrat courant retrouve
-- sa ligne, avec sa clé d'idempotence, et n'est pas remboursée deux fois. Si elle a payé deux
-- contrats, elle est remboursée des deux — ce qui est le fait, pas un doublon.
--
-- `nulls not distinct` : le chemin minorité s'applique à un compte qui n'a JAMAIS payé
-- (`stripe_subscription_id` nul). Sans cette clause, chaque appel créerait une ligne de plus,
-- chacune avec sa propre clé — c'est-à-dire précisément le double remboursement qu'on évite.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LA CLÉ : un remboursement par CONTRAT ─────────────────────────────────────────────────

alter table public.remboursement drop constraint remboursement_pkey;

alter table public.remboursement
  add column id uuid not null default gen_random_uuid();

alter table public.remboursement add primary key (id);

-- ⚠️ `nulls not distinct` EST LOAD-BEARING (voir l'en-tête). Sans elle, deux lignes à
-- `stripe_subscription_id` nul cohabiteraient : deux clés d'idempotence, deux remboursements.
create unique index remboursement_un_par_contrat
  on public.remboursement (utilisatrice_id, stripe_subscription_id) nulls not distinct;

comment on table public.remboursement is
  'Story 3.5, regrainée par la revue adversariale du 2026-08-18 (R3) : un remboursement INTÉGRAL par CONTRAT, quel que soit le chemin (garantie FR-089 demandée par elle, ou minorité FR-071 decidee par le système). La cle primaire etait `utilisatrice_id` : apres un reabonnement, la ligne d''un contrat CLOS faisait court-circuiter Stripe et l''ecran annoncait un virement qui ne partait jamais. L''unicite (utilisatrice, contrat) `nulls not distinct` porte desormais l''idempotence — y compris pour le chemin minorite sur un compte qui n''a jamais paye. NON-art. 9. Cascade FR-067.';

comment on column public.remboursement.id is
  'Revue adversariale (R3) : cle de substitution. L''identite metier est (utilisatrice_id, stripe_subscription_id), portee par `remboursement_un_par_contrat`.';

-- ── 2. L'ÉLIGIBILITÉ : la garantie d'un contrat ne s'exerce qu'une fois ───────────────────────
--
-- ⚠️ SANS CETTE CLAUSE, LE BOUTON RESTE APRÈS LE REMBOURSEMENT. `eligible_au_remboursement` ne
-- regardait que l'abonnement et les branches ; or un remboursement ne change PAS `etat` (l'accès
-- court jusqu'à l'échéance payée). Le bouton « Demander le remboursement » restait donc affiché à
-- quelqu'un dont l'argent est déjà revenu — et le clic répondait « le remboursement arrive »,
-- indéfiniment. Le court-circuit de la route est LÉGITIME dans ce cas-là (c'est bien le même
-- remboursement), mais l'OFFRE ne l'est pas : on ne propose pas un geste déjà accompli.
create or replace function public.eligible_au_remboursement(p_utilisatrice uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.abonnement a
     where a.utilisatrice_id = p_utilisatrice
       and a.etat = 'actif'
       -- `debut_le is not null` EXPLICITE : sans lui, une ligne sans date rendrait NULL à la
       -- comparaison, `exists` rendrait `false`, et le refus serait indiscernable d'un refus motivé.
       and a.debut_le is not null
       and a.debut_le <= now() - interval '3 months'
       -- L'ARTEFACT DU PRODUIT (FR-089) : « aucune branche posée ». Jamais son état.
       and not exists (
             select 1 from public.branche b where b.utilisatrice_id = p_utilisatrice
           )
       -- LA GARANTIE DE CE CONTRAT-CI (R3) : déjà exercée, il n'y a plus rien à proposer.
       and not exists (
             select 1
               from public.remboursement r
              where r.utilisatrice_id = p_utilisatrice
                and r.stripe_subscription_id is not distinct from a.stripe_subscription_id
           )
  );
$$;

comment on function public.eligible_au_remboursement(uuid) is
  'Story 3.5 (FR-089), regrainée par R3 : la garantie porte sur un ARTEFACT du produit (aucune branche posée) apres trois mois, et ne s''exerce qu''une fois PAR CONTRAT. Rend un BOOLEEN seul : FR-031 est satisfait par le type de retour, pas par une consigne d''affichage.';

-- ── 3. LA RÉSERVATION : elle vise le contrat COURANT ─────────────────────────────────────────

drop function public.demander_remboursement(uuid, text);

create function public.demander_remboursement(p_utilisatrice uuid, p_motif text)
returns table (cle uuid, subscription_id text, deja_demande boolean, confirme_le timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existant public.remboursement;
  v_sub      text;
begin
  if p_motif is null or p_motif not in ('garantie', 'minorite') then
    raise exception 'remboursement_motif_invalide';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_utilisatrice::text, 3500));

  -- ⚠️ LE CONTRAT COURANT SE LIT AVANT LA RECHERCHE, ET C'EST TOUT LE CORRECTIF. La version d'avant
  -- cherchait la ligne par `utilisatrice_id` seul, donc trouvait celle d'un contrat clos.
  select a.stripe_subscription_id into v_sub
    from public.abonnement a where a.utilisatrice_id = p_utilisatrice;

  -- Déjà demandé SUR CE CONTRAT : on rend la MÊME clé, ET l'horodatage de confirmation.
  -- `confirme_le is null` signifie « réservée, mais Stripe n'a jamais confirmé » : l'appelant DOIT
  -- rejouer avec cette clé. Non nul : le webhook `refund.created` est passé, il peut répondre.
  --
  -- `is not distinct from` plutôt que `=` : le chemin minorité vise un compte sans souscription, et
  -- `null = null` rend NULL, donc la ligne ne serait jamais retrouvée — une seconde application de
  -- la barrière rembourserait à neuf.
  select * into v_existant
    from public.remboursement r
   where r.utilisatrice_id = p_utilisatrice
     and r.stripe_subscription_id is not distinct from v_sub;
  if found then
    return query select v_existant.cle_idempotence,
                        v_existant.stripe_subscription_id,
                        true,
                        v_existant.confirme_le;
    return;
  end if;

  -- L'éligibilité ne gouverne QUE la garantie. La minorité rembourse sans condition (FR-071) :
  -- c'est un contrat qui n'aurait jamais dû exister, pas une garantie de satisfaction.
  if p_motif = 'garantie' and not public.eligible_au_remboursement(p_utilisatrice) then
    raise exception 'remboursement_non_eligible';
  end if;

  insert into public.remboursement (utilisatrice_id, motif, stripe_subscription_id)
  values (p_utilisatrice, p_motif, v_sub);

  return query
    select r.cle_idempotence, r.stripe_subscription_id, false, r.confirme_le
      from public.remboursement r
     where r.utilisatrice_id = p_utilisatrice
       and r.stripe_subscription_id is not distinct from v_sub;
end;
$$;

revoke all     on function public.demander_remboursement(uuid, text) from public, anon, authenticated;
grant  execute on function public.demander_remboursement(uuid, text) to service_role;

comment on function public.demander_remboursement(uuid, text) is
  'Revue adversariale du 2026-08-18 (R3) : la reservation vise le contrat COURANT. Auparavant elle cherchait la ligne par `utilisatrice_id` seul et retrouvait celle d''un contrat clos — la route court-circuitait alors Stripe et l''ecran annoncait un virement qui ne partait jamais.';

-- ── 4. LA CONFIRMATION ET L'ÉCHEC : ils visent LA ligne, pas toutes ──────────────────────────
--
-- ⚠️ TANT QU'IL N'Y AVAIT QU'UNE LIGNE PAR COMPTE, `where utilisatrice_id = …` DÉSIGNAIT LA BONNE.
-- Avec deux contrats remboursés, cette clause écrirait `confirme_le` sur les deux — dont un qui n'a
-- rien reçu. La clé d'idempotence, elle, est unique par ligne ET voyage jusqu'à Stripe : elle est
-- posée dans `metadata.remboursementCle` du Refund, donc l'événement la rapporte.
--
-- LE REPLI (clé absente) EXISTE ET IL EST NOMMÉ : un remboursement créé À LA MAIN dans le tableau
-- de bord Stripe ne porte pas notre métadonnée, et les lignes antérieures à cette migration non
-- plus. On vise alors la demande la PLUS RÉCENTE — jamais toutes : confirmer en bloc affirmerait
-- qu'un ancien remboursement échoué a finalement abouti.

drop function public.confirmer_remboursement(uuid, text, text);
drop function public.echouer_remboursement(uuid, text, text);

create function public.confirmer_remboursement(
  p_utilisatrice uuid,
  p_provider_event_id text,
  p_type text,
  p_cle uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
  v_cible  uuid;
begin
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return false; -- rejeu : aucun second effet
  end if;

  select r.id into v_cible
    from public.remboursement r
   where r.utilisatrice_id = p_utilisatrice
     and (p_cle is null or r.cle_idempotence = p_cle)
   order by r.demande_le desc
   limit 1;

  update public.remboursement
     set confirme_le = coalesce(confirme_le, now()),
         echec_le    = null   -- l'argent est rendu : l'échec qui précède n'a plus d'objet
   where id = v_cible;

  return true;
end;
$$;

create function public.echouer_remboursement(
  p_utilisatrice uuid,
  p_provider_event_id text,
  p_type text,
  p_cle uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
  v_cible  uuid;
begin
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return false;
  end if;

  -- `confirme_le is null` : on n'écrit JAMAIS un échec par-dessus une confirmation. Les webhooks
  -- n'arrivent pas dans l'ordre, et l'argent rendu ne se dé-rend pas.
  select r.id into v_cible
    from public.remboursement r
   where r.utilisatrice_id = p_utilisatrice
     and r.confirme_le is null
     and (p_cle is null or r.cle_idempotence = p_cle)
   order by r.demande_le desc
   limit 1;

  update public.remboursement
     set echec_le = coalesce(echec_le, now())
   where id = v_cible;

  return true;
end;
$$;

revoke all     on function public.confirmer_remboursement(uuid, text, text, uuid) from public, anon, authenticated;
grant  execute on function public.confirmer_remboursement(uuid, text, text, uuid) to service_role;
revoke all     on function public.echouer_remboursement(uuid, text, text, uuid) from public, anon, authenticated;
grant  execute on function public.echouer_remboursement(uuid, text, text, uuid) to service_role;

comment on function public.confirmer_remboursement(uuid, text, text, uuid) is
  'Revue adversariale (R3) : vise LA ligne remboursee, par la cle d''idempotence rapportee dans `metadata.remboursementCle` du Refund. Sans elle (remboursement cree a la main dans Stripe, ligne anterieure a 0075), repli sur la demande la plus recente — jamais sur toutes. Idempotent par `evenements_traites`.';

comment on function public.echouer_remboursement(uuid, text, text, uuid) is
  'Revue adversariale (R3) : meme ciblage que `confirmer_remboursement`. N''ecrit jamais un echec par-dessus une confirmation — l''ordre de livraison des webhooks n''est pas garanti.';
