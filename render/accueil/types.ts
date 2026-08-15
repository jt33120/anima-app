/**
 * types.ts — LE MODÈLE DE VUE DE LA BIBLIOTHÈQUE (Story 5.6, T7).
 *
 * ⚠️ POURQUOI CES TYPES SONT REDÉCLARÉS ICI PLUTÔT QU'IMPORTÉS DU DOMAINE.
 *
 * `render/` n'a pas le droit de connaître `lib/domain/` — c'est AD-7/AD-10, et c'est vérifié
 * (`tests/arc-architecture.test.ts` : « render ne dépend pas de lib/domain »). Le rendu dessine ce
 * qu'on lui donne ; il ne peut pas atteindre la couche qui décide. Même patron exactement que
 * `render/conversation/types.ts` pour l'ouverture (4.10).
 *
 * Le prix de cette frontière, c'est une forme déclarée des deux côtés — et c'est aussi ce qui en
 * fait une GARDE : `tests/bibliotheque-frontiere.test.ts` vérifie que les deux déclarations
 * coïncident, et surtout que **ni l'une ni l'autre** ne gagne un champ capable de porter un badge,
 * un compteur ou un cadenas (FR-031, AC2). La leçon de la 4.10 est que le compte fuit par le type ;
 * ici, il n'y a pas de type par où fuir.
 */

/** Une ligne de fait CALCULÉ, déjà mise en mots par le domaine. Le rendu ne formate rien. */
export interface LigneFaitVue {
  readonly intitule: string;
  readonly valeur: string;
}

/**
 * Le texte d'Anima — union transportée telle quelle depuis `lib/corpus/port`.
 *
 * ⚠️ NE JAMAIS L'APLATIR EN `string | undefined` ICI. Avec un optionnel, un `?? ""` quelque part
 * transformerait « Anima ne l'a pas encore écrit » en « il n'y a rien à dire », et les deux
 * s'afficheraient pareil. C'est exactement le troisième état que `lib/corpus/port` refuse.
 */
export type TexteVue = { readonly statut: "ecrit"; readonly texte: string } | { readonly statut: "non_ecrit" };

export interface CarteVue {
  readonly cle: string;
  readonly titre: string;
  readonly faits: readonly LigneFaitVue[];
  readonly texte: TexteVue;
}

/**
 * La carte « Anam » (Story 6.3, AC6). Trois chaînes, et RIEN d'autre.
 *
 * ⚠️ AUCUN CHAMP NUMÉRIQUE, ET AUCUN BOOLÉEN NON PLUS. Un `aUnMotif: boolean` serait la porte : le
 * rendu s'en servirait pour dessiner une pastille, et FR-031 ne tiendrait plus qu'à la discipline.
 * L'existence d'un motif se lit à `ligne !== null`, et cette information EST la ligne — il n'y a rien
 * à en extraire de plus.
 *
 * `presence` est la phrase invariante, identique pour tout le monde : elle ne peut rien laisser fuir.
 * `ligne` est la seule chose qui varie, et c'est du TEXTE DÉJÀ ÉCRIT — le rendu ne formate ni date, ni
 * mot, ni rien (AD-7).
 */
export interface CarteAnamVue {
  readonly titre: string;
  readonly presence: string;
  readonly ligne: string | null;
}

export interface BibliothequeVue {
  readonly cartes: readonly CarteVue[];
  /**
   * La carte d'Anam. REQUISE, et c'est la moitié de la garde : une carte qui apparaît et disparaît
   * selon qu'Anam a quelque chose à dire EST une pastille — simplement dessinée avec la carte au lieu
   * d'un point rouge. Le champ obligatoire interdit l'omission ; le `ligne: null` porte l'absence.
   */
  readonly anam: CarteAnamVue;
  /** La clé de la carte mise en avant, ou `null` si aucune n'a rien à montrer aujourd'hui. */
  readonly enAvant: string | null;
  /**
   * Le jour civil affiché sur la carte du ciel.
   *
   * Il est là pour une raison précise, reportée de la 5.4 : `lune_relative` ne change que tous les
   * ~2,5 jours, donc **le même texte d'horoscope sort deux à trois jours de suite**. Sans date,
   * deux jours identiques se liraient comme une application bloquée. Avec, ils se lisent comme
   * « le ciel n'a pas bougé » — ce qui est la vérité.
   */
  readonly jour: { readonly a: number; readonly m: number; readonly j: number };
}
