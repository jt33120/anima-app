import "server-only";
import { fenetreDe } from "@/lib/domain/ordonnanceur";
import { codeDErreur } from "@/lib/domain/code-erreur";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";
import {
  LOT_PAR_TICK,
  PLAFOND_ENTREES,
  PLAFOND_NOTIFICATION_HEURES,
  aQuelqueChoseADire,
  periodeDe,
} from "@/lib/domain/synthese";
import { consigneSynthese, messagesSynthese } from "@/lib/domain/consigne-synthese";
import { creerDepotSynthese, type DepotSynthese } from "@/lib/data/depot-synthese";
import { creerAiPort } from "@/lib/ai/fabrique";
import { creerPortCourriel } from "@/lib/courriel/fabrique";
import type { AiPort } from "@/lib/ai/port";
import type { PortCourriel } from "@/lib/courriel/port";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";

/**
 * Story 4.9 (AC1) — LE JOB DE SYNTHÈSE. Premier job du registre à produire un EFFET VISIBLE : un texte
 * qu'une personne lira, et un courriel qu'elle recevra.
 *
 * ── POURQUOI CE JOB EST QUOTIDIEN ALORS QUE LA SYNTHÈSE EST HEBDOMADAIRE ───────────────────────────────
 *
 * Tentation évidente : `cadence: "hebdomadaire"` au registre. Elle est fausse, et d'une façon qui ne se
 * verrait qu'en production. Le répartiteur réclame UNE ligne par job et par fenêtre : avec une cadence
 * hebdomadaire, le fan-out du lundi qui réussit PARTIELLEMENT (trois personnes sur cinq — une panne de
 * modèle, un courriel refusé) clôt quand même sa fenêtre en `reussi`. Le mardi, le tick trouve la semaine
 * déjà réussie → `deja_fait` → les deux personnes en échec ne sont JAMAIS reprises, ni ce jour-là ni la
 * semaine suivante, qui aura sa propre période.
 *
 * D'où le découplage, qui est le cœur technique de cette story :
 *
 *   • LE FAN-OUT (l'entrée du registre) a une fenêtre QUOTIDIENNE — il doit repasser chaque jour ; c'est
 *     lui, le mécanisme de reprise.
 *   • L'UNITÉ DE TRAVAIL (une personne) a une fenêtre HEBDOMADAIRE, réclamée sur `(job, semaine, cible)`.
 *     C'est là, et seulement là, que vit l'absence de double effet.
 *
 * Une personne traitée lundi est `deja_fait` mardi. Une personne en échec lundi est reprise mardi. C'est
 * exactement la répartition que `execution_job.cible_id` attendait depuis la 4.8 — la colonne existe et
 * son index `nulls not distinct` a été posé pour ça.
 *
 * ── L'ORDRE DES EFFETS ─────────────────────────────────────────────────────────────────────────────────
 *
 * Réclamer → produire → écrire → RÉSERVER le canal → envoyer. La réservation précède l'envoi pour la même
 * raison que la réclamation précède l'exécution : entre « j'envoie » et « je note que j'ai envoyé », il y
 * a une fenêtre, et cette fenêtre-là s'appelle « un deuxième courriel ». Le prix de ce choix est assumé :
 * un envoi qui échoue APRÈS réservation est perdu pour la semaine. C'est le bon sens de l'échec — la
 * synthèse, elle, est écrite et l'attend dans l'app.
 */

export const NOM_JOB = "synthese-hebdomadaire";

/** Le bail d'une SEULE personne : le modèle fort peut prendre du temps, mais pas éternellement. */
const BAIL_PERSONNE_S = 180;

export interface DepsSynthese {
  readonly depot: DepotSynthese;
  readonly ia: AiPort;
  readonly courriel: PortCourriel;
}

/**
 * Le cœur, testable : toutes les dépendances entrent par la porte. Le registre, lui, appelle
 * `executerSynthese` ci-dessous, qui les résout. Le répartiteur reste ainsi ignorant de ce qu'un job
 * fabrique — il ne connaît que `ContexteJob` (AD-10).
 */
export async function executerSyntheseAvec(ctx: ContexteJob, deps: DepsSynthese): Promise<void> {
  const semaine = fenetreDe("hebdomadaire", ctx.instant);
  const candidates = await deps.depot.candidates(semaine, LOT_PAR_TICK);

  // PAS de `if (candidates.length === 0) return;` ici, et c'est délibéré. Il ne faisait rien qu'une
  // boucle sur un tableau vide ne fasse déjà — mais il MASQUAIT la garde `echecs > 0` d'en bas : avec un
  // retour anticipé, on pouvait retirer ce `echecs > 0` sans qu'aucun test ne rougisse, alors qu'il est
  // le seul à empêcher un incident quotidien les jours où personne n'a rien à raconter. Deux défenses du
  // même invariant, et un test qui prouve « au moins une existe » sans jamais dire laquelle : c'est le
  // piège payé en 4.7, retrouvé ici par la mutation-vérification.
  let echecs = 0;

  for (const utilisatriceId of candidates) {
    // LA réclamation par personne. Elle est la décision : si elle refuse, cette personne a déjà eu sa
    // synthèse cette semaine (ou l'a en cours ailleurs) et il n'y a rien à décider de plus.
    const reclame = await ctx.depot.reclamer(NOM_JOB, semaine, utilisatriceId, BAIL_PERSONNE_S);
    if (!reclame) continue;

    try {
      const materiau = await deps.depot.materiau(utilisatriceId, PLAFOND_ENTREES);
      const periode = periodeDe(materiau);

      // D3 / FR-034 : rien à dire, donc rien. On clôt en RÉUSSITE — le job a fait son travail, qui était
      // de constater qu'il n'y avait pas de travail. Clore en échec ferait revenir cette personne demain
      // pour reconstater la même chose, tous les jours, indéfiniment.
      if (!aQuelqueChoseADire(materiau) || !periode) {
        await ctx.depot.clore(NOM_JOB, semaine, utilisatriceId, true, null);
        continue;
      }

      // Le tier n'est pas choisi ici : la capacité `synthese` est résolue au modèle FORT par la politique
      // unique (AD-5, `lib/ai/politique-tier.ts`). `contientArt9` est vrai — c'est le journal.
      const reponse = await deps.ia.completer({
        capacite: "synthese",
        messages: [consigneSynthese(), ...messagesSynthese(materiau)],
        contientArt9: true,
      });

      const ecrite = await deps.depot.enregistrer(
        utilisatriceId,
        semaine,
        periode.debut,
        periode.fin,
        reponse.texte,
        periode.tronquee,
      );

      // `ecrite === false` : une synthèse existait déjà pour cette semaine. Rien de neuf n'a été produit,
      // donc rien à annoncer. Notifier quand même serait annoncer deux fois la même chose.
      if (ecrite) await notifier(deps, utilisatriceId, semaine);

      await ctx.depot.clore(NOM_JOB, semaine, utilisatriceId, true, null);
    } catch (e) {
      echecs += 1;
      // Clore en ÉCHEC pour CETTE personne seulement : sa fenêtre redevient réclamable demain, celles des
      // autres n'ont pas bougé. Aucun incident par personne — une panne de modèle en toucherait vingt et
      // noierait la table sous vingt lignes disant la même chose.
      await ctx.depot.clore(NOM_JOB, semaine, utilisatriceId, false, codeDErreur(e));
    }
  }

  // En revanche, un lot ENTIÈREMENT en échec est un vrai signal : ce n'est plus une personne, c'est le
  // chemin. `lever_incident` dédoublonne par (type, job, jour) — au plus une ligne par jour.
  if (echecs > 0 && echecs === candidates.length) {
    await ctx.depot.leverIncident("job_echoue", NOM_JOB, "lot_entierement_echoue");
  }
}

/**
 * L'annonce (AC4). Trois refus possibles, tous silencieux et tous sûrs : le canal n'est pas configuré,
 * l'adresse est introuvable, ou le plafond a mordu. Dans les trois cas la synthèse existe et se lit dans
 * l'app — le plafond borne le CANAL, jamais le CONTENU.
 *
 * `estConfigure()` est interrogé AVANT la réservation, et l'ordre compte : réserver puis découvrir qu'on
 * ne peut pas envoyer consommerait le droit d'envoyer sans avoir envoyé, et le plafond de 72 h bloquerait
 * alors une notification qui n'est jamais partie.
 */
async function notifier(deps: DepsSynthese, utilisatriceId: string, semaine: string): Promise<void> {
  try {
    if (!deps.courriel.estConfigure()) return;

    const adresse = await deps.depot.adresse(utilisatriceId);
    if (!adresse) return;

    // La clé d'idempotence est la SEMAINE, la même que celle de la synthèse : une synthèse, une annonce.
    const reserve = await deps.depot.reserverNotification(
      utilisatriceId,
      "synthese_prete",
      semaine,
      PLAFOND_NOTIFICATION_HEURES,
    );
    if (!reserve) return;

    await deps.courriel.envoyer(adresse, "synthese_prete");
  } catch (e) {
    // L'échec de l'ANNONCE ne fait pas échouer la SYNTHÈSE : le travail a bien été produit et il est
    // consultable. Le rétrograder en échec ferait revenir cette personne demain pour une synthèse qui
    // existe déjà — et le journal du processus est le bon endroit pour dire qu'un courriel n'est pas parti.
    journaliserIncidentSecurite("synthese_courriel", { code: codeDErreur(e) });
  }
}

/** Ce qu'appelle le registre. Résout les dépendances ; toute la logique est dans le cœur ci-dessus. */
export async function executerSynthese(ctx: ContexteJob): Promise<void> {
  return executerSyntheseAvec(ctx, {
    depot: creerDepotSynthese(),
    ia: await creerAiPort(),
    courriel: creerPortCourriel(),
  });
}
