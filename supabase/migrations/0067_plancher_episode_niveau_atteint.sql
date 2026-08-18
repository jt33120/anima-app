-- Migration forward-only — revue des Epics 1 à 4 (trouvaille critique #2, second volet).
--
-- ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
--
-- Le pipeline (2.3/2.4) force `niveauEffectif = max(niveauDétecté, épisodeOuvert ? 1 : 0)`. Le
-- plancher vaut donc UN, quel que soit le niveau ATTEINT par l'épisode. Or le bloc de numéros
-- d'urgence n'est émis qu'à partir du niveau 2.
--
-- Conséquence, sur le chemin le plus banal qui soit : une femme classée « idéation active » (niveau 3)
-- au tour N ; au tour N+1 le fournisseur est dégradé, `repliSur()` rend niveau 1, le plancher rend 1
-- — et l'écran cesse de porter le moindre numéro, alors que l'épisode est TOUJOURS OUVERT et que
-- l'entité `episode_detresse` sait, elle, qu'il a atteint 3.
--
-- Le forçage disait « fort pour tout l'épisode ». Il ne tenait que la moitié de sa promesse : il
-- gardait le TIER de modèle, pas le NIVEAU de réponse.
--
-- ══ LE CORRECTIF ════════════════════════════════════════════════════════════════════════════════
--
-- `niveau_plancher_episode()` rend le `niveau_max` de l'épisode OUVERT (0 s'il n'y en a pas). C'est
-- la même ligne, la même colonne, déjà monotone par `enregistrer_tour_detresse` (« rehausse :
-- niveau_max monotone »). Rien de neuf n'est écrit : ce qui manquait, c'est de le LIRE.
--
-- ⚠️ ET `episode_detresse_ouvert` EN DÉRIVE DÉSORMAIS, au lieu d'interroger la table une seconde
-- fois. Deux lectures de « où en est l'épisode » finiraient par ne plus dire la même chose — c'est
-- la leçon R1 de ce dépôt, payée assez de fois. Une seule connaît la table ; l'autre la questionne.
--
-- Privilèges : patron 0010 — révoqué de public/anon/authenticated, exécutable par service_role seul.
-- L'épisode est possédé par le serveur (AD-17) ; la cliente n'en lit jamais rien directement.

create or replace function public.niveau_plancher_episode(cible uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  -- `episode_detresse_ouvert_unique` garantit AU PLUS un épisode ouvert : le scalaire ne peut pas
  -- rendre plusieurs lignes. `coalesce` traduit « aucun épisode » en « aucun plancher ».
  select coalesce((
    select e.niveau_max
      from public.episode_detresse e
     where e.utilisatrice_id = cible and e.fin is null
  ), 0);
$$;

revoke all on function public.niveau_plancher_episode(uuid) from public, anon, authenticated;
grant execute on function public.niveau_plancher_episode(uuid) to service_role;

comment on function public.niveau_plancher_episode(uuid) is
  'Revue Epics 1-4 : plancher de niveau d''un épisode OUVERT = son niveau ATTEINT (niveau_max), 0 sinon. Le pipeline force max(détecté, plancher) — un repli de fournisseur ne peut plus faire retomber une idéation active sous le seuil du bloc de ressources. `episode_detresse_ouvert` en dérive (une seule lecture de la table).';

-- `episode_detresse_ouvert` : MÊME contrat, MÊME signature, MÊMES privilèges — elle dérive.
create or replace function public.episode_detresse_ouvert(cible uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.niveau_plancher_episode(cible) > 0;
$$;
