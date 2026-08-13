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
  /** Faux ⇒ midi du jour LOCAL par défaut (voir `resoudreInstant`), et la Lune devient approximative. */
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
/**
 * Une lecture de calendrier LOCALE (`naif`, exprimée comme si elle était UTC) résolue en instant UTC.
 *
 * Point fixe en deux passes : le décalage dépend de l'instant, qui dépend du décalage. La première
 * passe donne le bon décalage sauf tout près d'un changement d'heure ; la seconde converge.
 *
 * JETTE si `Intl` ne connaît pas l'identifiant de fuseau — c'est aux appelants de décider quoi en
 * faire, et ils ne décident pas la même chose (`resoudreInstant` dégrade, `fenetreIncertitude`
 * élargit).
 *
 * ⚠️ EXPORTÉE depuis la Story 5.4 : `lib/data/lire-quotidien.ts` en a besoin pour résoudre minuit et
 * midi du jour civil parisien. **Ne pas en écrire une seconde ailleurs** — deux implémentations de
 * cette conversion divergeront un jour de changement d'heure, et ce jour-là personne ne regardera.
 */
export function instantDepuisLocal(naif: number, fuseau: string): Date {
  let instant = new Date(naif - decalageMinutes(new Date(naif), fuseau) * 60000);
  instant = new Date(naif - decalageMinutes(instant, fuseau) * 60000);
  return instant;
}

/** Les composantes de calendrier d'une date ISO. Regex, JAMAIS `new Date(chaîne)` — voir P6. */
function eclaterDate(iso: string): { a: number; m: number; j: number } {
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!jour) {
    throw new Error("theme-natal : date de naissance illisible (attendu AAAA-MM-JJ)");
  }
  return { a: Number(jour[1]), m: Number(jour[2]), j: Number(jour[3]) };
}

/** Les composantes d'une heure `HH:MM` ou `HH:MM:SS`. */
function eclaterHeure(texte: string): { hh: number; mi: number; ss: number } {
  const hm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(texte);
  if (!hm) throw new Error("theme-natal : heure de naissance illisible (attendu HH:MM)");
  return { hh: Number(hm[1]), mi: Number(hm[2]), ss: Number(hm[3] ?? 0) };
}

/**
 * L'instant retenu quand l'heure manque : MIDI DU JOUR LOCAL, pas midi UTC (revue du 2026-08-12, A7).
 *
 * ── CE QUE MIDI UTC FAISAIT DE FAUX ─────────────────────────────────────────────────────────────
 *
 * Le jour de naissance est une date LOCALE : « née le 3 mai » veut dire le 3 mai là où elle est
 * née. Prendre midi UTC, c'est prendre un instant qui, selon le fuseau, tombe n'importe où dans ce
 * jour — voire en dehors. À Kiribati (UTC+14), midi UTC est 2 h du matin le LENDEMAIN local ; à
 * Baker (UTC−12), c'est minuit le jour PRÉCÉDENT. Le point retenu n'était même pas dans la fenêtre
 * d'instants possibles que `fenetreIncertitude` calcule pour ce même thème — deux fonctions du même
 * fichier qui ne parlaient pas du même jour.
 *
 * En France l'écart n'est que d'une ou deux heures, donc ~1° de Lune : invisible, et faux quand
 * même. Le défaut mordait vraiment loin d'ici, c'est-à-dire là où personne n'aurait testé.
 *
 * ── LE RÉSIDU, DIT ─────────────────────────────────────────────────────────────────────────────
 *
 * Midi local n'est pas exactement le milieu de la fenêtre les jours de changement d'heure, où le
 * jour local dure 23 ou 25 h : l'écart est alors d'une demi-heure, soit ~0,3° de Lune. On préfère
 * un point NOMMÉ (« midi ») à un milieu calculé, parce que le milieu exigerait d'appeler
 * `fenetreIncertitude`, qui appelle `resoudreInstant` — la boucle serait pire que le résidu.
 *
 * ── SANS FUSEAU ────────────────────────────────────────────────────────────────────────────────
 *
 * On retombe sur midi UTC. Ce n'est pas mieux qu'avant, mais ce n'est pas pire : sans fuseau, il
 * n'existe aucun « jour local » à viser. La fenêtre d'incertitude, elle, s'élargit à 50 h et c'est
 * elle qui porte l'aveu.
 */
function midiDuJourLocal(a: number, m: number, j: number, fuseau: string | null | undefined): Date {
  const naif = Date.UTC(a, m - 1, j, 12, 0, 0);
  if (!fuseau) return new Date(naif);
  try {
    return instantDepuisLocal(naif, fuseau);
  } catch {
    // Fuseau inconnu d'`Intl` : c'est le cas `fuseau_invalide`, déjà nommé par l'appelant.
    return new Date(naif);
  }
}

export function resoudreInstant(entrees: EntreesNaissance): InstantResolu {
  const { a, m, j } = eclaterDate(entrees.date);

  const sansHeure = (raison: RaisonSansHeure): InstantResolu => ({
    instantUtc: midiDuJourLocal(a, m, j, entrees.fuseau),
    heureConnue: false,
    raisonSansHeure: raison,
  });

  if (!entrees.heure) return sansHeure("heure_absente");
  if (!entrees.fuseau) return sansHeure("fuseau_absent");

  const { hh, mi, ss } = eclaterHeure(entrees.heure);
  const naif = Date.UTC(a, m - 1, j, hh, mi, ss);

  try {
    return { instantUtc: instantDepuisLocal(naif, entrees.fuseau), heureConnue: true };
  } catch {
    // `Intl` jette sur un identifiant de fuseau inconnu. On DÉGRADE plutôt que de propager : le
    // reste du thème (les dix corps, les nœuds) ne dépend pas du fuseau et reste juste. Faire
    // échouer tout le socle à cause d'un champ facultatif mal rempli serait disproportionné —
    // mais la raison est nommée pour que le défaut de donnée reste trouvable (AC6).
    return sansHeure("fuseau_invalide");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 5.3 — LA FENÊTRE D'INCERTITUDE
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// Sans heure, `resoudreInstant` prend MIDI et le calcul aboutit : longitude finie, signe rendu,
// rien qui signale que ce signe est un PARI. La fenêtre est ce qui rend le pari visible — elle
// borne les instants où la naissance a réellement pu avoir lieu.

/** Les décalages UTC extrêmes réellement en vigueur : Baker à UTC−12, Kiribati à UTC+14. */
const DECALAGE_MAX_EST_MS = 14 * 3600_000;
const DECALAGE_MAX_OUEST_MS = 12 * 3600_000;

/**
 * L'intervalle des instants UTC où la naissance a pu avoir lieu.
 *
 * `min === max` ⇒ l'instant est connu exactement : aucun signe n'est ambigu, et RIEN n'est
 * échantillonné (le surcoût ne frappe que le cas dégradé).
 */
export interface FenetreInstant {
  readonly min: Date;
  readonly max: Date;
}

/**
 * Les quatre cas, et ce qu'on ignore dans chacun (Story 5.3, décision D2).
 *
 * | heure | fuseau | ce qu'on ignore | durée |
 * |---|---|---|---|
 * | connue | connu   | rien              | 0     |
 * | absente| connu   | l'heure du jour   | le jour LOCAL (23, 24 ou 25 h) |
 * | absente| inconnu | l'heure ET le décalage | 50 h |
 * | connue | inconnu | le décalage       | 26 h  |
 *
 * ⚠️ LE JOUR LOCAL N'EST PAS « MINUIT + 24 H ». Aux changements d'heure il dure 23 h ou 25 h. On
 * résout les DEUX bornes par le fuseau ; on n'en additionne aucune. Une heure de trop, c'est un
 * demi-degré de Lune, largement de quoi fabriquer une ambiguïté qui n'existe pas.
 *
 * ⚠️ SANS FUSEAU, LA FENÊTRE N'EST PAS DE 24 H. Le jour LOCAL n'est pas connu si le fuseau ne l'est
 * pas : l'instant vrai va de « minuit à UTC+14 » à « minuit du lendemain à UTC−12 ». Prendre 24 h
 * déclarerait certains des signes qui ne le sont pas (P7) — le mensonge exact que la 5.3 refuse.
 */
/** Les composantes d'une heure, ou `null` si elle est absente OU illisible. Ne jette jamais. */
function lireHeureOuRien(texte: string | null | undefined): { hh: number; mi: number; ss: number } | null {
  if (!texte) return null;
  try {
    return eclaterHeure(texte);
  } catch {
    return null;
  }
}

export function fenetreIncertitude(entrees: EntreesNaissance): FenetreInstant {
  const { a, m, j } = eclaterDate(entrees.date);

  // Heure ET fuseau exploitables → un point. `resoudreInstant` est la SOURCE UNIQUE de cette
  // décision : la dupliquer ici ferait diverger les deux le jour où l'une des deux évolue.
  const resolu = resoudreInstant(entrees);
  if (resolu.heureConnue) return { min: resolu.instantUtc, max: resolu.instantUtc };

  if (resolu.raisonSansHeure === "heure_absente" && entrees.fuseau) {
    try {
      // `Date.UTC(a, m-1, j+1)` gère le débordement de mois et d'année tout seul.
      return {
        min: instantDepuisLocal(Date.UTC(a, m - 1, j, 0, 0, 0), entrees.fuseau),
        max: instantDepuisLocal(Date.UTC(a, m - 1, j + 1, 0, 0, 0), entrees.fuseau),
      };
    } catch {
      // Fuseau inconnu ET heure absente : on retombe sur la fenêtre large ci-dessous. `resoudreInstant`
      // ne l'a pas signalé parce qu'il teste l'absence d'heure AVANT la validité du fuseau.
    }
  }

  // Le décalage est inconnu. `naif` = la lecture de calendrier locale prise comme si elle était UTC ;
  // l'instant vrai est `naif − décalage`, donc quelque part dans `[naif − 14 h, naif + 12 h]`.
  // ⚠️ LA LECTURE DE L'HEURE NE DOIT PAS FAIRE EXPLOSER LE SOCLE (revue du 2026-08-12, B5).
  //
  // `eclaterHeure` JETTE sur une heure illisible, et c'est juste là où elle est appelée — mais ici
  // elle contredisait une décision déjà prise deux fonctions plus haut. Avec `{ heure: "7h15" }` et
  // AUCUN fuseau, `resoudreInstant` dégrade proprement (`fuseau_absent`, midi par défaut) : il a
  // décidé que cette heure ne servirait pas. `fenetreIncertitude` la reparsait quand même et
  // levait — donc `calculerThemeNatal`, documenté « aboutit TOUJOURS avec ce qui est disponible »
  // (AC6/FR-049), mourait sur une entrée que son propre fichier venait de savoir traiter.
  //
  // Deux fonctions voisines, la même entrée, deux décisions opposées. On suit celle qui dégrade :
  // une heure illisible est une heure qu'on n'a pas, et la fenêtre s'élargit à la journée entière —
  // ce qui est exactement l'aveu correct.
  const heure = lireHeureOuRien(resolu.raisonSansHeure === "heure_absente" ? null : entrees.heure);
  const naifDebut = Date.UTC(a, m - 1, j, heure?.hh ?? 0, heure?.mi ?? 0, heure?.ss ?? 0);
  // Sans heure, `naif` couvre tout le jour : la borne haute part de MINUIT DU LENDEMAIN.
  const naifFin = heure ? naifDebut : Date.UTC(a, m - 1, j + 1, 0, 0, 0);
  return {
    min: new Date(naifDebut - DECALAGE_MAX_EST_MS),
    max: new Date(naifFin + DECALAGE_MAX_OUEST_MS),
  };
}

/**
 * Pas d'échantillonnage de la fenêtre (Story 5.3, décision D3).
 *
 * Tester seulement les deux bornes serait plus simple, et faux dans un cas précis : un corps proche
 * d'une STATION (fin de rétrogradation) peut sortir d'un signe et y revenir à l'intérieur de la
 * fenêtre. Les deux bornes donneraient le même signe, la vérité serait l'autre.
 *
 * Coût maximal : 51 instants × 13 corps = 663 lectures, UNE FOIS, au calcul (le thème est gravé —
 * AD-6). Quand l'heure est connue, la fenêtre est un point et ce code ne tourne pas.
 *
 * RÉSIDU ASSUMÉ : un corps qui franchirait une cuspide et reviendrait en moins d'une heure
 * échapperait encore — cela suppose une station à moins de ~0,05° d'une cuspide. La correction
 * exacte est un solveur de changement de signe ; elle est déférée, et le résidu est écrit.
 */
const PAS_ECHANTILLONNAGE_MS = 3600_000;

/**
 * Le signe de ce corps est-il le même PARTOUT dans la fenêtre ?
 *
 * ⚠️ CE N'EST PAS UN CAS PARTICULIER DE LA LUNE (décision D1). En 24 h la Lune parcourt ~13,2° et
 * traverse une cuspide environ deux fois sur cinq ; mais le Soleil le fait un jour sur trente, et
 * le Soleil est LE nombre que tout le monde connaît. Un `if (corps === "lune")` laisserait donc
 * passer un Soleil faux sur trente naissances sans heure — invérifiable, et d'apparence normale.
 *
 * Une lecture illisible (corps inconnu de la source, date hors plage, valeur non finie) est
 * IGNORÉE plutôt que traitée comme ambiguë : l'existence du corps est décidée par la lecture
 * centrale dans `calculerThemeNatal`. Confondre les deux ferait disparaître Chiron sous une raison
 * qui n'est pas la sienne.
 */
export function signeAmbigu(
  corps: Corps,
  fenetre: FenetreInstant,
  ephemeride: EphemerisPort,
): boolean {
  const debut = fenetre.min.getTime();
  const fin = fenetre.max.getTime();
  if (!(fin > debut)) return false;

  const instants: number[] = [];
  for (let t = debut; t < fin; t += PAS_ECHANTILLONNAGE_MS) instants.push(t);
  instants.push(fin); // la borne haute est TOUJOURS échantillonnée, même si le pas ne tombe pas juste

  let reference: Signe | null = null;
  for (const t of instants) {
    const lecture = ephemeride.longitudeEcliptique(corps, new Date(t));
    if (lecture.statut !== "calcule" || !Number.isFinite(lecture.longitude)) continue;
    const { signe } = placer(lecture.longitude);
    if (reference === null) reference = signe;
    else if (signe !== reference) return true;
  }
  return false;
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

/**
 * Pourquoi un corps ne figure pas dans le thème.
 *
 * `RaisonNonCalcule` vient du PORT : ce que la SOURCE ne sait pas faire (Chiron, date hors plage).
 * `signe_ambigu_sans_heure` vient du DOMAINE : la source sait parfaitement calculer ce corps — c'est
 * l'INSTANT qui n'est pas connu assez précisément pour que son signe le soit (Story 5.3, D1).
 *
 * ⚠️ NE PAS ajouter cette raison à `RaisonNonCalcule` dans `port.ts`. Un adaptateur ne peut pas la
 * produire : il ne connaît ni la fenêtre, ni l'heure de naissance. L'y mettre inviterait le prochain
 * lecteur à croire qu'une éphéméride peut en décider.
 */
export type RaisonAbsenceCorps = RaisonNonCalcule | "signe_ambigu_sans_heure";

export interface CorpsNonCalcule {
  readonly corps: Corps;
  readonly raison: RaisonAbsenceCorps;
}

export interface ThemeNatal {
  /**
   * Version de FORME du document (pas la version de la ligne `theme_natal`, qui compte les recalculs).
   *
   * ⚠️ CE NUMÉRO ET LE PRÉFIXE DE `chaineEmpreinte` SE BUMPENT ENSEMBLE (Story 5.3, D4/P1). Bumper
   * celui-ci seul rend inexploitable tout thème déjà gravé, ET le trigger de 0039 refuse le recalcul
   * (l'empreinte n'aurait pas changé) : le socle meurt pour tous les comptes existants, sans une
   * seule erreur nulle part. `tests/theme-natal.test.ts` lie les deux.
   */
  readonly schema: 2;
  /** Identifiant de la source d'éphéméride employée — entre dans l'empreinte d'entrées (0039). */
  readonly adaptateur: string;
  readonly positions: readonly PositionCorps[];
  /** Ce qui n'a PAS pu être calculé, avec sa raison. Jamais silencieux (P2). */
  readonly absents: readonly CorpsNonCalcule[];
  readonly angles: Angles;
  /**
   * `midi_par_defaut` ⇒ l'heure manquait, l'instant retenu est midi du jour LOCAL (midi UTC si le
   * fuseau est lui aussi inconnu) : la Lune est à ±7,7° près et tout ce qui dépend de l'heure est
   * absent. La story 5.3 lit ce champ pour dire ce qui manque ; `ciblesNatalesDe` (5.4) le lit pour
   * refuser d'aspecter la Lune natale, qu'on ne connaît alors pas à mieux que deux fois l'orbe.
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

  // Story 5.3 (D1) — la fenêtre des instants possibles. Ponctuelle quand l'heure est connue : le
  // `fenetreOuverte` ci-dessous coupe alors TOUT échantillonnage, et le cas nominal ne paie rien.
  const fenetre = fenetreIncertitude(entrees);
  const fenetreOuverte = fenetre.max.getTime() > fenetre.min.getTime();

  const positions: PositionCorps[] = [];
  const absents: CorpsNonCalcule[] = [];

  for (const corps of CORPS) {
    const lecture = ephemeride.longitudeEcliptique(corps, instantUtc);
    if (lecture.statut === "non_calcule") {
      absents.push({ corps, raison: lecture.raison });
      continue;
    }
    // Story 5.3 (AC1/FR-049) — le corps est calculable, mais son SIGNE l'est-il ? Si la fenêtre
    // traverse une cuspide, le signe de midi est un pari. On le déclare absent plutôt que de le
    // servir avec l'autorité d'un calcul — même règle que Chiron, appliquée au temps au lieu de
    // la source.
    if (fenetreOuverte && signeAmbigu(corps, fenetre, ephemeride)) {
      absents.push({ corps, raison: "signe_ambigu_sans_heure" });
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
    schema: 2,
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
    // ⚠️ CE PRÉFIXE EST LE LEVIER DE MIGRATION DE FORME, pas une décoration de version (Story 5.3,
    // D4/P1). L'empreinte ne dépend que des entrées de naissance et de l'adaptateur : changer la
    // FORME du thème ne la changerait pas, et le trigger de 0039 refuserait donc le recalcul —
    // laissant tous les thèmes déjà gravés inexploitables et impossibles à réparer. Bumper ce
    // préfixe en même temps que `ThemeNatal.schema` débloque exactement UN recalcul par compte.
    `v${2 satisfies ThemeNatal["schema"]}`,
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
