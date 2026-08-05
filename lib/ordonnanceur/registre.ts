import "server-only";
import type { DescriptionJob } from "@/lib/domain/ordonnanceur";
import type { DepotOrdonnanceur } from "@/lib/data/depot-ordonnanceur";
import { executerSante } from "@/lib/ordonnanceur/jobs/sante";

/**
 * Story 4.8 (AC1) — LE REGISTRE. La liste, unique et déclarative, de tout ce qui s'exécute périodiquement
 * dans ce produit.
 *
 * C'est le fichier qu'on lit pour répondre à « qu'est-ce qui tourne tout seul ici ? ». Que cette question
 * ait UNE réponse tient à une seule chose : rien d'autre dans le dépôt ne déclenche de mécanisme périodique.
 * Un test de garde (`tests/ordonnanceur-architecture.test.ts`) casse le build si ça change — c'est l'AC4.
 *
 * Les futurs pensionnaires, déjà nommés ailleurs et volontairement absents ici :
 *   • la synthèse périodique (Story 4.9) ;
 *   • les rappels d'échéance (Story 4.10) ;
 *   • la rétention et l'effacement (Epic 6, AD-14) ;
 *   • les deux rythmes de notification (Epic 6, FR-033/034).
 */

export interface ContexteJob {
  readonly depot: DepotOrdonnanceur;
  readonly instant: Date;
  /** Le registre lui-même — le job de santé en a besoin, et le lui passer évite un cycle d'importation. */
  readonly registre: readonly JobEnregistre[];
}

export interface JobEnregistre extends DescriptionJob {
  readonly executer: (ctx: ContexteJob) => Promise<void>;
}

export const REGISTRE: readonly JobEnregistre[] = [
  {
    nom: "sante-ordonnanceur",
    cadence: "quotidien",
    // Deux jours : un tick manqué ne déclenche rien (Vercel Cron n'est pas contractuellement ponctuel),
    // deux ticks manqués, si. La tolérance vaut toujours plus que l'intervalle de la cadence, sinon le job
    // s'alerterait sur son propre décalage d'exécution.
    toleranceHeures: 48,
    delaiMs: 15_000,
    executer: executerSante,
  },
];
