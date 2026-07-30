import "server-only";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import type { DepotJournal, EntreeAConsigner } from "@/lib/domain/depot-journal";

/**
 * Dépôt du journal brut (AD-8, couche 1) sous JWT utilisatrice : la RLS + le write-gate font respecter
 * l'isolation (AD-12) et le consentement (AD-13). JAMAIS `service_role` — le journal est POSSÉDÉ par
 * l'utilisatrice (contraste avec `depot-seance`, server-authoritative). `contenu` est art. 9 → jamais
 * loggé ni porté par une erreur en clair (NFR-022) : l'erreur ne porte que le code Postgres.
 */
export function creerDepotJournal(utilisatriceId: string): DepotJournal {
  return {
    async consigner(entree: EntreeAConsigner): Promise<void> {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.from("entree_journal").upsert(
        {
          utilisatrice_id: utilisatriceId,
          cle_tour: entree.cleTour,
          role: entree.role,
          contenu: entree.contenu,
        },
        // Idempotence : la réémission (retry/reconnexion) du même tour logique → conflit IGNORÉ (pas d'erreur).
        { onConflict: "utilisatrice_id,cle_tour,role", ignoreDuplicates: true },
      );
      if (error) throw new Error(`entree_journal.consigner: ${error.code ?? "echec"}`);
    },
  };
}
