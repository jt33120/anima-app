import { corpus, NON_ECRIT, type Corpus } from "./port";

/**
 * ancrage.ts — LES CRÉNEAUX DES ANCRAGES (Story 5.9, T2 · FR-054 / FR-081 / FR-086).
 *
 * ── CE FICHIER EST VOLONTAIREMENT VIDE DE TEXTE ────────────────────────────────────────────────
 *
 * Vingt-quatre créneaux sont DÉCLARÉS, aucun n'est ÉCRIT — même forme et même raison qu'en 5.2, 5.4
 * et 5.5. FR-054 exige que les textes viennent du corpus d'Anima ; FR-086 rappelle qu'Anima est une
 * personne réelle et identifiable, dont on ne fabrique jamais une parole. Les trois façons de
 * remplir ces créneaux sans elle sont fermées : les faire générer par un modèle (FR-047 + FR-054),
 * les écrire nous-mêmes (du texte générique repris, ce que FR-054 bannit), les acheter ou les
 * recopier (FR-054, et le droit d'auteur par-dessus).
 *
 * ── LE NOMBRE D'ANCRAGES EST UNE QUESTION POUR ANIMA, PAS UNE DÉCISION DE CODE ─────────────────
 *
 * Quatre est un point de départ tenable, pas une vérité. Les clés sont donc NEUTRES
 * (`ancrage-1`… `ancrage-4`) : elles ne portent aucun nom, aucun thème, aucune promesse. Le titre
 * affiché est lui aussi un créneau de corpus — nommer les quatre exercices nous-mêmes reviendrait à
 * signer d'Anima quatre titres qu'elle n'a pas écrits. La question part dans
 * `POUR-ANIMA-ce-qui-attend.md` (Q6), au même titre que les 21 noms de carte du jeu.
 *
 * ── LA STRUCTURE VIT DANS LE DOMAINE, PAS ICI ──────────────────────────────────────────────────
 *
 * `lib/domain/ancrage.ts` déclare les cinq temps et leur ordre. Ce fichier ne connaît que des CLÉS.
 * C'est ce qui empêche la séquence de se dédoubler : une seule liste ordonnée existe dans le
 * produit, et le corpus s'y branche par `cleEtape`.
 *
 * ── PURETÉ (garde `tests/corpus-architecture.test.ts`) ─────────────────────────────────────────
 *
 * Aucun import de `@/lib/ai/*`, aucun de `@/lib/data/*`, aucun `server-only`, aucun Supabase. Un
 * corpus est une CONSTANTE.
 *
 * ⚠️ ET CONTRAIREMENT AUX AUTRES CORPUS, CELUI-CI EST PREMIUM (FR-056).
 *
 * Le mantra, l'horoscope, les nombres et l'ennéagramme sont du socle gratuit : rien n'interdit à
 * leur texte d'atteindre le client. Ici si. La garde n'est pas une policy — il n'y a pas de table —
 * c'est une FRONTIÈRE DE DÉPENDANCE : ce module n'est importé que par `lib/domain/ancrage.ts` et
 * `lib/data/lire-ancrage.ts` (`server-only`). Aucun `"use client"`, aucun module de `render/`,
 * aucune route d'API ne l'atteint, et `tests/ancrage-frontiere.test.ts` le vérifie.
 * Un import depuis un composant client mettrait les 24 textes dans le bundle de tout le monde.
 */

/** Les quatre ancrages, par clé neutre. Une cinquième se déclare ICI, jamais ailleurs. */
export const CLES_ANCRAGE: readonly string[] = Object.freeze([
  "ancrage-1",
  "ancrage-2",
  "ancrage-3",
  "ancrage-4",
]);

/** La clé du créneau de TITRE d'un ancrage. */
export function cleTitre(cle: string): string {
  return `${cle}:titre`;
}

/** La clé du créneau d'un TEMPS de l'exercice. */
export function cleEtape(cle: string, etape: string): string {
  return `${cle}:${etape}`;
}

// Les cinq temps, recopiés ici en tant que CHAÎNES seulement — `lib/domain/ancrage.ts` importe ce
// module, donc l'importer en retour ferait un cycle. Ce n'est pas une seconde déclaration de la
// structure : `tests/ancrage-corpus.test.ts` vérifie que ces cinq chaînes sont exactement `ETAPES`,
// et que chaque temps du domaine a bien son créneau pour chaque ancrage.
const TEMPS = ["arrivee", "souffle", "corps", "nommer", "retour"] as const;

function declarer(): Record<string, typeof NON_ECRIT> {
  const table: Record<string, typeof NON_ECRIT> = {};
  for (const cle of CLES_ANCRAGE) {
    table[cleTitre(cle)] = NON_ECRIT;
    for (const t of TEMPS) table[cleEtape(cle, t)] = NON_ECRIT;
  }
  return table;
}

/** 4 ancrages × (1 titre + 5 temps) = 24 créneaux. Zéro écrit. */
export const ANCRAGES: Corpus = corpus("ancrages", declarer());
