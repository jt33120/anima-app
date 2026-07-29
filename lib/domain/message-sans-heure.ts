/**
 * message-sans-heure.ts — La formulation « sans heure de naissance » (Story 2.7, T6 — AC1, FR-011/FR-050).
 *
 * COUTURE INERTE : aucun consommateur aujourd'hui. La CAPTURE du prénom (colonne absente du schéma →
 * refonte onboarding) et le CALCUL de « ce qui reste disponible sans l'heure » (numérologie / soleil /
 * planètes vs ascendant / maisons / Lune, FR-049) relèvent du SOCLE (Epic 4). 2.7 livre l'INVARIANT
 * non-bloquant (la machine d'arc n'a AUCUNE précondition de profil, FR-010) + cette formulation
 * PROVISOIRE, SANS la câbler à une donnée inexistante — exactement comme `estLendemainDEpisode` (2.6).
 *
 * ⚠️ PROVISOIRE — porte pré-lancement produit. Registre Anam ; la voix complète est la Story 2.8.
 * ⚠️ Non-bloquant (FR-010) : sans l'heure, la séance ne se bloque JAMAIS jusqu'au bilan — Anam
 *    explique ce qui reste disponible ET où l'ajouter, puis poursuit.
 */
export const MESSAGE_SANS_HEURE =
  "Il me manque ton heure de naissance. Sans elle, je préfère ne pas inventer l'ascendant, les " +
  "maisons ni la position exacte de la Lune — mais tout le reste est là : ton soleil, tes planètes, " +
  "ta numérologie. Tu pourras l'ajouter plus tard dans ton profil ; on avance sans, rien ne se bloque.";
