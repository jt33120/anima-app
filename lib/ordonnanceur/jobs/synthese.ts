import "server-only";
import { randomUUID } from "node:crypto";
import { fenetreDe } from "@/lib/domain/ordonnanceur";
import { codeDErreur } from "@/lib/domain/code-erreur";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";
import {
  LOT_PAR_TICK,
  PLAFOND_ENTREES,
  PLAFOND_NOTIFICATION_HEURES,
  PLAFOND_OCTETS,
  aQuelqueChoseADire,
  periodeDe,
  validerSortieSynthese,
} from "@/lib/domain/synthese";
import { consigneSynthese, messagesSynthese } from "@/lib/domain/consigne-synthese";
import { creerDepotSynthese, type DepotSynthese } from "@/lib/data/depot-synthese";
import { creerAiPort } from "@/lib/ai/fabrique";
import { envoyerSousEgressArt9Ordonnanceur } from "@/lib/ai/egress-guard";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { creerPortCourriel } from "@/lib/courriel/fabrique";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort } from "@/lib/ai/port";
import type { PortCourriel } from "@/lib/courriel/port";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";

/**
 * Story 4.9 (AC1) — LE JOB DE SYNTHÈSE. Premier job du registre à produire un EFFET VISIBLE : un texte
 * qu'une personne lira, et un courriel qu'elle recevra.
 *
 * ── TOUT EST QUOTIDIEN ; C'EST LA CADENCE, EN BASE, QUI EST HEBDOMADAIRE (revu par la revue 4.9) ────────
 *
 * La version d'origine découplait une fenêtre de fan-out QUOTIDIENNE d'une unité de travail HEBDOMADAIRE,
 * réclamée sur `(job, semaine, cible)`. Le raisonnement était juste sur son point de départ — une cadence
 * hebdomadaire au registre aurait clos la semaine en `reussi` sur un succès PARTIEL, abandonnant pour de
 * bon les personnes en échec — mais il faisait de la semaine ISO la clé d'idempotence, et c'est cette
 * clé-là qui a dû tomber : elle rendait impossible tout rattrapage plus fin qu'une tranche par semaine.
 *
 * L'agencement actuel :
 *
 *   • LE FAN-OUT et L'UNITÉ DE TRAVAIL ont tous deux une fenêtre QUOTIDIENNE. La réclamation par personne
 *     porte sur `(job, jour, cible)` et ne dit plus qu'une chose : « pas deux fois la même personne le
 *     même jour ». C'est la répartition que `execution_job.cible_id` attendait depuis la 4.8 — la colonne
 *     et son index `nulls not distinct` ont été posés pour ça.
 *   • LA CADENCE vit en base, dans `utilisatrices_a_synthetiser` : sept jours depuis la fin de la dernière
 *     période racontée — SAUF si celle-ci était tronquée, auquel cas on enchaîne dès le lendemain jusqu'à
 *     ce que le retard soit résorbé.
 *   • L'ABSENCE DE DOUBLE EFFET vit dans l'index unique `(utilisatrice_id, periode_debut)`. Les périodes
 *     se pavent bout à bout, donc deux synthèses ne peuvent pas partager un début.
 *
 * Une personne servie aujourd'hui n'est plus candidate demain (la cadence la retient sept jours). Une
 * personne en échec aujourd'hui est reprise demain (sa réclamation du jour est close en échec, et la
 * cadence ne la retient pas puisque aucune synthèse n'a été écrite). Une personne en rattrapage revient
 * chaque jour jusqu'à ce que son journal soit raconté jusqu'au bout.
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
  /**
   * Client `service_role` — uniquement pour l'egress-guard art. 9 (revue 4.9, T2-1). L'ordonnanceur n'a
   * pas de session, donc pas d'`auth.uid()` : la garde relit l'état vivant par `eligible_a_synthese`.
   */
  readonly supabase: SupabaseClient;
  readonly courriel: PortCourriel;
}

/**
 * Le cœur, testable : toutes les dépendances entrent par la porte. Le registre, lui, appelle
 * `executerSynthese` ci-dessous, qui les résout. Le répartiteur reste ainsi ignorant de ce qu'un job
 * fabrique — il ne connaît que `ContexteJob` (AD-10).
 */
export async function executerSyntheseAvec(ctx: ContexteJob, deps: DepsSynthese): Promise<void> {
  // LA FENÊTRE DE RÉCLAMATION PAR PERSONNE EST LE JOUR, plus la semaine ISO (revue 4.9). Une personne est
  // donc tentée au plus une fois par jour — ce qui est exactement le rythme du rattrapage chronologique.
  // C'est la CADENCE, en base, qui décide s'il faut la servir aujourd'hui (sept jours depuis la dernière
  // période, sauf rattrapage en cours) ; la réclamation ne décide plus que « pas deux fois le même jour ».
  const jour = fenetreDe("quotidien", ctx.instant);
  const candidates = await deps.depot.candidates(LOT_PAR_TICK);

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
    const reclame = await ctx.depot.reclamer(NOM_JOB, jour, utilisatriceId, BAIL_PERSONNE_S);
    if (!reclame) continue;

    try {
      const materiau = await deps.depot.materiau(utilisatriceId, PLAFOND_ENTREES, PLAFOND_OCTETS);
      const periode = periodeDe(materiau);

      // D3 / FR-034 : rien à dire, donc rien. On clôt en RÉUSSITE — le job a fait son travail, qui était
      // de constater qu'il n'y avait pas de travail. Clore en échec ferait revenir cette personne demain
      // pour reconstater la même chose, tous les jours, indéfiniment.
      if (!aQuelqueChoseADire(materiau) || !periode) {
        await ctx.depot.clore(NOM_JOB, jour, utilisatriceId, true, null);
        continue;
      }

      // Le tier n'est pas choisi ici : la capacité `synthese` est résolue au modèle FORT par la politique
      // unique (AD-5, `lib/ai/politique-tier.ts`). `contientArt9` est vrai — c'est le journal, et il est
      // désormais LU par quelqu'un : l'egress-guard relit l'état vivant juste avant de poster.
      const egress = await envoyerSousEgressArt9Ordonnanceur({
        supabase: deps.supabase,
        utilisatriceId,
        adaptateur: deps.ia,
        requete: {
          capacite: "synthese",
          // Le jeton rend les marqueurs du bloc journal imprévisibles : sans lui, une ligne écrite dans
          // le journal peut imiter le délimiteur et se faire passer pour une consigne.
          messages: [consigneSynthese(), ...messagesSynthese(materiau, randomUUID())],
          contientArt9: true,
        },
      });
      // Bloquée = elle n'est plus éligible depuis la constitution du lot (révocation, barrière, détresse),
      // ou le ZDR n'est pas prouvé. Rien n'a été posté, et rien ne doit être écrit. On clôt en RÉUSSITE :
      // le job a fait son travail, qui était de constater qu'il ne devait rien faire. Clore en échec la
      // ferait revenir demain pour reconstater la même chose, tous les jours.
      if (egress.bloque) {
        journaliserIncidentSecurite("synthese_egress_bloque", { code: egress.raison });
        await ctx.depot.clore(NOM_JOB, jour, utilisatriceId, true, null);
        continue;
      }

      // La sortie du modèle est bornée AVANT d'entrer en base : un refus poli (« je ne peux pas vous
      // aider ») serait stocké tel quel et lu comme le récit de sa semaine ; du blanc ferait lever la
      // contrainte `contenu_non_vide`, donc échouer la tranche, donc la rejouer à l'identique demain.
      const contenu = validerSortieSynthese(egress.reponse.texte);
      if (contenu === null) throw new Error("synthese_sortie_vide");

      const syntheseId = await deps.depot.enregistrer(
        utilisatriceId,
        periode.debut,
        periode.fin,
        contenu,
        periode.tronquee,
      );

      // `null` : la tranche existait déjà, ou l'éligibilité a changé pendant la production. Rien de neuf
      // n'a été produit, donc rien à annoncer. L'identifiant rendu est la clé d'idempotence de l'annonce :
      // une synthèse, une annonce, et le lien entre les deux est la ligne elle-même.
      if (syntheseId) await notifier(deps, utilisatriceId, syntheseId);

      await ctx.depot.clore(NOM_JOB, jour, utilisatriceId, true, null);
    } catch (e) {
      echecs += 1;
      // Clore en ÉCHEC pour CETTE personne seulement : sa fenêtre redevient réclamable demain, celles des
      // autres n'ont pas bougé. Aucun incident par personne — une panne de modèle en toucherait vingt et
      // noierait la table sous vingt lignes disant la même chose.
      await ctx.depot.clore(NOM_JOB, jour, utilisatriceId, false, codeDErreur(e));
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
async function notifier(deps: DepsSynthese, utilisatriceId: string, syntheseId: string): Promise<void> {
  try {
    if (!deps.courriel.estConfigure()) return;

    const adresse = await deps.depot.adresse(utilisatriceId);
    if (!adresse) return;

    // La clé d'idempotence est LA SYNTHÈSE elle-même. C'était la semaine ISO ; ça ne pouvait plus l'être
    // une fois la clé de la synthèse devenue la période, et c'est de toute façon plus exact : une ligne
    // écrite, une annonce, sans intermédiaire calendaire entre les deux.
    const reserve = await deps.depot.reserverNotification(
      utilisatriceId,
      "synthese_prete",
      syntheseId,
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
    supabase: createSupabaseAdminClient(),
    courriel: creerPortCourriel(),
  });
}
