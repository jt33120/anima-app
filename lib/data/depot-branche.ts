import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import type { EtatBranche } from "@/lib/scene/projection";

/**
 * Dépôt de la BRANCHE (Story 4.5 + 4.6) sous JWT utilisatrice. La RLS + le write-gate + les gardes (AD-17 à la
 * naissance, R1 au renommage) vivent dans les policies/triggers (0021/0022) — le dépôt n'est qu'un adaptateur.
 * JAMAIS `service_role`, JAMAIS `.from("branche")` direct : tout passe par des RPC possédées (security invoker).
 *
 * NFR-022 : le `nom` et le verbatim `contenu` (art. 9) ne sont JAMAIS loggés ni portés par une erreur en clair —
 * l'erreur ne porte que le code Postgres. Le verbatim REMONTE en donnée (la fiche l'affiche, FR-027) — c'est
 * l'affichage légitime à la propriétaire, distinct de NFR-022 (logs/erreurs).
 */

/** Une branche chargée pour l'arbre : l'état + le verbatim de son extrait source (pour la fiche). */
export interface BrancheChargee {
  id: string;
  nom: string;
  etat: EtatBranche;
  intensite: number;
  dateNaissance: string;
  extraitSourceId: string;
  extraitContenu: string;
  extraitCreeLe: string;
}

/** Un message de l'échange source (« Voir dans la conversation ») : le message exact + son voisinage. */
export interface EchangeMessage {
  id: string;
  role: "utilisatrice" | "anam";
  contenu: string;
  creeLe: string;
  estCible: boolean;
}

export interface DepotBranche {
  creerDepuisSignal(args: { signalId: string; nom: string }): Promise<void>;
  chargerBranches(): Promise<BrancheChargee[]>;
  chargerEchangeSource(args: { extraitSourceId: string }): Promise<EchangeMessage[]>;
  renommer(args: { brancheId: string; nom: string }): Promise<void>;
}

export function creerDepotBranche(client?: SupabaseClient): DepotBranche {
  const clientOu = async () => client ?? (await createSupabaseServerClient());

  return {
    async creerDepuisSignal({ signalId, nom }): Promise<void> {
      const supabase = await clientOu();
      const { error } = await supabase.rpc("creer_branche_depuis_signal", { p_signal_id: signalId, p_nom: nom });
      if (error) throw new Error(`branche.creerDepuisSignal: ${error.code ?? "echec"}`);
    },

    async chargerBranches(): Promise<BrancheChargee[]> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("charger_branches_arbre");
      if (error) throw new Error(`branche.chargerBranches: ${error.code ?? "echec"}`);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.branche_id as string,
        nom: r.nom as string,
        etat: r.etat as EtatBranche,
        // Repli sûr au plus près de la frontière serveur : une valeur non finie (la colonne `real` accepte
        // 'NaN' avant la borne 0023) ne doit jamais entrer dans le domaine (revue 4.6).
        intensite: Number.isFinite(Number(r.intensite)) ? Math.min(1, Math.max(0, Number(r.intensite))) : 0,
        dateNaissance: r.date_naissance as string,
        extraitSourceId: r.extrait_source_id as string,
        extraitContenu: r.extrait_contenu as string,
        extraitCreeLe: r.extrait_cree_le as string,
      }));
    },

    async chargerEchangeSource({ extraitSourceId }): Promise<EchangeMessage[]> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("charger_echange_source", { p_extrait_source_id: extraitSourceId });
      if (error) throw new Error(`branche.chargerEchangeSource: ${error.code ?? "echec"}`);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        role: r.role as "utilisatrice" | "anam",
        contenu: r.contenu as string,
        creeLe: r.cree_le as string,
        estCible: Boolean(r.est_cible),
      }));
    },

    async renommer({ brancheId, nom }): Promise<void> {
      const supabase = await clientOu();
      const { error } = await supabase.rpc("renommer_branche", { p_branche_id: brancheId, p_nouveau_nom: nom });
      if (error) throw new Error(`branche.renommer: ${error.code ?? "echec"}`);
    },
  };
}
