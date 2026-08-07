import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import type {
  DepotAbonnement,
  EvenementAbonnementProjete,
  ResultatProjection,
} from "@/lib/domain/depot-abonnement";

/**
 * Implémentation infra du dépôt d'abonnement (Story 3.1). ÉCRIVAIN UNIQUE : la projection passe
 * exclusivement par la RPC `traiter_evenement_abonnement` (security definer, service_role) — jamais
 * une écriture directe. Le client admin est légitime ici : abonnement est NON-art. 9 (tâche système,
 * AD-12). Contrairement au métrage best-effort, une erreur DB est PROPAGÉE (throw) : le webhook
 * répond alors 500 et Stripe REJOUE (l'idempotence par event.id rend le rejeu sûr).
 */
export function creerDepotAbonnement(): DepotAbonnement {
  const admin = createSupabaseAdminClient();
  return {
    async traiterEvenement(e: EvenementAbonnementProjete): Promise<ResultatProjection> {
      const { data, error } = await admin.rpc("traiter_evenement_abonnement", {
        cible: e.utilisatriceId,
        p_provider_event_id: e.providerEventId,
        p_type: e.type,
        p_stripe_customer_id: e.customerId,
        p_stripe_subscription_id: e.subscriptionId,
        p_etat: e.etat,
        p_periode_fin: e.periodeFin,
        p_source_maj_le: e.sourceMajLe,
        p_debut_le: e.debutLe,
        p_resiliation_demandee_le: e.resiliationDemandeeLe,
      });
      if (error) {
        // Jamais de contenu art. 9 dans le message (code Postgres seul).
        throw new Error(`traiter_evenement_abonnement a échoué (${error.code ?? "inconnu"}).`);
      }
      return data as ResultatProjection;
    },
  };
}
