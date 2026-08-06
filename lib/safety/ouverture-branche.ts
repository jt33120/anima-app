import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";
import { creerDepotArbitrage } from "@/lib/data/depot-arbitrage";
import { phraseProposition } from "@/lib/domain/branche";
import {
  FENETRE_INVITATION_HEURES,
  PHRASE_INVITATION,
  tropDeBranchesOuvertes,
  type Ouverture,
} from "@/lib/domain/arbitrage-ouverture";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";

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
 */
export type { Ouverture } from "@/lib/domain/arbitrage-ouverture";

export async function chargerOuverture(
  supabase: SupabaseClient,
  maintenant: Date = new Date(),
): Promise<Ouverture | null> {
  try {
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
