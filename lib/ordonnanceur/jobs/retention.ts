import "server-only";
import { codeDErreur } from "@/lib/domain/code-erreur";
import { LOT_MAX } from "@/lib/domain/retention";
import { journaliserExploitation } from "@/lib/safety/rpc-repli";
import { creerDepotRetention, echeancesCourantes, type DepotRetention } from "@/lib/data/depot-retention";
import { annoncerInactivite } from "@/lib/courriel/avis-inactivite";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";

/**
 * jobs/retention.ts — LE MOTEUR DE RÉTENTION AUTOMATIQUE (Story 6.8 · NFR-021 · AD-14 · FR-071).
 *
 * ══ TROIS PHASES, ET LEUR ORDRE EST UNE DÉCISION ════════════════════════════════════════════════
 *
 *   1. TRANCHER les échéances dues — c'est ce qui est URGENT et daté ; une suppression promise pour
 *      le 3 doit avoir lieu le 3, pas quand il restera du budget.
 *   2. PRÉVENIR les comptes inactifs — c'est la phase qui grandit avec le nombre de comptes, donc
 *      celle qu'on accepte de voir rendre la main. Un avis qui part demain reste un avis ; une
 *      suppression qui glisse d'un jour est une promesse non tenue.
 *   3. PURGER le journal de l'ordonnanceur — la moins urgente, et la seule qui n'engage personne.
 *
 * ══ AUCUNE RÉCLAMATION PAR PERSONNE, ET C'EST DÉLIBÉRÉ ══════════════════════════════════════════
 *
 * Les deux autres jobs à fan-out (`synthese`, `rappel-echeance`) réclament une fenêtre par personne
 * dans `execution_job` : c'est ce qui les empêche d'écrire deux fois. Ici, ce serait à la fois inutile
 * et absurde.
 *
 * INUTILE : l'idempotence est STRUCTURELLE. Une fois le compte effacé, il ne ressort d'aucune des
 * deux sélections — il n'existe plus. Une fois l'échéance posée, `poser_echeance_suppression` refuse
 * de l'écraser. Rien à dédoublonner.
 *
 * ABSURDE : la ligne de réclamation porterait `cible_id = la personne`, et cette ligne est en
 * `on delete cascade` vers `utilisatrice`. Elle serait donc EFFACÉE PAR L'EFFACEMENT qu'elle est
 * censée garder — une serrure emportée par la porte qu'elle ferme.
 *
 * Conséquence heureuse : ce job n'écrit aucune ligne par personne dans la table qu'il purge.
 *
 * ══ CE QU'IL NE FAIT JAMAIS ═════════════════════════════════════════════════════════════════════
 *
 * Aucun appel modèle. Aucune lecture de contenu — il ne lit que des HORODATAGES et des identifiants
 * (`derniere_activite` en base). Aucun art. 9 ne traverse ce fichier, et rien de ce qu'il journalise
 * ne porte d'identifiant de personne (NFR-002/NFR-022).
 */

export const NOM_JOB = "retention";

export const RESERVE_RETENTION_MS = 2_400;

/** 12 s : la purge, puis deux boucles bornées à un aller-retour (ou deux) par personne. */
export const DELAI_JOB_RETENTION_MS = 12_000;

export interface DepsRetention {
  readonly depot: DepotRetention;
  /**
   * L'envoi de l'avis. Injecté pour le test, et surtout ISOLÉ DANS `lib/courriel/` en production :
   * c'est là que vit le régime légal, hors du plafond et du refus de canal (voir `avis-inactivite.ts`).
   * Rend `false` quand rien n'a pu partir — et alors AUCUNE échéance n'est posée.
   */
  readonly annoncer: (utilisatriceId: string) => Promise<boolean>;
}

export async function executerRetention(ctx: ContexteJob, deps?: Partial<DepsRetention>): Promise<void> {
  const depot = deps?.depot ?? creerDepotRetention();
  const annoncer = deps?.annoncer ?? annoncerInactivite;
  const echeances = echeancesCourantes();

  const reste = () => ctx.echeance.getTime() - Date.now();

  // ── 1. LES ÉCHÉANCES DUES ─────────────────────────────────────────────────────────────────────
  const dus = await depot.comptesAEffacer(LOT_MAX);
  let traites = 0;
  for (const utilisatriceId of dus) {
    if (reste() < RESERVE_RETENTION_MS) {
      // Comme les trois autres jobs : rendre la main SE DIT. Le reste part au tick suivant — les
      // échéances ne se périment pas, elles restent dues.
      journaliserExploitation("retention_lot_incomplet", { code: `restants_${dus.length - traites}` });
      return;
    }
    traites += 1;
    try {
      const issue = await depot.trancher(utilisatriceId, echeances);
      // ⚠️ SOUS `code`, ET SANS L'IDENTIFIANT. Le journal dit ce qui a été fait, jamais à qui : la
      // trace nominative de l'effacement vit dans `effacement`, avec une empreinte (0058).
      journaliserExploitation("retention_echeance", { code: `issue_${issue}` });
    } catch (e) {
      // Un compte qui résiste ne bloque pas les suivants : leur échéance est due, elle aussi.
      journaliserExploitation("retention_echeance_echouee", { code: codeDErreur(e) });
    }
  }

  // ── 2. LES AVIS D'INACTIVITÉ ──────────────────────────────────────────────────────────────────
  //
  // ⚠️ ON ENVOIE D'ABORD, ON POSE L'ÉCHÉANCE ENSUITE — et l'ordre inverse serait le vrai danger.
  // Poser d'abord, c'est risquer une échéance posée sans avis parti : trois mois plus tard, le
  // compte disparaît sans que personne n'ait été prévenu. Envoyer d'abord, c'est risquer au pire un
  // second courriel demain — et `tracer_avis_inactivite` le rend même improbable. AD-15 : le repli
  // penche du côté du moindre effet.
  //
  // ⚠️ AUCUNE ÉCHÉANCE N'EST POSÉE SI L'AVIS N'EST PAS PARTI — canal non configuré, adresse
  // introuvable, panne d'envoi : `annoncer` rend `false` ou lève, et on passe. Le compte reste, et il
  // ressortira demain. Mieux vaut un compte conservé trop longtemps qu'un compte supprimé sans avis.
  const aPrevenir = await depot.comptesAPrevenir(echeances.inactiviteMois, LOT_MAX);
  let prevenus = 0;
  for (const utilisatriceId of aPrevenir) {
    if (reste() < RESERVE_RETENTION_MS) {
      journaliserExploitation("retention_avis_incomplet", {
        code: `restants_${aPrevenir.length - prevenus}`,
      });
      return;
    }
    prevenus += 1;
    try {
      if (!(await annoncer(utilisatriceId))) {
        journaliserExploitation("retention_avis_impossible", { code: "avis_non_parti" });
        continue;
      }
      // ⚠️ L'ÉCHÉANCE EST LA SEULE TRACE, ET UNE GARDE L'A IMPOSÉ. On écrivait aussi une ligne dans
      // `notification_envoyee` ; `tests/regime-anam.test.ts` a refusé — cette table est le miroir des
      // motifs à CANAL, et l'avis d'inactivité relève du régime légal, qui y échappe. La trace y aurait
      // de toute façon été purgée par `purger_notifications_envoyees` (0034), alors que l'échéance vit
      // exactement aussi longtemps que le compte qu'elle concerne.
      await depot.poserEcheance(utilisatriceId, echeances.preavisMois);
    } catch (e) {
      journaliserExploitation("retention_avis_echoue", { code: codeDErreur(e) });
    }
  }

  // ── 3. LE JOURNAL DE L'ORDONNANCEUR (trouvaille R1 de la revue 6.1a) ─────────────────────────
  //
  // En dernier, et hors de toute boucle : c'est la seule phase qui n'engage personne, et la seule
  // qu'on accepte de perdre entièrement quand le budget est consommé.
  if (reste() >= RESERVE_RETENTION_MS) {
    try {
      const retirees = await depot.purgerJournal(echeances.journalJours);
      if (retirees > 0) journaliserExploitation("retention_journal_purge", { code: `lignes_${retirees}` });
    } catch (e) {
      journaliserExploitation("retention_journal_echoue", { code: codeDErreur(e) });
    }
  }
}
