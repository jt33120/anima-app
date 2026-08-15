import "server-only";
import { avecDelai } from "@/lib/domain/delai";
import { fenetreDe } from "@/lib/domain/ordonnanceur";
import { codeDErreur } from "@/lib/domain/code-erreur";
import { journaliserExploitation, journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";
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
    // Sous la clé `code`, et pas sous des clés parlantes : `journaliserIncidentSecurite` ne recopie PAS
    // l'objet qu'on lui donne — il en extrait `code` (ou le nom d'exception) et jette le reste, précisément
    // pour qu'aucun champ libre ne parte en log (NFR-022). Un `{motif, deploiement}` sortait donc en
    // `code: undefined` : l'alerte existait, vide de sens (revue 4.8, défaut n°10). Les deux valeurs sont
    // des énumérations fermées — rien d'identifiant ne peut s'y glisser.
    journaliserIncidentSecurite("ordonnanceur_environnement", {
      code: `${verdict.motif}/${verdict.deploiement}`,
    });
    return { execute: false, refus: verdict.motif, jobs: [] };
  }

  const jobs: { nom: string; issue: IssueJob }[] = [];

  for (const job of registre) {
    const fenetre = fenetreDe(job.cadence, instant);
    const bail = Math.ceil(job.delaiMs / 1000) + MARGE_BAIL_S;
    // Hors des deux `try` : c'est la seule chose que les rattrapages ci-dessous ont besoin de savoir, et ils
    // ne doivent pas pouvoir l'oublier. Tant qu'elle est fausse, aucun effet n'a été produit ; une fois
    // vraie, plus aucun chemin n'a le droit de prétendre le contraire.
    let travailFait = false;
    try {
      // La réclamation EST la décision. Si elle refuse, quelqu'un a déjà fait ce travail dans cette fenêtre
      // (ou le fait en ce moment) — il n'y a rien à décider de plus, et surtout rien à décider ici.
      const jeton = await deps.depot.reclamer(job.nom, fenetre, null, bail);
      if (jeton === null) {
        // ⚠️ Story 6.1 — CE CHEMIN NE LAISSAIT AUCUNE TRACE, NULLE PART. La ligne `execution_job`
        // est celle d'hier, `tentatives` n'est pas incrémenté, et le `deja_fait` poussé ci-dessous
        // ne vit que dans le rapport HTTP — qui part vers l'ordonnanceur externe et se perd.
        //
        // Ce n'est pas un détail comptable : sur un rejeu de purge (6.8), il ne resterait ensuite
        // AUCUNE trace disant « la rétention a été rejouée et n'a rien refait ». Or c'est
        // exactement la phrase qu'il faut pouvoir produire pour une obligation légale — l'absence
        // d'effet est le résultat attendu, et un résultat attendu qu'on ne peut pas montrer ne vaut
        // pas mieux qu'un travail non fait.
        //
        // Sous `code`, avec le NOM DU JOB — un identifiant technique, jamais une cible (NFR-022).
        journaliserExploitation("ordonnanceur_deja_fait", { code: job.nom });
        jobs.push({ nom: job.nom, issue: "deja_fait" });
        continue;
      }
      try {
        await avecDelai(
          job.executer({
            depot: deps.depot,
            instant,
            // L'échéance que le job doit s'imposer LUI-MÊME, calculée sur la même valeur que le `avecDelai`
            // qui l'entoure. Un job par lots qui la respecte rend la main proprement ; celui qui l'ignore
            // se fait couper, et se fait alors rapporter comme un échec alors qu'il a peut-être tout fait.
            echeance: new Date(Date.now() + job.delaiMs),
            registre,
          }),
          job.delaiMs,
          `${job.nom.replace(/-/g, "_")}_timeout`,
        );
        travailFait = true;
      } catch (e) {
        const code = codeDErreur(e);
        // Clore en ÉCHEC, pas laisser pendre : une ligne `echoue` est immédiatement re-réclamable, alors
        // qu'une ligne `en_cours` abandonnée immobilise la fenêtre jusqu'à l'expiration du bail.
        if (!(await deps.depot.clore(job.nom, fenetre, null, false, code, jeton))) {
          journaliserExploitation("ordonnanceur_cloture_refusee", { code: job.nom });
        }
        await deps.depot.leverIncident("job_echoue", job.nom, code);
        jobs.push({ nom: job.nom, issue: "echoue" });
      }

      // LA CLÔTURE EN RÉUSSITE EST HORS DU CATCH CI-DESSUS, et ce n'est pas une question de mise en forme.
      // Quand elle y était (revue 4.8, défauts n°3 et n°5), un simple hoquet réseau sur `clore(true)` —
      // après un job parfaitement exécuté — tombait dans le catch du JOB : on écrivait `echoue`, on levait
      // un incident `job_echoue` mensonger, et surtout on rendait la fenêtre IMMÉDIATEMENT re-réclamable.
      // Le repli produisait donc PLUS d'effet que le chemin nominal, l'exact inverse d'AD-15. Sur la
      // synthèse (4.9), c'eût été une seconde synthèse et une seconde notification ; sur la rétention
      // (Epic 6), un second effacement.
      if (travailFait) {
        // ⚠️ Story 6.1a — LE REFUS DE CLÔTURE NE CHANGE PAS L'ISSUE RAPPORTÉE, et c'est délibéré.
        // L'issue suit le TRAVAIL, jamais la comptabilité (voir le catch ci-dessous, revue 4.8) : le job
        // a bel et bien tourné. Ce qu'un refus dit, c'est qu'une AUTRE exécution détient désormais la
        // fenêtre — parce que celle-ci a dépassé son bail sans le savoir. C'est le seul signal qui
        // permette, plus tard, de distinguer « la purge n'a rien refait » de « deux purges se sont
        // marché dessus ». Il ne vit que dans le journal du processus : la base, elle, appartient à
        // l'autre, et on n'y réécrit rien.
        if (!(await deps.depot.clore(job.nom, fenetre, null, true, null, jeton))) {
          journaliserExploitation("ordonnanceur_cloture_refusee", { code: job.nom });
        }
        jobs.push({ nom: job.nom, issue: "execute" });
      }
    } catch (e) {
      // L'échec de la MÉCANIQUE (réclamation, clôture, incident), pas du job. On n'a plus rien de fiable à
      // écrire — mais les jobs SUIVANTS n'y sont pour rien : un job cassé ne met pas l'ordonnanceur à
      // l'arrêt.
      //
      // L'issue rapportée suit le TRAVAIL, jamais la comptabilité : si `clore(true)` a échoué, le job a bel
      // et bien tourné et le dire « échoué » serait faux. La ligne reste alors `en_cours` sous son bail —
      // on ne réécrit rien dans une base qui vient de refuser une écriture.
      //
      // RÉSIDU ASSUMÉ : ce bail expirera bien avant le tick suivant, donc le job sera ré-exécuté demain.
      // C'est la limite du protocole à deux temps, et elle se referme au niveau du JOB, pas ici : un job
      // qui produit un effet visible (4.9, Epic 6) doit être idempotent sur sa propre clé, pas seulement
      // sur sa fenêtre.
      journaliserIncidentSecurite("ordonnanceur_job_indisponible", { code: `${job.nom}/${codeDErreur(e)}` });
      jobs.push({ nom: job.nom, issue: travailFait ? "execute" : "echoue" });
    }
  }

  return { execute: true, jobs };
}
