import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

/**
 * Story 4.10 (T4) — le dépôt de l'ARBITRAGE D'OUVERTURE, sous JWT utilisatrice.
 *
 * Deux méthodes, et la seconde n'est pas une lecture :
 *
 *   • `faits()` — combien de branches encore en `naissance`, et laquelle viser. Le COMPTE s'arrête ICI :
 *     il entre dans le domaine pur, choisit une branche du `if`, et ne ressort jamais (AC5 [DUR]).
 *
 *   • `reserverParole()` — une RÉSERVATION, pas une question. Elle écrit, et c'est ce qui la rend sûre :
 *     deux rendus concurrents (deux onglets, un rafraîchissement) ne peuvent pas dire deux fois la même
 *     chose. Patron `reserver_notification` — la réservation EST la décision.
 *
 * JAMAIS `service_role`, JAMAIS `.from()` direct. Les RPC sont possédées (0036).
 */

export interface FaitsArbitrage {
  /** ⚠️ NE DOIT PAS SORTIR DE `lib/`. Sert au prédicat pur, jamais au rendu (FR-031/AC5). */
  readonly branchesEnNaissance: number;
  /** La plus ancienne encore en `naissance` (ordre total : date puis id). `null` si aucune. */
  readonly brancheCibleId: string | null;
}

export interface DepotArbitrage {
  faits(): Promise<FaitsArbitrage>;
  /** `true` si Anam a le droit de dire l'invitation MAINTENANT — au plus une fois par fenêtre, réarmée par un mouvement. */
  reserverParole(fenetreHeures: number): Promise<boolean>;
}

export function creerDepotArbitrage(client?: SupabaseClient): DepotArbitrage {
  const clientOu = async () => client ?? (await createSupabaseServerClient());

  return {
    async faits(): Promise<FaitsArbitrage> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("faits_arbitrage_ouverture");
      if (error) throw new Error(`arbitrage.faits: ${error.code ?? "echec"}`);
      const ligne = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
      // Repli au plus près de la frontière : un compte illisible devient 0, donc `tropDeBranchesOuvertes`
      // dit non, donc Anam propose comme avant. Le doute ne fait jamais PARLER Anam (voir le domaine pur).
      const brut = Number(ligne?.branches_en_naissance);
      return {
        branchesEnNaissance: Number.isFinite(brut) && brut > 0 ? brut : 0,
        brancheCibleId: (ligne?.branche_cible as string) ?? null,
      };
    },

    async reserverParole(fenetreHeures): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("reserver_invitation_integration", {
        p_fenetre_heures: fenetreHeures,
      });
      if (error) throw new Error(`arbitrage.reserverParole: ${error.code ?? "echec"}`);
      // Dans le doute : NE PAS parler. Une phrase de trop est irrattrapable et se répète dans le souvenir ;
      // une phrase de moins ne coûte rien — la proposition ordinaire reprendra son cours.
      return data === true;
    },
  };
}
