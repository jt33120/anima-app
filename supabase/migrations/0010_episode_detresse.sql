-- Migration forward-only — Story 2.4 : l'entité `episode_detresse` (AD-17, FR-042, FR-046).
--
-- SOURCE UNIQUE DE VÉRITÉ des règles vitales de détresse. Deux dérivations DISTINCTES en sortent :
--   • `limites_levees` = `fin IS NULL` (épisode OUVERT)  → gouverne paywall/quota/bilan (AD-9) ;
--   • garde de branche = ouvert OU `now() < fenetre_expire_at` (72 h après) → « aucune branche née
--     d'un épisode » (FR-042, AD-8) — PLUS LARGE que limites_levees.
--
-- Posture (AC3) : SERVER-AUTHORITATIVE, deny-by-default (patron `usage_ia`/`audit_securite`, PAS
--   `art9_temoin`). Un épisode est une DÉCISION DE SÉCURITÉ écrite par le serveur — la personne ne
--   « déclare » jamais sa détresse et ne doit JAMAIS pouvoir fermer/forger son épisode (sinon
--   extinction/paywall jouables). RLS activée + FORCE, AUCUNE policy : la table est invisible et
--   non-inscriptible sous une session utilisatrice. Elle révèle un état de santé mentale → protégée
--   au niveau art. 9, chiffrée au repos, exclue de toute analyse (entité séparée du journal, FR-046).
--   Les deux accès légitimes sont des fonctions SECURITY DEFINER (ci-dessous).
--
-- Les SEUILS d'extinction ne sont JAMAIS figés dans le SQL (AD-14 / convention SPINE) : la fonction
--   de transition les REÇOIT en arguments ; leurs valeurs (provisoires, porte clinique) vivent dans
--   `lib/safety/episode-detresse`.

create table public.episode_detresse (
  id                     uuid        primary key default gen_random_uuid(),
  utilisatrice_id        uuid        not null references public.utilisatrice(id) on delete cascade,
  debut                  timestamptz not null default now(),  -- base du délai minimal d'extinction
  niveau_max             int         not null,                -- plus haut niveau atteint (1-3), monotone
  fin                    timestamptz,                         -- NULL = ouvert → limites_levees en dérive
  fenetre_expire_at      timestamptz,                         -- posé à l'extinction = fin + 72 h
  tours_surs_consecutifs int         not null default 0,      -- compteur d'extinction (remis à 0 si niveau ≥ 1)
  constraint episode_niveau_max_valide  check (niveau_max between 1 and 3),
  constraint episode_fin_apres_debut    check (fin is null or fin >= debut),
  -- La fenêtre 72 h NAÎT avec l'extinction : les deux sont null (ouvert) ou non-null (fermé) ensemble.
  constraint episode_fenetre_coherente  check ((fin is null) = (fenetre_expire_at is null))
);

-- UN SEUL épisode ouvert par utilisatrice (défense en profondeur au-delà de la sérialisation
-- applicative) : deux tours concurrents ne peuvent jamais ouvrir deux épisodes.
create unique index episode_detresse_ouvert_unique
  on public.episode_detresse (utilisatrice_id) where (fin is null);
create index episode_detresse_utilisatrice_idx on public.episode_detresse (utilisatrice_id);

alter table public.episode_detresse enable row level security;
alter table public.episode_detresse force  row level security;  -- aucune policy = deny-by-default

comment on table public.episode_detresse is
  'Story 2.4 (AD-17) : entité de détresse possédée par le serveur. limites_levees dérive de fin IS NULL ; fenêtre 72 h de fenetre_expire_at. Server-authoritative deny-by-default (art. 9, FR-046) : écrite/lue uniquement via fonctions security definer. Jamais de contenu (art. 9-safe).';

-- ── Transition ATOMIQUE possédée : un tour classé ─────────────────────────────────────────────────
-- « Transition d'extinction unique et possédée » (AD-17). Reçoit le niveau DÉTECTÉ BRUT (jamais
-- l'effectif forcé — sinon inextinguible) et les SEUILS en arguments (jamais de littéral ici).
-- Race-safe : verrou de ligne sur l'épisode ouvert (patron `appliquer_barriere_minorite`/0006).
-- Retourne `limites_levees` APRÈS le tour, pour éviter un aller-retour de lecture au pipeline.
create or replace function public.enregistrer_tour_detresse(
  cible uuid, p_niveau int, p_seuil_tours int, p_duree_min_s int, p_fenetre_s int
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ep     public.episode_detresse;
  v_tours int;
begin
  -- Verrou de ligne (sérialise deux tours concurrents du même compte).
  select * into ep
    from public.episode_detresse
   where utilisatrice_id = cible and fin is null
   for update;

  if p_niveau >= 1 then
    if not found then
      -- OUVRE (on conflict : un tour concurrent a déjà ouvert — l'épisode existe, limites levées).
      insert into public.episode_detresse (utilisatrice_id, niveau_max, tours_surs_consecutifs)
      values (cible, p_niveau, 0)
      on conflict (utilisatrice_id) where (fin is null) do nothing;
      return true;
    end if;
    -- REHAUSSE : niveau_max monotone, série sûre cassée (compteur remis à 0).
    update public.episode_detresse
       set niveau_max = greatest(niveau_max, p_niveau),
           tours_surs_consecutifs = 0
     where id = ep.id;
    return true;
  end if;

  -- p_niveau = 0
  if not found then
    return false;  -- aucun épisode ouvert : rien à compter, limites non levées
  end if;

  v_tours := ep.tours_surs_consecutifs + 1;
  if v_tours >= p_seuil_tours
     and now() - ep.debut >= make_interval(secs => p_duree_min_s) then
    -- ÉTEINT : fin + fenêtre 72 h (durée reçue en argument, jamais figée).
    update public.episode_detresse
       set fin = now(),
           fenetre_expire_at = now() + make_interval(secs => p_fenetre_s),
           tours_surs_consecutifs = v_tours
     where id = ep.id;
    return false;  -- limites RETOMBÉES (épisode fermé)
  end if;

  -- COMPTE : encore ouvert.
  update public.episode_detresse
     set tours_surs_consecutifs = v_tours
   where id = ep.id;
  return true;
end;
$$;

revoke all on function public.enregistrer_tour_detresse(uuid, int, int, int, int) from public, anon, authenticated;
grant execute on function public.enregistrer_tour_detresse(uuid, int, int, int, int) to service_role;

-- ── Dérivation 1 : épisode ouvert ? (service_role — lecture serveur pour le pipeline) ─────────────
create or replace function public.episode_detresse_ouvert(cible uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.episode_detresse e
    where e.utilisatrice_id = cible and e.fin is null
  );
$$;

revoke all on function public.episode_detresse_ouvert(uuid) from public, anon, authenticated;
grant execute on function public.episode_detresse_ouvert(uuid) to service_role;

-- ── Dérivation 2 : garde de branche (couture Epic 4) ──────────────────────────────────────────────
-- Sans paramètre, keyée sur auth.uid() (patron `est_barre_minorite` — pas d'oracle inter-utilisatrices,
-- acquis revue 1.6), granted `authenticated` : le futur write-gate de `branche` (Epic 4) l'appellera
-- dans son WITH CHECK. Bloque tant que l'épisode est OUVERT ou dans les 72 h suivant l'extinction.
create or replace function public.branche_bloquee_par_detresse()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.episode_detresse e
    where e.utilisatrice_id = (select auth.uid())
      and (e.fin is null or e.fenetre_expire_at > now())
  );
$$;

revoke all on function public.branche_bloquee_par_detresse() from public;
grant execute on function public.branche_bloquee_par_detresse() to authenticated;
