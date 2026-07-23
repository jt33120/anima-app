/**
 * Décision d'onboarding — pure et testable (Story 1.4, étendue en 1.5).
 * Les étapes du seuil, dans l'ordre : mineur (barrière) → naissance → consentement → suite.
 *
 * - `mineur`       : BARRIÈRE PERSISTANTE — un compte marqué mineur est refusé à CHAQUE
 *                    connexion (FR-070/FR-071), pas seulement au moment de la déclaration.
 * - `consentement` : la date est posée mais l'accord art. 9 + déclaration IA manque (FR-072).
 * - `suite`        : tout est en règle → entrée dans la scène.
 *
 * Fonction PURE : la lecture en base (utilisatrice + consentement, sous RLS) est faite
 * par `etapeOnboardingPour` (etat-onboarding.ts), source unique partagée par les gardes.
 */
export type LigneOnboarding = {
  date_naissance: string | null;
  mineur_detecte: boolean;
} | null;

export type EtapeOnboarding = "mineur" | "naissance" | "consentement" | "suite";

export function etapeOnboarding(
  ligne: LigneOnboarding,
  aConsenti: boolean,
): EtapeOnboarding {
  if (ligne?.mineur_detecte) return "mineur";
  // Pas de ligne lisible (cas défensif — le trigger la garantit) OU pas de date :
  // on (re)part de la naissance. On n'entre JAMAIS dans la scène sans état confirmé.
  if (!ligne || !ligne.date_naissance) return "naissance";
  if (!aConsenti) return "consentement";
  return "suite";
}
