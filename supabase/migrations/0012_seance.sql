-- Migration forward-only — Story 2.7 : la trace `seance` (arc construire → observer → nommer → clore).
--
-- La TRACE VÉRIFIABLE MAIS JAMAIS VISIBLE de l'arc (AC2). L'arc est STATEFUL (compteurs accumulés sur
-- toute la séance) : sans persistance, chaque tour HTTP repartirait de `construire`. La trace vit donc
-- dans une vraie table, sur le patron EXACT d'`episode_detresse` (0010) :
--
-- Posture : SERVER-AUTHORITATIVE, deny-by-default. Une trace de séance est une DÉCISION SERVEUR (la
--   phase et les compteurs sont calculés par la machine PURE `lib/domain/arc-seance`, jamais déclarés
--   par la cliente) — la personne ne doit JAMAIS pouvoir lire ni forger sa trace (sinon nommage
--   prématuré jouable). RLS activée + FORCE, AUCUNE policy : invisible et non-inscriptible sous une
--   session utilisatrice. La trace est DÉRIVÉE de la conversation (art. 9) → protégée au niveau art. 9,
--   chiffrée au repos. Les deux accès légitimes sont des fonctions SECURITY DEFINER (service_role).
--
-- SANS VERBATIM (AC2) : uniquement des SIGNAUX STRUCTURÉS (phase, compteurs, booléens, horodatages).
--   Aucune colonne de contenu — le journal verbatim 3 couches relève d'Epic 4 (AD-8).
--
-- AD-14 : ce SQL ne contient AUCUN seuil ni logique de transition. TOUTE la logique de phase (seuils
--   FR-004, conjonction FR-007, gate FR-005) vit dans la machine PURE `lib/domain/arc-seance` ; ce SQL
--   n'est qu'un STORE de signaux (rien à figer, rien à paramétrer côté base).
--
-- Périmètre 2.7 : UNE seule séance courante par utilisatrice (upsert sur `utilisatrice_id`). Le cycle
--   multi-séances (clôture → nouvelle séance) relève de 2.9 / Epic 4 (deferred-work).

create table public.seance (
  id                          uuid        primary key default gen_random_uuid(),
  utilisatrice_id             uuid        not null unique references public.utilisatrice(id) on delete cascade,
  phase                       text        not null default 'construire',
  sujets_abordes              int         not null default 0,
  a_reponse_longue            boolean     not null default false,
  reformulations              int         not null default 0,   -- reformulations ÉMISES par Anam
  confirmations               int         not null default 0,   -- reformulations CONFIRMÉES par l'utilisatrice
  elements_personnels         int         not null default 0,
  restitutions                int         not null default 0,
  deux_dernieres_propositions boolean[]   not null default array[false, false],  -- fenêtre glissante FR-007
  observation_delivree        boolean     not null default false,
  fin_proposee                boolean     not null default false,
  debut                       timestamptz not null default now(),  -- télémétrie de durée, jamais une coupure
  cree_le                     timestamptz not null default now(),
  mis_a_jour_le               timestamptz not null default now(),
  constraint seance_phase_valide      check (phase in ('construire', 'observer', 'nommer', 'clore')),
  constraint seance_props_paire       check (cardinality(deux_dernieres_propositions) = 2),
  constraint seance_compteurs_positifs check (
    sujets_abordes >= 0 and reformulations >= 0 and confirmations >= 0
    and elements_personnels >= 0 and restitutions >= 0
  )
);

create index seance_utilisatrice_idx on public.seance (utilisatrice_id);

alter table public.seance enable row level security;
alter table public.seance force  row level security;  -- aucune policy = deny-by-default

comment on table public.seance is
  'Story 2.7 : trace de l''arc de séance (construire/observer/nommer/clore). Server-authoritative deny-by-default (art. 9, dérivé de la conversation) : écrite/lue uniquement via fonctions security definer. Signaux structurés uniquement, JAMAIS de verbatim. Toute la logique de phase vit dans lib/domain/arc-seance (aucun seuil en SQL, AD-14).';

-- ── Lecture : charge la trace courante (service_role — pour le pipeline serveur, T4) ───────────────
-- `setof` (jamais un composite scalaire) : PostgREST renvoie un TABLEAU — vide = aucune trace (le
-- dépôt repart alors de l'état initial). Un `returns public.seance` renverrait un composite tout-à-null
-- au lieu de `null` sur zéro ligne (quirk PostgREST) → phase null en aval.
create or replace function public.charger_seance(cible uuid)
returns setof public.seance
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.seance s where s.utilisatrice_id = cible;
$$;

revoke all on function public.charger_seance(uuid) from public, anon, authenticated;
grant execute on function public.charger_seance(uuid) to service_role;

-- ── Écriture : upsert idempotent de la trace (service_role) ────────────────────────────────────────
-- La machine PURE a déjà calculé l'état ; cette fonction ne fait que le PERSISTER (aucune décision ici).
create or replace function public.ecrire_seance(
  cible uuid,
  p_phase text,
  p_sujets_abordes int,
  p_a_reponse_longue boolean,
  p_reformulations int,
  p_confirmations int,
  p_elements_personnels int,
  p_restitutions int,
  p_deux_dernieres_propositions boolean[],
  p_observation_delivree boolean,
  p_fin_proposee boolean,
  p_debut timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.seance (
    utilisatrice_id, phase, sujets_abordes, a_reponse_longue, reformulations, confirmations,
    elements_personnels, restitutions, deux_dernieres_propositions, observation_delivree,
    fin_proposee, debut, mis_a_jour_le
  ) values (
    cible, p_phase, p_sujets_abordes, p_a_reponse_longue, p_reformulations, p_confirmations,
    p_elements_personnels, p_restitutions, p_deux_dernieres_propositions, p_observation_delivree,
    p_fin_proposee, p_debut, now()
  )
  on conflict (utilisatrice_id) do update set
    phase = excluded.phase,
    sujets_abordes = excluded.sujets_abordes,
    a_reponse_longue = excluded.a_reponse_longue,
    reformulations = excluded.reformulations,
    confirmations = excluded.confirmations,
    elements_personnels = excluded.elements_personnels,
    restitutions = excluded.restitutions,
    deux_dernieres_propositions = excluded.deux_dernieres_propositions,
    observation_delivree = excluded.observation_delivree,
    fin_proposee = excluded.fin_proposee,
    debut = excluded.debut,
    mis_a_jour_le = now();
end;
$$;

revoke all on function public.ecrire_seance(
  uuid, text, int, boolean, int, int, int, int, boolean[], boolean, boolean, timestamptz
) from public, anon, authenticated;
grant execute on function public.ecrire_seance(
  uuid, text, int, boolean, int, int, int, int, boolean[], boolean, boolean, timestamptz
) to service_role;
