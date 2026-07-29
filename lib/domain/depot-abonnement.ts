import type { EtatAbonnement } from "./abonnement";

/**
 * Port PUR du dépôt d'abonnement (Story 3.1, AD-10). Défini par le domaine, implémenté par l'infra
 * (`lib/data/depot-abonnement`). Aucun import runtime (type seul).
 */

/** Un événement d'abonnement NORMALISÉ, prêt à projeter (déjà mappé en `EtatAbonnement`). */
export type EvenementAbonnementProjete = {
  readonly providerEventId: string;
  readonly type: string;
  readonly utilisatriceId: string;
  readonly etat: EtatAbonnement;
  readonly customerId: string | null;
  readonly subscriptionId: string | null;
  readonly periodeFin: string | null; // ISO 8601 UTC, ou null si inconnu
  readonly sourceMajLe: string; // ISO 8601 UTC — horodatage de l'event Stripe (anti-régression d'ordre)
};

/** Résultat de la projection écrivain-unique (miroir des retours de la RPC `traiter_evenement_abonnement`). */
export type ResultatProjection = "traite" | "deja_traite" | "ignore_obsolete";

export interface DepotAbonnement {
  /** Applique un événement à la projection `abonnement`, idempotent par `providerEventId`. */
  traiterEvenement(evenement: EvenementAbonnementProjete): Promise<ResultatProjection>;
}
