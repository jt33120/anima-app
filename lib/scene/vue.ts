/**
 * vue.ts — Le VIEW-STATE client éphémère (SPINE L155) : région courante + la
 * transition, dont ce module est le PROPRIÉTAIRE UNIQUE. Story 1.7 (AD-7).
 *
 * Réducteur PUR — aucun React, aucun effet. Il est hébergé par `useReducer` dans
 * `render/scene-dom.tsx`, mais ne connaît rien du rendu. C'est ce qui rend un futur
 * adaptateur WebGL possible sans réécrire l'état (AD-10 : render → modèle, jamais l'inverse).
 *
 * Le cadrage fin (parallaxe, chorégraphie) est DIFFÉRÉ hors modèle (SPINE §Deferred L272) :
 * en 1.7, l'état se limite à la région courante ; le fondu est la seule grammaire de mouvement.
 */

import { REGION_ENTREE, type IdRegion } from "./regions";

export interface EtatVue {
  readonly regionCourante: IdRegion;
}

export const etatInitial: EtatVue = { regionCourante: REGION_ENTREE };

export type ActionVue = { type: "aller"; cible: IdRegion };

/**
 * Transition pure. Aller vers la région déjà courante est idempotent : on rend la
 * MÊME référence d'état (aucun rerender inutile, aucun fondu rejoué sur place).
 */
export function reducteurVue(etat: EtatVue, action: ActionVue): EtatVue {
  switch (action.type) {
    case "aller":
      if (action.cible === etat.regionCourante) return etat;
      return { regionCourante: action.cible };
    default:
      return etat;
  }
}
