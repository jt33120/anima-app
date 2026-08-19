/**
 * regions.ts — Le CATALOGUE des régions de la scène + les types. Story 1.7 (AD-7).
 *
 * MODÈLE PUR : données seules, aucun import Next/React/DOM, aucun import `render/`.
 * La scène est UN monde continu ; les « régions » sont des cadrages de ce monde,
 * reliés en fondu (jamais des routes, jamais des écrans secs — cf. story Décision n°2).
 */

/** Les cadrages du monde. `seuil` = le rideau d’entrée ; les 3 autres = destinations. */
export type IdRegion = "seuil" | "accueil" | "anam" | "arbre";

export interface Region {
  readonly id: IdRegion;
  /** Libellé du lien nommé (doublage non-spatial de rang égal, UX-DR-37). */
  readonly nom: string;
  /** Apparaît dans la barre basse / le rail latéral (Accueil, Anam, L’arbre). */
  readonly destinationDirecte: boolean;
}

/**
 * Catalogue complet, dans l’ORDRE DE LECTURE LINÉAIRE garanti (AC3), indépendant
 * de la disposition spatiale. Le seuil ouvre le monde mais n’est pas une destination
 * de la barre : on n’y « retourne » pas, il se lève une fois.
 */
export const CATALOGUE_REGIONS: readonly Region[] = [
  { id: "seuil", nom: "Seuil", destinationDirecte: false },
  { id: "accueil", nom: "Accueil", destinationDirecte: true },
  { id: "anam", nom: "Anam", destinationDirecte: true },
  { id: "arbre", nom: "L’arbre", destinationDirecte: true },
] as const;

/** Les destinations nommées, dans l’ordre — source de la barre basse et du rail. */
export const REGIONS: readonly Region[] = CATALOGUE_REGIONS.filter(
  (r) => r.destinationDirecte,
);

/** Le rideau d’entrée : où l’on arrive en franchissant le seuil. */
export const REGION_ENTREE: IdRegion = "seuil";

/**
 * Le FOYER du monde : la région sur laquelle il s’ouvre une fois le seuil franchi.
 *
 * ⚠️ LE SEUIL SE FRANCHIT UNE FOIS, ET C’EST TOUT SON PROPOS. Il était rendu à CHAQUE chargement :
 * une porte posée devant une porte déjà ouverte, puisque les trois destinations étaient offertes
 * dans la barre juste en dessous. Quelqu’un qui revenait devait rouvrir un rideau qu’il avait
 * déjà levé, et n’avait aucune raison de comprendre ce que cet écran faisait là.
 */
export const REGION_FOYER: IdRegion = "accueil";

/**
 * La région où vit la conversation avec Anam. SOURCE UNIQUE (ne jamais coder « anam »
 * en dur ailleurs) : c’est elle qui, seule, porte la mention IA légale (FR-013, art. 50)
 * et le signe d’Anam dans la surimpression persistante (Story 1.8).
 */
export const REGION_CONVERSATION: IdRegion = "anam";

const IDS: readonly string[] = CATALOGUE_REGIONS.map((r) => r.id);

/** Garde de type : `v` est-il un identifiant de région connu ? */
export const estRegion = (v: string): v is IdRegion => IDS.includes(v);
