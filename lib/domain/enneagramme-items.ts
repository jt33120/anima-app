import type { ItemBareme, NiveauReponse, TypeEnneagramme } from "./enneagramme";

/**
 * enneagramme-items.ts — LES DIX-HUIT ÉNONCÉS DU TEST COURT (Story 5.5, AC1).
 *
 * ══ POURQUOI CES PHRASES NE SONT PAS DU CORPUS D'ANIMA ═══════════════════════════════════════════
 *
 * FR-054 réserve à Anima les INTERPRÉTATIONS — ce que le produit dit du sens d'un nombre, d'un
 * signe, d'un type. Un énoncé de test n'interprète rien : c'est une phrase que le produit soumet à
 * l'accord de quelqu'un, du même registre que ce qu'il dit de lui-même. Le précédent est écrit :
 * D10 de la 5.3 range `MESSAGE_SANS_HEURE` et `PHRASE_INVITATION` dans `lib/domain/` pour cette
 * raison exacte.
 *
 * Conséquence pratique : ces dix-huit phrases NE consomment PAS le budget d'écriture d'Anima (156
 * créneaux l'attendent déjà). Les neuf interprétations de types, elles, sont du corpus — et naîtront
 * non écrites, comme les trois autres corpus.
 *
 * ══ LE REGISTRE, ET CE QU'IL INTERDIT ════════════════════════════════════════════════════════════
 *
 * Ces phrases tombent AUTOMATIQUEMENT sous le contrôle de voix bloquant, qui balaie `lib/` en
 * récursif. Deux formulations réflexes d'un questionnaire y sont mortes avant d'être écrites, et
 * c'est mesuré :
 *
 *     « Je m'inquiète de ce qui pourrait mal tourner. »  → refusé (revendication d'affect)
 *     « Ce n'est pas un diagnostic. »                     → refusé (lexique médical)
 *
 * La première parce que les motifs qui empêchent Anam de revendiquer un ressenti ne savent pas
 * distinguer sa voix de celle de l'utilisatrice ; la seconde parce que NFR-008 ne fait pas
 * d'exception pour les dénégations. Le réflexe — ajouter ce fichier aux exclusions du balayage — est
 * fermé : un test dédié exige que toute exclusion prouve qu'elle protège d'un vrai match, et la
 * revue 4.9 en a déjà retiré quatre.
 *
 * Donc : des CONSTATS, à la première personne, sans vocabulaire clinique, sans futur, et sans
 * dénégation médicale. La reformulation est toujours possible — « j'envisage ce qui pourrait mal
 * tourner » dit la même chose que la phrase refusée.
 *
 * ══ L'ORDRE EST FIXE, ET LES TYPES SONT ENTRELACÉS ═══════════════════════════════════════════════
 *
 * Aucun mélange aléatoire : `Math.random` rendrait le test non reproductible, et l'AC1 exige le
 * déterminisme. Les deux énoncés d'un même type sont donc séparés par les huit autres — servis
 * groupés, ils rendraient le barème lisible à l'œil nu et pousseraient à répondre au personnage
 * plutôt qu'à soi.
 */

export interface ItemTest extends ItemBareme {
  readonly id: string;
  readonly type: TypeEnneagramme;
  readonly texte: string;
}

/**
 * DIX-HUIT ÉNONCÉS, DEUX PAR TYPE — décision Julian du 2026-08-13.
 *
 * « Court » est dans le titre de la story, et la charte visuelle interdit tout indicateur de
 * progression (barre, « question 3 sur 12 », points remplis) : un test long désoriente sans recours.
 * À l'autre bout, un seul énoncé par type ne départage rien. Deux est le plus petit jeu qui laisse
 * apparaître un écart.
 */
export const ITEMS: readonly ItemTest[] = Object.freeze([
  { id: "e1a", type: 1, texte: "Je repère tout de suite ce qui n'est pas à sa place." },
  { id: "e2a", type: 2, texte: "Je sais souvent ce dont les autres ont besoin avant qu'ils le disent." },
  { id: "e3a", type: 3, texte: "J'avance plus vite quand il y a un résultat à montrer." },
  { id: "e4a", type: 4, texte: "Ce qui est ordinaire me laisse à distance." },
  { id: "e5a", type: 5, texte: "Je préfère observer un moment avant de participer." },
  { id: "e6a", type: 6, texte: "J'envisage ce qui pourrait mal tourner, par réflexe." },
  { id: "e7a", type: 7, texte: "Je garde plusieurs portes ouvertes." },
  { id: "e8a", type: 8, texte: "Je dis les choses franchement, quitte à bousculer." },
  { id: "e9a", type: 9, texte: "Je cède facilement pour que le calme revienne." },
  { id: "e1b", type: 1, texte: "Il y a une bonne façon de faire, et je m'y tiens." },
  { id: "e2b", type: 2, texte: "J'ai du mal à demander quelque chose pour moi." },
  { id: "e3b", type: 3, texte: "Je m'adapte à ce qu'on attend de moi, presque sans y penser." },
  { id: "e4b", type: 4, texte: "Il me manque souvent quelque chose que les autres semblent avoir." },
  { id: "e5b", type: 5, texte: "Je garde mon énergie, et je choisis où la dépenser." },
  { id: "e6b", type: 6, texte: "Je fais confiance lentement, et rarement d'un coup." },
  { id: "e7b", type: 7, texte: "Quand quelque chose pèse, je passe à la suite." },
  { id: "e8b", type: 8, texte: "Je supporte mal qu'on décide à ma place." },
  { id: "e9b", type: 9, texte: "Mes propres envies mettent du temps à me parvenir." },
] as const);

/**
 * Les libellés de l'échelle. Ils descendent du serveur avec les énoncés plutôt que d'être recopiés
 * dans un module de copie de rendu : `render/` ne peut importer ni `@/lib/domain` ni `@/lib/corpus`,
 * et la 5.3 a écrit la parade dans ses écarts — « recopier les textes aurait fabriqué une divergence
 * en attente ». Aucun chiffre n'est jamais montré (FR-031).
 */
export const LIBELLES_NIVEAU: Readonly<Record<NiveauReponse, string>> = Object.freeze({
  0: "Pas du tout",
  1: "Un peu",
  2: "Plutôt",
  3: "Tout à fait",
});

/** Ce qu'un énoncé montre à l'écran : son identité et sa phrase. */
export interface ItemAffiche {
  readonly id: string;
  readonly texte: string;
}

/**
 * ⚠️ LE TYPE NE DESCEND JAMAIS AVEC L'ÉNONCÉ, et ce n'est pas de l'économie de bande passante.
 *
 * Servir `{ id, texte, type }` publierait le barème dans le HTML : n'importe qui verrait quel type
 * chaque phrase pèse, et le saurait EN RÉPONDANT. Un test dont on voit la grille ne mesure plus rien
 * — il mesure ce qu'on veut être.
 *
 * C'est le même geste que l'AC7 dur de la 4.7 (le nom d'une branche ne transite jamais vers un
 * modèle) : ce qui n'a pas besoin de sortir ne sort pas.
 */
export function itemsPourAffichage(): readonly ItemAffiche[] {
  return Object.freeze(ITEMS.map(({ id, texte }) => Object.freeze({ id, texte })));
}

/**
 * Ce que l'écran dit quand Anima n'a pas encore écrit le texte d'un type (AC1).
 *
 * ⚠️ CE N'EST PAS UN TEXTE DE CORPUS, et la distinction est toute la story. Le corpus dit ce qu'un
 * type SIGNIFIE — c'est Anima qui l'écrit, elle seule (FR-054/FR-086). Cette phrase-ci dit
 * l'ÉTAT DU PRODUIT : le créneau existe, il est vide, et on le dit plutôt que de le combler. Elle
 * relève donc de la voix produit, comme `MESSAGE_SANS_HEURE` (5.3, décision D10).
 *
 * Le troisième état que `lib/corpus/port.ts` refuse d'exister — « texte par défaut » — serait
 * exactement ce qu'on fabriquerait en écrivant ici deux lignes sur ce qu'est un type 4.
 *
 * Aucun futur adressé (« tu le liras bientôt ») : ce serait une promesse que le code ne tient pas.
 */
export const MESSAGE_TYPE_SANS_TEXTE =
  "Anima n'a pas encore écrit ce qu'elle voit dans ce type. Son texte se posera ici.";
