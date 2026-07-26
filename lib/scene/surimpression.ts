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
}

/** Projette, pour une région donnée, ce que porte la surimpression persistante. Pur. */
export function surimpressionPour(region: IdRegion): Surimpression {
  const enConversation = region === REGION_CONVERSATION;
  return {
    porteSecours: true,
    signeAnam: enConversation,
    mentionIA: enConversation,
  };
}
