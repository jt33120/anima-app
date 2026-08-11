import { indiceDuJour, type JourCivil } from "@/lib/astro/quotidien";
import { corpus, lireTexte, type Corpus, type TexteCorpus, NON_ECRIT } from "./port";

/**
 * mantra.ts — LES 60 MANTRAS DU JOUR (Story 5.4, FR-054 / FR-080 / FR-086).
 *
 * ── CE FICHIER EST VOLONTAIREMENT VIDE DE TEXTE ────────────────────────────────────────────────
 *
 * Les 60 créneaux sont DÉCLARÉS, aucun n'est ÉCRIT — même forme et même raison qu'en 5.2 : FR-054
 * exige que les textes viennent du corpus d'Anima, et FR-086 rappelle qu'Anima est une personne
 * réelle dont on ne fabrique jamais une parole. Un modèle ne peut pas les écrire (FR-047), nous non
 * plus (ce serait du texte générique repris, ce que FR-054 bannit), et on ne les achète pas.
 *
 * ── UN MANTRA N'EST NI UN ANCRAGE NI UNE LECTURE (FR-080) ──────────────────────────────────────
 *
 * Les trois mots ne se confondent jamais, et « en employer un pour un autre est un défaut » :
 *
 *   • **mantra du jour** — un texte COURT, GRATUIT, NON INTERACTIF. C'est ce fichier ;
 *   • **ancrage**        — un exercice guidé et interactif de 2 à 5 min (Story 5.9) ;
 *   • **lecture**        — le rituel long avec tirage (Stories 5.7/5.8).
 *
 * Le mantra est gratuit à vie (FR-055) ; les deux autres ne le sont pas. Le registre de la
 * facturation ne s'écrit PAS dans ce fichier, pas même en commentaire — `socle-jamais-coupe.test.ts`
 * balaie les commentaires autant que le code, et un « TODO : mettre ça derrière l'offre payante »
 * posé ici serait le premier pas vers la coupure d'un socle gratuit à vie.
 *
 * ── IMPERSONNEL, ET C'EST LA SIGNATURE QUI LE GARANTIT (FR-033, décision D8) ───────────────────
 *
 * `mantraDuJour(jour)` ne prend QUE le jour. Il n'existe aucun paramètre par lequel le journal, une
 * branche ou un échange pourrait entrer — donc « ne référence jamais le journal, une branche ou un
 * échange » cesse d'être une consigne qu'on peut enfreindre par distraction.
 *
 * Conséquence assumée : **le même mantra est servi à tout le monde le même jour.** C'est le sens
 * exact d'« impersonnel » (FR-033), et c'est ce qui rend le rythme quotidien acceptable.
 *
 * ── JAMAIS SIGNÉ PAR ANAM (FR-033) ─────────────────────────────────────────────────────────────
 *
 * Un mantra n'est pas une parole d'Anam adressée à quelqu'un : c'est un texte posé. Aucun des 60
 * créneaux ne doit porter le nom d'Anam ni une signature. `tests/corpus-quotidien.test.ts` le
 * vérifie, et prouve son balayage sur un faux corpus — sans quoi la garde serait vacuement vraie
 * sur un corpus vide.
 *
 * ── PURETÉ (garde `tests/corpus-architecture.test.ts`) ─────────────────────────────────────────
 *
 * Aucun import de `@/lib/ai/*`, aucun de `@/lib/data/*`, aucun `server-only`, aucun Supabase. La
 * seule dépendance est `lib/astro/quotidien` pour la rotation — le corpus connaît le domaine, jamais
 * l'inverse (décision D9).
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Le nombre de mantras — donc la LONGUEUR DU CYCLE : le même texte revient tous les 60 jours.
 *
 * Décision Julian du 2026-08-11 (option complète). C'est un arbitrage entre le travail d'écriture
 * d'une seule autrice et la sensation de répétition : deux mois de cycle est ce qui a été retenu.
 *
 * ⚠️ CHANGER CE NOMBRE DÉCALE TOUTE LA ROTATION — le mantra de demain ne sera pas celui qui était
 * prévu. Ce n'est pas grave (il n'y a pas d'archive en v1, EXPERIENCE.md §607), mais il faut le
 * savoir avant de le faire.
 */
export const CARDINAL_MANTRA = 60;

/** La clé d'un créneau : `"mantra:7"`. Même format qu'en 5.2 — `"<domaine>:<valeur>"`. */
export function cleMantra(rang: number): string {
  if (!Number.isInteger(rang) || rang < 1 || rang > CARDINAL_MANTRA) {
    throw new Error(`corpus mantra : rang hors domaine (${rang}) — attendu 1..${CARDINAL_MANTRA}`);
  }
  return `mantra:${rang}`;
}

/** Les 60 clés, dans l'ordre du cycle. Exportée pour rendre la complétude mesurable. */
export const CLES_MANTRA: readonly string[] = Object.freeze(
  Array.from({ length: CARDINAL_MANTRA }, (_, k) => `mantra:${k + 1}`),
);

/**
 * ⚠️ TOUS LES CRÉNEAUX SONT `NON_ECRIT`. La table se construit depuis `CLES_MANTRA` plutôt qu'en 60
 * lignes recopiées : une liste écrite à la main finirait par diverger, et l'inventaire compterait
 * des créneaux qui n'existent pas.
 *
 * Anima écrit en remplaçant une entrée :
 *
 *     [cleMantra(7)]: ecrit("…"),
 */
export const CORPUS_MANTRA: Corpus = corpus(
  "mantra",
  Object.fromEntries(CLES_MANTRA.map((cle) => [cle, NON_ECRIT])),
);

/**
 * La CLÉ du mantra d'un jour.
 *
 * Exportée séparément pour une raison de testabilité qui est aussi une raison de conception : tant
 * qu'aucun texte n'est écrit, deux mantras sont `{statut:"non_ecrit"}` des deux côtés, donc
 * INDISCERNABLES. Sans cette porte, une rotation cassée (« rendre toujours le premier créneau »)
 * serait invisible jusqu'au jour où Anima écrit — c'est-à-dire jusqu'à la mise en ligne.
 */
export function cleMantraDuJour(jour: JourCivil): string {
  return CLES_MANTRA[indiceDuJour(jour, CARDINAL_MANTRA)];
}

/**
 * LE MANTRA DU JOUR.
 *
 * Ne dépend d'AUCUNE donnée de naissance : il reste servi même quand le thème natal est
 * indisponible (AC6). C'est le seul morceau du socle quotidien qui ne demande rien à personne.
 */
export function mantraDuJour(jour: JourCivil): TexteCorpus {
  return lireTexte(CORPUS_MANTRA, cleMantraDuJour(jour));
}
