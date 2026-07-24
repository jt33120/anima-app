/**
 * projection.ts — La DOMAIN-PROJECTION serveur, en LECTURE SEULE (SPINE L155 + AD-7 :
 * « lib/scene/ projette l'état max »). Story 1.7.
 *
 * Le rendu ne l'ÉCRIT JAMAIS : il la reçoit en props et la dessine. La monotonie de
 * l'arbre (les branches ne régressent pas — AD-8) est gardée à l'écriture par le SQL,
 * jamais par le rendu. En 1.7 c'est un STUB (tronc présent, aucune branche) : la
 * frontière et le type sont posés ; l'Epic 4 remplira `branches` depuis l'état persisté.
 */

export interface ProjectionScene {
  readonly tronc: { readonly present: true };
  /** Epic 4 élargira ce type ; en 1.7 la liste est vide et gelée (lecture seule réelle). */
  readonly branches: readonly [];
  /**
   * Niveau d'éveil, 0→100. Scalaire interne qui pilote la croissance de l'arbre.
   * JAMAIS affiché en chiffre à l'utilisatrice (on ne note pas les gens) — l'arbre EST
   * le retour. Calculé serveur depuis le parcours (Epic 4) ; STUB en 1.7 (valeur fixe,
   * ajustable). La monotonie (l'éveil ne régresse pas — AD-8) est garantie côté modèle.
   */
  readonly eveil: number;
}

export const projectionInitiale: ProjectionScene = Object.freeze({
  tronc: Object.freeze({ present: true as const }),
  branches: Object.freeze([] as const),
  eveil: 62, // placeholder : arbre feuillu, calme, sans fruit — à piloter par l'Epic 4
});
