import "server-only";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import type { DepotFaits, FaitCandidat } from "@/lib/domain/fusion-fait";

/**
 * Dépôt des faits extraits (AD-8 couche 2) sous JWT utilisatrice : la RLS + le write-gate + le trigger
 * anti-résurrection font respecter l'isolation (AD-12), le consentement (AD-13) et l'invariant tombstone
 * (AD-18). JAMAIS `service_role` — le fait est POSSÉDÉ par l'utilisatrice (comme le journal). `contenu`
 * et `cleDedoublonnage` sont art. 9 → jamais loggés ni portés par une erreur en clair (NFR-022) : l'erreur
 * ne porte que le code Postgres.
 *
 * SEUL chemin d'écriture (AC4) : l'unique fonction possédée `fusionner_fait_extrait` (security invoker →
 * RLS + write-gate s'appliquent). L'identité vient du JWT (`auth.uid()` dans la fonction) — jamais fournie
 * par l'appelant. `supabase-js .upsert()` ne sait pas exprimer l'`ON CONFLICT … WHERE` conditionnel, d'où
 * la fonction (patron `lib/safety/depot-episode.ts`).
 */
export function creerDepotFaits(): DepotFaits {
  async function appeler(args: {
    p_origine: "extrait" | "utilisatrice";
    p_statut: "actif" | "corrige" | "supprime";
    p_cle: string;
    p_contenu: string;
    p_extrait_source: string | null;
  }): Promise<void> {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("fusionner_fait_extrait", args);
    if (error) throw new Error(`fusionner_fait_extrait: ${error.code ?? "echec"}`);
  }

  return {
    async fusionner(fait: FaitCandidat): Promise<void> {
      await appeler({
        p_origine: "extrait",
        p_statut: "actif",
        p_cle: fait.cleDedoublonnage,
        p_contenu: fait.contenu,
        p_extrait_source: fait.extraitSourceId,
      });
    },
    async corriger(cleDedoublonnage: string, contenu: string): Promise<void> {
      await appeler({ p_origine: "utilisatrice", p_statut: "corrige", p_cle: cleDedoublonnage, p_contenu: contenu, p_extrait_source: null });
    },
    async supprimer(cleDedoublonnage: string): Promise<void> {
      // Contenu VIDÉ au tombstone (point (b)) : la clé demeure (bloque la résurrection), le contenu art. 9 part.
      await appeler({ p_origine: "utilisatrice", p_statut: "supprime", p_cle: cleDedoublonnage, p_contenu: "", p_extrait_source: null });
    },
  };
}
