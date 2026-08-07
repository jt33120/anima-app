-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0038 — LA PORTE DE SORTIE (Story 3.5 : FR-060, FR-089, FR-071)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- La seule migration de l'Epic 3 qui travaille CONTRE l'intérêt commercial du produit. Elle pose de quoi
-- partir : résilier, se faire rembourser, et être prévenue avant d'être reconduite.
--
-- ── QUI A TOUCHÉ CE QUI EST RÉÉCRIT ICI, ET POURQUOI JE LE NOMME ────────────────────────────────────────
--
-- `traiter_evenement_abonnement` : créée par 0013, RÉÉCRITE INTÉGRALEMENT par 0014 (durcissement de
-- concurrence — verrou consultatif + clause anti-régression atomique). AUCUNE autre migration ne l'a
-- amendée (vérifié : `grep -l traiter_evenement_abonnement` ne rend que 0013 et 0014). Le texte de 0014
-- fait donc foi, et c'est LUI qui est repris ci-dessous, à l'identique, plus deux colonnes.
--
-- Ce recensement n'est pas de la politesse. En 4.10 j'ai réécrit `reserver_notification` en oubliant que
-- 0030 ET 0034 l'avaient amendée : la garde de désabonnement a disparu silencieusement, et la story
-- suivante l'a retrouvée par hasard. Une réécriture qui ne nomme pas ses amendeurs est une régression qui
-- attend.
--
-- ⚠️ LA SIGNATURE CHANGE — DONC `create or replace` NE SUFFIT PAS.
-- Postgres surcharge par signature : `create or replace` avec deux paramètres de plus créerait une
-- DEUXIÈME fonction, l'ancienne restant appelable. PostgREST résoudrait alors selon les arguments reçus,
-- et un appelant oublié continuerait d'écrire par l'ancien chemin — sans `debut_le`, donc en cassant
-- silencieusement l'éligibilité au remboursement. On DROP explicitement l'ancienne arité.
--
-- ── CE QUE CETTE MIGRATION POSE ────────────────────────────────────────────────────────────────────────
--
--   1. `abonnement.debut_le` + `abonnement.resiliation_demandee_le` — les deux dates qui manquaient ;
--   2. `traiter_evenement_abonnement` en arité 10 (l'ancienne arité 8 est supprimée) ;
--   3. `eligible_au_remboursement()` — un BOOLÉEN, jamais un compte (FR-031) ;
--   4. `remboursement` — un remboursement par compte, les deux chemins convergent ;
--   5. `information_reconduction` — l'obligation légale, HORS du canal d'opt-out ;
--   6. `demander_remboursement()` / `reserver_information_reconduction()` — réservation avant exécution.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. LES DEUX DATES QUI MANQUAIENT
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `debut_le` — alimenté depuis `subscription.start_date`, et surtout PAS depuis `current_period_start`.
-- La différence décide de la garantie : `start_date` est la date de première souscription et NE BOUGE PAS
-- à la reconduction ; `current_period_start` se réinitialise chaque année. Avec la seconde, personne ne
-- serait jamais « abonnée depuis trois mois » plus de trois mois d'affilée, et la garantie FR-089
-- redeviendrait disponible tous les ans. Avec la première, elle est ce qu'elle dit être.
--
-- `resiliation_demandee_le` — la résiliation « en fin de période » ne change PAS `subscription.status`
-- (il reste `active`), donc l'état projeté reste `actif` : c'est voulu, c'est ce qui fait que l'accès
-- continue jusqu'à la fin payée (AC8, et la note de `lib/domain/abonnement.ts`). Mais l'écran doit
-- pouvoir dire « résilié, actif jusqu'au … » plutôt que « actif » tout court, sinon quelqu'un qui vient
-- de résilier ne voit aucune trace de son geste et résilie une seconde fois. C'est donc `cancel_at` qui
-- est projeté ici — un fait de facturation, pas un état.

alter table public.abonnement add column debut_le                timestamptz;
alter table public.abonnement add column resiliation_demandee_le timestamptz;

comment on column public.abonnement.debut_le is
  'Story 3.5 : `subscription.start_date` — la PREMIÈRE souscription, stable à travers les reconductions (jamais `current_period_start`, qui se réinitialise chaque année et rendrait la garantie FR-089 re-disponible annuellement). Base du calcul des trois mois.';
comment on column public.abonnement.resiliation_demandee_le is
  'Story 3.5 : `subscription.cancel_at` — la résiliation est DEMANDÉE, l''accès court jusqu''à la fin payée. N''affecte pas `etat` (qui reste `actif` : Stripe garde `status=active`), sert uniquement à ce que l''écran ne dise pas « actif » tout court à quelqu''un qui vient de résilier.';

-- ── BACKFILL : sans lui, `debut_le` reste NULL sur les lignes déjà projetées ────────────────────────────
--
-- Et NULL est le pire des cas ici, parce qu'il ne fait pas de bruit : `null <= now() - interval
-- '3 months'` rend NULL, la ligne sort du `exists`, et l'éligibilité rend `false`. Un refus PARFAITEMENT
-- indiscernable d'un refus fondé. Sans ce backfill, la garantie FR-089 ne marcherait pour personne
-- d'ancien et rien — ni erreur, ni journal, ni test — ne le dirait. Même famille que le
-- `make_interval(days => null)` que 0034 documente pour la purge : une opération qui ne fait rien en
-- prétendant avoir fait quelque chose.
--
-- La reconstruction `periode_fin - 1 an` est APPROXIMATIVE (elle suppose une période annuelle jamais
-- changée) et elle est acceptable pour une seule raison : au moment où cette migration s'applique, le
-- produit n'est pas lancé et la table est vide ou quasi. Elle existe pour que l'environnement local et
-- les rares comptes de test ne portent pas un NULL muet.
update public.abonnement
   set debut_le = periode_fin - interval '1 year'
 where debut_le is null
   and periode_fin is not null;

-- ── La projection, en arité 10. Texte de 0014 À L'IDENTIQUE, deux paramètres en plus. ──────────────────
drop function if exists public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz);

create or replace function public.traiter_evenement_abonnement(
  cible uuid,
  p_provider_event_id text,
  p_type text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_etat text,
  p_periode_fin timestamptz,
  p_source_maj_le timestamptz,
  p_debut_le timestamptz,                -- ── AJOUTÉ PAR LA 3.5 ──
  p_resiliation_demandee_le timestamptz  -- ── AJOUTÉ PAR LA 3.5 ──
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
  ab       public.abonnement;
begin
  -- 0) Sérialise tous les appels concurrents du MÊME compte (même sans ligne existante : le FOR UPDATE
  --    seul ne verrouille rien sur une ligne absente). pg_catalog schéma-qualifié (search_path='').
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(cible::text, 0));

  -- 1) Dédup idempotente par event.id : un rejeu Stripe ne produit AUCUN second effet.
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return 'deja_traite';
  end if;

  -- 2) Verrou de ligne (désormais garanti sérialisé par le verrou consultatif ci-dessus).
  select * into ab from public.abonnement where utilisatrice_id = cible for update;

  -- 3) Anti-régression : un event PLUS ANCIEN ne régresse jamais l'état (Stripe n'ordonne pas).
  if found and ab.source_maj_le > p_source_maj_le then
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

revoke all on function public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz)
  to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. L'ÉLIGIBILITÉ — un booléen, et rien d'autre
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- FR-031 interdit tout score, note, jauge ou série. Le respecter par une consigne d'interface serait
-- fragile ; le respecter par le TYPE de retour est structurel : il n'existe pas de nombre à faire fuir,
-- ni dans une réponse d'API, ni dans un journal, ni dans un attribut `aria-*`. On ne peut pas afficher
-- « il te reste 12 jours » à partir d'un booléen.
--
-- DEUX ENTRÉES, UNE SEULE PRÉDICATION (leçon R1-bis : deux implémentations d'un invariant divergent).
-- La forme paramétrée sert le chemin serveur (remboursement de minorité, FR-071, où il n'y a pas de JWT) ;
-- la forme sans argument sert la lecture d'écran sous JWT. La seconde APPELLE la première — elle ne la
-- recopie pas. Patron `est_premium_courante()` (0036).
create function public.eligible_au_remboursement(p_utilisatrice uuid)
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
       -- `debut_le is not null` EXPLICITE. Sans lui, une ligne sans date rendrait NULL à la comparaison,
       -- `exists` rendrait `false`, et le refus serait indiscernable d'un refus motivé. Ici le refus est
       -- une DÉCISION testable : pas de date connue → pas de garantie, et un test le prouve.
       and a.debut_le is not null
       and a.debut_le <= now() - interval '3 months'
       -- L'ARTEFACT DU PRODUIT (FR-089) : « aucune branche posée ». Jamais son état, jamais un résultat
       -- personnel, jamais un jugement sur ce qu'elle a vécu. Une seule branche, même en `naissance`,
       -- même renommée depuis, suffit à dire que le produit a produit.
       and not exists (
             select 1 from public.branche b where b.utilisatrice_id = p_utilisatrice
           )
  );
$$;

create function public.eligible_au_remboursement()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eligible_au_remboursement((select auth.uid()));
$$;

-- La forme PARAMÉTRÉE ne doit jamais être appelable sous JWT : elle accepte un uuid arbitraire et
-- répondrait sur le compte de quelqu'un d'autre. Elle n'expose qu'un booléen, mais un booléen sur un
-- identifiant choisi est déjà un oracle. Chemin serveur seulement.
revoke all     on function public.eligible_au_remboursement(uuid) from public, anon, authenticated;
grant  execute on function public.eligible_au_remboursement(uuid) to service_role;

-- ⚠️ `revoke ... from public` NE SUFFIT PAS pour `anon` — les `alter default privileges` de Supabase lui
-- donnent un grant EXPLICITE (leçon de 0007, repayée en 0036). On le révoque nommément.
revoke all     on function public.eligible_au_remboursement() from public, anon;
grant  execute on function public.eligible_au_remboursement() to authenticated;

comment on function public.eligible_au_remboursement(uuid) is
  'Story 3.5 (FR-089) : la garantie porte sur un ARTEFACT du produit (aucune branche posée) après trois mois — jamais sur son état ni sur un résultat personnel. Rend un BOOLÉEN seul : FR-031 est satisfait par le type de retour, pas par une consigne d''affichage.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LE REMBOURSEMENT — un par compte, deux chemins qui convergent
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Deux appelants, une seule table : la GARANTIE (FR-089, elle le demande) et la MINORITÉ (FR-071, le
-- système le décide en appliquant la barrière). Les faire converger ici est ce qui rend l'idempotence
-- vraie : deux tables, ou deux clés, et une mineure ayant déjà obtenu la garantie serait remboursée deux
-- fois. Un compte, un remboursement intégral — après quoi il n'y a plus rien à rendre.
--
-- La MINORITÉ n'est PAS soumise à l'éligibilité. Un compte mineur est remboursé intégralement quoi qu'il
-- ait posé : c'est un contrat qui n'aurait jamais dû exister, pas une garantie de satisfaction.
create table public.remboursement (
  utilisatrice_id        uuid        primary key references public.utilisatrice(id) on delete cascade,
  motif                  text        not null,
  stripe_subscription_id text,
  -- La clé d'idempotence envoyée à Stripe. STOCKÉE, et déterminée par la BASE, pas par l'appelant : au
  -- retry, la route relit la même clé et Stripe reconnaît la même opération. Une clé dérivée d'un
  -- horodatage ou d'un aléa côté route rendrait chaque tentative unique — c'est-à-dire rembourserait
  -- autant de fois qu'il y a de retries.
  cle_idempotence        uuid        not null default gen_random_uuid(),
  demande_le             timestamptz not null default now(),
  -- NULL tant que Stripe n'a pas confirmé. La confirmation vient du webhook `charge.refunded`, jamais de
  -- la réponse d'API : c'est l'événement qui fait autorité (convention « Événements externes »).
  confirme_le            timestamptz,
  constraint remboursement_motif_valide check (motif in ('garantie', 'minorite'))
);

alter table public.remboursement enable row level security;
alter table public.remboursement force  row level security;

-- Lecture propriétaire : elle doit pouvoir voir qu'un remboursement est en cours (et son EXPORT le porte,
-- FR-067). Aucune policy d'écriture : la demande passe par la RPC ci-dessous.
create policy remboursement_proprietaire_lecture on public.remboursement
  for select
  using (auth.uid() = utilisatrice_id);

comment on table public.remboursement is
  'Story 3.5 : un remboursement INTÉGRAL par compte, quel que soit le chemin (garantie FR-089 demandée par elle, ou minorité FR-071 décidée par le système). La clé primaire sur `utilisatrice_id` EST l''idempotence. `cle_idempotence` est déterminée en base pour que les retries de la route soient reconnus par Stripe comme la même opération. NON-art. 9. Cascade FR-067.';

-- ── La réservation : re-vérifier PUIS réserver ─────────────────────────────────────────────────────────
--
-- ⚠️ CORRECTION D'UNE ERREUR QUE J'AI FAILLI LAISSER ICI. J'avais d'abord écrit que l'ordre était
-- load-bearing — « réserver puis vérifier laisserait une ligne derrière, et cette ligne, étant la clé
-- d'idempotence, empêcherait à jamais le vrai remboursement ». La campagne de mutation dit le contraire :
-- le mutant qui inverse les deux blocs ne casse AUCUN test, et il a raison de ne rien casser. Cette
-- fonction REFUSE PAR `raise exception`, ce qui abandonne la transaction — l'insert est annulé quel que
-- soit l'ordre. Le raisonnement de 0034 (« refuser ne doit RIEN consommer ») s'appliquait là-bas parce
-- que `reserver_notification` rend `false` au lieu de lever ; il ne se transpose pas ici.
--
-- L'ordre est donc conservé pour la LISIBILITÉ, et parce qu'il redeviendrait load-bearing le jour où
-- quelqu'un remplacerait le `raise` par un `return`. Ce qui protège réellement la clé, c'est le
-- `raise` — et c'est LUI qui est testé (« un refus n'a pas brûlé la clé : une demande légitime
-- ultérieure aboutit »), pas l'ordre des lignes.
--
-- POURQUOI `raise` PLUTÔT QU'UN BOOLÉEN : la route doit distinguer « pas éligible » (403) de « déjà
-- demandé » (200, idempotent). Un booléen ne porte pas cette différence, et la route inventerait alors
-- sa propre interprétation — c'est-à-dire une seconde source de vérité sur l'éligibilité.
--
-- La re-vérification n'est pas redondante avec celle de la route : la route affiche, celle-ci DÉCIDE.
-- Une garde qui ne vit que dans l'appelant est une garde qu'un appelant oublié contourne (leçon R1).
create function public.demander_remboursement(p_utilisatrice uuid, p_motif text)
returns table (cle uuid, subscription_id text, deja_demande boolean)
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

  -- Déjà demandé : on rend la MÊME clé. C'est ce qui fait qu'un retry de la route reparle à Stripe de la
  -- même opération au lieu d'en ouvrir une seconde.
  select * into v_existant from public.remboursement r where r.utilisatrice_id = p_utilisatrice;
  if found then
    return query select v_existant.cle_idempotence, v_existant.stripe_subscription_id, true;
    return;
  end if;

  -- L'éligibilité ne gouverne QUE la garantie. La minorité rembourse sans condition (FR-071).
  if p_motif = 'garantie' and not public.eligible_au_remboursement(p_utilisatrice) then
    raise exception 'remboursement_non_eligible';
  end if;

  select a.stripe_subscription_id into v_sub
    from public.abonnement a where a.utilisatrice_id = p_utilisatrice;

  insert into public.remboursement (utilisatrice_id, motif, stripe_subscription_id)
  values (p_utilisatrice, p_motif, v_sub);

  return query
    select r.cle_idempotence, r.stripe_subscription_id, false
      from public.remboursement r where r.utilisatrice_id = p_utilisatrice;
end;
$$;

revoke all     on function public.demander_remboursement(uuid, text) from public, anon, authenticated;
grant  execute on function public.demander_remboursement(uuid, text) to service_role;

-- ── La confirmation, portée par le webhook ─────────────────────────────────────────────────────────────
--
-- `p_type` est un PARAMÈTRE et non une constante : le SQL n'a pas à deviner quel événement Stripe fait
-- foi. Le premier jet codait `'charge.refunded'` en dur — ce qui aurait figé ici une décision d'intégration
-- qui a changé pendant l'écriture (`refund.created` porte NOTRE `metadata`, `charge.refunded` obligerait à
-- remonter charge → facture → abonnement pour retrouver de qui il s'agit).
create function public.confirmer_remboursement(
  p_utilisatrice uuid,
  p_provider_event_id text,
  p_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
begin
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return false; -- rejeu : aucun second effet
  end if;

  update public.remboursement
     set confirme_le = coalesce(confirme_le, now())
   where utilisatrice_id = p_utilisatrice;

  return true;
end;
$$;

revoke all     on function public.confirmer_remboursement(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.confirmer_remboursement(uuid, text, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. L'INFORMATION AVANT RECONDUCTION — et pourquoi elle ne passe PAS par `reserver_notification`
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- C'EST LA DÉCISION LA PLUS IMPORTANTE DE CETTE MIGRATION, et elle est invisible si on ne l'écrit pas.
--
-- `reserver_notification` (0034) commence par ceci :
--
--     if exists (select 1 from public.preference_courriel p
--                 where p.utilisatrice_id = p_utilisatrice and p.refuse_le is not null)
--     then return false; end if;
--
-- Faire passer l'information de reconduction par là, c'est décider que quelqu'un ayant cliqué « ne plus
-- recevoir » au bas d'une synthèse sera reconduit pour 69 € sans avoir été prévenu. Le plafond par
-- famille (4.10) pourrait l'écarter en plus, pour une raison entièrement légitime de son côté.
--
-- Le refus de canal est un droit d'opposition (art. 21) sur les NOTIFICATIONS PRODUIT. L'information
-- avant reconduction tacite est une OBLIGATION CONTRACTUELLE (art. L215-1 C. consommation) : elle ne
-- relève pas du même régime, et rien ne permet d'y renoncer par un clic dans un pied de courriel.
--
-- D'où : idempotence PROPRE, table PROPRE, et aucune lecture de `preference_courriel`. Ce qui est
-- délibérément absent ci-dessous est aussi important que ce qui y est.
create table public.information_reconduction (
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  -- L'échéance ANNONCÉE. C'est elle la clé, pas la date d'envoi : deux événements Stripe distincts pour
  -- la même reconduction (rejeu, re-génération de facture) ne doivent produire qu'un seul courriel.
  echeance        timestamptz not null,
  envoye_le       timestamptz not null default now(),
  primary key (utilisatrice_id, echeance)
);

alter table public.information_reconduction enable row level security;
alter table public.information_reconduction force  row level security;
-- Aucune policy : registre système (patron `evenements_traites`/0013). Il ne porte aucun contenu, et
-- l'exposer ne servirait qu'à raconter un calendrier d'envois.

comment on table public.information_reconduction is
  'Story 3.5 (FR-060, art. L215-1) : trace d''idempotence de l''information légale avant reconduction tacite. VOLONTAIREMENT hors de `notification_envoyee` : ce chemin ne consulte NI `preference_courriel.refuse_le` NI le plafond par famille — un droit d''opposition au canal marketing ne peut pas faire disparaître une obligation contractuelle d''information.';

create function public.reserver_information_reconduction(
  p_utilisatrice      uuid,
  p_provider_event_id text,
  p_echeance          timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
begin
  if p_echeance is null then
    -- Sans échéance, la clé d'idempotence n'existe pas et chaque rejeu enverrait un courriel. On refuse
    -- plutôt que d'envoyer sans filet (patron `plafond_notification_invalide`, 0034).
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

revoke all     on function public.reserver_information_reconduction(uuid, text, timestamptz) from public, anon, authenticated;
grant  execute on function public.reserver_information_reconduction(uuid, text, timestamptz) to service_role;
