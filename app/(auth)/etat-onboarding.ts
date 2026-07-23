import type { SupabaseClient } from "@supabase/supabase-js";
import { etapeOnboarding, type EtapeOnboarding } from "./onboarding";

/**
 * État d'onboarding d'une session — SOURCE UNIQUE de vérité partagée par toutes les
 * gardes (/auth/confirm, /naissance, /consentement). Un seul endroit lit et décide,
 * pour qu'aucune garde ne diverge (leçon de la revue 1.4 : une barrière oubliée dans
 * un seul chemin suffit à laisser passer un mineur).
 *
 * Tout est lu SOUS la session RLS (auth.uid()) — jamais service_role (AD-12).
 * (Fichier importé uniquement depuis le serveur : Server Components / route handlers.)
 */
export async function etapeOnboardingPour(
  supabase: SupabaseClient,
  userId: string,
): Promise<EtapeOnboarding> {
  const { data: ligne } = await supabase
    .from("utilisatrice")
    .select("date_naissance, mineur_detecte")
    .eq("id", userId)
    .maybeSingle();

  // aConsenti : une preuve de consentement existe ET n'est pas révoquée
  // (revoked_at est préparée pour la Story 1.6 — ici toujours null).
  const { data: consentement } = await supabase
    .from("consentement")
    .select("revoked_at")
    .eq("utilisatrice_id", userId)
    .maybeSingle();
  const aConsenti = !!consentement && consentement.revoked_at === null;

  return etapeOnboarding(ligne, aConsenti);
}
