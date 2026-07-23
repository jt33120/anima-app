import type { SupabaseClient } from "@supabase/supabase-js";
import { etapeOnboarding, type EtapeOnboarding } from "./onboarding";

/**
 * État d'onboarding d'une session — SOURCE UNIQUE de vérité partagée par toutes les
 * gardes (/auth/confirm, /naissance, /consentement) ET la Server Action de consentement.
 * Un seul endroit lit et décide, pour qu'aucun chemin ne diverge (leçon de la revue 1.4 :
 * une barrière oubliée dans un seul chemin suffit à laisser passer un mineur).
 *
 * Tout est lu SOUS la session RLS (auth.uid()) — jamais service_role (AD-12).
 * (Fichier importé uniquement depuis le serveur : Server Components / route handlers / actions.)
 */
export async function etapeOnboardingPour(
  supabase: SupabaseClient,
  userId: string,
): Promise<EtapeOnboarding> {
  const { data: ligne, error: erreurLigne } = await supabase
    .from("utilisatrice")
    .select("date_naissance, mineur_detecte")
    .eq("id", userId)
    .maybeSingle();
  // Fail LOUD sur une vraie erreur de lecture : ne jamais confondre « lecture impossible »
  // (transitoire) avec « pas de ligne ». Sinon on renverrait une adulte déjà consentante vers
  // /naissance, ensuite bloquée par l'immutabilité de la date (revue 1.5).
  if (erreurLigne) {
    throw new Error(`Lecture de l'état d'onboarding impossible : ${erreurLigne.message}`);
  }

  const { data: consentement, error: erreurConsentement } = await supabase
    .from("consentement")
    .select("art9_accorde, ia_reconnue, revoked_at")
    .eq("utilisatrice_id", userId)
    .maybeSingle();
  if (erreurConsentement) {
    throw new Error(`Lecture du consentement impossible : ${erreurConsentement.message}`);
  }

  // aConsenti : une preuve EXPLICITE (art. 9 accordé ET déclaration IA reconnue), non révoquée.
  // On lit les DRAPEAUX — pas seulement l'existence de la ligne : une ligne art9_accorde=false
  // (écrivable en direct via l'API REST sous RLS) ne doit JAMAIS ouvrir la scène (revue 1.5).
  const aConsenti =
    !!consentement &&
    consentement.art9_accorde === true &&
    consentement.ia_reconnue === true &&
    consentement.revoked_at === null;

  return etapeOnboarding(ligne, aConsenti);
}
