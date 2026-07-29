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
  const { data } = await supabase.from("abonnement").select("etat").maybeSingle();
  return estPremium(data as { etat: EtatAbonnement } | null);
}
