/**
 * port.ts — `EphemerisPort` : la SEULE porte par laquelle une éphéméride entre dans le produit
 * (Story 5.1, AD-6 / SPINE L24 « trois frontières franchies uniquement par un port »).
 *
 * ── CE QUE LE PORT DÉCLARE ─────────────────────────────────────────────────────────────────────
 *
 * Il déclare CE QUE LE DOMAINE DEMANDE, jamais ce que la bibliothèque du moment sait faire. C'est
 * toute la différence entre un port et un habillage : un port écrit d'après l'implémentation
 * s'effondre le jour où on en change, parce qu'il en a hérité les trous.
 *
 * Concrètement : `chiron` figure dans `Corps` alors qu'AUCUN adaptateur d'aujourd'hui ne sait le
 * calculer. C'est délibéré. Le besoin est réel (décision produit du 2026-08-07) ; c'est la SOURCE
 * qui manque. Le port dit le besoin, l'adaptateur dit son impuissance — dans cet ordre.
 *
 * ── POURQUOI UNE LECTURE EST UNE UNION, PAS UN `number | undefined` ────────────────────────────
 *
 * `undefined` répond « je n'ai rien » sans dire pourquoi, et surtout sans distinguer les deux cas
 * qui comptent : « cette éphéméride ne connaît pas ce corps » (définitif, la porte pré-lancement
 * Chiron) et « la date sort de la plage couverte » (transitoire, une naissance de 1887). Le premier
 * s'affiche à l'utilisatrice comme une absence assumée, le second comme un incident.
 *
 * Une union force l'appelant à traiter les deux. Un `undefined` le laisse écrire `?? 0` — et
 * 0° signifie « 0° du Bélier », une position parfaitement plausible. C'est exactement la faute
 * `NaN` trouvée en revue 4.6 sur `intensite`, transposée aux degrés.
 *
 * ── PURETÉ (garde `tests/astro-architecture.test.ts`) ──────────────────────────────────────────
 *
 * Ce fichier n'importe RIEN. Ni `@/lib/ai/*` (frontière de déterminisme AD-6 : le socle est un
 * calcul, jamais un modèle), ni infra, ni `server-only`. Il est lisible par le domaine ET par
 * l'adaptateur sans qu'aucun des deux ne connaisse l'autre.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les corps
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Les dix corps du thème classique. La Terre n'y est pas : le thème est GÉOCENTRIQUE, la Terre en
 * est le point d'observation, pas un objet observé. (Le Soleil et la Lune sont des « planètes » au
 * sens astrologique et pas au sens astronomique — le vocabulaire du domaine l'emporte ici.)
 */
export type CorpsClassique =
  | "soleil"
  | "lune"
  | "mercure"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturne"
  | "uranus"
  | "neptune"
  | "pluton";

/**
 * Les compléments demandés par le produit.
 *
 * Les DEUX nœuds sont nommés distinctement, et ce n'est pas du zèle : les astrologues ne les
 * emploient pas indifféremment (le moyen lisse l'oscillation de ±1,5° du vrai). Un champ `noeud`
 * ambigu obligerait chaque lecteur en aval à deviner lequel il tient — et ils divergent assez pour
 * changer de degré, parfois de signe.
 *
 * `chiron` est déclaré ICI et n'est fourni par AUCUN adaptateur à ce jour (voir l'en-tête).
 */
export type CorpsComplementaire = "noeud_moyen" | "noeud_vrai" | "chiron";

export type Corps = CorpsClassique | CorpsComplementaire;

/** Les dix classiques, dans l'ordre traditionnel du thème (luminaires, puis distance croissante). */
export const CORPS_CLASSIQUES: readonly CorpsClassique[] = Object.freeze([
  "soleil",
  "lune",
  "mercure",
  "venus",
  "mars",
  "jupiter",
  "saturne",
  "uranus",
  "neptune",
  "pluton",
]);

export const CORPS_COMPLEMENTAIRES: readonly CorpsComplementaire[] = Object.freeze([
  "noeud_moyen",
  "noeud_vrai",
  "chiron",
]);

/** Tout ce que le thème tente de placer. Source unique : le domaine itère dessus, jamais sur une copie. */
export const CORPS: readonly Corps[] = Object.freeze([...CORPS_CLASSIQUES, ...CORPS_COMPLEMENTAIRES]);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les lectures
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Pourquoi une position n'a pas pu être calculée. Fermé exprès : une raison libre finirait en texte
 * d'excuse, donc en prose stockée — et le contenu du thème ne porte AUCUNE prose (FR-053, AC7).
 *
 * - `ephemeride_sans_asteroides` : la source ne connaît pas ce corps, et n'en connaîtra pas. C'est
 *   le cas de Chiron avec `astronomy-engine` (son énumération `Body` n'a aucun astéroïde). DÉFINITIF
 *   pour cet adaptateur — c'est la porte pré-lancement, pas un bogue à corriger dans le code.
 * - `hors_plage_ephemeride` : la date sort de la plage où la source garantit sa précision. Un thème
 *   à moitié faux serait pire qu'un thème incomplet : il aurait l'air juste.
 */
export type RaisonNonCalcule = "ephemeride_sans_asteroides" | "hors_plage_ephemeride";

export type LectureCorps =
  | { readonly statut: "calcule"; readonly longitude: number }
  | { readonly statut: "non_calcule"; readonly raison: RaisonNonCalcule };

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le port
// ══════════════════════════════════════════════════════════════════════════════════════════════

export interface EphemerisPort {
  /**
   * Identifie la SOURCE, pas la bibliothèque : `"astronomy-engine@2.1.19"`. Il entre dans
   * l'empreinte d'entrées de `theme_natal` (migration 0039), et c'est ce qui autorisera le recalcul
   * le jour où l'adaptateur change — les entrées de naissance, elles, n'auront pas bougé.
   */
  readonly identifiant: string;

  /**
   * Longitude écliptique GÉOCENTRIQUE APPARENTE, en degrés dans `[0, 360)`, rapportée à
   * l'écliptique et à l'équinoxe VRAIS DE LA DATE (le zodiaque tropical).
   *
   * ⚠️ Les trois qualificatifs sont chacun un piège déjà rencontré :
   *   • GÉOCENTRIQUE — `astronomy-engine` expose une fonction `EclipticLongitude()` qui est
   *     HÉLIOCENTRIQUE (« as seen from the center of the Sun »). L'appeler par réflexe donne un
   *     thème vu depuis le Soleil : tout est faux, et rien ne plante ;
   *   • APPARENTE — corrigée du temps-lumière et de l'aberration, comme le fait toute éphéméride
   *     astrologique. Sans ça les planètes lointaines dérivent de plusieurs minutes d'arc ;
   *   • DE LA DATE — pas J2000. L'écart de précession atteint ~0,3° en 2026, soit un degré de
   *     zodiaque perdu, et il grandit d'année en année.
   */
  longitudeEcliptique(corps: Corps, instantUtc: Date): LectureCorps;

  /**
   * Temps sidéral apparent à Greenwich (GAST), en HEURES sidérales dans `[0, 24)`.
   * C'est l'entrée de l'ascendant et du milieu du ciel. En heures et pas en degrés parce que c'est
   * la convention de toutes les sources ; la conversion (×15) est faite UNE FOIS dans le domaine.
   */
  tempsSideralGreenwich(instantUtc: Date): number;

  /**
   * Obliquité VRAIE de l'écliptique, en degrés (~23,44°). Vraie et non moyenne : elle inclut la
   * nutation, comme le temps sidéral apparent ci-dessus. Mélanger l'un apparent et l'autre moyen
   * introduirait une incohérence d'une dizaine de secondes d'arc dans l'ascendant — invisible à
   * l'œil, et suffisante pour faire basculer un ascendant né à la limite d'un signe.
   */
  obliquiteVraie(instantUtc: Date): number;
}
