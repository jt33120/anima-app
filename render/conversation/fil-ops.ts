import type { Tour } from "./types";

/**
 * fil-ops.ts — opérations PURES sur le fil (Story 2.6). Testables en env node (aucun DOM/réseau).
 *
 * `insererTour` place un tour (ex. le bloc ressources de détresse) juste AVANT ou APRÈS un tour
 * ancre (le tour d'Anam) — le placement est décidé par le SERVEUR (position dans la trame). Si
 * l'ancre a disparu (tour retiré entre-temps), la liste est renvoyée inchangée : jamais un crash.
 */
export function insererTour(
  tours: readonly Tour[],
  ancreId: string,
  position: "avant" | "apres",
  tour: Tour,
): Tour[] {
  const i = tours.findIndex((t) => t.id === ancreId);
  if (i < 0) return [...tours];
  const at = position === "avant" ? i : i + 1;
  return [...tours.slice(0, at), tour, ...tours.slice(at)];
}
