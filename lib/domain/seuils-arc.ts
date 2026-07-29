/**
 * Seuils de l'arc de séance (Story 2.7 — FR-002/003/004/007) — module PUR, SOURCE UNIQUE des
 * seuils, sur le patron d'`episode-detresse`. Ils sont passés à la machine `arc-seance` ; jamais
 * figés ailleurs (AD-14 / convention SPINE « paramètres lus à l'exécution »).
 *
 * ⚠️ PROVISOIRES — porte pré-lancement PRODUIT (et clinique/juriste pour tout ce qui borde la
 * détresse, PRD §Première séance). Ce sont l'INTENTION produit (12-20 min, ≥ 3 sujets, ≥ 2
 * reformulations…), NON un protocole validé. On code la MACHINE (quelle phase pour quels signaux),
 * jamais le jugement.
 */

/** construire → observer : nombre de sujets de vie distincts requis (FR-004). */
export const SEUIL_SUJETS = 3;
/** observer → nommer : reformulations émises requises (FR-004). */
export const SEUIL_REFORMULATIONS = 2;
/** observer → nommer & peutNommer : confirmations explicites requises (FR-004 / FR-007). */
export const SEUIL_CONFIRMATIONS = 1;
/** peutNommer : éléments personnels non sollicités requis (FR-007). */
export const SEUIL_ELEMENTS_PERSONNELS = 1;
/** nommer → clore : moments de restitution requis AVANT la clôture (FR-003). */
export const SEUIL_RESTITUTIONS = 3;
/** Niveau de détresse à partir duquel nommer est INTERDIT (FR-007). Lu du verdict, jamais re-détecté. */
export const NIVEAU_DETRESSE_BLOQUANT = 1;

/**
 * Durée cible d'une séance (FR-002) — 12 à 20 min. C'est un REPÈRE de télémétrie, JAMAIS une
 * coupure : `avancerArc` ne force aucune transition sur le temps (aucun minuteur nulle part).
 */
export const CIBLE_DUREE_MIN_MS = 12 * 60 * 1000;
export const CIBLE_DUREE_MAX_MS = 20 * 60 * 1000;
