import {
  CORPS,
  CORPS_CLASSIQUES,
  type Corps,
  type EphemerisPort,
  type RaisonNonCalcule,
} from "./port";

/**
 * theme-natal.ts — LE CALCUL DU THÈME NATAL (Story 5.1, AD-6 / FR-047 / NFR-011).
 *
 * Module PUR : aucune I/O, aucun `server-only`, aucun import d'infra — et surtout aucun import de
 * `@/lib/ai/*`. C'est la frontière de déterminisme : le socle EST un calcul, un modèle de langage
 * n'y a aucune place. La garde vit dans `tests/astro-architecture.test.ts` ; ici, la structure la
 * rend évidente à la lecture.
 *
 * ── AUCUNE PROSE, ET C'EST STRUCTUREL (FR-053, AC7) ────────────────────────────────────────────
 *
 * « Le socle ne prédit jamais » est habituellement une consigne — donc quelque chose qu'on peut
 * enfreindre par distraction. Ici c'est une propriété du type : tout ce que produit ce module est
 * fait de NOMBRES et d'ÉNUMÉRATIONS. Il n'existe aucun champ de texte libre, donc aucun endroit où
 * une prédiction pourrait s'écrire. Le jour où quelqu'un ajoutera un `commentaire: string`, la
 * garde d'absence rougira — pas parce qu'elle aura reconnu une prédiction, mais parce qu'elle aura
 * vu apparaître un endroit où en écrire une.
 *
 * L'interprétation (le sens des positions) vit dans le corpus d'Anima, stories 5.2 et 5.6.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le zodiaque
// ══════════════════════════════════════════════════════════════════════════════════════════════

export type Signe =
  | "belier"
  | "taureau"
  | "gemeaux"
  | "cancer"
  | "lion"
  | "vierge"
  | "balance"
  | "scorpion"
  | "sagittaire"
  | "capricorne"
  | "verseau"
  | "poissons";

/** Ordre du zodiaque TROPICAL : l'index EST la longitude divisée par 30. Ne jamais réordonner. */
export const SIGNES: readonly Signe[] = Object.freeze([
  "belier",
  "taureau",
  "gemeaux",
  "cancer",
  "lion",
  "vierge",
  "balance",
  "scorpion",
  "sagittaire",
  "capricorne",
  "verseau",
  "poissons",
]);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Trigonométrie en degrés — les conversions vivent ICI, une seule fois
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// Toute l'astronomie se raisonne en degrés et tout `Math.*` travaille en radians. Éparpiller les
// conversions est la façon la plus fiable de perdre un facteur π/180 quelque part : le résultat
// reste un nombre plausible, aucun test ne plante, et le thème est faux.

const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);
const cos = (deg: number) => Math.cos(deg * RAD);
const tan = (deg: number) => Math.tan(deg * RAD);
const atan2Deg = (y: number, x: number) => Math.atan2(y, x) / RAD;

/**
 * Ramène un angle dans `[0, 360)`.
 *
 * ⚠️ `%` en JavaScript garde le signe du dividende : `-10 % 360` vaut `-10`, pas `350`. Un
 * ascendant négatif traverserait ensuite `Math.floor(lon / 30)` et donnerait un index de signe
 * négatif — donc `SIGNES[-1]` === `undefined`, et un thème avec un signe manquant sans que rien
 * n'ait planté.
 */
export function normaliserDegres(angle: number): number {
  if (!Number.isFinite(angle)) {
    throw new Error("theme-natal : angle non fini — une position ne se devine pas (Story 5.1, P9)");
  }
  return ((angle % 360) + 360) % 360;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les entrées
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Les entrées telles qu'elles sortent de la base — sous leur forme BRUTE, pas encore résolue.
 * `date` est obligatoire (FR-048) ; tout le reste est optionnel et le calcul doit aboutir sans
 * (FR-049, AC6).
 */
export interface EntreesNaissance {
  /** ISO `AAAA-MM-JJ`, heure locale de naissance. */
  readonly date: string;
  /** `HH:MM` ou `HH:MM:SS`, heure LOCALE du lieu de naissance. */
  readonly heure?: string | null;
  /** Identifiant IANA (`Europe/Paris`). Sans lui, l'heure est inexploitable — voir `resoudreInstant`. */
  readonly fuseau?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
}

/**
 * Pourquoi l'heure de naissance n'a pas pu servir.
 *
 * `fuseau_invalide` est distinct de `fuseau_absent` EXPRÈS : le premier est un défaut de donnée
 * (un identifiant IANA erroné en base), le second une information qu'on n'a jamais eue. Les
 * confondre ferait passer un bogue pour une saisie incomplète — et personne n'irait le chercher.
 */
export type RaisonSansHeure = "heure_absente" | "fuseau_absent" | "fuseau_invalide";

/**
 * Pourquoi les angles (ascendant, milieu du ciel, maisons) n'ont pas pu être calculés.
 *
 * `latitude_polaire` : au pôle géographique EXACT, l'horizon coïncide avec l'écliptique de façon
 * dégénérée et l'ascendant n'existe pas — ce n'est pas une limite de calcul, c'est une limite de la
 * notion. Entre le cercle polaire et le pôle, en revanche, l'ascendant reste parfaitement défini
 * (c'est le système Placidus qui y casse, pas l'ascendant — et on ne livre pas Placidus).
 */
export type RaisonSansAngles = RaisonSansHeure | "coordonnees_absentes" | "latitude_polaire";

export interface InstantResolu {
  readonly instantUtc: Date;
  /** Faux ⇒ midi UTC par défaut (voir `resoudreInstant`), et la Lune devient approximative. */
  readonly heureConnue: boolean;
  readonly raisonSansHeure?: RaisonSansHeure;
}

/**
 * Décalage d'un fuseau IANA à un instant donné, en minutes (positif à l'est de Greenwich).
 *
 * Passe par `Intl` plutôt que par une table : les décalages historiques ne sont pas une constante
 * par pays. La France était à UTC+0 jusqu'en 1911 et n'a repris l'heure d'été qu'en 1976 ; stocker
 * « +01:00 » rendrait faux tout thème antérieur, et tout thème d'été.
 */
function decalageMinutes(instantUtc: Date, fuseau: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(instantUtc)) p[type] = value;
  // `hour12: false` peut rendre « 24 » pour minuit selon l'environnement : ramené à 0.
  const heure = Number(p.hour) % 24;
  const local = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    heure,
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((local - instantUtc.getTime()) / 60000);
}

/**
 * Résout une date + heure LOCALES en instant UTC.
 *
 * ── SANS HEURE : MIDI, JAMAIS MINUIT ───────────────────────────────────────────────────────────
 *
 * La Lune parcourt ~13° par jour. Prendre minuit fait porter toute l'erreur d'un côté (jusqu'à 13°
 * de retard) ; prendre midi la répartit et la divise par deux (±6,6°). C'est la convention du
 * « thème de midi », et elle n'est pas cosmétique : 6,6° font souvent la différence entre deux
 * signes pour la Lune. Le drapeau `heureConnue` propage l'incertitude jusqu'au thème, pour que la
 * story 5.3 puisse dire honnêtement ce qui manque au lieu de le taire.
 *
 * ── SANS FUSEAU : L'HEURE EST INEXPLOITABLE ────────────────────────────────────────────────────
 *
 * « 07:15 » ne désigne aucun instant sans le lieu. Le réflexe serait de supposer UTC : ça donnerait
 * un ascendant faux d'un à douze signes, avec l'air d'être juste. On préfère déclarer l'heure
 * inconnue — c'est moins que ce qu'on aimerait, mais c'est vrai.
 */
export function resoudreInstant(entrees: EntreesNaissance): InstantResolu {
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entrees.date);
  if (!jour) {
    throw new Error("theme-natal : date de naissance illisible (attendu AAAA-MM-JJ)");
  }
  const [, a, m, j] = jour;

  const sansHeure = (raison: RaisonSansHeure): InstantResolu => ({
    instantUtc: new Date(Date.UTC(Number(a), Number(m) - 1, Number(j), 12, 0, 0)),
    heureConnue: false,
    raisonSansHeure: raison,
  });

  if (!entrees.heure) return sansHeure("heure_absente");
  if (!entrees.fuseau) return sansHeure("fuseau_absent");

  const hm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(entrees.heure);
  if (!hm) throw new Error("theme-natal : heure de naissance illisible (attendu HH:MM)");
  const [, hh, mi, ss] = hm;

  const naif = Date.UTC(
    Number(a),
    Number(m) - 1,
    Number(j),
    Number(hh),
    Number(mi),
    Number(ss ?? 0),
  );

  try {
    // Point fixe en deux passes : le décalage dépend de l'instant, qui dépend du décalage. La
    // première passe donne le bon décalage sauf tout près d'un changement d'heure ; la seconde converge.
    let instant = new Date(naif - decalageMinutes(new Date(naif), entrees.fuseau) * 60000);
    instant = new Date(naif - decalageMinutes(instant, entrees.fuseau) * 60000);
    return { instantUtc: instant, heureConnue: true };
  } catch {
    // `Intl` jette sur un identifiant de fuseau inconnu. On DÉGRADE plutôt que de propager : le
    // reste du thème (les dix corps, les nœuds) ne dépend pas du fuseau et reste juste. Faire
    // échouer tout le socle à cause d'un champ facultatif mal rempli serait disproportionné —
    // mais la raison est nommée pour que le défaut de donnée reste trouvable (AC6).
    return sansHeure("fuseau_invalide");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les angles : ascendant, milieu du ciel, maisons
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Le système de maisons employé.
 *
 * ⚠️ `signes_entiers` est le SEUL système livré en v1, et c'est un choix, pas un oubli.
 *
 * Placidus (le système par défaut en astrologie francophone) demande un solveur itératif dont les
 * conventions de signe se reconstruisent mal de mémoire. Une erreur de signe y est indétectable :
 * elle n'échoue jamais, elle range simplement chaque planète dans une maison voisine — plausible,
 * invérifiable, faux. C'est exactement la raison pour laquelle on refuse d'approximer Chiron ; la
 * même règle s'applique ici.
 *
 * Les signes entiers, eux, sont EXACTS par construction (la maison I est le signe de l'ascendant,
 * les suivantes sont les signes suivants), n'ont aucun mode de rupture polaire, et sont le système
 * historiquement d'origine — pas un repli honteux. Et l'ASCENDANT lui-même, qui est l'angle qui
 * compte le plus, est calculé exactement dans les deux cas.
 *
 * Le champ reste un PARAMÈTRE et il est INSCRIT dans le thème (jamais supposé) : le jour où
 * Placidus arrive, l'empreinte d'entrées change, la version s'incrémente, rien d'autre ne bouge.
 */
export type SystemeMaisons = "signes_entiers";

export interface AnglesCalcules {
  readonly statut: "calcule";
  /** Longitude écliptique de l'ascendant, degrés `[0, 360)`. */
  readonly ascendant: number;
  /** Longitude écliptique du milieu du ciel (Medium Coeli), degrés `[0, 360)`. */
  readonly milieuDuCiel: number;
  /** Les 12 cuspides, maison I en premier, degrés `[0, 360)`. */
  readonly maisons: readonly number[];
  readonly systeme: SystemeMaisons;
}

export interface AnglesAbsents {
  readonly statut: "non_calcule";
  readonly raison: RaisonSansAngles;
}

export type Angles = AnglesCalcules | AnglesAbsents;

/**
 * Ascendant et milieu du ciel, par les formules sphériques classiques.
 *
 * `ramc` = ascension droite du milieu du ciel, en degrés = temps sidéral LOCAL.
 * `latitude` = φ, `obliquite` = ε.
 *
 *   MC  = atan2( sin RAMC , cos RAMC · cos ε )
 *   ASC = atan2( cos RAMC , −( sin RAMC · cos ε + tan φ · sin ε ) )
 *
 * `atan2` et non `atan` : `atan` perd le quadrant, ce qui décale l'ascendant de 180° une fois sur
 * deux. Le thème serait alors juste la moitié du temps — le pire des régimes pour être détecté.
 *
 * Aux pôles géographiques exacts (|φ| = 90°), `tan φ` diverge : la notion d'ascendant n'y existe
 * pas. On refuse plutôt que de rendre un infini normalisé en 0° du Bélier.
 */
export function ascendantEtMilieuDuCiel(
  ramc: number,
  latitude: number,
  obliquite: number,
): { ascendant: number; milieuDuCiel: number } {
  if (Math.abs(latitude) >= 89.9) {
    throw new Error("theme-natal : ascendant indéfini au pôle géographique (|latitude| ≥ 89,9°)");
  }
  const milieuDuCiel = normaliserDegres(atan2Deg(sin(ramc), cos(ramc) * cos(obliquite)));
  const ascendant = normaliserDegres(
    atan2Deg(cos(ramc), -(sin(ramc) * cos(obliquite) + tan(latitude) * sin(obliquite))),
  );
  return { ascendant, milieuDuCiel };
}

/** Les 12 cuspides en signes entiers : la maison I commence au 0° du signe de l'ascendant. */
export function maisonsSignesEntiers(ascendant: number): readonly number[] {
  const debut = Math.floor(normaliserDegres(ascendant) / 30) * 30;
  return Object.freeze(Array.from({ length: 12 }, (_, i) => normaliserDegres(debut + i * 30)));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le thème
// ══════════════════════════════════════════════════════════════════════════════════════════════

export interface PositionCorps {
  readonly corps: Corps;
  /** Longitude écliptique tropicale, degrés `[0, 360)`. */
  readonly longitude: number;
  readonly signe: Signe;
  /** Degré DANS le signe, `[0, 30)`. Redondant avec `longitude` — et voulu : c'est ce qui se lit. */
  readonly degre: number;
  /** Maison occupée, `1..12`. Absente quand les angles ne sont pas calculables (AC6). */
  readonly maison?: number;
}

export interface CorpsNonCalcule {
  readonly corps: Corps;
  readonly raison: RaisonNonCalcule;
}

export interface ThemeNatal {
  /** Version de FORME du document (pas la version de la ligne `theme_natal`, qui compte les recalculs). */
  readonly schema: 1;
  /** Identifiant de la source d'éphéméride employée — entre dans l'empreinte d'entrées (0039). */
  readonly adaptateur: string;
  readonly positions: readonly PositionCorps[];
  /** Ce qui n'a PAS pu être calculé, avec sa raison. Jamais silencieux (P2). */
  readonly absents: readonly CorpsNonCalcule[];
  readonly angles: Angles;
  /**
   * `midi_par_defaut` ⇒ l'heure manquait, l'instant est midi UTC : la Lune est à ±6,6° près et tout
   * ce qui dépend de l'heure est absent. La story 5.3 lit ce champ pour dire quoi il manque.
   */
  readonly precision: "heure_connue" | "midi_par_defaut";
}

/** Signe et degré d'une longitude. Une seule dérivation dans tout le produit. */
export function placer(longitude: number): { signe: Signe; degre: number } {
  const l = normaliserDegres(longitude);
  const index = Math.floor(l / 30);
  return { signe: SIGNES[index], degre: l - index * 30 };
}

/**
 * Maison occupée par une longitude, `1..12`, à partir des cuspides. Générique : elle marche pour
 * tout système de cuspides croissantes modulo 360, pas seulement les signes entiers.
 */
export function maisonDe(longitude: number, maisons: readonly number[]): number {
  const l = normaliserDegres(longitude);
  for (let i = 11; i >= 0; i--) {
    const depuis = normaliserDegres(l - maisons[i]);
    const largeur = normaliserDegres(maisons[(i + 1) % 12] - maisons[i]) || 360;
    if (depuis < largeur) return i + 1;
  }
  // Inatteignable si les cuspides couvrent le cercle ; on ne devine pas pour autant.
  throw new Error("theme-natal : cuspides ne couvrant pas le cercle");
}

/**
 * LE CALCUL. Fonction pure : mêmes entrées + même port ⇒ même sortie, toujours (déterminisme
 * vérifiable, FR-047).
 *
 * Aboutit TOUJOURS avec ce qui est disponible (AC6) : un corps que la source ne connaît pas passe
 * dans `absents` avec sa raison, des angles incalculables sont déclarés absents avec la leur, et
 * rien de tout cela n'interrompt le reste. Ce qui interrompt, en revanche, c'est une valeur
 * ABERRANTE (non finie) : elle signale un défaut de calcul, pas une donnée manquante, et la faire
 * passer pour 0° du Bélier serait fabriquer une position (P9).
 */
export function calculerThemeNatal(
  entrees: EntreesNaissance,
  ephemeride: EphemerisPort,
): ThemeNatal {
  const { instantUtc, heureConnue, raisonSansHeure } = resoudreInstant(entrees);

  // ── Les angles d'abord : les positions en dépendent (la maison occupée) ──
  const angles = calculerAngles(entrees, instantUtc, heureConnue, raisonSansHeure, ephemeride);
  const maisons = angles.statut === "calcule" ? angles.maisons : null;

  const positions: PositionCorps[] = [];
  const absents: CorpsNonCalcule[] = [];

  for (const corps of CORPS) {
    const lecture = ephemeride.longitudeEcliptique(corps, instantUtc);
    if (lecture.statut === "non_calcule") {
      absents.push({ corps, raison: lecture.raison });
      continue;
    }
    // `normaliserDegres` jette sur non fini : une éphéméride qui rend NaN est un incident, pas une
    // absence. Les deux se ressembleraient à l'affichage et n'ont rien à voir à la lecture du code.
    const longitude = normaliserDegres(lecture.longitude);
    const { signe, degre } = placer(longitude);
    positions.push({
      corps,
      longitude,
      signe,
      degre,
      ...(maisons ? { maison: maisonDe(longitude, maisons) } : {}),
    });
  }

  return {
    schema: 1,
    adaptateur: ephemeride.identifiant,
    positions: Object.freeze(positions),
    absents: Object.freeze(absents),
    angles,
    precision: heureConnue ? "heure_connue" : "midi_par_defaut",
  };
}

function calculerAngles(
  entrees: EntreesNaissance,
  instantUtc: Date,
  heureConnue: boolean,
  raisonSansHeure: RaisonSansHeure | undefined,
  ephemeride: EphemerisPort,
): Angles {
  // Sans heure exploitable, l'ascendant tourne de 360° en 24 h : le « calculer » depuis midi
  // reviendrait à tirer un signe au hasard avec l'autorité d'un calcul.
  if (!heureConnue) {
    return { statut: "non_calcule", raison: raisonSansHeure ?? "heure_absente" };
  }
  if (
    entrees.latitude === null ||
    entrees.latitude === undefined ||
    entrees.longitude === null ||
    entrees.longitude === undefined
  ) {
    return { statut: "non_calcule", raison: "coordonnees_absentes" };
  }
  // Au pôle exact, `tan φ` diverge. On le constate ICI et on déclare l'absence, plutôt que de
  // laisser `ascendantEtMilieuDuCiel` jeter : une naissance au pôle doit quand même obtenir ses dix
  // corps et ses nœuds (AC6). La sécurité basse niveau reste en place pour un appelant direct.
  if (Math.abs(entrees.latitude) >= 89.9) {
    return { statut: "non_calcule", raison: "latitude_polaire" };
  }

  const gastHeures = ephemeride.tempsSideralGreenwich(instantUtc);
  const obliquite = ephemeride.obliquiteVraie(instantUtc);
  // Temps sidéral LOCAL : Greenwich (en heures ×15) plus la longitude EST du lieu.
  const ramc = normaliserDegres(gastHeures * 15 + entrees.longitude);

  const { ascendant, milieuDuCiel } = ascendantEtMilieuDuCiel(ramc, entrees.latitude, obliquite);
  return {
    statut: "calcule",
    ascendant,
    milieuDuCiel,
    maisons: maisonsSignesEntiers(ascendant),
    systeme: "signes_entiers",
  };
}

/**
 * L'EMPREINTE DES ENTRÉES — ce que la migration 0039 exige pour autoriser un recalcul.
 *
 * Elle liste tout ce dont le résultat dépend, y compris l'identifiant d'adaptateur : le jour où une
 * source de Chiron arrive, les entrées de naissance n'auront pas changé, et sans lui la base
 * refuserait le recalcul (commentaire de colonne dans 0039).
 *
 * Ce n'est PAS un secret : c'est un discriminant. Le hachage est fait par l'appelant (couche data),
 * qui a accès à `crypto` ; ici on ne produit que la chaîne canonique — le domaine reste pur.
 */
export function chaineEmpreinte(entrees: EntreesNaissance, identifiantAdaptateur: string): string {
  return [
    "v1",
    entrees.date,
    entrees.heure ?? "",
    entrees.fuseau ?? "",
    entrees.latitude ?? "",
    entrees.longitude ?? "",
    "signes_entiers" satisfies SystemeMaisons,
    identifiantAdaptateur,
  ].join("|");
}

/** Les dix classiques — réexporté pour que les appelants n'aient pas à connaître `./port`. */
export { CORPS_CLASSIQUES };
