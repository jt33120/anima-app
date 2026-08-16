/**
 * surimpression.ts — Ce que la SURIMPRESSION PERSISTANTE porte, PAR région. Story 1.8.
 *
 * MODÈLE PUR (AD-7) : données/logique seules, aucun import Next/React/DOM, aucun `render/`.
 * Décider *quels* éléments la surimpression porte est une règle de MODÈLE, pas de rendu :
 *  - la PORTE DE SECOURS est TOUJOURS présente, sur toutes les régions, indépendante de
 *    toute détection (FR-077, AD-9/AD-15) — garantie au TYPE (`true` littéral) ;
 *  - le SIGNE d'Anam et la MENTION IA (« Anam est une IA », FR-013 / AI Act art. 50) ne
 *    paraissent que sur la région de conversation.
 * `render/` CONSOMME ce modèle (il dessine) ; il ne décide rien (AD-7/AD-10).
 */

import { REGION_CONVERSATION, type IdRegion } from "./regions";

/** Cible des deux liens de la surimpression (porte de secours + mention IA). Source unique. */
export const URL_AIDE = "/aide";

/**
 * ⚠️ HISSÉS DEPUIS `render/surimpression.tsx` PAR LA STORY 6.9, et ce n'est pas cosmétique.
 *
 * Ces deux valeurs étaient des littéraux dans le JSX. Le pied de halte (`lib/domain/pied-halte.ts`)
 * doit porter EXACTEMENT la même mention et le même lien : deux littéraux auraient divergé au
 * premier ajustement de copie, et on se serait retrouvé avec deux formulations d'une mention à
 * enjeu légal (FR-013 / AI Act art. 50) dans le même produit.
 */
export const MENTION_IA = "Anam est une IA";
export const URL_TRANSPARENCE = `${URL_AIDE}#transparence`;

/**
 * Story 3.5 — la page « L'abonnement ». Source unique, jamais écrite en dur ailleurs.
 *
 * ⚠️ NE PAS CONFONDRE AVEC `/desabonnement`, qui est le retrait du CANAL COURRIEL (Story 4.9, art. 21).
 * Les deux mots se ressemblent en français et désignent deux choses sans rapport : l'un arrête des
 * courriels, l'autre arrête un contrat à 69 €/an.
 */
export const URL_ABONNEMENT = "/abonnement";

export interface Surimpression {
  /**
   * Toujours vraie, partout, indépendante de toute détection (FR-077, AD-9/AD-15).
   * Type littéral `true` : construire une surimpression sans porte de secours ne COMPILE pas.
   */
  readonly porteSecours: true;
  /** Présence d'Anam → seulement en conversation. */
  readonly signeAnam: boolean;
  /** « Anam est une IA », légalement requise sur la région de conversation (FR-013, art. 50). */
  readonly mentionIA: boolean;
  /**
   * Story 3.5 (FR-060, décision D1) — LE CHEMIN VERS LA SORTIE.
   *
   * Vrai UNIQUEMENT quand un abonnement existe. Un compte gratuit n'a rien à résilier : lui montrer une
   * entrée « L'abonnement » serait, au mieux, une impasse ; au pire, la suggestion qu'il lui manque
   * quelque chose — c'est-à-dire du commerce déguisé en navigation, sur toutes les régions à la fois.
   *
   * ⚠️ CE DRAPEAU N'EST PAS GARDÉ PAR `limitesCommercialesLevees`, ET C'EST DÉLIBÉRÉ. La carte
   * d'abonnement, le paywall et le bandeau de quota refusent de se monter pendant un épisode de détresse
   * (AD-9). Le masquer LUI reviendrait à cacher la porte de sortie à quelqu'un en crise — l'exact inverse
   * de ce que la garde protège. Sortir n'est pas du commerce. Voir l'en-tête de
   * `app/api/abonnement/resilier/route.ts`.
   *
   * Ne dépend PAS de la région : contrairement au signe d'Anam et à la mention IA, la sortie doit être
   * atteignable d'où qu'elle soit — FR-060 exige « aussi simple que la souscription », et la souscription
   * se fait en une carte, en pleine conversation.
   */
  readonly cheminAbonnement: boolean;
}

/**
 * Projette, pour une région donnée, ce que porte la surimpression persistante. Pur.
 *
 * `abonnee` est passé par l'appelant (couche serveur, qui a lu `abonnement` sous JWT) : ce module reste
 * pur et ne lit rien — c'est ce qui permet de le tester sans base et ce qui tient la frontière AD-7.
 */
export function surimpressionPour(region: IdRegion, abonnee = false): Surimpression {
  const enConversation = region === REGION_CONVERSATION;
  return {
    porteSecours: true,
    signeAnam: enConversation,
    mentionIA: enConversation,
    cheminAbonnement: abonnee,
  };
}
