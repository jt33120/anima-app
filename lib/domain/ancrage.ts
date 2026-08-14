import type { TexteCorpus } from "@/lib/corpus/port";
import { lireTexte } from "@/lib/corpus/port";
import { ANCRAGES, cleEtape, cleTitre } from "@/lib/corpus/ancrage";
import { terme } from "./vocabulaire";

/**
 * ancrage.ts — LA STRUCTURE FIXE DE L'EXERCICE GUIDÉ (Story 5.9, T1).
 *
 * Module PUR (AD-1) : aucune I/O, aucune horloge, aucun `server-only`, aucun Supabase. Il déclare la
 * séquence, il assemble, il fait avancer d'une étape. Il ne lit pas l'abonnement — c'est
 * `lib/data/lire-ancrage.ts` qui garde l'accès, et c'est délibéré : un domaine qui saurait lire un
 * entitlement finirait par en dépendre pour décider du CONTENU.
 *
 * ── POURQUOI LA SÉQUENCE EST UNE CONSTANTE, ET PAS UNE DONNÉE ─────────────────────────────────
 *
 * FR-081 dit « structure fixe ». Écrite en base ou en configuration, elle deviendrait variable —
 * quelqu'un pourrait servir un ancrage de deux étapes, ou de quarante, et rien ne rougirait. Ici
 * elle est une constante gelée, et la fourchette de durée du format la contraint (voir plus bas).
 *
 * ── L'ANCRAGE N'EST NI UN MANTRA NI UNE LECTURE (FR-080) ──────────────────────────────────────
 *
 *     mantra du jour  →  bref, NON interactif, gratuit à vie (FR-055)
 *     ancrage         →  2 à 5 min, INTERACTIF, premium         ← ce fichier
 *     lecture         →  rituel long avec tirage, interactif, premium (5.7/5.8)
 *
 * La nature de l'ancrage n'est PAS redéclarée ici : elle se lit dans `vocabulaire.ts`, seule source.
 * Une redéclaration pourrait diverger, et la divergence serait invisible.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La séquence — fixe, ordonnée, gelée
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Les cinq temps de l'exercice. Ce sont des NOMS DE TEMPS, pas des textes : la prose vient du
 * corpus. Ajouter un sixième temps est possible — mais l'assertion de durée ci-dessous décidera si
 * le format le supporte encore.
 */
export type EtapeAncrage = "arrivee" | "souffle" | "corps" | "nommer" | "retour";

export const ETAPES: readonly EtapeAncrage[] = Object.freeze([
  "arrivee",
  "souffle",
  "corps",
  "nommer",
  "retour",
]);

/**
 * Le rythme d'un temps, en secondes. C'est une ALLURE, pas une minuterie : rien ne chronomètre
 * l'utilisatrice et rien ne verrouille une étape (le produit n'impose jamais). Cette constante ne
 * sert qu'à une chose — rendre vérifiable la fourchette que le format s'est donnée.
 */
export const ALLURE_SECONDES = 40;

/**
 * ⚠️ L'ASSERTION DE COHÉRENCE, AU CHARGEMENT DU MODULE (AC2).
 *
 * Même patron qu'`assertCatalogueBorne` en 5.6 : la contrainte est vérifiée quand le module se
 * charge, pas seulement en test. `terme("ancrage").dureeMinutes` vaut [2, 5] et c'est la SEULE
 * source — si quelqu'un ajoute des étapes jusqu'à faire un exercice de neuf minutes, le format n'est
 * plus celui que FR-080 distingue de la lecture, et le produit refuse de démarrer.
 *
 * Le vérifier ici plutôt qu'en test ferme le chemin « le test est vert parce qu'il ne tourne pas ».
 */
const FOURCHETTE = terme("ancrage").dureeMinutes;
if (FOURCHETTE === null) {
  throw new Error("ancrage : le terme « ancrage » doit déclarer une fourchette de durée (FR-080)");
}
const MINUTES = (ETAPES.length * ALLURE_SECONDES) / 60;
if (MINUTES < FOURCHETTE[0] || MINUTES > FOURCHETTE[1]) {
  throw new Error(
    `ancrage : ${ETAPES.length} étapes à ${ALLURE_SECONDES} s font ${MINUTES.toFixed(1)} min — ` +
      `le format en déclare ${FOURCHETTE[0]} à ${FOURCHETTE[1]}`,
  );
}

/** La durée impliquée par la structure, en minutes. Exposée pour la rendre inspectable. */
export const DUREE_MINUTES = MINUTES;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'assemblage
// ══════════════════════════════════════════════════════════════════════════════════════════════

export interface TempsAncrage {
  readonly etape: EtapeAncrage;
  /** Ce qu'Anima a écrit — ou n'a pas encore écrit. L'union force à traiter le second cas (FR-054). */
  readonly texte: TexteCorpus;
}

export interface AncrageAssemble {
  readonly cle: string;
  /** Le titre vient du CORPUS, jamais de nous : ce serait une parole attribuée à Anima (FR-086). */
  readonly titre: TexteCorpus;
  readonly temps: readonly TempsAncrage[];
}

/**
 * Assemble UN ancrage depuis le corpus.
 *
 * `lireTexte` JETTE sur une clé non déclarée, et c'est ce qui rend l'assemblage sûr : une clé
 * d'ancrage inventée ne rend pas un exercice vide, elle casse — ce qui est la vérité (un défaut de
 * code, pas un texte en attente d'écriture).
 */
export function assemblerAncrage(cle: string): AncrageAssemble {
  return {
    cle,
    titre: lireTexte(ANCRAGES, cleTitre(cle)),
    temps: ETAPES.map((etape) => ({ etape, texte: lireTexte(ANCRAGES, cleEtape(cle, etape)) })),
  };
}

/**
 * Un ancrage est-il TRAVERSABLE aujourd'hui ?
 *
 * Il l'est quand ses cinq temps sont écrits. Un exercice à trous n'est pas un exercice court : c'est
 * un exercice cassé, qui laisserait l'utilisatrice devant un écran vide au milieu. Le titre seul ne
 * suffit donc pas, et un seul temps non écrit disqualifie.
 *
 * En v1, aucun ancrage n'est traversable — les 24 créneaux attendent Anima. C'est l'état RÉEL, et
 * la halte le dit (AC6) plutôt que de fabriquer un repli.
 */
export function estTraversable(a: AncrageAssemble): boolean {
  return a.titre.statut === "ecrit" && a.temps.every((t) => t.texte.statut === "ecrit");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La progression — pure, testable sans DOM (AD-7 : le rendu ne décide rien)
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** L'indice est-il le dernier temps ? */
export function estDernier(indice: number, total: number): boolean {
  return indice >= total - 1;
}

/**
 * L'indice suivant, BORNÉ au dernier temps.
 *
 * Il ne boucle pas : un ancrage qui recommencerait tout seul serait un ancrage dont on ne sort pas.
 * Il ne dépasse pas non plus — l'appelant lit `estDernier` pour savoir qu'il n'y a plus de suivant,
 * plutôt que de recevoir un indice hors bornes qu'il faudrait rattraper au rendu.
 */
export function etapeSuivante(indice: number, total: number): number {
  if (total <= 0) return 0;
  if (indice < 0) return 0;
  return Math.min(indice + 1, total - 1);
}
