import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

/**
 * depot-seuil.ts — LA DATE DU PREMIER FRANCHISSEMENT (migration 0078, H4).
 *
 * ⚠️ TOUT PASSE SOUS LE JWT DE LA PERSONNE, JAMAIS PAR `service_role` (AD-12). La lecture est un
 * simple `select` : `authenticated` a le grant SELECT sur cette colonne-là, et la policy
 * `utilisatrice_proprietaire` limite la ligne à la sienne. L'écriture, elle, passe OBLIGATOIREMENT
 * par la RPC : la colonne n'a aucun grant UPDATE, donc il n'existe pas d'autre chemin — y compris
 * pour un POST direct sur `/rest/v1/`.
 */
export interface DepotSeuil {
  /** La date du premier franchissement, ou `null` s'il n'a jamais été franchi. */
  lireFranchiLe(): Promise<string | null>;
  /** Le seuil vient d'être franchi. Rend `true` si c'est CET appel qui a posé la date. */
  marquerFranchi(): Promise<boolean>;
}

export function creerDepotSeuil(client?: SupabaseClient): DepotSeuil {
  const clientOu = async () => client ?? (await createSupabaseServerClient());

  return {
    async lireFranchiLe(): Promise<string | null> {
      const supabase = await clientOu();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      const { data: ligne } = await supabase
        .from("utilisatrice")
        .select("seuil_franchi_le")
        .eq("id", data.user.id)
        .maybeSingle<{ seuil_franchi_le: string | null }>();
      return ligne?.seuil_franchi_le ?? null;
    },

    async marquerFranchi(): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("marquer_seuil_franchi");
      if (error) throw new Error(`seuil.marquerFranchi: ${error.code ?? "echec"}`);
      return data === true;
    },
  };
}
