import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";
import { creerDepotArbitrage } from "@/lib/data/depot-arbitrage";
import { creerDepotRythme } from "@/lib/data/depot-rythme";
import { PHRASE_PAUSE, seuilFranchi } from "@/lib/domain/rythme-pause";
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
import { chargerHypotheseADire } from "@/lib/data/lire-enneagramme";
import { PHRASE_OUVERTURE_HYPOTHESE } from "@/lib/domain/enneagramme-hypothese";

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
  utilisatriceId: string,
  maintenant: Date = new Date(),
): Promise<Ouverture | null> {
  try {

    // ══════════════════════════════════════════════════════════════════════════════════════════
    // Story 6.4 (AC1) — LE GESTE DE PAUSE, ET POURQUOI IL PASSE *AVANT TOUT LE RESTE*
    // ══════════════════════════════════════════════════════════════════════════════════════════
    //
    // Deux raisons, et la seconde est mécanique.
    //
    // 1. TOUTES LES AUTRES OUVERTURES INVITENT À FAIRE PLUS — une branche à ouvrir, une intégration
    //    à mener, une hypothèse à explorer. La pause est la seule dont l'objet est de faire MOINS.
    //    Proposer une branche à quelqu'un qui vient de franchir le seuil de rythme est très
    //    exactement le geste inverse de celui que FR-036 demande.
    //
    // 2. ⚠️ PLACÉE EN PREMIER, RIEN D'AUTRE N'A ENCORE ÉTÉ LU, DONC RIEN NE PEUT ÊTRE DÉPENSÉ. La
    //    mention de complétion du socle et l'hypothèse d'ennéagramme se CONSOMMENT. Placée en
    //    dernier, la pause les préempterait après coup et l'une des deux serait perdue pour
    //    toujours — c'est le défaut trouvé en revue 4.10, et il ne se rejoue pas ici.
    //
    // Son propre `try`, comme les blocs suivants : une panne de la mesure de rythme ne doit pas
    // faire taire les quatre autres ouvertures, qui n'ont besoin de rien de tout ça. Direction du
    // doute : ON SE TAIT — se taire à tort reporte la pause d'un chargement, tandis que parler à
    // tort insérerait une ligne de revue produit qui ne correspond à aucune parole dite.
    //
    // La garde AD-17 n'est PAS ici : elle vit dans `reserver_pause_rythme` (0055), en SQL, et elle
    // y est évaluée AVANT l'insertion — sinon un épisode de détresse ne différerait pas la pause,
    // il la supprimerait pour un mois.
    try {
      const rythme = creerDepotRythme(supabase, maintenant);
      const mesure = await rythme.mesurer();
      // ⚠️ `seuilFranchi` est la SEULE lecture de la mesure qui existe. Il n'y a pas de branche
      // « et si elle vient peu ? » — l'AC4 dit qu'aucune absence n'est constatée, jamais, et
      // l'absence de la fonction inverse EST cette garantie (voir `rythme-pause.ts`).
      if (seuilFranchi(mesure) && (await rythme.reserver(mesure))) {
        return { type: "pause", phrase: PHRASE_PAUSE };
      }
    } catch (e) {
      journaliserIncidentSecurite("ouverture_pause_rythme", e);
    }

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

    // ══════════════════════════════════════════════════════════════════════════════════════════
    // Story 5.5 (AC2) — L'HYPOTHÈSE D'ANAM, ET POURQUOI ELLE EST *AVANT* LE GATE, ELLE AUSSI
    // ══════════════════════════════════════════════════════════════════════════════════════════
    //
    // ⚠️ NE JAMAIS DÉPLACER CE BLOC SOUS `premiumSousJwt`. Même raison qu'au-dessus, et elle est
    // écrite noir sur blanc dans FR-055 : l'ennéagramme fait partie du socle GRATUIT À VIE.
    // `tests/socle-jamais-coupe.test.ts` garde cette position.
    //
    // ⚠️ EN REVANCHE, IL PASSE *APRÈS* LA MENTION DE COMPLÉTION, ET C'EST L'INVERSE D'UN DÉTAIL. Les
    // deux sont du socle libre, donc l'ordre entre elles se décide sur autre chose : ce qu'on perd à
    // perdre l'arbitrage. La mention n'a qu'UNE SEULE CHANCE et s'auto-éteint — la faire passer
    // seconde reviendrait à ne jamais la dire à quelqu'un qui a aussi une hypothèse en attente.
    // L'hypothèse, elle, reste `en_attente` en base : elle repart au prochain chargement. La règle
    // est constante dans ce fichier — ce qui ne revient pas de soi-même passe devant.
    //
    // ⚠️ LECTURE SEULE, ET C'EST LA TROISIÈME FOIS QUE CE DÉPÔT L'ÉCRIT. Ce chemin part
    // d'`app/page.tsx`, donc à chaque rendu de la scène — et la scène monte ses trois régions en
    // permanence, `inert` sauf l'active. Une parole marquée « dite » ici se dépenserait sans avoir
    // jamais atteint un écran : la faute a été payée en revue 4.10 (`reserver_invitation_integration`
    // consommée par un `router.refresh()`) puis en migration 0045. La dépense vit dans
    // `marquerHypotheseDite`, appelée par le CLIENT quand la région est active.
    //
    // Son propre `try` : cette lecture est ajoutée sur un chemin qui marchait sans elle. La 4.10
    // avait cassé la proposition de la 4.5 avec un `try` global — chaque effet porte le sien.
    // Direction du doute : ON SE TAIT. L'hypothèse reste `en_attente` en base, elle sera dite au
    // prochain chargement ; c'est l'inverse exact de la mention de complétion, qui n'a qu'une seule
    // chance parce qu'elle s'auto-éteint.
    try {
      // ⚠️ LA GARDE DE DÉTRESSE MANQUAIT SUR CE CHEMIN (revue Epic 5, R4 · migration 0063). La
      // lecture n'était qu'un `select` sur trois colonnes : 0049 ne gardait que la SEMENCE du germe,
      // rien n'en gardait la PAROLE. Un germe semé à froid lundi était donc prononcé mardi en pleine
      // crise — et DÉPENSÉ, donc jamais redit à un moment calme. `charger_hypothese_a_dire` porte le
      // même prédicat que `charger_proposition_branche`, dont le germe a la même forme.
      const h = await chargerHypotheseADire(supabase);
      if (h.statut === "calcule") {
        return {
          type: "hypothese-enneagramme",
          phrase: PHRASE_OUVERTURE_HYPOTHESE,
          hypotheseId: h.hypothese.id,
        };
      }
    } catch (e) {
      journaliserIncidentSecurite("ouverture_hypothese_enneagramme", e);
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
