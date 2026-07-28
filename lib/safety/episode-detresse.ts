/**
 * Seuils d'extinction de l'épisode de détresse (Story 2.4) — module PUR, SOURCE UNIQUE des seuils.
 *
 * La LOGIQUE de transition (ouvre / rehausse / compte / éteint) vit dans le SQL possédé
 * `enregistrer_tour_detresse` (atomique, race-safe — migrations 0010/0011) : c'est la seule
 * implémentation autoritaire, prouvée par les tests SQL réels (`tests/episode-detresse.test.ts`).
 * Ici, uniquement les seuils — passés EN ARGUMENTS au SQL, jamais figés là-bas (AD-14 / convention
 * SPINE « paramètres lus à l'exécution »).
 *
 * ⚠️ PROVISOIRES — porte pré-lancement clinique (PRD §5) : `SEUIL_TOURS_SURS` et `DUREE_MIN_EPISODE_MS`
 * sont des placeholders de seuillage de sécurité, à valider par un professionnel qualifié.
 */

/** 72 h (FR-042) — fenêtre pendant laquelle, après extinction, aucune branche ne peut naître. */
export const FENETRE_POST_EPISODE_MS = 72 * 60 * 60 * 1000;

/** Tours SÛRS consécutifs (niveau 0) requis pour éteindre un épisode. */
export const SEUIL_TOURS_SURS = 3;

/** Délai minimal depuis le DERNIER tour élevé (≥ 1) avant toute extinction — jamais éteint trop tôt. */
export const DUREE_MIN_EPISODE_MS = 30 * 60 * 1000; // 30 min
