"use client";

/*
 * BoutonTronc — LE SEUL chemin vers la fiche du tronc (Story 5.3, AC3/AC5).
 *
 * ⚠️ POURQUOI UN COMPOSANT ET PAS TROIS BOUTONS. La région arbre a TROIS états visibles : le canevas,
 * la vue liste, et l'état vide. Le tronc n'est DESSINÉ que dans le premier — mais quelqu'un qui n'a
 * encore aucune branche est précisément la personne qui n'a pas donné son heure, et c'est justement
 * dans l'état vide qu'elle passe son temps. Un chemin qui n'existerait que sur le canevas serait
 * inatteignable pour elle.
 *
 * Trois copies de ce bouton, c'est trois endroits où l'aria-label diverge et un où on l'oublie —
 * exactement la raison d'être d'`EtatVideArbre` (Story 3.3, AC2). Un seul composant, donc : le
 * placement change (`className`), jamais le libellé ni le comportement.
 *
 * ⚠️ LE MOT « INCOMPLET » N'EST NULLE PART, aria-label compris (AC3). Un lecteur d'écran ne doit pas
 * entendre une étiquette que l'œil ne voit pas.
 */

import { ARIA_TRONC_A_COMPLETER, TRONC_TITRE } from "./copie-arbre";
import s from "./arbre.module.css";

export interface ProprietesBoutonTronc {
  onOuvrir: () => void;
  /** Placement seulement. Le canevas le superpose au dessin ; ailleurs il vit dans le flux. */
  className?: string;
  /** Sur le canevas, le tronc est DESSINÉ : le bouton n'est qu'une cible, sans texte visible. */
  cibleSeule?: boolean;
}

export default function BoutonTronc({ onOuvrir, className, cibleSeule }: ProprietesBoutonTronc) {
  return (
    <button
      type="button"
      className={className ?? s.actionSecondaire}
      aria-label={ARIA_TRONC_A_COMPLETER}
      onClick={onOuvrir}
    >
      {/* Hors canevas, le bouton porte un LIBELLÉ VISIBLE : une cible invisible dans un écran de
          texte serait un piège au pointeur. Sur le canevas, le dessin EST le libellé. */}
      {cibleSeule ? null : <span aria-hidden>{TRONC_TITRE}</span>}
    </button>
  );
}
