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
  /**
   * Story 3.5 — la PREMIÈRE souscription (`subscription.start_date`), base des trois mois de la garantie
   * FR-089. Distincte de la période courante : elle ne bouge pas à la reconduction. `null` si l'event ne
   * la porte pas — la RPC conserve alors la valeur déjà projetée (coalesce), elle ne l'efface pas.
   */
  readonly debutLe: string | null;
  /**
   * Story 3.5 — `subscription.cancel_at` : la date à laquelle la résiliation prendra effet, ou `null` si
   * aucune résiliation n'est en cours. `null` est une VALEUR, pas une absence : une résiliation annulée
   * doit effacer la date côté projection (sinon l'écran dirait « résilié » à quelqu'un qui est revenu).
   */
  readonly resiliationDemandeeLe: string | null;
};

/** Résultat de la projection écrivain-unique (miroir des retours de la RPC `traiter_evenement_abonnement`). */
export type ResultatProjection = "traite" | "deja_traite" | "ignore_obsolete";

export interface DepotAbonnement {
  /** Applique un événement à la projection `abonnement`, idempotent par `providerEventId`. */
  traiterEvenement(evenement: EvenementAbonnementProjete): Promise<ResultatProjection>;
}
