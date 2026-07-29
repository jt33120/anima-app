import { etatArcInitial, type EtatArc } from "./arc-seance";

/**
 * `DepotSeance` — le PORT de persistance de la trace d'arc, DÉFINI PAR LE DOMAINE (Story 2.7, T3).
 * Le domaine reste pur (AD-1) : il déclare le contrat, l'infra l'implémente (`lib/data/depot-seance`,
 * service_role, patron `depot-episode`). L'identité de l'utilisatrice est fixée à la CONSTRUCTION du
 * dépôt (patron `creerDepotEpisode`) — les méthodes n'ont donc pas de paramètre `userId`.
 */
export interface DepotSeance {
  /** Charge la trace courante ; jamais de trace → état initial (repartir de construire, sûr). */
  charger(): Promise<EtatArc>;
  /** Persiste l'état calculé par la machine (upsert idempotent). Ne décide rien. */
  ecrire(etat: EtatArc): Promise<void>;
}

/**
 * Placeholder PUR pour les tests unitaires de la machine (patron `depotEpisodePlaceholder`) :
 * honnête (aucune persistance) — `charger` repart de l'état initial, `ecrire` ne fait rien. Le dépôt
 * RÉEL (persistant, cross-tour) vit dans `lib/data/depot-seance` (T3 GREEN).
 */
export const depotSeancePlaceholder: DepotSeance = {
  async charger() {
    return etatArcInitial();
  },
  async ecrire() {
    /* aucune persistance côté placeholder */
  },
};
