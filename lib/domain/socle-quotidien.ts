import { PALIER, TICKS_MAX_PAR_JOUR, DERIVE_PLANIFICATION_MS, type Palier } from "@/lib/domain/ordonnanceur-budget";
// Le créneau diurne vient de sa source unique (revue Epic 6, R3) : deux définitions de « le soir »
// divergent au premier ajustement, et l'une des deux devient fausse.
import { CRENEAU_DIURNE_DEBUT, CRENEAU_DIURNE_FIN } from "@/lib/domain/regime-anam";

/**
 * socle-quotidien.ts — LA MANIFESTATION QUOTIDIENNE DU SOCLE (Story 6.2 · FR-033, FR-035, NFR-015).
 *
 * Module PUR (AD-1) : aucune horloge, aucun hasard, aucune I/O, aucun `server-only`. « Quel jour
 * est-on ? » est une question qu'on lui répond, jamais une qu'il pose — même règle que `lib/astro/`.
 *
 * ── CE QUI PART, ET CE QUI NE PART PAS ─────────────────────────────────────────────────────────
 *
 * La poussée elle-même ne porte **aucune charge utile** (décision D1). Le service de poussée —
 * APNs, FCM, Mozilla — reçoit zéro octet de contenu ; le titre et le corps sont choisis dans le
 * service worker, à partir de l'ensemble ci-dessous, qui y est embarqué.
 *
 * Ce module n'est donc pas ce qui *fabrique* l'aperçu à l'exécution : c'est ce qui le **définit**,
 * et surtout ce contre quoi les gardes mordent. `tests/socle-quotidien.test.ts` passe chaque corps
 * au détecteur de prédiction (5.2), au lexique interdit (2.8) et au lexique d'aperçu ci-dessous ;
 * `tests/poussee-architecture.test.ts` exige que `public/sw.js` porte EXACTEMENT cet ensemble.
 *
 * Sans cette seconde garde, l'ensemble relu vivrait ici et l'ensemble expédié vivrait là-bas, et
 * les deux divergeraient au premier « je corrige juste une virgule dans le service worker ».
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le titre, le corps, et la limite de six mots
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Le titre de l'aperçu — le nom du produit, et rien d'autre.
 *
 * ⚠️ Il n'est PAS « Anam dit… », ni « Un message d'Anam ». L'AC1 exige que la notification du socle
 * ne soit **jamais signée d'Anam** : le socle est calculé, elle ne l'a pas écrit, et le lui attribuer
 * serait la première fabrication d'une parole qu'elle n'a pas prononcée (le voisin exact de FR-086).
 *
 * Il est identique au `title` du document (`app/layout.tsx`) et au `name` du manifeste : trois
 * surfaces exposées au monde, un seul mot, aucune n'apprend rien à qui regarde par-dessus l'épaule.
 */
export const TITRE_POUSSEE = "Anam";

/** La limite dure de l'AC2. Six mots, séparateurs d'espaces — comptés, jamais estimés. */
export const MOTS_MAX_APERCU = 6;

/**
 * L'ENSEMBLE FINI ET RELU (AC1, AC2).
 *
 * Quatre interdits pèsent en même temps sur chacune de ces lignes, et c'est ce qui rend l'exercice
 * étroit :
 *
 *   1. **rien du contenu** — ni journal, ni branche, ni échange, ni socle du jour (FR-035) ;
 *   2. **aucun registre ésotérique** — on tend le téléphone deux secondes, et si « voyance » sort,
 *      c'est raté (NFR-015, DESIGN.md §301) ;
 *   3. **aucune convocation** — « reviens », « tu as manqué », « ça fait longtemps » sont du
 *      réengagement, et l'AC3 dit qu'il n'en existe aucun ;
 *   4. **aucune signature d'Anam**, ni première personne qui la ferait parler.
 *
 * Ce qui reste est volontairement pauvre : un marqueur de présence qui n'exige rien. C'est le
 * cahier des charges, pas une limite d'écriture.
 *
 * ⚠️ **PORTE AVANT PUBLICATION — cette copie n'a pas encore été relue par Anima.** Elle vit sur la
 * surface la plus exposée du produit (un écran verrouillé, en public). Elle est provisoire au même
 * titre que les créneaux de corpus, et elle est inscrite à ce titre dans
 * `POUR-ANIMA-ce-qui-attend.md`.
 */
export const CORPS_POUSSEE: readonly string[] = Object.freeze([
  "Le jour a tourné.",
  "Rien d’urgent, comme toujours.",
  "C’est là, quand tu veux.",
  "Un moment calme est disponible.",
  "Le jour commence, sans hâte.",
  "Rien à faire aujourd’hui non plus.",
  "La journée est ouverte.",
]);

/**
 * LE LEXIQUE D'APERÇU — ce qui ne doit jamais s'afficher sur un écran verrouillé.
 *
 * ⚠️ Ce n'est **pas** un doublon de `lexique-interdit.ts` (2.8), et les confondre ferait perdre
 * l'un des deux. Celui-là police ce qu'**Anam** peut dire (promesse médicale, affect prêté,
 * emoji) ; celui-ci police ce qui peut être **vu par un tiers** au-dessus de l'épaule. Les deux
 * ensembles ne se recoupent presque pas : « lune » est parfaitement acceptable dans une séance et
 * catastrophique sur un écran verrouillé.
 *
 * Racines, pas mots entiers : « astro » attrape « astrologie », « astrologique », « astral ».
 */
export const RACINES_INTERDITES_APERCU: readonly string[] = Object.freeze([
  "astro",
  "horoscope",
  "zodia",
  "tarot",
  "carte",
  "tirage",
  "voyan",
  "medium",
  "oracle",
  "divin",
  "karma",
  "chakra",
  "aura",
  "spirit",
  "ame",
  "destin",
  "energie",
  "lune",
  "planet",
  "signe",
  "ascendant",
  "numerolog",
  "ennea",
  "rituel",
  "arcane",
  "presage",
  "augure",
  "therap",
  "anxi",
  "depress",
  "detresse",
]);

/**
 * Les racines interdites trouvées dans un texte, sur sa forme normalisée (accents pliés,
 * apostrophes unifiées) — sans quoi « énergie » passerait devant « energie ».
 *
 * Rend la liste et non un booléen : un test qui échoue doit dire QUEL mot a fui.
 */
export function chercherFuitesApercu(texte: string): readonly string[] {
  const plat = texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return RACINES_INTERDITES_APERCU.filter((racine) => plat.includes(racine));
}

/** Le nombre de mots d'un aperçu — séparateurs d'espaces, ponctuation attachée au mot. */
export function compterMots(texte: string): number {
  const mots = texte.trim().split(/\s+/).filter((m) => m.length > 0);
  return mots.length;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le choix du jour
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Le corps du jour, par calcul déterministe (AC1) — `coût marginal nul`, aucun appel modèle.
 *
 * `jour` est le jour civil au format ISO `AAAA-MM-JJ` (celui que la base produit déjà, `jour_paris`
 * en 0046). On n'accepte PAS un `Date` : un instant n'a pas de jour tant qu'on n'a pas choisi un
 * fuseau, et ce module n'a aucun moyen de le choisir (même raison qu'en `lib/astro/quotidien.ts`).
 *
 * ⚠️ L'index est calculé sur le **nombre de jours écoulés**, pas sur `jour_de_l_annee % n`. La
 * seconde écriture est tentante et fausse : au 1er janvier, l'index retombe à 0 quel que soit le
 * reste de l'année précédente, et deux personnes voyant le produit à deux jours d'écart verraient
 * la même ligne. Le compte absolu ne se réinitialise jamais.
 */
export function corpsDuJour(jour: string): string {
  return CORPS_POUSSEE[indexDuJour(jour, CORPS_POUSSEE.length)];
}

/** Le nombre de jours écoulés depuis l'époque, modulo `taille`. Exporté pour que `sw.js` le copie. */
export function indexDuJour(jour: string, taille: number): number {
  const [a, m, j] = jour.split("-").map((n) => Number.parseInt(n, 10));
  // `Date.UTC` et non `new Date(chaîne)` : la seconde interprète différemment selon la forme reçue,
  // et une composante à un chiffre suffit à basculer d'UTC au fuseau local. On ne lit pas d'horloge
  // ici — on convertit trois entiers en un compte de jours.
  const jours = Math.floor(Date.UTC(a, m - 1, j) / 86_400_000);
  return ((jours % taille) + taille) % taille;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'heure choisie, et le palier qui peut ou non l'honorer
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** 8 h 00, heure de Paris (décision D3 — un seul fuseau tant que le produit est français). */
export const HEURE_PAR_DEFAUT = 8;

/**
 * ── LE CRÉNEAU DIURNE S'APPLIQUE AUSSI À LA POUSSÉE (revue Epic 6, R3) ────────────────────────────
 *
 * ⚠️ **IL NE S'Y APPLIQUAIT PAS, ET C'ÉTAIT LE SEUL CANAL QUI ALLUME UN ÉCRAN VERROUILLÉ.**
 *
 * `creneauDiurneOuvert` (`regime-anam`) était appelé par `synthese.ts` et `rappel-echeance.ts` — les
 * deux jobs de COURRIEL. Le job de poussée lisait l'heure choisie et poussait. Le sélecteur proposait
 * 00 h à 23 h, la contrainte SQL acceptait `0..23`, et le palier `hobby` rendait le tout inerte : le
 * défaut dormait, et se serait réveillé au passage en `pro` — c'est-à-dire au moment où plus personne
 * ne relit ce fichier.
 *
 * La borne haute est **20 et non 21** : `creneauDiurneOuvert` teste `h < CRENEAU_DIURNE_FIN`, donc une
 * poussée à 21 h tombe hors créneau. On dérive les bornes de la source unique plutôt que de réécrire
 * deux nombres — deux définitions de « le soir » divergent au premier ajustement.
 *
 * ⚠️ Ceci n'est PAS la garde. La garde est `preference_socle_heure_ck` (0061), qui lie aussi
 * `service_role` : `authenticated` détient l'`update` sur `preference_socle`, et un `PATCH` PostgREST
 * direct ne voit jamais de `<select>`.
 */
export const PREMIERE_HEURE_POUSSABLE = CRENEAU_DIURNE_DEBUT;
export const DERNIERE_HEURE_POUSSABLE = CRENEAU_DIURNE_FIN - 1;

/**
 * Les heures qu'un écran a le droit de PROPOSER — indépendantes du palier.
 *
 * ⚠️ Distinctes de `heuresHonorables`, et c'est voulu : sur `hobby` l'ensemble honorable est VIDE,
 * et un sélecteur vide empêcherait de régler une préférence que la 6.2 accepte pourtant d'enregistrer
 * (« Ton choix est enregistré. Les notifications ne partent pas encore »). Ce qu'on peut CHOISIR et ce
 * que le produit peut TENIR sont deux questions, et les confondre viderait l'écran.
 */
export const HEURES_CHOISISSABLES: readonly number[] = Object.freeze(
  Array.from(
    { length: CRENEAU_DIURNE_FIN - CRENEAU_DIURNE_DEBUT },
    (_, i) => CRENEAU_DIURNE_DEBUT + i,
  ),
);

export function heureValide(heure: number): boolean {
  return (
    Number.isInteger(heure) &&
    heure >= PREMIERE_HEURE_POUSSABLE &&
    heure <= DERNIERE_HEURE_POUSSABLE
  );
}

/**
 * LES HEURES QU'UN PALIER PEUT RÉELLEMENT HONORER (décision D4, AC8).
 *
 * ⚠️ **Cette fonction ne connaît pas le mot « pro ».** Elle lit les deux faits de plateforme mesurés
 * en 6.1/6.1a et en tire la conséquence — c'est ce qui la rend robuste au jour où un troisième
 * palier apparaît, et c'est ce qui empêche le raccourci `palier === "pro"` de se glisser ici.
 *
 * Deux conditions, et l'oubli de la seconde est le piège :
 *
 *   • **la cadence** — moins de 24 déclenchements par jour ne peut pas couvrir 24 heures civiles ;
 *   • **la dérive** — même à 24 déclenchements, une dérive annoncée d'une heure ou plus déplace le
 *     déclenchement d'une heure civile à l'autre. La notification de 8 h partirait à 8 h 58 un jour
 *     et à 6 h 04 le lendemain : « l'heure choisie » serait un mot pour « à peu près ».
 *
 * Sur `hobby` (1 tick/jour, ±59 min), l'ensemble est VIDE et le job ne pousse rien. C'est AD-15 au
 * littéral : le repli produit moins d'effet, jamais plus. Une notification à une heure au hasard
 * serait un effet de plus, et c'est exactement ce qu'on refuse.
 */
export function heuresHonorables(palier: Palier): readonly number[] {
  if (!heureHonorable(TICKS_MAX_PAR_JOUR[palier], DERIVE_PLANIFICATION_MS[palier])) return Object.freeze([]);
  // Le créneau diurne (R3) borne ce que la CADENCE autorise : les deux conditions sont
  // indépendantes, et l'ensemble honorable est leur intersection. Une cadence suffisante ne rend pas
  // 3 h du matin acceptable.
  return Object.freeze(
    Array.from(
      { length: DERNIERE_HEURE_POUSSABLE - PREMIERE_HEURE_POUSSABLE + 1 },
      (_, i) => PREMIERE_HEURE_POUSSABLE + i,
    ),
  );
}

/**
 * LE PRÉDICAT NU : deux faits de plateforme entrent, un verdict sort.
 *
 * ⚠️ **Il est extrait POUR ÊTRE MUTABLE.** Écrit à l'intérieur de `heuresHonorables`, son second terme
 * était intestable : les deux paliers réels échouent ou passent les DEUX conditions ensemble, donc
 * amputer la garde de sa clause de dérive rendait exactement le même verdict — un mutant survivant, et
 * survivant pour une bonne raison (il n'existait aucune entrée qui les sépare).
 *
 * Ici, les entrées se choisissent : `(24 ticks, 59 min de dérive)` est le palier hypothétique qui
 * sépare les deux clauses, et il suffit à faire mourir le mutant. C'est la leçon des « défenses
 * redondantes » du dépôt, appliquée à une conjonction plutôt qu'à deux gardes.
 */
export function heureHonorable(ticksParJour: number, deriveMs: number): boolean {
  // Moins de 24 déclenchements par jour ne peut pas couvrir 24 heures civiles…
  if (ticksParJour < 24) return false;
  // …et une dérive d'une heure ou plus déplace le déclenchement d'une heure civile à l'autre, ce qui
  // vide « l'heure choisie » de son sens même à la bonne cadence.
  return deriveMs < 3_600_000;
}

/** Le palier courant peut-il honorer une heure choisie ? Le job s'y arrête avant toute lecture. */
export function palierHonoreLHeure(): boolean {
  return heuresHonorables(PALIER).length > 0;
}
