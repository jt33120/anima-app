import {
  ASPECTS,
  CIBLES_NATALES,
  type Aspect,
  type CibleNatale,
  type Configuration,
  type LuneRelative,
} from "@/lib/astro/quotidien";
import { corpus, lireTexte, type Corpus, type TexteCorpus, NON_ECRIT } from "./port";

/**
 * horoscope.ts — LES 27 CRÉNEAUX D'INTERPRÉTATION DU JOUR (Story 5.4, FR-054 / FR-053 / FR-086).
 *
 * ── CE FICHIER EST VOLONTAIREMENT VIDE DE TEXTE ────────────────────────────────────────────────
 *
 * 27 créneaux DÉCLARÉS, aucun ÉCRIT. Même forme et même raison qu'en 5.2 (voir `mantra.ts`).
 *
 * ── C'EST LE CORPUS LE PLUS EXPOSÉ DU PRODUIT (FR-053) ─────────────────────────────────────────
 *
 * « Le socle ne prédit jamais », et l'horoscope est le GENRE de la prédiction : « aujourd'hui, Mars
 * te pousse à agir » est exactement la phrase qu'on attend d'un horoscope, et exactement celle qui
 * est interdite. Le détecteur de la 5.2 (`chercherPredictions`) balaie ce fichier — et il refusera
 * le futur adressé (« tu verras », « cela t'apportera ») avant qu'il ne soit publié sous le nom
 * d'une personne réelle.
 *
 * La reformulation est toujours possible : un aspect DÉCRIT une configuration du ciel, il n'annonce
 * rien. « Une tension entre ce qui pousse et ce qui retient » n'est pas une prédiction ; « tu vas
 * vivre une tension » en est une.
 *
 * ── LES DEUX FAMILLES DE CRÉNEAUX (décision D11) ───────────────────────────────────────────────
 *
 *   • `lune_relative:<0..11>` — **12** créneaux, présents TOUS LES JOURS. La distance en signes
 *     entre la Lune du jour et le Soleil natal. Change tous les ~2,5 jours ;
 *   • `aspect:<aspect>:<cible>` — **15** créneaux (5 aspects × Soleil / Lune / Ascendant), pour la
 *     configuration dominante quand elle existe (~un jour sur deux). C'est elle qui fait qu'un jour
 *     ne ressemble pas au précédent.
 *
 * ── PURETÉ ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Aucun import de `@/lib/ai/*`, aucun de `@/lib/data/*`, aucun `server-only`, aucun Supabase. La
 * seule dépendance est `lib/astro/quotidien` : le corpus connaît le domaine, jamais l'inverse (D9).
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les clés
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Les douze distances possibles entre la Lune du jour et le Soleil natal. */
export const DISTANCES_LUNE: readonly number[] = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
]);

/**
 * La clé d'un créneau de Lune relative : `"lune_relative:7"`.
 *
 * Jette hors domaine, comme `cleNumerologie` : demander la distance 13 est un défaut de code, pas
 * un texte en attente. Rendre `non_ecrit` la ferait passer pour du travail d'écriture — elle
 * resterait vide pour toujours et personne n'irait la chercher.
 */
export function cleLuneRelative(distance: number): string {
  if (!DISTANCES_LUNE.includes(distance)) {
    throw new Error(`corpus horoscope : distance de Lune hors domaine (${distance}) — attendu 0..11`);
  }
  return `lune_relative:${distance}`;
}

/**
 * La clé d'un créneau d'aspect : `"aspect:carre:soleil"`.
 *
 * Trois segments et non deux, mais le format reste celui décidé en 5.2 : `"<domaine>:<valeur>"`, la
 * valeur étant ici composée. Le port ne traite les clés que comme des chaînes ; ce qui compte, c'est
 * qu'un seul format existe pour que l'inventaire de complétude s'écrive une bonne fois.
 *
 * ⚠️ Le corps TRANSITANT n'entre PAS dans la clé, et c'est la décision D6 : l'inclure donnerait
 * 5 × 5 × 3 = 75 créneaux au lieu de 15. Le texte parle de ce que la journée touche chez elle (la
 * cible) et de comment (l'aspect) ; quelle planète le fait est un FAIT affiché, pas une variante de
 * texte à écrire cinq fois.
 */
export function cleAspect(aspect: Aspect, cible: CibleNatale): string {
  if (!ASPECTS.some((a) => a.nom === aspect)) {
    throw new Error(`corpus horoscope : aspect inconnu (${aspect})`);
  }
  if (!CIBLES_NATALES.includes(cible)) {
    throw new Error(`corpus horoscope : cible hors domaine (${cible}) — voir CIBLES_NATALES`);
  }
  return `aspect:${aspect}:${cible}`;
}

/** Les 27 clés, dans l'ordre de lecture. Exportée pour rendre la complétude mesurable. */
export const CLES_HOROSCOPE: readonly string[] = Object.freeze([
  ...DISTANCES_LUNE.map((d) => `lune_relative:${d}`),
  ...ASPECTS.flatMap((a) => CIBLES_NATALES.map((c) => `aspect:${a.nom}:${c}`)),
]);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le corpus
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ TOUS LES CRÉNEAUX SONT `NON_ECRIT`. Anima écrit en remplaçant une entrée :
 *
 *     [cleAspect("carre", "soleil")]: ecrit("…"),
 */
export const CORPUS_HOROSCOPE: Corpus = corpus(
  "horoscope",
  Object.fromEntries(CLES_HOROSCOPE.map((cle) => [cle, NON_ECRIT])),
);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les jonctions calcul → texte
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Une Lune relative `non_calcule` n'a PAS de créneau : on ne cherche pas le sens d'une distance
 * qu'on n'a pas. Les deux absences restent distinctes jusqu'au bout — « je ne sais pas le calculer »
 * (il manque ton Soleil natal) n'est pas « je ne l'ai pas encore écrit ». Même règle qu'en 5.2.
 */
export function texteLuneRelative(lune: LuneRelative): TexteCorpus | null {
  if (lune.statut !== "calcule") return null;
  return lireTexte(CORPUS_HOROSCOPE, cleLuneRelative(lune.distance));
}

/** Le texte de la configuration dominante. `null` quand il n'y en a pas — un jour calme est un vrai jour. */
export function texteConfiguration(configuration: Configuration | undefined): TexteCorpus | null {
  if (!configuration) return null;
  return lireTexte(CORPUS_HOROSCOPE, cleAspect(configuration.aspect, configuration.cible));
}
