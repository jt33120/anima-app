import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

/**
 * Dépôt de la BRANCHE (Story 4.5) sous JWT utilisatrice : la RLS + le write-gate + la garde AD-17 (au point
 * d'écriture, dans la policy WITH CHECK) font respecter le consentement, l'isolation, le nom donné par elle et
 * « aucune branche née d'une détresse ». JAMAIS `service_role` — la branche est POSSÉDÉE par l'utilisatrice,
 * et `creer_branche_depuis_signal` est `security invoker` (elle a BESOIN de `auth.uid()`).
 *
 * NFR-022 : le `nom` (art. 9) n'est JAMAIS loggé ni porté par une erreur en clair — l'erreur ne porte que le
 * code Postgres.
 */
export interface DepotBranche {
  creerDepuisSignal(args: { signalId: string; nom: string }): Promise<void>;
}

export function creerDepotBranche(client?: SupabaseClient): DepotBranche {
  return {
    async creerDepuisSignal({ signalId, nom }: { signalId: string; nom: string }): Promise<void> {
      const supabase = client ?? (await createSupabaseServerClient());
      const { error } = await supabase.rpc("creer_branche_depuis_signal", { p_signal_id: signalId, p_nom: nom });
      if (error) throw new Error(`branche.creerDepuisSignal: ${error.code ?? "echec"}`);
    },
  };
}
