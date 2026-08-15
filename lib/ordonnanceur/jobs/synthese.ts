import "server-only";
import { randomUUID } from "node:crypto";
import { fenetreDe } from "@/lib/domain/ordonnanceur";
import { codeDErreur } from "@/lib/domain/code-erreur";
import { journaliserExploitation, journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";
import { avecDelai } from "@/lib/domain/delai";
import {
  DELAI_MODELE_MS,
  LOT_PAR_TICK,
  LOT_RATTRAPAGE_ANNONCE,
  PLAFOND_ENTREES,
  PLAFOND_NOTIFICATION_HEURES,
  PLAFOND_OCTETS,
  DELAI_ANNONCE_MS,
  RATTRAPAGE_ANNONCE_JOURS,
  RESERVE_PERSONNE_MS,
  RESERVE_RATTRAPAGE_MS,
  RETENTION_NOTIFICATION_JOURS,
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
export const BAIL_PERSONNE_S = 180;

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

  // ── LE RATTRAPAGE DE L'ANNONCE (Story 4.10, décision D4) ─────────────────────────────────────────────
  //
  // AVANT le fan-out, et sans aucune réclamation : c'est tout l'intérêt. L'annonce était accrochée à la
  // PRODUCTION — `notifier()` n'était tentée que dans le tour où la synthèse venait d'être écrite. Refusée
  // là (plafond de 72 h, canal non configuré, hoquet réseau), elle était perdue DÉFINITIVEMENT : la
  // cadence retient la personne sept jours, et la synthèse existant déjà, `enregistrer` rend `null`.
  //
  // La migration 0030 décrivait exactement ce défaut et l'a CONTOURNÉ (plafond par motif) au lieu de le
  // réparer ; le passage au plafond par FAMILLE (4.10) le rendrait plus fréquent. Voici la réparation :
  // l'annonce est retrouvable par une requête, donc retentable, indépendamment de toute réclamation.
  //
  // `notifier` est idempotente par construction (la clé de réservation est l'identifiant de la synthèse),
  // donc repasser dessus ne peut pas produire un second courriel.
  //
  // ⚠️ SANS CANAL, ON NE LIT MÊME PAS (revue 4.10) : interroger la base pour cinq annonces qui sortiront
  // toutes immédiatement de `notifier` est du budget dépensé pour rien. Le job de rappel applique déjà
  // cet ordre et documente pourquoi ; celui-ci ne l'avait pas suivi.
  if (deps.courriel.estConfigure()) {
    for (const attente of await deps.depot.syntheseesNonAnnoncees(LOT_RATTRAPAGE_ANNONCE, RATTRAPAGE_ANNONCE_JOURS)) {
      // Le rattrapage rend la main PENDANT qu'il reste de quoi produire — pas au moment où il n'en reste
      // plus. Sa réserve est STRICTEMENT au-dessus de celle du fan-out (voir `RESERVE_RATTRAPAGE_MS`) ;
      // avec la réserve du fan-out, il ne s'arrêtait qu'au moment où la production s'arrêtait aussi.
      if (ctx.echeance.getTime() - Date.now() < RESERVE_RATTRAPAGE_MS) {
        journaliserExploitation("synthese_rattrapage_incomplet", { code: "budget" });
        break;
      }
      // Bornée : une réserve ne réserve rien si l'opération qu'elle protège n'a pas de plafond.
      // `notifier` avale déjà ses propres erreurs ; le délai ne peut donc pas faire échouer le job.
      await avecDelai(
        notifier(deps, attente.utilisatriceId, attente.syntheseId),
        DELAI_ANNONCE_MS,
        "synthese_rattrapage_timeout",
      ).catch((e) => journaliserExploitation("synthese_rattrapage", { code: codeDErreur(e) }));
    }
  }

  const candidates = await deps.depot.candidates(NOM_JOB, LOT_PAR_TICK);

  // LE PLAFOND DE DÉBIT SE DIT (revue 4.9, T6-8). Vingt personnes par tick × sept jours = 140 synthèses
  // par semaine pour tout le produit. Au-delà, le tri par attente fait TOURNER le service : chacune
  // finit par être servie, mais une semaine sur deux — et comme un lot saturé n'a par définition aucun
  // échec, il ne lève aucun incident. La dégradation est donc parfaitement silencieuse, et le premier à
  // l'apprendre serait quelqu'un qui écrit pour se plaindre de ne plus rien recevoir.
  //
  // Un lot plein n'est pas encore un problème (il peut être exactement plein une fois), mais c'est le
  // seul signal disponible avant que ça en devienne un.
  if (candidates.length >= LOT_PAR_TICK) {
    journaliserExploitation("synthese_lot_sature", { code: `lot_${LOT_PAR_TICK}` });
  }

  // PAS de `if (candidates.length === 0) return;` ici, et c'est délibéré. Il ne faisait rien qu'une
  // boucle sur un tableau vide ne fasse déjà — mais il MASQUAIT la garde `echecs > 0` d'en bas : avec un
  // retour anticipé, on pouvait retirer ce `echecs > 0` sans qu'aucun test ne rougisse. Deux défenses du
  // même invariant, et un test qui prouve « au moins une existe » sans jamais dire laquelle : c'est le
  // piège payé en 4.7, retrouvé ici par la mutation-vérification.
  //
  // `tentees` et `candidates.length` ne sont PAS la même chose, et les confondre cassait l'alarme dans
  // les deux sens (revue 4.9, T3-4). Dix-neuf personnes « rien à dire » et une seule qui échoue, c'est
  // 100 % du travail réel en échec — et l'ancien test `echecs === candidates.length` ne levait rien. À
  // l'inverse, dans un produit qui compte une poignée d'utilisatrices, `candidates.length` vaut 1 presque
  // toujours : le moindre hoquet devenait alors un incident système et faisait passer /api/health en
  // `degrade`. Le dénominateur juste est ce qu'on a VRAIMENT tenté.
  let tentees = 0;
  let echecs = 0;

  for (const [rang, utilisatriceId] of candidates.entries()) {
    // RENDRE LA MAIN AVANT D'ÊTRE COUPÉ (T3-1). Se faire couper par `avecDelai` clôt le fan-out en
    // `echoue` et lève un `job_echoue` — alors que tout le monde a peut-être été servi. Ce mensonge-là
    // était quotidien, et il faisait répondre `degrade` à la sonde publique en permanence dès le premier
    // jour de production. Une alarme qui hurle tous les jours est une alarme que personne ne lit.
    if (ctx.echeance.getTime() - Date.now() < RESERVE_PERSONNE_MS) {
      journaliserExploitation("synthese_lot_incomplet", { code: `restantes_${candidates.length - rang}` });
      break;
    }

    // LA réclamation par personne. Elle est la décision : si elle refuse, cette personne a déjà été
    // traitée aujourd'hui (ou l'est en ce moment ailleurs) et il n'y a rien à décider de plus.
    const jeton = await ctx.depot.reclamer(NOM_JOB, jour, utilisatriceId, BAIL_PERSONNE_S);
    if (jeton === null) continue;

    let issue: IssuePersonne;
    let motifEchec: string | null = null;
    try {
      issue = await produirePour(deps, utilisatriceId);
    } catch (e) {
      issue = "echec";
      echecs += 1;
      motifEchec = codeDErreur(e);
    }
    // Une personne qui n'avait rien à dire, ou que l'egress a écartée, n'a pas été TENTÉE : rien n'a été
    // produit, rien n'a échoué. La compter diluerait l'alarme d'en bas.
    if (issue !== "rien_a_dire" && issue !== "bloquee") tentees += 1;

    // LA CLÔTURE EST HORS DU TRY, et c'est exactement le patron que la revue 4.8 avait imposé au
    // répartiteur (`executer.ts`, défauts n°3 et n°5) — patron que ce job avait perdu. Quand elle était
    // dedans, un simple hoquet réseau sur `clore(true)` — après une synthèse écrite ET un courriel
    // PARTI — tombait dans le catch : on écrivait `echoue`, et la trace disait le contraire de ce qui
    // s'était produit. Le commentaire de `executer.ts` l'annonçait mot pour mot : « Sur la synthèse
    // (4.9), c'eût été une seconde synthèse et une seconde notification. »
    try {
      // Story 6.1a : le jeton reçu à la réclamation. Un refus ici veut dire qu'une autre exécution a
      // repris cette personne sur bail expiré — donc que la synthèse qu'on vient d'écrire a peut-être
      // une jumelle en vol. Ça se dit, ça ne se corrige pas d'ici : l'unicité `(utilisatrice_id,
      // periode_debut)` est ce qui empêche la seconde d'exister.
      if (!(await ctx.depot.clore(NOM_JOB, jour, utilisatriceId, motifEchec === null, motifEchec, jeton))) {
        journaliserExploitation("synthese_cloture_refusee", { code: NOM_JOB });
      }
    } catch (e) {
      // Et elle est PROTÉGÉE. Sans ce catch, une base indisponible au moment de clore la première
      // personne faisait sortir l'exception de la boucle : les suivantes n'étaient jamais réclamées, le
      // compteur d'échecs était perdu, et l'unique signal — un `job_echoue` du répartiteur — ne disait
      // rien du fait que dix-neuf personnes sur vingt n'avaient pas été regardées.
      journaliserExploitation("synthese_cloture", { code: codeDErreur(e) });
    }
  }

  // Un lot ENTIÈREMENT en échec est un vrai signal : ce n'est plus une personne, c'est le chemin. Le
  // plancher de deux est ce qui empêche l'alarme de se déclencher sur une seule utilisatrice — pour
  // celle-là, c'est le disjoncteur ci-dessous qui parle, et il attend trois jours avant de le faire.
  if (echecs > 0 && echecs === tentees && tentees >= 2) {
    await ctx.depot.leverIncident("job_echoue", NOM_JOB, "lot_entierement_echoue");
  }

  // LE DISJONCTEUR (T3-2). Une personne dont le matériau fait échouer le modèle de façon déterministe
  // revenait chaque jour, première dans le tri (elle n'a jamais rien reçu), et brûlait un appel au modèle
  // fort à vie. La base l'écarte après trois échecs en sept jours ; ici on le DIT — sinon l'écartement
  // serait silencieux, et « cette personne n'a plus de synthèse » est précisément ce qu'il faut savoir.
  // `lever_incident` dédoublonne par (type, job, jour) : au plus une ligne par jour.
  const bloquees = await deps.depot.personnesEnEchecRepete(NOM_JOB);
  if (bloquees > 0) {
    await ctx.depot.leverIncident("job_echoue", NOM_JOB, "echecs_repetes");
  }

  // LA PURGE DE LA TRACE (revue T5-3). Ici plutôt que dans un job à part : c'est ce job qui écrit ces
  // lignes, la purge est un `delete` sur une table minuscule, et un job de plus voudrait dire une
  // fenêtre, un incident et une sonde de plus pour trois lignes de SQL. Le moteur de rétention unique
  // (AD-14, Epic 6) la reprendra avec les autres durées — ce qui compte est qu'en attendant, elle
  // TOURNE : une durée de conservation qui attend un epic n'est pas une durée de conservation.
  //
  // Un échec ici ne fait échouer ni une personne ni le job : rien de ce que l'utilisatrice attend n'en
  // dépend. Mais il se DIT, sinon une rétention en panne est indistinguable d'une rétention absente.
  if ((await deps.depot.purgerNotifications(RETENTION_NOTIFICATION_JOURS)) === null) {
    journaliserExploitation("synthese_purge_notifications", { code: "echec" });
  }
}

/** Ce qu'il est advenu d'une personne. Un échec ne se dit pas ici : il se lève. */
type IssuePersonne = "produite" | "rien_a_dire" | "bloquee" | "echec";

/**
 * Le travail d'UNE personne. Extrait de la boucle par la revue 4.9 pour que la clôture puisse vivre
 * DEHORS : tant que la clôture était mêlée aux `continue` du corps, elle ne pouvait pas être hoistée, et
 * c'est ce qui l'avait ramenée dans le `try`.
 */
async function produirePour(deps: DepsSynthese, utilisatriceId: string): Promise<IssuePersonne> {
  const materiau = await deps.depot.materiau(utilisatriceId, PLAFOND_ENTREES, PLAFOND_OCTETS);

  // D3 / FR-034 : rien à dire, donc rien. C'est une RÉUSSITE — le job a fait son travail, qui était de
  // constater qu'il n'y avait pas de travail.
  //
  // UNE seule garde, et c'est le correctif (revue 4.9, T4-1). Il y en avait deux — `!aQuelqueChoseADire`
  // ET `!periode` — qui disaient exactement la même chose, si bien qu'aucune n'était prouvée : retirer
  // l'une laissait l'autre couvrir le cas. Le prédicat vit désormais à un seul endroit, dans `periodeDe`.
  const periode = periodeDe(materiau);
  if (!periode) return "rien_a_dire";

  // Le tier n'est pas choisi ici : la capacité `synthese` est résolue au modèle FORT par la politique
  // unique (AD-5). `contientArt9` est vrai — c'est le journal, et l'egress-guard relit l'état vivant
  // juste avant de poster.
  //
  // `avecDelai` borne l'appel (T3-2) : sans lui, une seule réponse qui ne revient pas mangeait tout le
  // budget du fan-out, et comme rien n'était écrit, la même personne repassait première le lendemain.
  const egress = await avecDelai(
    envoyerSousEgressArt9Ordonnanceur({
      supabase: deps.supabase,
      utilisatriceId,
      adaptateur: deps.ia,
      requete: {
        capacite: "synthese",
        // Le jeton rend les marqueurs du bloc journal imprévisibles : sans lui, une ligne écrite dans le
        // journal peut imiter le délimiteur et se faire passer pour une consigne.
        messages: [consigneSynthese(), ...messagesSynthese(materiau, randomUUID())],
        contientArt9: true,
      },
    }),
    DELAI_MODELE_MS,
    "synthese_modele_timeout",
  );

  // Bloquée = elle n'est plus éligible depuis la constitution du lot (révocation, barrière, détresse), ou
  // le ZDR n'est pas prouvé. Rien n'a été posté, et rien ne doit être écrit.
  if (egress.bloque) {
    journaliserIncidentSecurite("synthese_egress_bloque", { code: egress.raison });
    return "bloquee";
  }

  // La sortie du modèle est bornée AVANT d'entrer en base : un refus poli (« je ne peux pas vous aider »)
  // serait stocké tel quel et lu comme le récit de sa semaine ; du blanc ferait lever la contrainte
  // `contenu_non_vide`, donc échouer la tranche, donc la rejouer à l'identique demain.
  const contenu = validerSortieSynthese(egress.reponse.texte);
  if (contenu === null) throw new Error("synthese_sortie_vide");

  const syntheseId = await deps.depot.enregistrer(
    utilisatriceId,
    periode.debut,
    periode.fin,
    contenu,
    periode.tronquee,
  );

  // `null` : la tranche existait déjà, ou l'éligibilité a changé pendant la production. Rien de neuf n'a
  // été produit, donc rien à annoncer. L'identifiant rendu est la clé d'idempotence de l'annonce : une
  // synthèse, une annonce, et le lien entre les deux est la ligne elle-même.
  if (syntheseId) await notifier(deps, utilisatriceId, syntheseId);

  return "produite";
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

    // LE JETON DE DÉSABONNEMENT, AVANT LA RÉSERVATION (revue T5-2). L'ordre est le même que celui
    // d'`estConfigure()`, et pour la même raison : tout ce qui peut empêcher l'envoi doit être connu
    // avant de consommer le droit d'envoyer. Sans jeton, on n'envoie pas — un courriel sans porte de
    // sortie est exactement ce que cette revue a refusé.
    const jeton = await deps.depot.jetonDesabonnement(utilisatriceId);
    if (!jeton) return;

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

    await deps.courriel.envoyer(adresse, "synthese_prete", jeton);
  } catch (e) {
    // L'échec de l'ANNONCE ne fait pas échouer la SYNTHÈSE : le travail a bien été produit et il est
    // consultable. Le rétrograder en échec ferait revenir cette personne demain pour une synthèse qui
    // existe déjà.
    //
    // Le CANAL a changé (revue 4.9, T6-10) : `journaliserIncidentSecurite` annonce « indisponibilité
    // d'une RPC de sécurité », si bien qu'un 5xx de Resend se lisait dans les journaux comme une panne de
    // garde de sécurité — et c'était sa seule trace. Le canal des vrais incidents, celui où vivent les
    // alertes de détresse, se retrouvait repollué là où la revue 4.7 venait de le nettoyer.
    journaliserExploitation("synthese_courriel", { code: codeDErreur(e) });
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
