import {
  CORPS,
  type Corps,
  type EphemerisPort,
} from "./port";
import {
  normaliserDegres,
  placer,
  type CorpsNonCalcule,
  type FenetreInstant,
  type PositionCorps,
  type Signe,
  type ThemeNatal,
} from "./theme-natal";

/**
 * quotidien.ts — LE SOCLE QUOTIDIEN : le ciel du jour et ses configurations (Story 5.4).
 *
 * Module PUR, comme tout `lib/astro/` : aucune I/O, aucun `server-only`, aucun import de
 * `@/lib/ai/*` (frontière de déterminisme AD-6), **aucune horloge et aucun hasard** — les deux sont
 * bannis par `tests/astro-architecture.test.ts`. « Quel jour est-on ? » est une question que ce
 * module ne pose jamais : on la lui répond.
 *
 * ── AUCUNE PROSE, ET C'EST STRUCTUREL (FR-053) ─────────────────────────────────────────────────
 *
 * L'horoscope est **la surface la plus dangereuse du produit** pour « le socle ne prédit jamais » :
 * le genre tout entier est bâti sur la prédiction. La parade est la même qu'en 5.1 — tout ce que
 * produit ce module est fait de NOMBRES et d'ÉNUMÉRATIONS. Il n'existe aucun champ de texte libre,
 * donc aucun endroit où une prédiction pourrait s'écrire. Le texte vit dans `lib/corpus/`, où le
 * détecteur de prédiction de la 5.2 le police.
 *
 * ⚠️ `lib/astro/` n'importe JAMAIS `lib/corpus/`. La dépendance va dans l'autre sens (le corpus
 * connaît le domaine, pas l'inverse) ; l'inverser ferait entrer la prose dans le socle et viderait
 * la garde ci-dessus de son sens.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le jour civil
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un jour de calendrier, en COMPOSANTES.
 *
 * Volontairement pas un `Date` : un `Date` est un instant, et un instant n'a pas de « jour » tant
 * qu'on n'a pas choisi un fuseau. Le domaine n'a aucun moyen de le choisir — c'est la couche data
 * qui tranche (`Europe/Paris`, décision D3), exactement comme `lire-numerologie.ts` tranche l'année
 * de référence. Prendre un `Date` ici, c'est rouvrir la question à chaque appel.
 *
 * `m` est le mois HUMAIN, 1..12. Pas l'index 0..11 de `Date` : ce module est lu par des humains, et
 * un mois qui vaut 7 en août est une faute qui se recopie.
 */
export interface JourCivil {
  readonly a: number;
  readonly m: number;
  readonly j: number;
}

/** L'époque du compteur. Arbitraire et fixe : seules les DIFFÉRENCES et le modulo comptent. */
const EPOQUE_UTC = Date.UTC(2000, 0, 1);
const MS_PAR_JOUR = 86_400_000;

/**
 * Le numéro d'un jour, entier, qui avance de 1 par jour de calendrier.
 *
 * Compte des jours de CALENDRIER, pas des durées : `Date.UTC` ignore les changements d'heure (il n'y
 * en a pas en UTC), donc la journée de 23 h du passage à l'heure d'été compte pour 1 comme les
 * autres. Un compteur bâti sur des millisecondes LOCALES avancerait de 0,958 ce jour-là.
 *
 * ⚠️ JETTE sur une année à deux chiffres. `Date.UTC(99, 0, 1)` désigne **1999**, silencieusement —
 * c'est le plus ancien piège de JavaScript, et il décale de 1900 ans sans rien signaler.
 */
export function numeroDeJour(jour: JourCivil): number {
  if (!Number.isInteger(jour.a) || jour.a < 100) {
    throw new Error("quotidien : année invalide — `Date.UTC(99, …)` désignerait 1999 (attendu ≥ 100)");
  }
  return Math.round((Date.UTC(jour.a, jour.m - 1, jour.j) - EPOQUE_UTC) / MS_PAR_JOUR);
}

/**
 * L'indice du jour dans une rotation de `cardinal` éléments.
 *
 * C'est la SÉLECTION du mantra du jour (D8) : elle ne dépend que du jour. Aucun paramètre par lequel
 * le journal, une branche ou un échange pourrait entrer — FR-033 devient une propriété de la
 * signature plutôt qu'une consigne.
 *
 * `cardinal` est un PARAMÈTRE parce que `lib/astro` ne connaît pas la taille du corpus et n'a pas à
 * la connaître (D9).
 *
 * ⚠️ Le `+ cardinal` n'est pas de la superstition : `%` garde le signe du dividende en JavaScript.
 * Un jour antérieur à l'époque rendrait un indice NÉGATIF, donc `CLES[-2] === undefined`, donc un
 * texte manquant sans la moindre erreur.
 */
export function indiceDuJour(jour: JourCivil, cardinal: number): number {
  if (!Number.isInteger(cardinal) || cardinal < 1) {
    throw new Error(`quotidien : cardinal de rotation invalide (${cardinal}) — attendu un entier ≥ 1`);
  }
  const n = numeroDeJour(jour);
  return ((n % cardinal) + cardinal) % cardinal;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La géométrie des aspects
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * L'écart entre deux longitudes, par l'ARC LE PLUS COURT, dans `[0, 180]`.
 *
 * ⚠️ PIÈGE P3 — une soustraction rate tout aspect à cheval sur 0° du Bélier : 359° et 2° sont à
 * **3°** l'un de l'autre, pas à 357°. C'est un douzième du zodiaque qui disparaîtrait sans qu'aucun
 * test ne plante et sans qu'aucune valeur n'ait l'air fausse.
 *
 * `normaliserDegres` jette sur une valeur non finie : une longitude aberrante est un incident de
 * calcul, pas une donnée manquante (règle P9 de la 5.1).
 */
export function ecartAngulaire(a: number, b: number): number {
  const d = normaliserDegres(a - b);
  return d > 180 ? 360 - d : d;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le ciel du jour
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Les corps dont un aspect dure des HEURES ou des JOURS — les seuls qui font qu'un jour ne
 * ressemble pas au précédent (décision D4).
 *
 * ⚠️ NE PAS Y AJOUTER JUPITER, SATURNE, URANUS, NEPTUNE NI PLUTON. Un aspect de Pluton reste dans
 * l'orbe pendant **deux ans** : la sélection « la configuration la plus serrée » se verrouillerait
 * dessus, et le produit dirait chaque matin la même chose avec l'autorité d'un calcul. Les transits
 * lents sont réels et importants en astrologie ; ils ne sont simplement pas l'unité du JOUR.
 * `tests/quotidien.test.ts` MESURE la variation sur 30 jours — c'est là que le mutant meurt.
 */
export const CORPS_TRANSITANTS: readonly Corps[] = Object.freeze([
  "lune",
  "soleil",
  "mercure",
  "venus",
  "mars",
]);

/**
 * Un corps change de signe dans la journée.
 *
 * ⚠️ C'EST UN FAIT, PAS UNE ABSENCE (décision D1, piège P1). La 5.3 a établi que sans heure de
 * naissance, un signe indéterminable est une absence — parce que l'instant vrai est INCONNU dans la
 * fenêtre. Ici il n'y a aucune inconnue : la Lune est réellement en Lion le matin et en Vierge le
 * soir. Ce n'est pas une incertitude, c'est un événement — et c'est le fait le plus intéressant de
 * la journée. Réutiliser `signeAmbigu` ici livrerait un horoscope sans Lune deux jours sur cinq.
 */
export interface ChangementDeSigne {
  readonly corps: Corps;
  readonly depuis: Signe;
  readonly vers: Signe;
}

export interface CielDuJour {
  /** L'instant auquel les positions sont rapportées — MIDI du jour civil (décision D2). */
  readonly instantReference: Date;
  /** Les positions à l'instant de référence. Aucune `maison` : le ciel n'a pas d'angles. */
  readonly positions: readonly PositionCorps[];
  /** Ce que la source ne sait pas calculer, avec sa raison. Jamais silencieux. */
  readonly absents: readonly CorpsNonCalcule[];
  readonly changementsDeSigne: readonly ChangementDeSigne[];
}

/**
 * Un jour civil RÉSOLU en instants — ce que la couche data produit et que le domaine consomme.
 *
 * Le domaine ne peut pas le construire lui-même : passer d'un jour de calendrier à des instants
 * demande de choisir un fuseau, et ce choix (`Europe/Paris`, D3) n'appartient pas au domaine — même
 * découpage qu'en 5.2, où `calculerNumerologie` reçoit une année et jamais un `Date`.
 */
export interface JourResolu {
  readonly jour: JourCivil;
  /** Les bornes UTC du jour civil. **23, 24 ou 25 h** selon le changement d'heure — jamais « +24 h ». */
  readonly fenetre: FenetreInstant;
  /** Midi (D2) : l'écart maximal à n'importe quel moment de la journée y est le plus petit. */
  readonly reference: Date;
}

/**
 * Pas d'échantillonnage pour la détection des changements de signe.
 *
 * Distinct — dans son intention, pas seulement dans sa valeur — du pas de `signeAmbigu` (5.3) :
 * là-bas on cherche si un signe est INDÉTERMINABLE, ici on cherche un ÉVÉNEMENT daté. Les garder
 * séparés évite qu'un réglage de l'un déplace silencieusement l'autre.
 *
 * RÉSIDU ASSUMÉ, le même qu'en 5.3 : une excursion de moins d'une heure hors du signe échapperait.
 * Cela suppose une station à moins de ~0,05° d'une cuspide.
 */
const PAS_DETECTION_MS = 3_600_000;

/**
 * Le ciel du jour : où sont les corps à midi, et lesquels changent de signe.
 *
 * Ne dépend d'AUCUNE donnée personnelle — c'est le même ciel pour tout le monde. C'est cette
 * propriété qui permet de le mémoïser une fois par jour dans la couche data (décision D7) plutôt
 * que de créer une table par utilisatrice et par jour.
 *
 * Les changements de signe ne sont cherchés que pour `CORPS_TRANSITANTS` : un corps lent ne change
 * pas de signe en 24 h, et l'échantillonner serait payer 8 × 25 lectures pour un résultat connu.
 */
export function cielDuJour(jour: JourResolu, ephemeride: EphemerisPort): CielDuJour {
  const positions: PositionCorps[] = [];
  const absents: CorpsNonCalcule[] = [];

  for (const corps of CORPS) {
    const lecture = ephemeride.longitudeEcliptique(corps, jour.reference);
    if (lecture.statut === "non_calcule") {
      absents.push({ corps, raison: lecture.raison });
      continue;
    }
    // `normaliserDegres` jette sur non fini : une éphéméride qui rend NaN est un incident, pas une
    // absence — même règle qu'en 5.1 (P9).
    const longitude = normaliserDegres(lecture.longitude);
    const { signe, degre } = placer(longitude);
    positions.push({ corps, longitude, signe, degre });
  }

  const changementsDeSigne: ChangementDeSigne[] = [];
  for (const corps of CORPS_TRANSITANTS) {
    for (const c of changementsDe(corps, jour.fenetre, ephemeride)) changementsDeSigne.push(c);
  }

  return {
    instantReference: jour.reference,
    positions: Object.freeze(positions),
    absents: Object.freeze(absents),
    changementsDeSigne: Object.freeze(changementsDeSigne),
  };
}

/**
 * Les changements de signe d'un corps sur la fenêtre, dans l'ordre chronologique.
 *
 * On enregistre CHAQUE transition entre deux échantillons consécutifs, et pas seulement l'écart
 * entre les deux bornes : un corps proche d'une station peut sortir d'un signe et y revenir dans la
 * journée. Comparer les bornes déclarerait alors « rien n'a bougé », ce qui est faux.
 *
 * Une lecture illisible est IGNORÉE (le corps garde son dernier signe connu) plutôt que traitée
 * comme un changement : l'existence du corps est décidée par la lecture centrale de `cielDuJour`,
 * et confondre les deux ferait apparaître des transitions fantômes pour Chiron.
 */
function changementsDe(
  corps: Corps,
  fenetre: FenetreInstant,
  ephemeride: EphemerisPort,
): readonly ChangementDeSigne[] {
  const debut = fenetre.min.getTime();
  const fin = fenetre.max.getTime();
  if (!(fin > debut)) return [];

  const instants: number[] = [];
  for (let t = debut; t < fin; t += PAS_DETECTION_MS) instants.push(t);
  instants.push(fin); // la borne haute est TOUJOURS échantillonnée, même si le pas ne tombe pas juste

  const trouves: ChangementDeSigne[] = [];
  let precedent: Signe | null = null;
  for (const t of instants) {
    const lecture = ephemeride.longitudeEcliptique(corps, new Date(t));
    if (lecture.statut !== "calcule" || !Number.isFinite(lecture.longitude)) continue;
    const { signe } = placer(lecture.longitude);
    if (precedent !== null && signe !== precedent) {
      trouves.push({ corps, depuis: precedent, vers: signe });
    }
    precedent = signe;
  }
  return trouves;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les configurations : ce que le ciel du jour touche dans le thème natal
// ══════════════════════════════════════════════════════════════════════════════════════════════

export type Aspect = "conjonction" | "sextile" | "carre" | "trigone" | "opposition";

/**
 * Les cinq aspects majeurs et leur angle. L'ORDRE EST SIGNIFIANT : il sert de départage stable
 * quand deux configurations ont la même orbe (piège P4). Ne pas réordonner.
 */
export const ASPECTS: readonly { readonly nom: Aspect; readonly angle: number }[] = Object.freeze([
  Object.freeze({ nom: "conjonction" as const, angle: 0 }),
  Object.freeze({ nom: "sextile" as const, angle: 60 }),
  Object.freeze({ nom: "carre" as const, angle: 90 }),
  Object.freeze({ nom: "trigone" as const, angle: 120 }),
  Object.freeze({ nom: "opposition" as const, angle: 180 }),
]);

/**
 * L'ORBE — l'écart maximal à l'angle exact pour qu'un aspect compte. UNE seule valeur (décision D5).
 *
 * L'usage astrologique module l'orbe par corps et par aspect. Ces tables ne se reconstruisent pas de
 * mémoire, et une erreur y est INDÉTECTABLE : elle n'échoue jamais, elle ajoute ou retire simplement
 * une configuration — plausible, invérifiable, faux. C'est mot pour mot l'argument qui a fait
 * refuser Placidus (5.1) et l'approximation de Chiron.
 *
 * C'est un PARAMÈTRE, pas une vérité : le jour où une astrologue tranche, cette constante bouge et
 * rien d'autre.
 */
export const ORBE_DEGRES = 3;

/**
 * Ce que le ciel du jour peut toucher.
 *
 * ⚠️ `"ascendant"` N'EST PAS un `Corps` et ne doit jamais le devenir : ce n'est pas un objet qu'une
 * éphéméride connaît, c'est un angle dérivé de l'heure et du lieu. L'ajouter à `Corps` casserait
 * `CORPS`, sur lequel `calculerThemeNatal` itère pour interroger l'éphéméride.
 */
export type CibleNatale = Corps | "ascendant";

/**
 * Les trois points que le texte du jour commente (décision D6).
 *
 * Aspecter les treize corps natals donnerait 5 × 13 = 65 créneaux de corpus à écrire — pour une
 * seule autrice (FR-054, FR-086). Ce n'est pas que de l'économie : les transits aux luminaires et
 * aux angles sont ceux qui comptent dans la pratique, et ce sont les trois points qu'une personne
 * identifie comme ELLE. Les autres corps natals restent calculés et exposés comme faits ; ils ne
 * portent simplement pas le texte du jour.
 *
 * L'ORDRE EST SIGNIFIANT (départage P4).
 */
export const CIBLES_NATALES: readonly CibleNatale[] = Object.freeze(["soleil", "lune", "ascendant"]);

export interface Configuration {
  readonly corpsTransitant: Corps;
  readonly aspect: Aspect;
  readonly cible: CibleNatale;
  /** Écart à l'angle exact, en degrés, dans `[0, ORBE_DEGRES]`. Plus il est petit, plus c'est serré. */
  readonly orbe: number;
}

/**
 * La longitude natale d'une cible, ou `null` si elle n'existe pas dans ce thème.
 *
 * ⚠️ PIÈGE P11 — les cibles se prennent dans ce que le thème CONTIENT, jamais dans la liste des
 * corps possibles. Chiron est toujours absent ; sans heure de naissance, l'ascendant l'est aussi et
 * d'autres corps peuvent l'être (signe indéterminable, 5.3). Lire `undefined` puis calculer dessus
 * donnerait `NaN`, donc une orbe de 0 après coercition, donc une configuration FANTÔME parfaitement
 * serrée — le mensonge le plus plausible que cette story puisse produire.
 */
function longitudeNatale(theme: ThemeNatal, cible: CibleNatale): number | null {
  if (cible === "ascendant") {
    return theme.angles.statut === "calcule" ? theme.angles.ascendant : null;
  }
  const position = theme.positions.find((p) => p.corps === cible);
  return position ? position.longitude : null;
}

/**
 * Toutes les configurations du jour, TRIÉES DU PLUS SERRÉ AU PLUS LÂCHE.
 *
 * ⚠️ PIÈGE P4 — le tri est TOTAL. Deux configurations d'orbe égale (l'égalité arrive dès qu'on
 * arrondit, et la conjonction d'un corps à deux cibles proches la produit) doivent être départagées
 * de façon stable, sinon l'horoscope change entre deux exécutions et le déterminisme de FR-047
 * tombe — sans qu'aucun test ponctuel ne s'en aperçoive.
 */
export function configurations(ciel: CielDuJour, theme: ThemeNatal): readonly Configuration[] {
  const trouvees: Configuration[] = [];

  for (const corpsTransitant of CORPS_TRANSITANTS) {
    const transit = ciel.positions.find((p) => p.corps === corpsTransitant);
    if (!transit) continue; // la source ne sait pas placer ce corps aujourd'hui

    for (const cible of CIBLES_NATALES) {
      const natal = longitudeNatale(theme, cible);
      if (natal === null) continue; // P11

      const separation = ecartAngulaire(transit.longitude, natal);
      for (const { nom, angle } of ASPECTS) {
        const orbe = Math.abs(separation - angle);
        if (orbe <= ORBE_DEGRES) trouvees.push({ corpsTransitant, aspect: nom, cible, orbe });
      }
    }
  }

  const rang = <T>(liste: readonly T[], valeur: T) => liste.indexOf(valeur);
  return Object.freeze(
    trouvees.sort(
      (x, y) =>
        x.orbe - y.orbe ||
        rang(CORPS_TRANSITANTS, x.corpsTransitant) - rang(CORPS_TRANSITANTS, y.corpsTransitant) ||
        ASPECTS.findIndex((a) => a.nom === x.aspect) - ASPECTS.findIndex((a) => a.nom === y.aspect) ||
        rang(CIBLES_NATALES, x.cible) - rang(CIBLES_NATALES, y.cible),
    ),
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La Lune du jour rapportée au Soleil natal
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Pourquoi la Lune relative n'a pas pu être établie. Fermé, comme toutes les raisons d'absence du
 * socle : une raison libre finirait en texte d'excuse, donc en prose stockée (FR-053).
 */
export type RaisonSansLuneRelative = "lune_du_jour_absente" | "soleil_natal_absent";

/**
 * La distance, EN SIGNES, entre la Lune du jour et le Soleil natal — `0..11`.
 *
 * C'est le seul élément du socle quotidien qui soit présent TOUS LES JOURS (décision D11) : une
 * configuration dans l'orbe n'existe qu'environ un jour sur deux, et un rendez-vous quotidien à
 * moitié vide n'est pas un rendez-vous. Elle est personnelle, et elle ne demande que le Soleil
 * natal — disponible même sans heure de naissance.
 *
 * ⚠️ Elle change tous les ~2,5 jours : le même texte sort deux à trois jours de suite. C'est ce qui
 * rend la configuration dominante nécessaire par-dessus — c'est elle qui fait qu'un jour ne
 * ressemble pas au précédent.
 */
export type LuneRelative =
  | { readonly statut: "calcule"; readonly distance: number }
  | { readonly statut: "non_calcule"; readonly raison: RaisonSansLuneRelative };

export function luneRelative(ciel: CielDuJour, theme: ThemeNatal): LuneRelative {
  const lune = ciel.positions.find((p) => p.corps === "lune");
  if (!lune) return { statut: "non_calcule", raison: "lune_du_jour_absente" };

  const soleil = theme.positions.find((p) => p.corps === "soleil");
  // Le Soleil natal manque quand son signe est indéterminable sans heure (5.3, D1) — environ une
  // naissance sans heure sur trente. On DÉCLARE l'absence : ni signe deviné depuis la date de
  // naissance, ni repli sur un autre corps.
  if (!soleil) return { statut: "non_calcule", raison: "soleil_natal_absent" };

  // ⚠️ Le `+ 12` n'est pas de la superstition : `%` garde le signe du dividende en JavaScript, et un
  // index négatif donnerait `SIGNES[-3] === undefined` sans rien casser de visible.
  const distance = ((indexSigne(lune.longitude) - indexSigne(soleil.longitude)) % 12 + 12) % 12;
  return { statut: "calcule", distance };
}

/** L'index du signe d'une longitude, `0..11`. L'ordre de `SIGNES` EST celui du zodiaque tropical. */
function indexSigne(longitude: number): number {
  return Math.floor(normaliserDegres(longitude) / 30);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'horoscope du jour
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ PAS DE CHAMP `schema`, ET CE N'EST PAS UN OUBLI. `ThemeNatal.schema` existe parce que le thème
 * est GRAVÉ et qu'une forme stockée doit pouvoir migrer (5.3, D4). Ici rien n'est stocké (D7) : un
 * numéro de version serait un rite copié, qui laisserait croire qu'il existe quelque part un
 * document à migrer — et le prochain lecteur chercherait le levier de recalcul correspondant.
 *
 * ⚠️ AUCUN CHAMP DE TEXTE. Comme `ThemeNatal` : que des nombres et des énumérations, donc aucun
 * endroit où une prédiction pourrait s'écrire (FR-053). La garde de `tests/astro-architecture.test.ts`
 * surveille l'APPARITION d'un tel champ.
 */
export interface HoroscopeDuJour {
  readonly jour: JourCivil;
  readonly ciel: CielDuJour;
  /** Toutes les configurations dans l'orbe, de la plus serrée à la plus lâche. */
  readonly configurations: readonly Configuration[];
  /** La plus serrée. ABSENTE environ un jour sur deux — un jour sans configuration est un vrai jour. */
  readonly dominante?: Configuration;
  readonly luneRelative: LuneRelative;
}

/**
 * L'HOROSCOPE DU JOUR. Fonction pure : mêmes entrées + même port ⇒ même sortie, toujours (FR-047).
 *
 * ── LA SIGNATURE EST LA GARANTIE DE FR-033 ─────────────────────────────────────────────────────
 *
 * « Ne référence jamais le journal, une branche ou un échange » est habituellement une consigne —
 * donc quelque chose qu'on enfreint par distraction. Ici il n'existe aucun paramètre par lequel le
 * journal, une branche ou un échange pourrait entrer : ni identifiant d'utilisatrice, ni client de
 * base, ni contexte. Le thème natal et le jour, rien d'autre.
 *
 * ⚠️ NE JAMAIS Y AJOUTER UN PARAMÈTRE « pour personnaliser un peu plus ». Ce serait ouvrir la porte
 * que cette signature ferme.
 */
export function horoscopeDuJour(
  theme: ThemeNatal,
  jour: JourResolu,
  ephemeride: EphemerisPort,
): HoroscopeDuJour {
  return assemblerHoroscope(theme, jour.jour, cielDuJour(jour, ephemeride));
}

/**
 * L'assemblage SEUL, sur un ciel déjà calculé.
 *
 * Existe parce que le ciel du jour est le MÊME POUR TOUT LE MONDE et se mémoïse une fois par jour
 * dans la couche data (décision D7) : sans cette porte, chaque lecture recalculerait 138 lectures
 * d'éphéméride pour un résultat identique. Ce qui reste ici est de l'arithmétique pure sur des
 * longitudes — quelques dizaines de microsecondes.
 *
 * ⚠️ NE JAMAIS MÉMOÏSER LE RÉSULTAT DE CETTE FONCTION (piège P7) : il dépend du THÈME NATAL, qui
 * bouge — la 5.3 le recalcule le jour où l'heure de naissance arrive. Un horoscope mis en cache
 * avant ce recalcul resterait juste-en-apparence pour toujours.
 */
export function assemblerHoroscope(
  theme: ThemeNatal,
  jour: JourCivil,
  ciel: CielDuJour,
): HoroscopeDuJour {
  const trouvees = configurations(ciel, theme);
  return {
    jour,
    ciel,
    configurations: trouvees,
    ...(trouvees.length > 0 ? { dominante: trouvees[0] } : {}),
    luneRelative: luneRelative(ciel, theme),
  };
}
