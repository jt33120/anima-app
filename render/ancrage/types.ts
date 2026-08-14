/**
 * types.ts — LE MODÈLE DE VUE DE L'ANCRAGE (Story 5.9, T5).
 *
 * ⚠️ POURQUOI CES TYPES SONT REDÉCLARÉS ICI PLUTÔT QU'IMPORTÉS DU DOMAINE.
 *
 * `render/` n'a pas le droit de connaître `lib/domain/` — c'est AD-7/AD-10, et c'est vérifié
 * (`tests/arc-architecture.test.ts`). Même patron que `render/accueil/types.ts` (5.6) et
 * `render/conversation/types.ts` (4.10).
 *
 * ── CE QUE CES TYPES NE PEUVENT PAS PORTER (FR-031) ───────────────────────────────────────────
 *
 * Aucun champ ne peut porter un badge, un compteur d'inventaire, un cadenas ni un verrou. La leçon
 * de la 4.10 est que **le compte fuit par le type** : s'il n'existe pas de champ où l'écrire, il n'y
 * a rien à masquer au rendu. `tests/ancrage-frontiere.test.ts` refuse l'apparition de `total`,
 * `restant`, `verrouille`, `premium`, `badge`, `nouveau`.
 *
 * ── ET POURQUOI `texte` EST UNE `string`, ALORS QUE PARTOUT AILLEURS C'EST UNE UNION ───────────
 *
 * Ailleurs (`render/accueil/types.ts`) on transporte `TexteCorpus` jusqu'au rendu, parce que la
 * carte doit AFFICHER honnêtement le créneau non écrit. Ici non : un exercice guidé à trous n'est
 * pas un exercice court, c'est un exercice cassé — on ne traverse pas cinq temps dont trois sont
 * vides. `estTraversable` (domaine) écarte donc l'ancrage incomplet AVANT le rendu, et ce qui arrive
 * ici est intégralement écrit. Le troisième état est dit une seule fois, au niveau de la halte.
 */

export interface TempsVue {
  /** Le texte du temps, écrit par Anima. Jamais vide — l'ancrage incomplet n'atteint pas le rendu. */
  readonly texte: string;
}

export interface AncrageVue {
  readonly cle: string;
  readonly titre: string;
  readonly temps: readonly TempsVue[];
}

/** Les mots des commandes, passés depuis le serveur : `render/` ne connaît pas `lib/domain`. */
export interface MotsAncrage {
  readonly avancer: string;
  readonly terminer: string;
  readonly traverse: string;
}
