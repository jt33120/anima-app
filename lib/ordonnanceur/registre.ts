import "server-only";
import type { DescriptionJob } from "@/lib/domain/ordonnanceur";
import type { DepotOrdonnanceur } from "@/lib/data/depot-ordonnanceur";
import { executerSante } from "@/lib/ordonnanceur/jobs/sante";
import { executerSynthese, NOM_JOB as NOM_SYNTHESE } from "@/lib/ordonnanceur/jobs/synthese";

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
    // 60 h, et surtout PAS 48. L'intention est « un tick manqué ne déclenche rien, deux ticks manqués, si ».
    // À 48 h — pile deux fois la cadence — la comparaison au deuxième tick tombait à quelques secondes de la
    // bascule : elle se jouait sur la dérive de planification de Vercel Cron, qui se compte en minutes. La
    // même panne alertait ou non selon le hasard de l'horaire. 60 h place le seuil au MILIEU de l'intervalle
    // [48 h, 72 h] : deux ticks manqués alertent toujours, un seul jamais (revue 4.8, défaut n°9).
    toleranceHeures: 60,
    delaiMs: 15_000,
    // Le jour où ce job est entré au registre (Story 4.8). Lu seulement tant qu'il n'a jamais réussi.
    enServiceDepuis: new Date("2026-08-05T00:00:00Z"),
    executer: executerSante,
  },
  {
    // ⚠️ QUOTIDIEN, alors que la synthèse est HEBDOMADAIRE. Ce n'est pas une erreur — c'est le mécanisme
    // de reprise. Le job est un FAN-OUT : il repasse chaque jour et réclame une fenêtre HEBDOMADAIRE par
    // personne. Une personne servie lundi est `deja_fait` mardi ; une personne en échec lundi est reprise
    // mardi. Avec une cadence hebdomadaire ici, un fan-out partiellement réussi clôrait sa semaine et les
    // personnes en échec ne seraient jamais reprises. Voir l'en-tête de `jobs/synthese.ts`.
    nom: NOM_SYNTHESE,
    cadence: "quotidien",
    // 60 h, pour la même raison que le job de santé : jamais pile sur un multiple de la cadence.
    toleranceHeures: 60,
    // Le lot est de 20 personnes et chacune coûte un appel au modèle fort. Le délai borne le FAN-OUT
    // entier, pas une personne — chaque personne a en plus son propre bail (`BAIL_PERSONNE_S`).
    delaiMs: 50_000,
    enServiceDepuis: new Date("2026-08-05T00:00:00Z"),
    executer: executerSynthese,
  },
];
