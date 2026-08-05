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
  /** Story 4.7 (AC5) — `null` tant que la transition n'a pas eu lieu. */
  dateFeuillaison: string | null;
  dateRayonnement: string | null;
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
  /**
   * Story 4.7 — les branches encore VIVANTES (hors rayonnement : une branche arrivée n'a plus à
   * feuiller) avec leur extrait source, pour la présélection déterministe du retour sur le thème.
   * Le `nom` remonte ici et reste EN MÉMOIRE SERVEUR : il sert la présélection, jamais le modèle (AC7).
   */
  chargerCandidatsRetour(): Promise<{ id: string; nom: string; extrait: string; etat: EtatBranche; intensite: number }[]>;
  /** Story 4.7 — consigne un retour et fait avancer la matière d'un degré. `true` si ça a bougé. */
  progresserFeuillaison(args: { brancheId: string; cleTour: string }): Promise<boolean>;
  /** Story 4.7 (AC3) — la DÉCLARATION de pleine lumière. SEUL appelant légitime : la route du geste. */
  declarerRayonnement(args: { brancheId: string }): Promise<void>;
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
        dateFeuillaison: (r.date_feuillaison as string) ?? null,
        dateRayonnement: (r.date_rayonnement as string) ?? null,
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

    async chargerCandidatsRetour(): Promise<
      { id: string; nom: string; extrait: string; etat: EtatBranche; intensite: number }[]
    > {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("charger_branches_arbre");
      if (error) throw new Error(`branche.chargerCandidatsRetour: ${error.code ?? "echec"}`);
      return (data ?? [])
        // Une branche en pleine lumière est arrivée : la faire « feuiller » encore n'aurait aucun sens,
        // et l'envoyer au modèle exposerait un extrait art. 9 pour rien (minimisation).
        .filter((r: Record<string, unknown>) => r.etat !== "rayonnement")
        .map((r: Record<string, unknown>) => ({
          id: r.branche_id as string,
          nom: (r.nom as string) ?? "",
          extrait: (r.extrait_contenu as string) ?? "",
          etat: r.etat as EtatBranche,
          intensite: Number.isFinite(Number(r.intensite)) ? Math.min(1, Math.max(0, Number(r.intensite))) : 0,
        }));
    },

    async progresserFeuillaison({ brancheId, cleTour }): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("progresser_feuillaison", {
        p_branche_id: brancheId,
        p_cle_tour: cleTour,
      });
      if (error) throw new Error(`branche.progresserFeuillaison: ${error.code ?? "echec"}`);
      return data === true;
    },

    async declarerRayonnement({ brancheId }): Promise<void> {
      const supabase = await clientOu();
      const { error } = await supabase.rpc("declarer_rayonnement", { p_branche_id: brancheId });
      if (error) throw new Error(`branche.declarerRayonnement: ${error.code ?? "echec"}`);
    },
  };
}
