/**
 * jeu.ts — LES 21 CARTES DU JEU D'ANIMA (Stories 5.7 puis 5.10, FR-015 / FR-016 / FR-022 · AD-11).
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
 * ── D'OÙ VIENNENT CES VINGT ET UNE CARTES (Story 5.10) ─────────────────────────────────────────
 *
 * Les vingt-quatre noms de la 5.7 avaient été inventés en juillet, en attendant qu'Anima se
 * prononce. Elle s'est prononcée : elle a retiré six cartes (`puits`, `corde`, `fontaine`, `nid`,
 * `metier-a-tisser`, `orage`) — elle avait coché « les images sombres, tristes ou angoissantes »
 * parmi ce qu'elle ne veut JAMAIS voir. Une image résiste par son ambiguïté, pas par sa noirceur.
 *
 * Trois cartes entrent : `fleur` (son emblème), `oiseau` (rien ne volait dans le jeu), et `seuil`
 * — une ligne au sol, une dalle usée, SANS porte dans le cadre : le lieu du franchissement sans
 * l'objet qui le permet.
 *
 * ⚠️ `seuil` est de NOTRE main, pas de la sienne, et c'est écrit ici pour que personne ne l'oublie
 * en relisant la liste. Elle figure dans les arbitrages à lui soumettre. Si elle la refuse, le jeu
 * tombe à vingt et rien d'autre ne bouge — aucun compte n'est écrit en dur dans ce code.
 *
 * ── POURQUOI VINGT ET UNE ──────────────────────────────────────────────────────────────────────
 *
 *   • **Zone de rejet non vide.** `2**32 = 204 522 252 × 21 + 4` : quatre indices sur vingt et un
 *     ont une chance de plus que les dix-sept autres si l'on écrit `mot % 21` sans rejet. La queue
 *     incomplète existe donc, et le chemin de rejet de `alea.ts` est RÉELLEMENT emprunté en
 *     production. Avec 32 cartes, `2**32 % 32 = 0`, la queue serait vide, et un échantillonneur
 *     biaisé deviendrait indiscernable d'un échantillonneur correct — y compris pour ses tests.
 *     Vingt et un étant premier, `2**32 % 21` ne peut pas valoir zéro : la propriété tient par
 *     construction, elle ne tient plus par chance. Voir `alea.ts`.
 *
 *   • **Assez grand** pour qu'un doublon ne soit pas la norme (deux lectures dans le mois retombent
 *     sur la même carte une fois sur 21 — c'était une fois sur 24, et c'est le seul argument de la
 *     5.7 que la réduction affaiblit) ;
 *
 *   • **Assez petit** pour que la commande d'art soit réelle : 21 visuels + 21 descriptions +
 *     21 créneaux de sens = 63 objets à produire. À 78 — la forme du tarot — ce serait 234, et on
 *     aurait emprunté la structure d'un jeu du commerce en croyant n'emprunter qu'un nombre.
 *
 * ⚠️ Vingt et un est aussi le nombre des arcanes majeurs NUMÉROTÉS du tarot (0 à 21 en font 22).
 * La coïncidence a été examinée et écartée en 5.10 : un nombre ne porte pas une structure. Ce jeu
 * n'a ni numérotation, ni ordre, ni hiérarchie, ni famille — et la garde qui compte porte sur les
 * NOMS (`tests/jeu-proprietaire.test.ts`, prouvée sur un faux jeu).
 *
 * ── CE QUE LES NOMS SONT, ET CE QU'ILS NE SONT PAS ─────────────────────────────────────────────
 *
 * Chaque clé nomme une CHOSE QU'ON PEUT DESSINER : un pont, une barque, une braise. Aucune ne nomme
 * une idée (« le passage », « le renoncement ») — une carte nommée par une idée porterait son sens
 * dans son nom, et le sens ne doit exister que côté serveur.
 *
 * ⚠️ ET AUCUNE NE NOMME CE QU'UNE AUTRE NOMME DÉJÀ. La 5.10 a failli ajouter `porte` à côté de
 * `porte-entrouverte`, et `chemin` à côté de `sentier` : deux visuels quasi identiques dans une
 * commande d'art, et deux cartes qui disent la même chose dans un tirage. Aucun test ne l'aurait vu.
 * `tests/jeu-proprietaire.test.ts` porte désormais la garde — mécanique pour les sous-chaînes,
 * déclarée pour les synonymes.
 *
 * Ces clés sont INTERNES. L'UX interdit de nommer la carte à l'écran (« ne jamais faire : nommer la
 * carte avant la réponse »), et rien dans le produit ne les affiche. Elles identifient un visuel et
 * une ligne de journal, c'est tout. C'est aussi pourquoi `porte-entrouverte` et `sentier` n'ont PAS
 * été renommés vers les mots d'Anima : un renommage aurait invalidé les lignes de `tirage` déjà en
 * base pour un gain cosmétique dans un fichier que personne ne lit.
 */

/** Une carte du jeu. Les cartes de l'ACCUEIL sont `CleCarte` / `CarteBibliotheque` (5.6) — rien à voir. */
export type CleCarteJeu =
  | "porte-entrouverte"
  | "pont"
  | "racine"
  | "serrure"
  | "lanterne"
  | "sentier"
  | "pierre-levee"
  | "barque"
  | "escalier"
  | "fenetre"
  | "bourgeon"
  | "braise"
  | "miroir-d-eau"
  | "mue"
  | "ruche"
  | "carrefour"
  | "tamis"
  | "horizon"
  | "fleur"
  | "oiseau"
  | "seuil";

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
      "racine",
      "serrure",
      "lanterne",
      "sentier",
      "pierre-levee",
      "barque",
      "escalier",
      "fenetre",
      "bourgeon",
      "braise",
      "miroir-d-eau",
      "mue",
      "ruche",
      "carrefour",
      "tamis",
      "horizon",
      "fleur",
      "oiseau",
      "seuil",
    ] as const satisfies readonly CleCarteJeu[]
  ).map((cle) => Object.freeze({ cle })),
);

/** Les clés seules — pour les corpus (sens, descriptions), qui doivent déclarer un créneau par carte. */
export const CLES_JEU: readonly CleCarteJeu[] = Object.freeze(JEU.map((c) => c.cle));

/**
 * La taille du jeu. Elle est DÉRIVÉE, jamais écrite en dur : un compte écrit à la main devient faux
 * à la première carte ajoutée, et il deviendrait faux exactement là où il compte — la borne de
 * l'échantillonnage uniforme.
 *
 * La 5.10 a fait passer le jeu de 24 à 21 sans toucher une seule ligne de production hors de ce
 * fichier : c'est exactement ce pour quoi la dérivation avait été écrite en 5.7.
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
