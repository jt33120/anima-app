/**
 * visuels.ts — QUELLES CARTES SONT DESSINÉES (Story 5.7, AC5 · FR-022).
 *
 * ── POURQUOI UN MANIFESTE PLUTÔT QU'UNE SONDE DE FICHIER ──────────────────────────────────────
 *
 * Le rendu ne peut pas interroger le disque, et une balise `<img>` pointant un fichier absent ne
 * « dit » rien : elle affiche l'icône d'image cassée du navigateur. Sur une carte de tirage, ce
 * serait la pire des sorties — un accident graphique là où le produit doit dire honnêtement qu'il
 * n'a pas encore de visuel.
 *
 * Le manifeste est donc DÉCLARATIF, et `tests/jeu-proprietaire.test.ts` vérifie deux choses :
 *   • chaque clé déclarée correspond à un fichier réellement présent sous `public/jeu/` ;
 *   • chaque clé déclarée est une carte du jeu (pas une clé fantôme survivant à un renommage).
 *
 * ── L'ENSEMBLE EST VIDE, ET C'EST L'ÉTAT HONNÊTE DU PRODUIT ───────────────────────────────────
 *
 * Les 21 visuels propriétaires (FR-022) sont une COMMANDE D'ART qui n'a pas encore été passée. Tant
 * qu'elle ne l'est pas, chaque carte le dit — même doctrine d'absence qu'en 5.6 pour les textes
 * d'Anima. Aucun dos de carte générique, aucune silhouette d'emprunt : un substitut « en attendant »
 * serait, littéralement, un visuel non créé pour Anima affiché à la place d'un visuel d'Anima.
 *
 * ⚠️ UN VISUEL NE COMPTE COMME DESSINÉ QUE SI SA DESCRIPTION EST ÉCRITE. Le composant exige les
 * deux, et le test l'exige aussi. Sans cette règle, la première image livrée s'afficherait avec un
 * texte alternatif vide : l'utilisatrice au lecteur d'écran recevrait « une image », c'est-à-dire
 * rien, et on lui demanderait ensuite ce qu'elle y voit.
 */

/** Le répertoire des visuels propriétaires. Aucun visuel n'est servi depuis ailleurs (FR-022). */
export const REPERTOIRE_VISUELS = "/jeu";

/** Le chemin du visuel d'une carte. */
export const cheminVisuel = (cle: string): string => `${REPERTOIRE_VISUELS}/${cle}.webp`;

/**
 * Les cartes dont le visuel est dessiné ET dont la description est écrite.
 *
 * Vide aujourd'hui. Se remplit une clé à la fois, à mesure que la commande d'art avance — et jamais
 * plus vite que les descriptions (voir l'en-tête).
 */
export const VISUELS_DESSINES: ReadonlySet<string> = Object.freeze(new Set<string>());
