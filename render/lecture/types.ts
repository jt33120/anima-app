/**
 * types.ts — LE MODÈLE DE VUE D'UNE CARTE TIRÉE (Story 5.7, T9).
 *
 * ⚠️ POURQUOI CES TYPES SONT REDÉCLARÉS ICI PLUTÔT QU'IMPORTÉS.
 *
 * `render/` n'a pas le droit de connaître `lib/domain/` (AD-7/AD-10, vérifié par
 * `tests/arc-architecture.test.ts`), et n'a surtout pas le droit d'atteindre `lib/lecture/`, qui
 * porte `server-only`. Même patron qu'en 5.6 pour la bibliothèque.
 *
 * ── LE CHAMP QUI N'EXISTE PAS EST LE PLUS IMPORTANT DU FICHIER ─────────────────────────────────
 *
 * `CarteTireeVue` porte `cle` et `description`. Elle NE PORTE PAS le sens, et ne le portera jamais :
 * AC4 exige qu'« aucune signification n'ait de représentation côté client avant la réponse de
 * l'utilisatrice ». Un champ `sens?: string` posé ici — même optionnel, même jamais rempli — serait
 * la porte par laquelle la signification traverserait un jour, et elle traverserait sans que rien ne
 * rougisse.
 *
 * C'est exactement la garde de la 5.6, où `terme` ne franchissait pas la frontière pour que le rendu
 * ne puisse pas déduire un cadenas. Ici l'enjeu est plus grand : le rendu ne doit pas pouvoir
 * déduire une lecture.
 *
 * `tests/tirage-frontiere.test.ts` vérifie que ce fichier ne gagne aucun champ de signification.
 *
 * ── ET LA `description` N'EN EST PAS UNE, DE SIGNIFICATION ─────────────────────────────────────
 *
 * Elle dit ce qui est DESSINÉ — « une porte entrouverte dans un mur de pierre, au crépuscule » —,
 * c'est-à-dire la matière que l'utilisatrice voyante reçoit par les yeux. Sans elle, une utilisatrice
 * au lecteur d'écran ne pourrait pas répondre à « qu'est-ce que tu vois ? ». Le balayage qui
 * l'empêche de dériver vers le sens vit dans `lib/corpus/description-cartes.ts`.
 */

/** Le texte d'un corpus — union transportée telle quelle, jamais aplatie en `string | undefined`. */
export type TexteVue = { readonly statut: "ecrit"; readonly texte: string } | { readonly statut: "non_ecrit" };

export interface CarteTireeVue {
  /** L'identité de la carte — elle désigne un visuel, elle ne s'affiche jamais (l'UX interdit de nommer la carte). */
  readonly cle: string;
  /** Ce qui est dessiné, pour le texte alternatif. Jamais ce que ça veut dire. */
  readonly description: TexteVue;
}
