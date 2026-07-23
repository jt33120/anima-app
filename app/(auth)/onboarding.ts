/**
 * Décision d'onboarding — pure et testable (Story 1.4, durcie en revue).
 * `mineur` est une BARRIÈRE PERSISTANTE : un compte marqué mineur est refusé à
 * chaque connexion (FR-070/FR-071), pas seulement au moment de la déclaration.
 */
export type LigneOnboarding = {
  date_naissance: string | null;
  mineur_detecte: boolean;
} | null;

export function etapeOnboarding(
  ligne: LigneOnboarding,
): "mineur" | "naissance" | "suite" {
  if (ligne?.mineur_detecte) return "mineur";
  if (ligne && !ligne.date_naissance) return "naissance";
  return "suite";
}
