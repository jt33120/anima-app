/**
 * vue.ts — Le VIEW-STATE client éphémère (SPINE L155) : région courante, caméra propre à l'arbre
 * (pan/zoom), fiche ouverte, et le contexte de retour de « Voir dans la conversation ». Ce module en est
 * le PROPRIÉTAIRE UNIQUE (Story 1.7, élargi en 4.6, AD-7).
 *
 * Réducteur PUR — aucun React, aucun effet. Hébergé par `useReducer` dans `render/scene-dom.tsx`, il ne
 * connaît rien du rendu : un futur adaptateur WebGL réutilise cet état sans réécriture (AD-10 : render → modèle).
 * Le rendu ne DÉCIDE rien du cadrage — il CONSOMME la caméra que ce réducteur calcule (AC9).
 */

import {
  REGION_CONVERSATION,
  REGION_ENTREE,
  REGION_FOYER,
  type IdRegion,
} from "./regions";

/** Caméra propre à l'arbre — indépendante du zoom 200 %/400 % de la page (Accessibility Floor). */
export interface Camera {
  readonly pan: { readonly x: number; readonly y: number };
  readonly zoom: number;
}

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
const clampZoom = (z: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export const cameraInitiale: Camera = { pan: { x: 0, y: 0 }, zoom: 1 };

export interface EtatVue {
  readonly regionCourante: IdRegion;
  /** Caméra de l'arbre (pan/zoom). Restaurée à l'identique au retour de la conversation (AC4). */
  readonly camera: Camera;
  /** Id de la branche dont la fiche est ouverte, ou null (étiquette, jamais modale). */
  readonly brancheSelectionnee: string | null;
  /** Contexte mémorisé quand on quitte l'arbre via « Voir dans la conversation » — null sinon. */
  readonly retour: {
    readonly region: IdRegion;
    readonly camera: Camera;
    readonly brancheSelectionnee: string | null;
  } | null;
}

/**
 * La région sur laquelle la scène S’OUVRE, selon que le seuil a déjà été franchi ou non.
 *
 * ⚠️ LE REPLI PENCHE VERS LE SEUIL, ET LE CHOIX N’EST PAS SYMÉTRIQUE. « On ne sait pas » (lecture
 * en panne, aucune donnée, test qui monte la scène nue) redonne le seuil : revoir une entrée
 * qu’on a déjà vue est un accroc, sauter une entrée qu’on n’a jamais vue en est un autre — et
 * celui-là fait manquer la seule fois où le lieu se présente (voir `lib/domain/premier-passage.ts`,
 * dont les deux replis penchent de la même façon, pour la même raison).
 */
export const regionDOuverture = (seuilDejaFranchi: boolean): IdRegion =>
  seuilDejaFranchi ? REGION_FOYER : REGION_ENTREE;

/** L’état de départ pour une région d’ouverture donnée. */
export const etatInitialPour = (regionCourante: IdRegion): EtatVue => ({
  regionCourante,
  camera: cameraInitiale,
  brancheSelectionnee: null,
  retour: null,
});

export const etatInitial: EtatVue = etatInitialPour(REGION_ENTREE);

export type ActionVue =
  | { type: "aller"; cible: IdRegion }
  | { type: "cadrer"; camera: Camera }
  | { type: "ouvrirFiche"; brancheId: string }
  | { type: "fermerFiche" }
  | { type: "voirDansConversation" }
  | { type: "revenir" };

/**
 * Transition pure. Idempotence préservée : une action sans effet rend la MÊME référence d'état
 * (aucun rerender inutile). Le zoom est borné DANS le modèle (le rendu ne décide pas des limites).
 */
export function reducteurVue(etat: EtatVue, action: ActionVue): EtatVue {
  switch (action.type) {
    case "aller":
      if (action.cible === etat.regionCourante) return etat;
      return { ...etat, regionCourante: action.cible };

    case "cadrer": {
      const zoom = clampZoom(action.camera.zoom);
      const { pan } = action.camera;
      if (
        zoom === etat.camera.zoom &&
        pan.x === etat.camera.pan.x &&
        pan.y === etat.camera.pan.y
      )
        return etat;
      return { ...etat, camera: { pan: { x: pan.x, y: pan.y }, zoom } };
    }

    case "ouvrirFiche":
      if (action.brancheId === etat.brancheSelectionnee) return etat;
      return { ...etat, brancheSelectionnee: action.brancheId };

    case "fermerFiche":
      if (etat.brancheSelectionnee === null) return etat;
      return { ...etat, brancheSelectionnee: null };

    case "voirDansConversation":
      // Mémorise le cadrage exact + la fiche ouverte, puis va à la conversation (retour restaurable, AC4).
      return {
        ...etat,
        regionCourante: REGION_CONVERSATION,
        retour: {
          region: etat.regionCourante,
          camera: etat.camera,
          brancheSelectionnee: etat.brancheSelectionnee,
        },
      };

    case "revenir":
      if (etat.retour === null) return etat;
      return {
        ...etat,
        regionCourante: etat.retour.region,
        camera: etat.retour.camera,
        brancheSelectionnee: etat.retour.brancheSelectionnee,
        retour: null,
      };

    default:
      return etat;
  }
}
