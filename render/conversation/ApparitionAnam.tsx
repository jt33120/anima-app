"use client";

import ImageAnam from "./ImageAnam";
import s from "./conversation.module.css";

/**
 * ApparitionAnam — le personnage en format PRÉSENCE (Story 2.2, B5 ; AC6). Paraît AUX BEATS
 * seulement (ouverture, nommer, clôture), JAMAIS à côté d'un tour ordinaire ; entre les beats,
 * `beat = null` → rien (seul le signe de la surimpression porte la présence). Sans cadre / cercle /
 * vignette : bord plumeux dissous dans le fond, entrée en `fondu-personnage` (700ms) — INSTANTANÉ
 * sous `prefers-reduced-motion` (jamais supprimé : aucune info par le seul mouvement).
 *
 * En 2.2, seul le beat « ouverture » est câblé (au montage de la conversation) ; « nommer » et
 * « clôture » restent des seams déclenchés par l'arc de séance (Stories 2.7/2.9).
 */

export type Beat = "ouverture" | "nommer" | "cloture" | null;

export default function ApparitionAnam({ beat }: { beat: Beat }) {
  if (!beat) return null;
  return (
    <div className={`${s.apparition} fondu-personnage`} data-beat={beat}>
      {/* `alt` sobre non-révélateur (UX-DR-15) : « illustration nocturne », jamais « femme au lotus ». */}
      <ImageAnam format="presence" alt="Illustration nocturne" />
    </div>
  );
}
