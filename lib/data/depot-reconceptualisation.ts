import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import type { DepotSignalReconcept } from "@/lib/safety/reconceptualisation-pipeline";

/**
 * Dépôt du SIGNAL DE RECONCEPTUALISATION (Story 4.4) sous JWT utilisatrice : la RLS + le write-gate + la
 * garde AD-17 (au point d'écriture) font respecter l'isolation, le consentement et « aucun signal né d'une
 * détresse ». JAMAIS `service_role` (contraste avec `depot-episode`, server-authoritative) — le signal est
 * POSSÉDÉ par l'utilisatrice, et la RPC est `security invoker` (elle a BESOIN de `auth.uid()` pour résoudre
 * l'entrée exacte ET pour `branche_bloquee_par_detresse()`).
 *
 * `client` OPTIONNEL : la détection tourne dans `after()` (post-réponse) — on RÉUTILISE le client JWT déjà
 * authentifié de la route (jeton en mémoire) plutôt que d'en reconstruire un qui devrait relire les cookies
 * d'une requête terminée. Hors route (tests/appels directs), il retombe sur `createSupabaseServerClient()`.
 *
 * NFR-022 : `cle_tour` (idempotence) et tout contenu ne sont JAMAIS loggés ni portés par une erreur en
 * clair — l'erreur ne porte que le code Postgres.
 */
export function creerDepotSignalReconcept(client?: SupabaseClient): DepotSignalReconcept {
  return {
    async enregistrer({ cleTour }: { cleTour: string }): Promise<void> {
      const supabase = client ?? (await createSupabaseServerClient());
      const { error } = await supabase.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: cleTour });
      if (error) throw new Error(`signal_reconceptualisation.enregistrer: ${error.code ?? "echec"}`);
    },
  };
}
