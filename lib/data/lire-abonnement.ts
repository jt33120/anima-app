import "server-only";
import { createSupabaseServerClient } from "./supabase/server";
import { estPremium, type EtatAbonnement } from "@/lib/domain/abonnement";

/**
 * Lit l'ENTITLEMENT premium de l'utilisatrice courante (Story 3.1, AC4) — la source de vérité UNIQUE
 * que les gardes des Stories 3.3/3.4 interrogeront. Lecture SOUS JWT (RLS SELECT propriétaire, AD-12) :
 * l'utilisatrice lit SA seule ligne `abonnement` ; jamais via le client admin. L'entitlement est
 * DÉRIVÉ (`estPremium`) — jamais stocké en double.
 */
export async function estPremiumCourante(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("abonnement").select("etat").maybeSingle();
  // Une VRAIE panne de lecture (RLS momentanément mauvaise, timeout, pool épuisé, JWT en bordure) résout
  // en `{data:null, error}` SANS lever (postgrest-js : `shouldThrowOnError=false`, jamais activé ici). Si
  // on l'ignorait, `data=null` dériverait `false` = « non premium » en silence → un appelant commercial
  // (route 3.2) PROPOSERAIT la carte à une abonnée active. On RELANCE donc l'erreur (miroir de
  // `lib/data/depot-abonnement`) pour que l'appelant applique son repli sûr (« le doute suspend le commerce »).
  if (error) throw new Error(`lecture abonnement a échoué (${error.code ?? "inconnu"}).`);
  return estPremium(data as { etat: EtatAbonnement } | null);
}
