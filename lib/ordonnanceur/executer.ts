import "server-only";
import { avecDelai } from "@/lib/domain/delai";
import { fenetreDe } from "@/lib/domain/ordonnanceur";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";
import type { DepotOrdonnanceur } from "@/lib/data/depot-ordonnanceur";
import { REGISTRE, type JobEnregistre } from "@/lib/ordonnanceur/registre";
import { verifierEnvironnement } from "@/lib/ordonnanceur/environnement";

/**
 * Story 4.8 — LE RÉPARTITEUR. Le seul appelant applicatif est la porte (`app/api/ordonnanceur/route.ts`) ;
 * un test de garde le vérifie (AC1/AC4).
 *
 * Le fil est court, et c'est le but : vérifier où l'on est, puis pour chaque job — réclamer, exécuter sous
 * délai, clore. Toute la subtilité vit ailleurs : dans la réclamation atomique (SQL) et dans la fenêtre
 * déterministe (domaine pur). Ici, on n'a plus qu'à ne pas se tromper d'ordre.
 */

/** Marge ajoutée au délai du job pour calculer son bail : un plantage franc libère la fenêtre après ça. */
const MARGE_BAIL_S = 60;

/** Un code d'erreur au format de nos RPC : « reclamer_execution: 42501 ». */
const CODE_RPC = /^[a-z_]+: [A-Z0-9]+$/;
/** Un code interne : au moins deux segments en minuscules reliés par `_` — « sante_ordonnanceur_timeout ». */
const CODE_INTERNE = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

/**
 * Réduit une erreur à un CODE écrivable en base (NFR-020/NFR-022).
 *
 * Le raisonnement, et il est plus strict qu'il n'en a l'air : un message d'erreur est un ramasse-miettes.
 * Il peut avoir traversé un adaptateur qui recopie l'entrée, une bibliothèque qui cite la valeur fautive,
 * un pilote qui rend la ligne. On ne peut donc pas ASSAINIR un message — on ne peut que RECONNAÎTRE les
 * nôtres et jeter le reste. D'où deux formes admises, et `erreur_non_identifiee` pour tout le reste.
 *
 * L'exigence de deux segments dans `CODE_INTERNE` n'est pas cosmétique : sans elle, un message réduit à un
 * seul mot en minuscules — c'est-à-dire un mot pris au verbatim d'une utilisatrice — passerait le filtre.
 */
export function codeDErreur(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  return CODE_RPC.test(message) || CODE_INTERNE.test(message) ? message.slice(0, 120) : "erreur_non_identifiee";
}

export type IssueJob = "execute" | "deja_fait" | "echoue";

export interface RapportOrdonnanceur {
  readonly execute: boolean;
  readonly refus?: "desaccord" | "base_muette";
  readonly jobs: readonly { readonly nom: string; readonly issue: IssueJob }[];
}

export interface DepsOrdonnanceur {
  readonly depot: DepotOrdonnanceur;
  readonly instant?: Date;
  readonly registre?: readonly JobEnregistre[];
}

export async function executerOrdonnanceur(deps: DepsOrdonnanceur): Promise<RapportOrdonnanceur> {
  const instant = deps.instant ?? new Date();
  const registre = deps.registre ?? REGISTRE;

  const verdict = await verifierEnvironnement(deps.depot);
  if (!verdict.accorde) {
    // AUCUNE écriture, pas même une trace d'incident. On vient de conclure qu'on n'est peut-être pas dans
    // la bonne base : y écrire quoi que ce soit contredirait la promesse même de l'AC3 (« n'opère que sur
    // le projet de son propre environnement »). Le refus part par le journal du processus et par la réponse
    // HTTP — deux canaux qui n'engagent pas la base d'en face.
    journaliserIncidentSecurite("ordonnanceur_environnement", {
      motif: verdict.motif,
      deploiement: verdict.deploiement,
    });
    return { execute: false, refus: verdict.motif, jobs: [] };
  }

  const jobs: { nom: string; issue: IssueJob }[] = [];

  for (const job of registre) {
    const fenetre = fenetreDe(job.cadence, instant);
    const bail = Math.ceil(job.delaiMs / 1000) + MARGE_BAIL_S;
    try {
      // La réclamation EST la décision. Si elle refuse, quelqu'un a déjà fait ce travail dans cette fenêtre
      // (ou le fait en ce moment) — il n'y a rien à décider de plus, et surtout rien à décider ici.
      const reclame = await deps.depot.reclamer(job.nom, fenetre, null, bail);
      if (!reclame) {
        jobs.push({ nom: job.nom, issue: "deja_fait" });
        continue;
      }
      try {
        await avecDelai(
          job.executer({ depot: deps.depot, instant, registre }),
          job.delaiMs,
          `${job.nom.replace(/-/g, "_")}_timeout`,
        );
        await deps.depot.clore(job.nom, fenetre, null, true, null);
        jobs.push({ nom: job.nom, issue: "execute" });
      } catch (e) {
        const code = codeDErreur(e);
        // Clore en ÉCHEC, pas laisser pendre : une ligne `echoue` est immédiatement re-réclamable, alors
        // qu'une ligne `en_cours` abandonnée immobilise la fenêtre jusqu'à l'expiration du bail.
        await deps.depot.clore(job.nom, fenetre, null, false, code);
        await deps.depot.leverIncident("job_echoue", job.nom, code);
        jobs.push({ nom: job.nom, issue: "echoue" });
      }
    } catch (e) {
      // L'échec de la mécanique elle-même (réclamation, clôture, incident). On n'a plus rien de fiable à
      // écrire pour ce job — mais les SUIVANTS n'y sont pour rien : un job cassé ne met pas l'ordonnanceur
      // à l'arrêt. Sa fenêtre reste réclamable au tick suivant.
      journaliserIncidentSecurite("ordonnanceur_job_indisponible", { job: job.nom, code: codeDErreur(e) });
      jobs.push({ nom: job.nom, issue: "echoue" });
    }
  }

  return { execute: true, jobs };
}
