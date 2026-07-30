-- Migration forward-only — Story 2-4b : idempotence de `enregistrer_tour_detresse` au « Réessayer ».
--
-- Remédiation de la dette F4 (4.1, racine 2.4). 0010/0011 sont DÉJÀ déployées (local + cloud) →
-- forward-only (invariant SPINE Opérations) : on corrige PAR-DESSUS (ALTER + DROP/CREATE FUNCTION),
-- on ne réécrit jamais 0010/0011.
--
-- LE PROBLÈME — la RPC d'extinction n'avait aucune clé d'idempotence. Un « Réessayer » (2.2) rejoue
--   le même tour LOGIQUE (même jeton `cleIdempotence`, 3.4) → le pipeline sécurité (AD-16) tourne une
--   2ᵉ fois → `enregistrer_tour_detresse` ré-incrémente `tours_surs_consecutifs` pour CE MÊME tour. Si
--   ce double-comptage atteint le seuil un tour trop tôt (garde des 30 min déjà franchie), l'épisode
--   S'ÉTEINT PRÉMATURÉMENT → `limites_levees` retombe avant l'heure → paywall/quota réapparaissent au
--   cœur d'une détresse (affaiblissement AD-16/AD-17). Le nouveau 500 du journal (4.1) a élargi la
--   fenêtre : une panne DB banale, après le pipeline sécurité, déclenche désormais le retry.
--
-- LA CORRECTION — idempotence ASYMÉTRIQUE par le jeton de tour (`p_cle_tour`), estampillé sur la ligne
--   d'épisode (`dernier_tour_compte`) :
--     • chemin « tour SÛR » (niveau 0, épisode ouvert) → COURT-CIRCUITÉ si la clé est déjà celle du
--       dernier tour compté : no-op, renvoie l'état courant (c'est le SEUL chemin qui rapproche
--       l'extinction) ;
--     • chemin « ouvre / rehausse » (niveau >= 1) → JAMAIS court-circuité. La protection ne peut que
--       MONTER (AD-15 : le doute protège). Un « Réessayer » peut, par non-déterminisme du modèle,
--       classer plus haut qu'au 1ᵉʳ essai (0 → >= 1) : court-circuiter la rehausse SUPPRIMERAIT une
--       escalade de protection — exactement l'inverse de l'intention. Ce chemin est déjà idempotent
--       dans la bonne direction (`greatest`, compteur→0, ré-armement d'horloge ne font que RETARDER
--       l'extinction) ; il estampille la clé pour qu'un tour sûr ultérieur du même tour logique ne
--       re-compte pas.
--
-- POURQUOI UNE SEULE COLONNE (résidu accepté) — un « Réessayer » ne vise QUE le tour COURANT (un tour
--   n'avance qu'après succès). Le verrou `FOR UPDATE` sur l'épisode ouvert rend le check-and-set
--   atomique (deux POST concurrents du même tour sérialisent : le 1ᵉʳ compte, le 2ᵉ voit `dernier =
--   clé` → no-op). Une colonne suffit donc pour N re-tentatives + double-soumission concurrente du tour
--   courant.
--   RÉSIDU (borné, auto-cicatrisant, NON cascadant) : un doublon réseau HORS-ORDRE d'un tour SÛR
--   NON-courant (clé ≠ dernière) échapperait au court-circuit et ré-incrémenterait UNE fois. Au bord
--   (v_tours = seuil, délai franchi) cet unique incrément parasite pose `fin = now()` → c'est UNE
--   extinction prématurée (pas « juste un incrément ») → limites_levees retombe jusqu'au prochain tour
--   détresse, qui ROUVRE l'épisode (chemin escalade, jamais court-circuité). Il ne peut JAMAIS cascader :
--   dès `fin` posé, le `select … where fin is null` ne trouve plus rien → tout rejeu ultérieur est INERTE
--   (`not found` → return false, aucun incrément) ; le dommage plafonne à UNE extinction. Déclencheur
--   non atteignable via le flux réel (conversation sérialisée ; « Réessayer » = MÊME clé sur le tour
--   courant → court-circuité ; concurrence sérialisée par FOR UPDATE) : il faudrait un retard réseau
--   d'un cycle de tour entier. Un keying complet (table/array `tours_comptes`) serait une croissance non
--   bornée sur une entité délibérément minimale : sur-ingénierie pour un résidu déjà dominé.

-- ── Colonne d'idempotence (art. 9-safe : UUID opaque, jamais de contenu — patron `usage_ia`) ────────
-- NULLable, sans défaut : NULL n'égale jamais une clé canonique → aucun court-circuit fantôme sur les
-- lignes pré-existantes (aucune en prod).
alter table public.episode_detresse
  add column dernier_tour_compte text;

comment on column public.episode_detresse.dernier_tour_compte is
  'Story 2-4b (F4) : clé du DERNIER tour logique enregistré (jeton de tour 3.4). Idempotence au « Réessayer » — un rejeu du MÊME tour sûr (niveau 0) ne re-compte pas → jamais d''extinction prématurée (AD-16/AD-17). UUID opaque, jamais de contenu (art. 9-safe).';

-- ── La signature CHANGE (ajout de p_cle_tour) → DROP l'ancienne 5-args (pas un overload orphelin) ───
-- puis CREATE la 6-args. Aucun appelant restant du 5-args (seul `lib/safety/depot-episode.ts` appelle,
-- via 6 arguments nommés).
drop function if exists public.enregistrer_tour_detresse(uuid, int, int, int, int);

create function public.enregistrer_tour_detresse(
  cible uuid, p_niveau int, p_seuil_tours int, p_duree_min_s int, p_fenetre_s int, p_cle_tour text
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
    -- ESCALADE : JAMAIS court-circuitée (la protection ne peut que monter, AD-15). Estampille la clé
    -- pour qu'un tour SÛR ultérieur du MÊME tour logique (retry mixte 0→>=1) ne re-compte pas.
    if not found then
      -- OUVRE. F2/F4 (0011) : fusionne niveau_max sur une course d'ouverture (greatest) ; réarme l'horloge (F3).
      insert into public.episode_detresse
        (utilisatrice_id, niveau_max, tours_surs_consecutifs, dernier_niveau_eleve_le, dernier_tour_compte)
      values (cible, p_niveau, 0, now(), p_cle_tour)
      on conflict (utilisatrice_id) where (fin is null)
      do update set niveau_max = greatest(public.episode_detresse.niveau_max, excluded.niveau_max),
                    tours_surs_consecutifs = 0,
                    dernier_niveau_eleve_le = now(),
                    dernier_tour_compte = excluded.dernier_tour_compte;
      return true;
    end if;
    -- REHAUSSE : niveau_max monotone, série sûre cassée, horloge du délai RÉARMÉE (F3), clé estampillée.
    update public.episode_detresse
       set niveau_max = greatest(niveau_max, p_niveau),
           tours_surs_consecutifs = 0,
           dernier_niveau_eleve_le = now(),
           dernier_tour_compte = p_cle_tour
     where id = ep.id;
    return true;
  end if;

  -- p_niveau = 0
  if not found then
    return false;  -- aucun épisode ouvert : rien à compter, limites non levées (inhéremment idempotent)
  end if;

  -- IDEMPOTENCE (Story 2-4b) : ce tour SÛR a-t-il déjà été compté ? Court-circuit → aucun ré-incrément,
  -- réponse IDENTIQUE au 1ᵉʳ appel. Sous le `FOR UPDATE`, ce check-and-set est atomique (retry + concurrence).
  if ep.dernier_tour_compte is not null and ep.dernier_tour_compte = p_cle_tour then
    return ep.fin is null;  -- ici : épisode ouvert (on l'a verrouillé sur `fin is null`) → true
  end if;

  v_tours := ep.tours_surs_consecutifs + 1;
  -- F3 : délai mesuré depuis le DERNIER tour élevé, pas depuis `debut`.
  if v_tours >= p_seuil_tours
     and now() - ep.dernier_niveau_eleve_le >= make_interval(secs => p_duree_min_s) then
    -- ÉTEINT (légitime : seuil de tours DISTINCTS + délai). Estampille la clé (idempotence du rejeu de
    -- CE tour d'extinction : rejoué, l'épisode est déjà clos → le SELECT `fin is null` le manque → false).
    update public.episode_detresse
       set fin = now(),
           fenetre_expire_at = now() + make_interval(secs => p_fenetre_s),
           tours_surs_consecutifs = v_tours,
           dernier_tour_compte = p_cle_tour
     where id = ep.id;
    return false;  -- limites RETOMBÉES (épisode fermé)
  end if;

  -- COMPTE : encore ouvert. Estampille la clé de CE tour logique.
  update public.episode_detresse
     set tours_surs_consecutifs = v_tours,
         dernier_tour_compte = p_cle_tour
   where id = ep.id;
  return true;
end;
$$;

revoke all on function public.enregistrer_tour_detresse(uuid, int, int, int, int, text)
  from public, anon, authenticated;
grant execute on function public.enregistrer_tour_detresse(uuid, int, int, int, int, text)
  to service_role;
