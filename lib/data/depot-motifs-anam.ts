import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import type { MotifAnamPresent } from "@/lib/domain/carte-anam";

/**
 * Story 6.3 (T5) — le dépôt des MOTIFS D'ANAM, sous JWT utilisatrice.
 *
 * Une seule lecture, et elle ne décide de rien : `motifs_anam_du()` (migration 0054) rend TOUS les
 * motifs présents, l'arbitrage vit dans le domaine pur (`motifPrioritaire`). C'est ce partage qui rend
 * la règle de produit modifiable sans migration, et testable sans base.
 *
 * ── POURQUOI UNE RPC ET PAS TROIS `select` ICI ────────────────────────────────────────────────────
 *
 * Parce que la garde AD-17 doit vivre en base. Les policies de lecture d'`intention` et de `synthese`
 * ne portent QUE la propriété — pas la fenêtre de détresse. Trois `select` écrits ici diraient donc
 * « une échéance que tu as fixée arrive aujourd'hui » à quelqu'une en épisode, à la seconde où le
 * canal sortant, lui, refuse. La fonction porte `branche_bloquee_par_detresse()` sur ses trois
 * branches, exactement comme `charger_proposition_branche` — la seule autre parole in-app d'Anam.
 *
 * JAMAIS `service_role`, JAMAIS `.from()` direct : la RPC est possédée, `security invoker`, et
 * `grant execute` à `authenticated` seulement.
 */

export interface DepotMotifsAnam {
  /** Tous les motifs présents pour la propriétaire du JWT. Liste vide = elle n'a rien à dire. */
  motifs(): Promise<readonly MotifAnamPresent[]>;
}

export function creerDepotMotifsAnam(client?: SupabaseClient): DepotMotifsAnam {
  const clientOu = async () => client ?? (await createSupabaseServerClient());

  return {
    async motifs(): Promise<readonly MotifAnamPresent[]> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("motifs_anam_du");
      if (error) throw new Error(`motifs_anam: ${error.code ?? "echec"}`);
      if (!Array.isArray(data)) return [];
      // ⚠️ NORMALISATION AU PLUS PRÈS DE LA FRONTIÈRE, ET SANS INVENTER. Une colonne absente devient
      // `null`, jamais `""` : le domaine distingue « pas de mots » (carte neutre) de « des mots vides »
      // (une phrase à trous). Aplatir les deux ici ferait sauter le fail-closed d'`ligneAnam`.
      return data.map((l: Record<string, unknown>) => ({
        motif: typeof l.motif === "string" ? l.motif : "",
        jour: typeof l.jour === "string" ? l.jour : null,
        titre: typeof l.titre === "string" ? l.titre : null,
        detail: typeof l.detail === "string" ? l.detail : null,
      }));
    },
  };
}
