import { CANEVAS } from "./geometrie";
import s from "./arbre.module.css";

/**
 * Tronc.tsx — LE TRONC, DESSINÉ EN UN SEUL ENDROIT (Story 5.6, T9 — dette de la Story 3.3).
 *
 * ── CE QUI MANQUAIT, ET POURQUOI PERSONNE NE L'AVAIT VU ────────────────────────────────────────
 *
 * FR-088 dit « elle voit son tronc, y compris incomplet ». Le tronc était bien dessiné — mais
 * seulement dans le canevas d'`ArbreInteractif`. Or l'état vide **remplace** ce canevas par un écran
 * de texte : la personne qui n'a encore aucune branche, c'est-à-dire **tout le monde le premier
 * jour**, ne voyait aucun tronc. Le seul moment où FR-088 comptait vraiment était le seul où il
 * n'était pas honoré.
 *
 * La 5.3 avait rendu la FICHE du tronc atteignable dans les trois états (`BoutonTronc`), donc rien
 * n'était inaccessible — c'est pour cela que le manque est resté invisible. Ce qui manquait, c'était
 * le DESSIN. `deferred-work.md` l'avait noté et assigné à cette story.
 *
 * ── UNE SEULE SOURCE POUR LE CHEMIN ────────────────────────────────────────────────────────────
 *
 * Même raisonnement que l'en-tête d'`EtatVideArbre` : deux copies du même tronc, c'est deux endroits
 * où la matière « en réserve » (5.3/AC3) peut diverger, et un endroit où l'oublier. Le chemin et ses
 * classes vivent donc ici, et les deux écrans les consomment.
 */

/**
 * Tronc + racines. Coordonnées du canevas 1000×1000 : la fourche est à `y = 560`, d'où partent
 * les branches — ne pas la déplacer sans `geometrie.ts`.
 */
export const CHEMIN_TRONC =
  "M 500 950 C 470 900 450 880 430 880 M 500 950 C 530 900 550 880 570 880 M 500 950 L 500 560";

export interface ProprietesTronc {
  /**
   * Story 5.3 (AC3) — la MATIÈRE EN RÉSERVE quand l'heure de naissance manque. Le contour reste
   * ENTIER : jamais un pointillé, jamais un fantôme. Un tronc en pointillés dirait « cassé » ou
   * « à débloquer » ; celui-ci dit « pas encore rempli », ce qui est l'état des faits.
   */
  readonly enReserve?: boolean;
}

/** Le `<path>` seul — à poser dans un `<svg>` au repère du canevas (`ArbreInteractif`). */
export function CheminTronc({ enReserve }: ProprietesTronc) {
  return <path d={CHEMIN_TRONC} className={`${s.tronc} ${enReserve ? s.troncEnReserve : ""}`} />;
}

/**
 * Le tronc AVEC son propre `<svg>` — pour l'état vide, qui n'a pas de canevas.
 *
 * `aria-hidden` : ce n'est pas une information, c'est le décor de l'écran vide. Ce que l'écran a à
 * dire est déjà dit en toutes lettres par `EtatVideArbre`, et le chemin vers la fiche du tronc
 * passe par un bouton nommé (5.3). Un `role="img"` de plus ferait annoncer deux fois la même chose.
 */
export default function TroncSeul({ enReserve }: ProprietesTronc) {
  return (
    <svg
      viewBox={`380 540 240 430`}
      className={s.troncSeul}
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      <CheminTronc enReserve={enReserve} />
    </svg>
  );
}

/** Exporté pour que les tests puissent vérifier que le repère n'a pas glissé. */
export const REPERE_CANEVAS = CANEVAS;
