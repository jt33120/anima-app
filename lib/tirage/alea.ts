/**
 * alea.ts — L'ÉCHANTILLONNAGE UNIFORME, ET SA PREUVE (Story 5.7, FR-015 · AD-11).
 *
 * ── LE DÉFAUT QUE LE TEST SUR GRAND N NE VERRA JAMAIS ──────────────────────────────────────────
 *
 * Le critère d'acceptation du PRD demande un test bloquant sur grand N, et il a raison : un tel test
 * attrape une source morte, un indice figé, un décalage d'un rang. Mais il est STRUCTURELLEMENT
 * AVEUGLE à la faute la plus probable du code qu'on écrit ici — le biais de modulo.
 *
 * `mot % 24` sur un mot uniforme de 32 bits n'est pas uniforme : `2**32 = 178 956 970 × 24 + 8`, donc
 * les 8 premiers indices ont une chance de plus que les 16 autres. L'écart relatif vaut 1,4 · 10⁻⁸.
 * Pour le détecter par un χ², il faudrait de l'ordre de 10¹⁶ tirages. Autrement dit : le test qui
 * rassure ne prouve pas, et le mutant `%` survivrait à une campagne entière.
 *
 * D'où l'inversion de la charge de la preuve dans `tests/tirage-alea.test.ts` :
 *
 *   • la garde PRINCIPALE est DÉTERMINISTE — une source scriptée interroge la frontière exacte du
 *     rejet (`limite - 1` accepté, `limite` rejeté). Trois mots suffisent, et ils tuent le mutant.
 *   • la garde sur grand N reste, EN SECOND, pour ce que seule elle attrape.
 *
 * ⚠️ Les tests fixent leurs bornes EN DUR (3, 24, 40) et ne les empruntent jamais à `TAILLE_JEU` :
 * le jour où le jeu passerait à 32 cartes — une puissance de deux —, la zone de rejet deviendrait
 * vide et une garde paramétrée par la taille du jeu deviendrait vacue sans que rien ne rougisse.
 *
 * ── LA GRAINE EST LE MOT ACCEPTÉ ───────────────────────────────────────────────────────────────
 *
 * `indiceUniforme` rend le mot qui a DÉTERMINÉ l'indice, pas la suite des mots consommés. C'est ce
 * qui rend le journal d'audit rejouable : `rejouer(graine, borne)` doit retrouver l'indice, sinon la
 * ligne journalisée est une preuve qui ne prouve rien.
 *
 * Résidu assumé, écrit plutôt que tu : le journal prouve la REJOUABILITÉ, pas que le mot accepté
 * fut le premier tiré. Un code qui rejetterait sélectivement les mots menant à une carte
 * indésirable produirait un journal parfaitement cohérent — mais il DÉFORMERAIT la distribution, et
 * c'est exactement ce que le χ² sur grand N attrape. Les deux gardes se complètent ; aucune des deux
 * ne suffit.
 */

/**
 * Une source d'aléa : un entier non signé sur 32 bits par appel.
 *
 * Le port existe pour que l'échantillonneur soit TESTABLE avec une source scriptée. Il n'ouvre pas
 * de porte sur le profil : c'est `indiceUniforme` (une fonction interne au tirage) qui le prend en
 * paramètre, jamais `tirerUneCarte()`, dont l'arité reste nulle (AD-11, AC1).
 */
export type SourceAlea = () => number;

/** L'espace des mots de 32 bits. Nommé, parce qu'il apparaît dans la formule de la limite de rejet. */
const ESPACE = 2 ** 32;

/**
 * Le CSPRNG système.
 *
 * `globalThis.crypto` plutôt que `node:crypto` : la Web Crypto API existe sur Node 22 ET sur le
 * runtime Edge, alors qu'un import `node:` exclurait ce dernier. Le tirage doit pouvoir s'exécuter
 * partout où le serveur s'exécute.
 *
 * `crypto.randomInt()` de Node ferait déjà le rejet correctement — et n'est pas retenu pour deux
 * raisons : il est absent du runtime Edge, et surtout il N'EXPOSE PAS le mot accepté. Sans ce mot,
 * pas de graine journalisable, donc pas d'audit (AC3). Posséder l'échantillonneur est le prix de
 * l'auditabilité.
 */
export const csprngSysteme: SourceAlea = () => {
  const mots = new Uint32Array(1);
  globalThis.crypto.getRandomValues(mots);
  return mots[0];
};

/** Un tirage d'indice : l'indice, et le mot qui l'a produit. */
export interface EchantillonUniforme {
  readonly indice: number;
  /** Le mot ACCEPTÉ, en hexadécimal sur 8 caractères. C'est la graine journalisée. */
  readonly graine: string;
}

/** Le format de graine du journal : 8 caractères hexadécimaux minuscules, jamais autre chose. */
const FORMAT_GRAINE = /^[0-9a-f]{8}$/;

const enHex = (mot: number): string => mot.toString(16).padStart(8, "0");

/**
 * Le nombre maximal de tirages avant abandon.
 *
 * La probabilité de rejet vaut au pire un peu moins de 1/2 (borne juste au-dessus de 2³¹), donc
 * 100 essais échouent avec une probabilité de l'ordre de 2⁻¹⁰⁰ : jamais. La borne n'est pas là pour
 * l'aléa, elle est là pour la PANNE — une source défaillante qui rendrait toujours le même mot rejeté
 * ferait boucler à l'infini une requête serveur. Mieux vaut une erreur bruyante qu'une fonction qui
 * ne rend jamais la main.
 */
const ESSAIS_MAX = 100;

/**
 * Un indice uniforme dans `[0, borne)`, par ÉCHANTILLONNAGE PAR REJET.
 *
 * `limite = ESPACE - (ESPACE % borne)` est le plus grand multiple de `borne` tenant dans l'espace.
 * Tout mot ≥ `limite` tombe dans la queue incomplète et est REJETÉ — c'est cette queue, et elle
 * seule, qui rendrait `mot % borne` biaisé.
 */
export function indiceUniforme(source: SourceAlea, borne: number): EchantillonUniforme {
  if (!Number.isInteger(borne) || borne < 1 || borne > ESPACE) {
    throw new Error(`indiceUniforme : borne invalide (${borne}).`);
  }
  const limite = ESPACE - (ESPACE % borne);

  for (let essai = 0; essai < ESSAIS_MAX; essai += 1) {
    const mot = source();
    // Une source qui ne rend pas un entier 32 bits non signé est REFUSÉE bruyamment. Sans cette
    // vérification, un `Math.random()` glissé à la place du CSPRNG rendrait un flottant de [0,1) :
    // `0.42 % 24` vaut `0.42`, et `JEU[0.42]` vaut `undefined`. La faute se manifesterait très loin
    // d'ici, sous une forme méconnaissable.
    if (!Number.isInteger(mot) || mot < 0 || mot >= ESPACE) {
      throw new Error(`indiceUniforme : la source n'a pas rendu un entier 32 bits (${mot}).`);
    }
    if (mot < limite) {
      return { indice: mot % borne, graine: enHex(mot) };
    }
  }
  throw new Error(`indiceUniforme : ${ESSAIS_MAX} rejets consécutifs — la source est en panne.`);
}

/**
 * L'AUDIT : à partir d'une ligne journalisée, retrouver l'indice tiré.
 *
 * `borne` est passée explicitement — c'est `taille_jeu`, journalisé AVEC la graine. Rejouer avec la
 * taille COURANTE serait le défaut silencieux de cette story : le jour où le jeu passe de 24 à 26
 * cartes, `graine % 24 ≠ graine % 26`, et l'audit rendrait des cartes fausses avec assurance sur
 * toutes les lignes antérieures.
 *
 * Une graine hors du domaine accepté fait JETER : une ligne journalisée dont le mot aurait dû être
 * rejeté est incohérente, et la faire passer pour valide reviendrait à certifier un faux.
 */
export function rejouer(graine: string, borne: number): number {
  if (!FORMAT_GRAINE.test(graine)) {
    throw new Error(`rejouer : graine mal formée (${graine}).`);
  }
  if (!Number.isInteger(borne) || borne < 1 || borne > ESPACE) {
    throw new Error(`rejouer : borne invalide (${borne}).`);
  }
  const mot = Number.parseInt(graine, 16);
  const limite = ESPACE - (ESPACE % borne);
  if (mot >= limite) {
    throw new Error(`rejouer : la graine ${graine} aurait dû être rejetée pour la borne ${borne}.`);
  }
  return mot % borne;
}
