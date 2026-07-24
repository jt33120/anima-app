/**
 * regions.ts — Le CATALOGUE des régions de la scène + les types. Story 1.7 (AD-7).
 *
 * MODÈLE PUR : données seules, aucun import Next/React/DOM, aucun import `render/`.
 * La scène est UN monde continu ; les « régions » sont des cadrages de ce monde,
 * reliés en fondu (jamais des routes, jamais des écrans secs — cf. story Décision n°2).
 */

/** Les cadrages du monde. `seuil` = le rideau d'entrée ; les 3 autres = destinations. */
export type IdRegion = "seuil" | "accueil" | "anam" | "arbre";

export interface Region {
  readonly id: IdRegion;
  /** Libellé du lien nommé (doublage non-spatial de rang égal, UX-DR-37). */
  readonly nom: string;
  /** Apparaît dans la barre basse / le rail latéral (Accueil, Anam, L'arbre). */
  readonly destinationDirecte: boolean;
}

/**
 * Catalogue complet, dans l'ORDRE DE LECTURE LINÉAIRE garanti (AC3), indépendant
 * de la disposition spatiale. Le seuil ouvre le monde mais n'est pas une destination
 * de la barre : on n'y « retourne » pas, il se lève une fois.
 */
export const CATALOGUE_REGIONS: readonly Region[] = [
  { id: "seuil", nom: "Seuil", destinationDirecte: false },
  { id: "accueil", nom: "Accueil", destinationDirecte: true },
  { id: "anam", nom: "Anam", destinationDirecte: true },
  { id: "arbre", nom: "L'arbre", destinationDirecte: true },
] as const;

/** Les destinations nommées, dans l'ordre — source de la barre basse et du rail. */
export const REGIONS: readonly Region[] = CATALOGUE_REGIONS.filter(
  (r) => r.destinationDirecte,
);

/** Le rideau d'entrée : où l'on arrive en franchissant le seuil. */
export const REGION_ENTREE: IdRegion = "seuil";

const IDS: readonly string[] = CATALOGUE_REGIONS.map((r) => r.id);

/** Garde de type : `v` est-il un identifiant de région connu ? */
export const estRegion = (v: string): v is IdRegion => IDS.includes(v);
