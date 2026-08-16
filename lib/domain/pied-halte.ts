/**
 * pied-halte.ts — CE QUE PORTE LE BAS D'UNE HALTE (Story 6.9, QA T7).
 *
 * ══ LE CONSTAT ÉTAIT PLUS GRAVE QUE CE QUE LA QA A RELEVÉ ════════════════════════════════════════
 *
 * Le tour de QA disait : « la mention IA n'existe que sur la scène, pas sur les cinq haltes ». En
 * ouvrant le dépôt, on trouve pire : **AUCUNE page hors de la scène ne mène à `/aide`**, sauf
 * `/barriere` et `/aide` elle-même.
 *
 * Or la porte de secours n'est pas une commodité de navigation. FR-077 la veut « toujours là,
 * indépendante de toute détection », et `lib/scene/surimpression.ts` va jusqu'à la garantir AU TYPE
 * (`porteSecours: true` littéral) — pour la scène. Hors scène, elle n'existait pas.
 *
 * Quelqu'un qui va mal ne va pas forcément mal dans la région de conversation. Elle peut être en
 * train de relire ce qu'Anam retient d'elle, ou de regarder ses données. Le filet doit être là aussi.
 *
 * ══ CE MODULE EST PUR (AD-1/AD-7) ═══════════════════════════════════════════════════════════════
 *
 * Il décide QUOI porter ; `render/PiedHalte.tsx` DESSINE. Même partage que
 * `surimpressionPour` / `render/surimpression.tsx`, et pour la même raison : décider ce qu'une page
 * doit légalement afficher est une règle de modèle, pas une question de mise en page.
 */

import { URL_AIDE, MENTION_IA, URL_TRANSPARENCE } from "@/lib/scene/surimpression";

export { URL_AIDE, MENTION_IA, URL_TRANSPARENCE };

/**
 * Les haltes — les écrans hors de la scène, atteints par une URL propre.
 *
 * ⚠️ CET ENSEMBLE EST FERMÉ ET GARDÉ. `tests/pied-halte.test.ts` compare cette liste au contenu
 * réel de `app/` : une page ajoutée sans verdict fait rougir la CI. C'est le même renversement de
 * charge que les inventaires d'export et d'effacement (6.6/6.7) — on ne compte pas sur la
 * discipline de celui qui ajoutera la prochaine page pour qu'il pense à la porte de secours.
 */
export type IdHalte =
  | "abonnement"
  | "ancrages"
  | "enneagramme"
  | "heure-naissance"
  | "lectures"
  | "memoire"
  | "mes-donnees"
  | "reglages"
  | "synthese";

export interface PiedHalte {
  /** FR-077 — TOUJOURS, sur toutes les haltes. Type littéral : l'omettre ne compile pas. */
  readonly porteSecours: true;
  /** FR-013 / AI Act art. 50 — seulement là où du texte produit par un modèle est affiché. */
  readonly mentionIA: boolean;
}

/**
 * Où la mention IA est due, et POURQUOI — un verdict par halte, jamais un défaut.
 *
 * ⚠️ LA RÈGLE N'EST PAS « PARTOUT ». La mention désigne quelque chose de précis : ce que tu lis a
 * été produit par un modèle. La coller sur `/reglages`, où il n'y a que des cases à cocher, ne
 * protège personne — et l'affaiblit là où elle compte, en la transformant en décor de bas de page.
 *
 * ⚠️ ET ELLE N'EST PAS « LÀ OÙ ON PARLE À ANAM » NON PLUS. L'art. 50 couvre DEUX choses : être
 * informé qu'on interagit avec une IA (§1, c'est la conversation, déjà tenu par la surimpression)
 * ET savoir qu'un contenu a été produit artificiellement (§2). Les haltes relèvent du second : on
 * n'y parle à personne, on y relit ce qu'une machine a écrit sur soi.
 */
const MENTION_DUE: Readonly<Record<IdHalte, { readonly mention: boolean; readonly motif: string }>> =
  Object.freeze({
    memoire: {
      mention: true,
      motif: "les phrases affichées sont extraites des échanges PAR UN MODÈLE (4.2) — elles se lisent comme des faits sur soi",
    },
    synthese: {
      mention: true,
      motif: "la synthèse périodique est écrite par le modèle fort (4.9)",
    },
    enneagramme: {
      mention: true,
      motif: "l'hypothèse de type est formulée par Anam (5.5) ; le texte du type, lui, vient du corpus",
    },
    lectures: {
      mention: true,
      motif: "la restitution écrite d'une lecture est produite par le modèle (5.8)",
    },
    ancrages: {
      mention: true,
      motif: "l'exercice guidé est composé pour elle (5.9) — même régime que la restitution",
    },
    reglages: { mention: false, motif: "des cases à cocher et une adresse ; aucun texte produit" },
    "mes-donnees": {
      mention: false,
      motif: "un export de SES données et un effacement ; le contenu affiché est le sien",
    },
    abonnement: { mention: false, motif: "un état de contrat ; aucun texte produit" },
    "heure-naissance": { mention: false, motif: "un formulaire ; aucun texte produit" },
  });

/** Ce que porte le bas d'une halte. Pur. */
export function piedPour(halte: IdHalte): PiedHalte {
  return { porteSecours: true, mentionIA: MENTION_DUE[halte].mention };
}

/** Le motif du verdict — lu par le test d'inventaire, jamais par l'écran. */
export function motifDeMention(halte: IdHalte): string {
  return MENTION_DUE[halte].motif;
}

export const HALTES: readonly IdHalte[] = Object.freeze(
  Object.keys(MENTION_DUE).sort() as IdHalte[],
);

/**
 * Les pages de `app/` qui ne sont PAS des haltes, avec leur raison.
 *
 * ⚠️ CETTE LISTE EST LA MOITIÉ QUI COMPTE. Sans elle, l'inventaire ne prouverait rien : il suffirait
 * d'oublier une page pour qu'elle échappe au verdict. Le test exige que `app/**\/page.tsx` soit
 * exactement l'union des deux listes.
 */
export const HORS_HALTE: Readonly<Record<string, string>> = Object.freeze({
  ".": "la scène elle-même — elle porte la surimpression persistante (1.8), qui est l'original de ce pied",
  aide: "c'est la destination : la porte de secours ne se renvoie pas à elle-même, et la mention y est déjà (ancre #transparence)",
  barriere:
    "sortie d'un compte barré-minorité — elle porte DÉJÀ son propre lien vers /aide, et rien d'autre ne doit s'y ajouter",
  cgu: "document contractuel, hors session",
  desabonnement: "atteinte depuis un pied de courriel, SANS session — aucune halte n'y est due",
  "(auth)/entrer": "avant toute session — il n'y a encore ni contenu ni interlocuteur",
  "(auth)/naissance": "parcours d'entrée, avant le consentement art. 9",
  "(auth)/consentement": "l'écran qui DÉCLARE l'IA — y remettre la mention serait la répéter à elle-même",
  "(auth)/consentement/revoque": "impasse volontaire après révocation",
  "(auth)/consentement/revoquer":
    "le geste de révocation lui-même — un écran d'action, rien n'y est affiché ni produit",
});
