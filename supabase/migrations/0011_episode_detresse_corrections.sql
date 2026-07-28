-- Migration forward-only — Story 2.4, correctifs de revue de code sur 0010.
--
-- 0010 est DÉJÀ déployée (local + cloud) → forward-only (invariant SPINE Opérations) : on corrige
-- PAR-DESSUS (ALTER + CREATE OR REPLACE + REVOKE), on ne réécrit jamais 0010. Trois trouvailles de
-- la revue max-effort (2026-07-28) :
--
--  F1 (least-privilege) — `branche_bloquee_par_detresse` ne révoquait EXECUTE que `from public`.
--     Or Supabase pose AUTOMATIQUEMENT un grant direct à `anon`/`authenticated` sur toute fonction
--     `public`, que `revoke from public` NE retire PAS (d'où le `revoke from anon` explicite de 0007).
--     → un client anon pouvait appeler la RPC (renvoyait false, mais surface anon rouverte). On ferme.
--
--  F2/F4 (concurrence) — sur une course d'ouverture (deux tours concurrents, aucun épisode ouvert),
--     le perdant heurtait `on conflict do nothing` puis `return true` SANS jamais fusionner niveau_max
--     via `greatest(...)` → update de niveau_max perdu (colonne monotone violée). On passe le ON
--     CONFLICT en DO UPDATE (greatest) : le perdant fusionne au lieu de ne rien faire.
--
--  F3 (extinction trop tôt) — le délai minimal était mesuré depuis `debut`. Pour un épisode ancien,
--     un pic tardif (niveau 3) suivi de quelques tours sûrs s'éteignait en minutes (la garde de délai
--     devenait un no-op). On mesure désormais depuis le DERNIER tour élevé (`dernier_niveau_eleve_le`),
--     réarmé à chaque ouverture ET rehausse — « jamais éteint trop tôt » redevient vrai après un pic tardif.

-- ── F3 : horloge du délai minimal = dernier tour élevé (≥ 1), pas l'ouverture ──────────────────────
-- Les lignes existantes (aucune en prod) : default now() est un point de départ sûr (au pire, délai
-- re-décompté une fois). NOT NULL cohérent avec `debut`.
alter table public.episode_detresse
  add column dernier_niveau_eleve_le timestamptz not null default now();

comment on column public.episode_detresse.dernier_niveau_eleve_le is
  'Story 2.4 (revue F3) : instant du dernier tour de niveau >= 1. Le délai minimal d''extinction se mesure depuis ICI (réarmé à chaque ouverture/rehausse), jamais depuis `debut` — sinon un pic tardif s''éteint trop tôt.';

-- ── F1 : fermer la surface anon (grant direct auto-posé, non retiré par `revoke from public`) ──────
revoke execute on function public.branche_bloquee_par_detresse() from anon;

-- ── F2/F4 + F3 : transition corrigée (CREATE OR REPLACE — même signature qu'en 0010) ───────────────
create or replace function public.enregistrer_tour_detresse(
  cible uuid, p_niveau int, p_seuil_tours int, p_duree_min_s int, p_fenetre_s int
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ep      public.episode_detresse;
  v_tours int;
begin
  -- Verrou de ligne (sérialise deux tours concurrents du même compte).
  select * into ep
    from public.episode_detresse
   where utilisatrice_id = cible and fin is null
   for update;

  if p_niveau >= 1 then
    if not found then
      -- OUVRE. F2/F4 : si une course a déjà ouvert (ON CONFLICT), on FUSIONNE niveau_max (greatest)
      -- au lieu de ne rien faire — plus jamais d'update de niveau_max perdu. Réarme aussi l'horloge (F3).
      insert into public.episode_detresse
        (utilisatrice_id, niveau_max, tours_surs_consecutifs, dernier_niveau_eleve_le)
      values (cible, p_niveau, 0, now())
      on conflict (utilisatrice_id) where (fin is null)
      do update set niveau_max = greatest(public.episode_detresse.niveau_max, excluded.niveau_max),
                    tours_surs_consecutifs = 0,
                    dernier_niveau_eleve_le = now();
      return true;
    end if;
    -- REHAUSSE : niveau_max monotone, série sûre cassée, horloge du délai RÉARMÉE (F3).
    update public.episode_detresse
       set niveau_max = greatest(niveau_max, p_niveau),
           tours_surs_consecutifs = 0,
           dernier_niveau_eleve_le = now()
     where id = ep.id;
    return true;
  end if;

  -- p_niveau = 0
  if not found then
    return false;  -- aucun épisode ouvert : rien à compter, limites non levées
  end if;

  v_tours := ep.tours_surs_consecutifs + 1;
  -- F3 : délai mesuré depuis le DERNIER tour élevé, pas depuis `debut`.
  if v_tours >= p_seuil_tours
     and now() - ep.dernier_niveau_eleve_le >= make_interval(secs => p_duree_min_s) then
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
