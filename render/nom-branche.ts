/**
 * nom-branche.ts — La validation du NOM d'une branche, côté RENDU, en UN SEUL EXEMPLAIRE.
 *
 * Pourquoi ce module existe (re-revue) : la classe des caractères sans glyphe était dupliquée dans
 * `render/arbre/ChampRenommage.tsx` (renommage, Story 4.6) et `render/conversation/PropositionBranche.tsx`
 * (naissance, Story 4.5). Le durcissement R1-bis n'a été appliqué QU'À la première : le chemin de la
 * NAISSANCE validait encore par un simple `.trim()`, donc son bouton s'activait pour des noms que la base
 * refuse toujours — l'app invitait alors à « réessayer » une requête qui ne pouvait jamais aboutir, sur un
 * écran où le caractère fautif est invisible par construction. Une seule copie, désormais.
 *
 * `render/` ne peut pas importer `lib/` (frontière AD-7) : cette classe est donc un MIROIR volontaire de
 * `public.branche_nom_significatif` (migration 0024) et de `lib/domain/branche.ts`. Les trois doivent rester
 * ÉQUIVALENTES — ni plus faibles (la base laisserait passer ce que l'app refuse), ni plus strictes (le bouton
 * resterait actif et la RPC lèverait un échec incompréhensible). Une garde de test verrouille l'équivalence.
 *
 * Les invisibles couverts, au-delà de `\s` : soft hyphen, CGJ, ALM, remplisseurs jamo/hangul, voyelles
 * inhérentes khmères, sélecteurs de variation mongols ET U+FE00–U+FE0F (présents dans presque tout
 * copier-coller d'emoji), largeurs nulles, marques directionnelles, braille blanc, annotations
 * interlinéaires, formatage musical, et les balises U+E0000–U+E01EF.
 */

const SANS_GLYPHE = /[\s\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\u{1d173}-\u{1d17a}\u{e0000}-\u{e01ef}]/gu;

/** La borne haute du nom, MIROIR du CHECK `branche_nom_borne` (migration 0023 : `length(nom) <= 300`). */
export const NOM_LONGUEUR_MAX = 300;

/** Reste-t-il quelque chose qui s'affiche, une fois les caractères sans glyphe retirés ? */
export const nomDonne = (nom: string) => nom.replace(SANS_GLYPHE, "").length > 0;

/** Le nom rogné comme le fera la base (`public.branche_rogner_nom`) — pour ne rien envoyer d'autre. */
export const rognerNom = (nom: string) => nom.replace(/^[\s\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\u{1d173}-\u{1d17a}\u{e0000}-\u{e01ef}]+|[\s\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\u{1d173}-\u{1d17a}\u{e0000}-\u{e01ef}]+$/gu, "");

/** Recevable = un nom réel ET dans la borne de la base. Les DEUX, comme le SQL. */
export const nomRecevable = (nom: string) => nomDonne(nom) && rognerNom(nom).length <= NOM_LONGUEUR_MAX;
