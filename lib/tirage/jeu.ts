/**
 * jeu.ts — LES 24 CARTES DU JEU D'ANIMA (Story 5.7, FR-015 / FR-016 / FR-022 · AD-11).
 *
 * ── CE FICHIER NE CONTIENT QUE DES IDENTITÉS ───────────────────────────────────────────────────
 *
 * Pas de sens, pas de description, pas de chemin d'image, pas de famille, pas d'ordre porteur. Une
 * carte, ici, est un NOM et rien d'autre.
 *
 * Ce n'est pas de la frugalité, c'est le cœur d'AD-11. Tout attribut supplémentaire posé ici
 * deviendrait un CRITÈRE DE CHOIX disponible pour l'échantillonneur, qui est le seul module à
 * importer ce fichier. Une carte qui saurait ce qu'elle veut dire pourrait être choisie pour ce
 * qu'elle veut dire — et « sélectionner une carte servant un message prédéterminé » est un DÉFAUT
 * CRITIQUE au sens littéral de FR-016.
 *
 * Le sens vit dans `lib/lecture/sens-cartes.ts`, sous `server-only`, et le tireur ne peut pas
 * l'importer (verrou ESLint sur `lib/tirage/**`). La description littérale vit dans
 * `lib/corpus/description-cartes.ts`. Les trois tables sont séparées PARCE QUE les réunir donnerait
 * au tirage exactement ce qu'on lui refuse.
 *
 * ── POURQUOI 24 ────────────────────────────────────────────────────────────────────────────────
 *
 *   • **Pas une puissance de deux.** `2**32 % 24 = 16 ≠ 0` : la zone de rejet de l'échantillonneur
 *     est NON VIDE, donc le chemin de rejet est réellement emprunté en production. Avec 32 cartes,
 *     `2**32 % 32 = 0`, la zone serait vide, et un échantillonneur biaisé (`mot % taille` sans
 *     rejet) deviendrait indiscernable d'un échantillonneur correct — y compris pour ses tests.
 *     Voir `alea.ts` : les gardes fixent leurs bornes en dur pour ne pas dépendre de ce nombre.
 *
 *   • **Assez grand** pour qu'un doublon ne soit pas la norme (deux lectures dans le mois retombent
 *     sur la même carte une fois sur 24) ;
 *
 *   • **Assez petit** pour que la commande d'art soit réelle : 24 visuels + 24 descriptions +
 *     24 créneaux de sens = 72 objets à produire. À 78 — la forme du tarot — ce serait 234, et on
 *     aurait emprunté la structure d'un jeu du commerce en croyant n'emprunter qu'un nombre.
 *
 * ── CE QUE LES NOMS SONT, ET CE QU'ILS NE SONT PAS ─────────────────────────────────────────────
 *
 * Chaque clé nomme une CHOSE QU'ON PEUT DESSINER : un puits, une barque, une braise. Aucune ne nomme
 * une idée (« le passage », « le renoncement ») — une carte nommée par une idée porterait son sens
 * dans son nom, et le sens ne doit exister que côté serveur.
 *
 * Ces clés sont INTERNES. L'UX interdit de nommer la carte à l'écran (« ne jamais faire : nommer la
 * carte avant la réponse »), et rien dans le produit ne les affiche. Elles identifient un visuel et
 * une ligne de journal, c'est tout.
 *
 * Aucun nom d'arcane, aucun jeu du commerce : `tests/jeu-proprietaire.test.ts` le vérifie et prouve
 * son balayage sur un faux jeu (FR-022).
 */

/** Une carte du jeu. Les cartes de l'ACCUEIL sont `CleCarte` / `CarteBibliotheque` (5.6) — rien à voir. */
export type CleCarteJeu =
  | "porte-entrouverte"
  | "pont"
  | "fontaine"
  | "racine"
  | "serrure"
  | "lanterne"
  | "nid"
  | "sentier"
  | "pierre-levee"
  | "metier-a-tisser"
  | "barque"
  | "escalier"
  | "fenetre"
  | "bourgeon"
  | "orage"
  | "braise"
  | "miroir-d-eau"
  | "mue"
  | "ruche"
  | "corde"
  | "carrefour"
  | "tamis"
  | "horizon"
  | "puits";

/**
 * Une carte : une clé, et rien d'autre.
 *
 * L'interface est volontairement à un seul champ plutôt que d'utiliser `CleCarteJeu` nu partout :
 * elle donne un endroit NOMMÉ où la tentation d'ajouter un attribut se verra en revue. Un jour
 * quelqu'un voudra y poser `poids`, `famille` ou `rarete` — et c'est précisément ce qu'AD-11
 * interdit, puisque le tireur est le seul lecteur de ce fichier.
 */
export interface CarteJeu {
  readonly cle: CleCarteJeu;
}

/**
 * Le jeu, gelé. L'ORDRE N'A AUCUN SENS : il n'est ni une progression, ni une hiérarchie, ni une
 * suite numérotée. C'est l'ordre d'un tableau, et l'échantillonneur tire un indice uniforme dedans.
 *
 * Ne jamais y introduire une notion de « première » ou de « dernière » carte : ce serait la première
 * marche vers une carte privilégiée.
 */
export const JEU: readonly CarteJeu[] = Object.freeze(
  (
    [
      "porte-entrouverte",
      "pont",
      "fontaine",
      "racine",
      "serrure",
      "lanterne",
      "nid",
      "sentier",
      "pierre-levee",
      "metier-a-tisser",
      "barque",
      "escalier",
      "fenetre",
      "bourgeon",
      "orage",
      "braise",
      "miroir-d-eau",
      "mue",
      "ruche",
      "corde",
      "carrefour",
      "tamis",
      "horizon",
      "puits",
    ] as const satisfies readonly CleCarteJeu[]
  ).map((cle) => Object.freeze({ cle })),
);

/** Les clés seules — pour les corpus (sens, descriptions), qui doivent déclarer un créneau par carte. */
export const CLES_JEU: readonly CleCarteJeu[] = Object.freeze(JEU.map((c) => c.cle));

/**
 * La taille du jeu. Elle est DÉRIVÉE, jamais écrite en dur : un compte écrit à la main devient faux
 * à la première carte ajoutée, et il deviendrait faux exactement là où il compte — la borne de
 * l'échantillonnage uniforme.
 */
export const TAILLE_JEU = JEU.length;

/**
 * Le jeu naît avec sa borne vérifiée. Un jeu vide ferait rendre `indiceUniforme` sur une borne nulle
 * (division par zéro, boucle infinie ou index hors bornes selon la faute) ; un jeu à une carte
 * rendrait un « tirage » constant qui passerait le χ² sans rien prouver.
 */
if (TAILLE_JEU < 2) {
  throw new Error(`jeu.ts : un jeu de ${TAILLE_JEU} carte(s) ne peut pas être tiré (AD-11).`);
}
