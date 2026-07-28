/**
 * lendemain.ts — le prédicat PUR « le lendemain d'un épisode » (Story 2.6, FR-045, AC5).
 *
 * COUTURE INERTE : aucun consommateur aujourd'hui. La reprise « en une phrase » exige la MÉMOIRE de
 * conversation (Epic 4) ; la suppression de la notif du socle exige l'ORDONNANCEUR (non bâti). 2.6
 * livre la MACHINE (la logique de récence), SANS I/O ni horloge cachée : la date est INJECTÉE. Un
 * futur consommateur (Epic 4) lira `episode_detresse` et appellera ce prédicat.
 *
 * ⚠️ Interdit d'interface (AC5) : le lendemain, RIEN dans l'UI ne rappelle l'épisode — pas de bandeau,
 * pas de carte « comment vas-tu », pas de « suivi ». Anam reprend en une phrase, et c'est tout.
 * ⚠️ Fenêtre PROVISOIRE — porte clinique (comme les seuils d'extinction, `episode-detresse`).
 */

/** Fenêtre « lendemain » : un épisode clos depuis peu (≤ 36 h) reste « frais » pour une reprise douce. */
export const FENETRE_LENDEMAIN_MS = 36 * 60 * 60 * 1000;

/** État minimal d'un épisode clos, tel qu'un futur lecteur (Epic 4) le fournira. */
export interface EpisodeClos {
  /** Instant de clôture (`episode_detresse.fin`), ou `null` si l'épisode est encore ouvert. */
  readonly fin: Date | null;
  /** Niveau maximum atteint pendant l'épisode (`niveau_max`). */
  readonly niveauMax: number;
}

/**
 * Vrai si l'on est « le lendemain » d'un épisode NOTABLE : clos (fin non nulle), de niveau ≥ 2, et
 * clos DANS la fenêtre (ni dans le futur, ni trop ancien). Le doute penche vers NE RIEN DIRE (`false`) :
 * jamais une reprise fabriquée sur un état incertain — l'absence de reprise est toujours sûre (AC5).
 */
export function estLendemainDEpisode(episode: EpisodeClos, maintenant: Date): boolean {
  if (episode.fin === null) return false; // encore ouvert → on n'est pas « le lendemain »
  if (episode.niveauMax < 2) return false; // détresse marquée sans idéation → aucune reprise
  const ecoule = maintenant.getTime() - episode.fin.getTime();
  return ecoule > 0 && ecoule <= FENETRE_LENDEMAIN_MS;
}
