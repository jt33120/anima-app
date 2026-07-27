/**
 * Décision d'onboarding — pure et testable (Story 1.4, étendue en 1.5, révocation en 1.6,
 * barrière de minorité détectée en 1.9).
 * Les étapes du seuil, dans l'ordre : mineur (barrière) → naissance → consentement → suite,
 * avec deux sorties latérales : « revoque » (consentement retiré) et « barre » (minorité
 * détectée après coup — la plus forte, elle prime sur tout).
 *
 * - `barre`        : BARRIÈRE DE MINORITÉ DÉTECTÉE (Story 1.9, FR-071) — un signal net a révélé
 *                    la minorité APRÈS le consentement. Le compte est SUSPENDU : plus aucune
 *                    écriture, plus aucun échange, on va vers l'écran /barriere (30 j + export).
 *                    DISTINCT de `mineur` : ici on ne signOut PAS (l'export a besoin de la session).
 * - `mineur`       : BARRIÈRE PERSISTANTE à la DÉCLARATION d'âge — un compte marqué mineur est
 *                    refusé à CHAQUE connexion (FR-070), signOut + /entrer?refus=age.
 * - `consentement` : la date est posée mais l'accord art. 9 + déclaration IA manque (FR-072).
 * - `revoque`      : elle avait consenti PUIS retiré (`revoked_at`) — traitement art. 9 suspendu
 *                    (AD-13). Ne JAMAIS la renvoyer re-consentir : elle va vers export/suppression.
 * - `suite`        : tout est en règle → entrée dans la scène.
 *
 * Fonction PURE : la lecture en base (utilisatrice + consentement, sous RLS) est faite
 * par `etapeOnboardingPour` (etat-onboarding.ts), source unique partagée par les gardes.
 */
export type LigneOnboarding = {
  date_naissance: string | null;
  mineur_detecte: boolean;
  barriere_minorite_le: string | null; // Story 1.9 : non-null = compte suspendu (FR-071)
} | null;

/** État du consentement art. 9 : jamais donné valablement / valide / donné puis révoqué. */
export type StatutConsentement = "aucun" | "valide" | "revoque";

export type EtapeOnboarding =
  | "barre"
  | "mineur"
  | "naissance"
  | "consentement"
  | "revoque"
  | "suite";

export function etapeOnboarding(
  ligne: LigneOnboarding,
  consentement: StatutConsentement,
): EtapeOnboarding {
  // Suspension pour minorité détectée : l'état le plus fort, il prime sur TOUT (Story 1.9).
  if (ligne?.barriere_minorite_le) return "barre";
  if (ligne?.mineur_detecte) return "mineur";
  // Révoquée : sortie latérale PRIORITAIRE (avant même la date). Une fois le consentement
  // retiré, on ne repasse JAMAIS par le tunnel d'onboarding — on va vers l'écran suspendu,
  // jamais re-cocher (pas de reconquête, AC4).
  if (consentement === "revoque") return "revoque";
  // Pas de ligne lisible (cas défensif — le trigger la garantit) OU pas de date :
  // on (re)part de la naissance. On n'entre JAMAIS dans la scène sans état confirmé.
  if (!ligne || !ligne.date_naissance) return "naissance";
  if (consentement === "aucun") return "consentement";
  return "suite";
}
