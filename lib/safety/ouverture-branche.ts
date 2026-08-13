import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";
import { creerDepotArbitrage } from "@/lib/data/depot-arbitrage";
import { phraseProposition } from "@/lib/domain/branche";
import {
  FENETRE_INVITATION_HEURES,
  PHRASE_INVITATION,
  PHRASE_SOCLE_COMPLETE,
  tropDeBranchesOuvertes,
  type Ouverture,
} from "@/lib/domain/arbitrage-ouverture";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";
import { premiumSousJwt } from "@/lib/safety/entitlement-premium";

/**
 * Story 4.5 (T4), ARBITRÉE PAR LA 4.10 — LE SEUL ENDROIT DU PRODUIT OÙ L'ON DÉCIDE D'OUVRIR UNE BRANCHE.
 *
 * C'est ce qui rend FR-030 implémentable proprement : l'arbitrage ne s'AJOUTE pas à côté de la proposition,
 * il SE SUBSTITUE à ce point unique. Appelé par `app/page.tsx` (Server Component sous JWT) au
 * franchissement du seuil, APRÈS la garde onboarding.
 *
 * ── L'ARBITRAGE, EN TROIS TEMPS ───────────────────────────────────────────────────────────────────────
 *
 *   1. Y a-t-il un moment mûr ? (`chargerProposition` applique déjà « le lendemain » et la garde détresse.)
 *      Non → rien, comme avant.
 *   2. A-t-elle déjà trop de branches ouvertes sans intégration ? (seuil pur, décision D2.)
 *      Non → Anam PROPOSE, exactement comme en 4.5.
 *   3. Oui → Anam a-t-elle le droit de parler ? (réservation atomique, décision D3.)
 *      Oui → elle INVITE. Non → elle se TAIT.
 *
 * ── LES DEUX PIÈGES, TOUS DEUX SILENCIEUX ─────────────────────────────────────────────────────────────
 *
 * (a) LE SIGNAL N'EST JAMAIS CONSOMMÉ ICI. Ce module LIT le germe ; il n'écrit rien dessus. Si Anam invite
 *     au lieu de proposer, le `signal_reconceptualisation` reste EN ATTENTE : ce moment-là est réel, et il
 *     n'a pas à disparaître parce qu'elle en avait déjà trois autres. L'écarter serait perdre définitivement
 *     une prise de conscience, sans trace et sans recours. Il reviendra le jour où une branche bougera.
 *
 * (b) ANAM SE TAIT APRÈS AVOIR PARLÉ. Sans la réservation, le signal étant toujours là et le seuil toujours
 *     franchi, l'invitation repartirait à chaque ouverture de l'app — chaque jour. FR-030 fabriquerait alors
 *     la violation de FR-034, et la plus agaçante des répétitions : celle qui se répète parce qu'elle n'a
 *     pas obéi. Parole refusée → `null` : ni proposition, ni invitation. Le silence EST la réponse.
 *
 * ── AC5 [DUR] : LE COMPTE NE TRAVERSE PAS LA FRONTIÈRE ────────────────────────────────────────────────
 *
 * `Ouverture` est une union discriminée SANS AUCUN CHAMP NUMÉRIQUE. Le compte est lu, il choisit une
 * branche du `if`, et il meurt ici. Le rendu ne peut pas afficher « 3 branches en cours » : il n'a jamais
 * reçu de 3. Même patron que la projection muette de la 4.6 et que la trame `beat` de la 2.7.
 *
 * REPLI SÛR : toute panne → `null`. L'ouverture est un bonus ; jamais elle ne bloque l'entrée dans la
 * scène (aucun 500). L'incident est journalisé sans art. 9 (NFR-022). Ce qui part au client ne porte que
 * des identifiants et une phrase GÉNÉRIQUE — aucun verbatim.
 *
 * ── ⚠️ DEUX DOUTES OPPOSÉS COHABITENT ICI, ET C'EST VOULU (Story 3.3) ─────────────────────────────────
 *
 *   • une panne du GATE PREMIUM → on se TAIT (`premiumSousJwt` retombe sur `false`) ;
 *   • une panne de l'ARBITRAGE  → on PROPOSE (le `catch` local, ci-dessous).
 *
 * Ce n'est pas une incohérence, c'est la même règle appliquée deux fois : on se trompe du côté qui coûte
 * le moins. Se taire à tort coûte une question différée — le germe reste en attente, il reviendra. Parler
 * à tort sur le gate premium lui fait écrire le nom d'une prise de conscience que la policy refusera
 * ensuite. Les deux coûts ne sont pas du même ordre, donc les deux replis ne vont pas du même côté.
 * Quiconque « harmonise » ces deux directions casse l'une des deux.
 */
export type { Ouverture } from "@/lib/domain/arbitrage-ouverture";

export async function chargerOuverture(
  supabase: SupabaseClient,
  maintenant: Date = new Date(),
): Promise<Ouverture | null> {
  try {
    // ══════════════════════════════════════════════════════════════════════════════════════════
    // Story 5.3 (AC4) — LA MENTION DE COMPLÉTION DU SOCLE, ET POURQUOI ELLE EST *AVANT* LE GATE
    // ══════════════════════════════════════════════════════════════════════════════════════════
    //
    // ⚠️ NE JAMAIS DÉPLACER CE BLOC SOUS `premiumSousJwt`. Ce serait le réflexe d'harmonisation —
    // « toutes les ouvertures passent par le même gate » — et il fabriquerait une COUPURE DU SOCLE
    // GRATUIT : le socle est gratuit à vie (FR-055), le tronc est gratuit (FR-088), et une
    // utilisatrice gratuite qui vient d'aller chercher son acte de naissance à la mairie
    // n'entendrait JAMAIS qu'Anam a bien reçu son heure. `tests/socle-jamais-coupe.test.ts` garde
    // cette position.
    //
    // Elle passe aussi EN PREMIER parmi les ouvertures, et pour une raison qui n'est pas la
    // politesse : elle est ponctuelle et s'auto-éteint. Une mention qui perdrait l'arbitrage à
    // chaque fois ne serait jamais dite — alors que la proposition, elle, revient d'elle-même.
    //
    // ⚠️ ELLE ÉCRIT (la réservation EST la décision, 0040). Donc son propre `try` : une panne de
    // cette lecture-écriture ne doit pas faire taire la proposition de la 4.5, qui n'a besoin de
    // rien de tout ça. C'est exactement la faute que la revue 4.10 a trouvée sur l'arbitrage.
    // Direction du doute : ON SE TAIT — la mention n'a qu'une seule chance, et se taire à tort la
    // reporte au prochain chargement, tandis que parler à tort la dépense pour rien.
    try {
      // ⚠️ LECTURE SEULE DEPUIS UN RENDU SERVEUR (revue du 2026-08-12, B3 — migration 0045).
      //
      // Cet appel dépensait la mention. Or il part d'`app/page.tsx`, donc à chaque rendu de la
      // scène — et la scène monte ses trois régions en permanence, `inert` sauf l'active. Une
      // utilisatrice qui arrive dans la région ARBRE faisait consommer sa phrase par un rendu qui
      // la plaçait dans une région qu'aucun lecteur d'écran n'annonce. Un rechargement avant
      // d'ouvrir la conversation, et la phrase était perdue POUR TOUJOURS.
      //
      // C'est le défaut de la revue 4.10 rejoué : une écriture irréversible déclenchée par un
      // rendu. La dépense vit maintenant dans `marquerAnnonceSocleDite`, appelée quand la phrase a
      // atteint l'écran.
      if (await creerDepotArbitrage(supabase).annonceSocleDue()) {
        return { type: "socle-complete", phrase: PHRASE_SOCLE_COMPLETE };
      }
    } catch (e) {
      journaliserIncidentSecurite("ouverture_socle_complete", e);
    }

    // ── Story 3.3 (D2-A, FR-088) : SUR UN COMPTE GRATUIT, ANAM NE PROPOSE PAS ────────────────────────
    //
    // Depuis 0037, la naissance d'une branche est gardée dans le `WITH CHECK` de `branche_insertion`.
    // Sans ce gate, Anam proposerait, l'utilisatrice écrirait le nom — un contenu art. 9 qu'elle vient de
    // composer sur elle-même — et l'écriture serait refusée. C'est MOT POUR MOT la faute que les revues
    // 4.7 (le geste de rayonnement offert pendant la fenêtre de détresse) puis 4.10 (le champ d'intention
    // offert sans abonnement) ont trouvée, et elle est pire ici que partout ailleurs : ce qu'on lui fait
    // écrire pour rien, c'est le nom qu'elle donne à une prise de conscience.
    //
    // ⚠️ ON FERME LA PROPOSITION, ON NE TOUCHE PAS AU SIGNAL. `evaluerReconceptualisationDuTour` continue
    // d'enregistrer les signaux d'un compte gratuit, à l'identique. C'est la doctrine que ce module porte
    // déjà pour l'arbitrage — « l'écarter serait perdre définitivement une prise de conscience, sans trace
    // et sans recours » — et elle vaut ici mot pour mot : le jour où elle s'abonne, ses moments mûrs sont
    // là, intacts, et Anam les lui propose. Un gate posé sur le signal les aurait effacés en silence.
    //
    // FR-059 n'est pas entamée : `charger_proposition_branche` n'ouvre un moment qu'à partir du JOUR CIVIL
    // SUIVANT sa naissance (0021), donc aucune proposition ne peut survenir pendant la première séance du
    // premier jour ; et FR-055 n'a jamais fait figurer une branche dans le gratuit à vie.
    //
    // ORDRE DÉLIBÉRÉ : le gate d'abord. Un compte gratuit ne déclenche alors AUCUNE lecture du germe —
    // c'est aussi de la minimisation, la proposition portant un pointeur vers de l'art. 9.
    if (!(await premiumSousJwt(supabase, "ouverture_branche_premium"))) return null;

    const p = await creerDepotSignalReconcept(supabase).chargerProposition();
    if (!p) return null;

    // La proposition ORDINAIRE (4.5) est calculée d'abord, et elle sert de repli.
    const proposition = {
      type: "proposition" as const,
      signalId: p.signalId,
      phrase: phraseProposition({ signalCreeLe: p.signalCreeLe, maintenant }),
    };

    // ⚠️ L'ARBITRAGE A SON PROPRE `try` (revue 4.10), et ce n'est pas une précaution de style.
    //
    // La 4.10 ajoute deux allers-retours de base sur un chemin qui n'en avait aucun. Sous le `catch`
    // global, une panne de l'un ou l'autre faisait rendre `null` — donc Anam se taisait AUSSI pour la
    // proposition ordinaire de la 4.5, qui n'avait besoin de rien de tout ça. Une fonctionnalité qui
    // marchait depuis trois stories tombait à cause d'une lecture ajoutée pour une autre. Le test
    // « une panne de l'arbitrage ne fait pas tomber la scène » assérait `null` et se déclarait satisfait :
    // personne ne relevait que le repli avait perdu la 4.5 en route.
    //
    // Direction du doute : on PROPOSE. Se tromper en proposant coûte une question qu'elle peut refuser ;
    // se tromper en se taisant lui fait perdre un moment mûr sans qu'elle sache qu'il a existé.
    try {
      const arbitrage = creerDepotArbitrage(supabase);
      const faits = await arbitrage.faits();

      if (tropDeBranchesOuvertes(faits.branchesEnNaissance) && faits.brancheCibleId) {
        // La réservation ÉCRIT : elle EST la décision, et elle est atomique — deux onglets ne peuvent pas
        // dire deux fois la même chose. Un refus veut dire « Anam a déjà dit ça récemment, et rien n'a
        // bougé depuis » : silence, et le germe reste intact.
        const parole = await arbitrage.reserverParole(FENETRE_INVITATION_HEURES);
        if (!parole) return null;
        return { type: "invitation", phrase: PHRASE_INVITATION, brancheCibleId: faits.brancheCibleId };
      }
    } catch (e) {
      journaliserIncidentSecurite("ouverture_arbitrage", e);
    }

    return proposition;
  } catch (e) {
    journaliserIncidentSecurite("ouverture_branche", e);
    return null;
  }
}
