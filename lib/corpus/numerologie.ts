import { NOMBRES, type LectureNombre, type NomNombre } from "@/lib/astro/numerologie";
import { corpus, lireTexte, type Corpus, type TexteCorpus, NON_ECRIT } from "./port";

/**
 * numerologie.ts — LES 69 CRÉNEAUX D'INTERPRÉTATION NUMÉROLOGIQUE (Story 5.2, FR-054 / FR-086).
 *
 * ── CE FICHIER EST VOLONTAIREMENT VIDE DE TEXTE ────────────────────────────────────────────────
 *
 * Les 69 créneaux sont DÉCLARÉS, aucun n'est ÉCRIT. Ce n'est pas un travail inachevé, c'est la seule
 * forme conforme : FR-054 exige que les interprétations viennent du corpus d'Anima, et FR-086
 * rappelle qu'Anima est une personne réelle dont on ne fabrique jamais une parole. Un modèle ne peut
 * pas les écrire (FR-047), nous non plus (ce serait du texte générique repris, exactement ce que
 * FR-054 bannit), et on ne les achète pas.
 *
 * Le produit affiche donc des nombres justes et dit honnêtement, créneau par créneau, que le texte
 * n'est pas encore écrit. C'est la discipline de FR-050 — « je préfère ne pas te l'inventer » — et
 * celle de Chiron en 5.1, appliquée à la prose.
 *
 * ── COMMENT ANIMA REMPLIT CE FICHIER ───────────────────────────────────────────────────────────
 *
 * Un créneau à la fois : `[cleNumerologie("chemin_de_vie", 7)]: ecrit("…")`. Rien d'autre à changer
 * — l'inventaire de complétude, les gardes de voix et le rendu suivent tout seuls. La fiche
 * d'écriture (un créneau par ligne, avec les règles de voix) vit dans
 * `_bmad-output/implementation-artifacts/corpus-numerologie-a-ecrire.md`.
 *
 * Dès qu'un texte est déposé ici, il tombe automatiquement sous : le contrôle de voix bloquant de la
 * 2.8 (`tests/lexique-voix.test.ts` balaie `lib/` en récursif) et le détecteur de prédiction de
 * cette story (`tests/corpus-architecture.test.ts`, FR-053).
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les valeurs possibles — ce qui définit le nombre de créneaux
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Les valeurs ordinaires de tout nombre numérologique. */
const SIMPLES: readonly number[] = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);

/**
 * Les valeurs possibles d'un nombre donné.
 *
 * L'année personnelle est la seule à ne PAS porter de nombre maître : elle parcourt un cycle de neuf
 * ans, et sa racine numérique est invariante modulo 9 (voir `reduireSansMaitre`). Déclarer 11, 22 et
 * 33 pour elle créerait trois créneaux qu'Anima écrirait pour rien — et un inventaire qui ne pourrait
 * jamais atteindre 100 %.
 */
export function valeursPossibles(nombre: NomNombre): readonly number[] {
  return nombre === "annee_personnelle"
    ? SIMPLES
    : Object.freeze([...SIMPLES, 11, 22, 33]);
}

/**
 * La clé d'un créneau : `"chemin_de_vie:7"`.
 *
 * Format décidé ICI une seule fois et réutilisé tel quel par les corpus à venir — mantras (5.4),
 * ennéagramme (5.5), sens des cartes (5.7). Trois formats différents pour trois corpus rendraient
 * l'inventaire de complétude impossible à écrire une bonne fois.
 *
 * Jette sur une valeur hors domaine : demander « chemin de vie 44 » est un défaut de code, pas un
 * texte manquant (voir `lireTexte` dans le port, même raisonnement).
 */
export function cleNumerologie(nombre: NomNombre, valeur: number): string {
  if (!valeursPossibles(nombre).includes(valeur)) {
    throw new Error(`corpus numerologie : ${nombre} ne prend pas la valeur ${valeur}`);
  }
  return `${nombre}:${valeur}`;
}

/** Les 69 clés, dans l'ordre de lecture du socle. Exportée pour rendre la complétude mesurable. */
export const CLES_NUMEROLOGIE: readonly string[] = Object.freeze(
  NOMBRES.flatMap((n) => valeursPossibles(n).map((v) => `${n}:${v}`)),
);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le corpus
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ TOUS LES CRÉNEAUX SONT `NON_ECRIT` — voir l'en-tête. La table se construit depuis
 * `CLES_NUMEROLOGIE` plutôt qu'en 69 lignes recopiées : une liste écrite à la main finirait par
 * diverger de la liste des clés, et l'inventaire compterait des créneaux qui n'existent pas.
 *
 * Anima écrit en remplaçant une entrée :
 *
 *     [cleNumerologie("chemin_de_vie", 7)]: ecrit("…"),
 */
export const CORPUS_NUMEROLOGIE: Corpus = corpus(
  "numerologie",
  Object.fromEntries(CLES_NUMEROLOGIE.map((cle) => [cle, NON_ECRIT])),
);

/**
 * LA JONCTION nombre → texte.
 *
 * Un nombre `non_calcule` n'a PAS de créneau : on ne cherche pas le sens d'un nombre qu'on n'a pas.
 * Les deux absences restent distinctes de bout en bout, et la 5.6 les affichera différemment —
 * « je ne sais pas le calculer » (il manque ton nom) n'est pas « je ne l'ai pas encore écrit ».
 */
export function texteDe(nombre: NomNombre, lecture: LectureNombre): TexteCorpus | null {
  if (lecture.statut !== "calcule") return null;
  return lireTexte(CORPUS_NUMEROLOGIE, cleNumerologie(nombre, lecture.valeur));
}
