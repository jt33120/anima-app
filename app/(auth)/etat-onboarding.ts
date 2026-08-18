import type { SupabaseClient } from "@supabase/supabase-js";
import {
  etapeOnboarding,
  type EtapeOnboarding,
  type StatutConsentement,
} from "./onboarding";

/**
 * État d'onboarding d'une session — SOURCE UNIQUE de vérité partagée par toutes les
 * gardes (/, /auth/confirm, /naissance, /consentement) ET les Server Actions de consentement.
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
    .select("date_naissance, mineur_detecte, barriere_minorite_le")
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
    .select("art9_accorde, ia_reconnue, cgu_acceptees, revoked_at")
    .eq("utilisatrice_id", userId)
    .maybeSingle();
  if (erreurConsentement) {
    throw new Error(`Lecture du consentement impossible : ${erreurConsentement.message}`);
  }

  return etapeOnboarding(ligne, statutConsentement(consentement));
}

/**
 * Statut du consentement art. 9 à partir de la ligne `consentement` (ou son absence) :
 *  - `aucun`   : pas de preuve valide (pas de ligne, ou art. 9 / IA non reconnus) → doit consentir.
 *  - `valide`  : art. 9 accordé ET IA reconnue ET non révoqué → traitement autorisé.
 *  - `revoque` : art. 9 accordé + IA reconnue MAIS `revoked_at` posé → traitement suspendu (AD-13).
 * On lit les DRAPEAUX, jamais la seule existence d'une ligne (acquis de la revue 1.5) : une ligne
 * `art9_accorde=false` (écrivable en direct via l'API REST sous RLS) ne vaut PAS un consentement.
 */
function statutConsentement(
  c: {
    art9_accorde: boolean;
    ia_reconnue: boolean;
    cgu_acceptees: boolean;
    revoked_at: string | null;
  } | null,
): StatutConsentement {
  // ⚠️ `cgu_acceptees` EST LU DEPUIS LA REVUE DES EPICS 1 À 4. Il ne l'était pas — ni ici, ni dans
  // `a_consenti_art9()` : seule la Server Action exigeait la case, c'est-à-dire rien pour qui écrit
  // en direct sur PostgREST. Le produit s'utilisait entièrement sans contrat, et la confirmation des
  // dix-huit ans que 0004 fait porter à cette même case ne valait pas davantage.
  //
  // Il est lu ICI ET en base, dans le même correctif : la base seule laisserait `etapeOnboarding`
  // rendre « suite » à quelqu'un dont toutes les écritures art. 9 échouent ensuite en silence. Une
  // garde qui laisse entrer dans une pièce où plus rien ne fonctionne est pire que pas de garde.
  if (!c || c.art9_accorde !== true || c.ia_reconnue !== true || c.cgu_acceptees !== true) {
    return "aucun";
  }
  return c.revoked_at === null ? "valide" : "revoque";
}
