import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { echeanceSuppression } from "./barriere-minorite";
import { reserverRemboursement } from "@/lib/data/depot-resiliation";
import { rembourserIntegralement } from "@/lib/stripe/resiliation";

/**
 * Applique la barrière de minorité DÉTECTÉE (Story 1.9, FR-071) au compte `cible`.
 *
 * Décision SYSTÈME (tâche serveur : le futur classifieur du pipeline sécurité — Epic 2 — ou
 * l'injection de test/DEV), JAMAIS une action invocable par le client avec un uid arbitraire.
 * D'où le choix : module `server-only`, PAS un `"use server"` export (sinon n'importe qui
 * suspendrait n'importe quel compte). L'appelant fournit un `cible` de confiance (self en DEV,
 * verdict serveur en Epic 2).
 *
 * Effet (atomique + idempotent, EN BASE — cf. migration 0006) : suspend le compte, ENREGISTRE
 * l'échéance de suppression à 30 j (durée paramétrée, `lib/safety/barriere-minorite`) pour le
 * moteur unique de rétention (AD-14 — 1.9 n'efface RIEN), et émet un audit de sécurité sans
 * art. 9. Puis pose le point de déclenchement du remboursement (AC5).
 */
/**
 * Pose la minorité DÉCLARÉE au seuil d'âge (FR-070, story 1.4) — AVEC son échéance de suppression.
 *
 * ══ POURQUOI CE CHEMIN EXISTE (revue des Epics 1 à 4, trouvaille #11) ═══════════════════════════
 *
 * `naissance/actions.ts` écrivait `mineur_detecte = true` sous le JWT de la personne, et rien
 * d'autre. Or `echeance_suppression` est une colonne SYSTÈME, hors du grant client depuis 0041 :
 * l'action ne pouvait pas la poser, et personne ne l'a remarqué. Le compte tombait alors dans un
 * angle mort parfait — `comptes_a_prevenir` exclut les mineures (« la minorité a son propre
 * chemin »), `comptes_a_effacer` exige une échéance qu'elle n'avait pas.
 *
 * Son compte n'aurait jamais été effacé : une adresse e-mail et le fait qu'elle a moins de dix-huit
 * ans, conservés sans limite, pour avoir répondu honnêtement à la question de son âge.
 *
 * ⚠️ CE N'EST PAS `appliquerBarriereMinorite`, ET C'EST DÉLIBÉRÉ. Les deux drapeaux disent deux
 * faits différents — « elle a déclaré 14 ans » n'est pas « on a détecté après coup » — et 0042 puis
 * 0061 ont explicitement refusé de les confondre. Deux portes, pas une porte élargie.
 */
export async function declarerMinorite(cible: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("declarer_minorite", {
    cible,
    // La DURÉE vit dans `lib/safety/barriere-minorite`, en un seul endroit : le SQL reçoit une date
    // déjà calculée et ne code jamais « 30 » (AD-14).
    echeance: echeanceSuppression(),
  });
  if (error) throw new Error(`declarer_minorite: ${error.message}`);
}

export async function appliquerBarriereMinorite(cible: string): Promise<void> {
  // service_role : tâche système (AD-12), jamais du contenu. La fonction SQL est révoquée
  // pour public/anon/authenticated → seul ce chemin serveur peut l'appeler.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("appliquer_barriere_minorite", {
    cible,
    echeance: echeanceSuppression(),
  });
  if (error) throw new Error(`appliquer_barriere_minorite: ${error.message}`);

  await declencherRemboursement(cible);
}

/**
 * Le remboursement intégral d'un compte détecté MINEUR (AC5 de la 1.9, FR-071).
 *
 * Posé en stub honnête par la Story 1.9 — aucun paiement n'existait alors — et BRANCHÉ par la 3.5. Il
 * partage l'exécution du remboursement de garantie (`lib/stripe/resiliation`) et sa réservation
 * (`remboursement`, un par compte) : deux chemins, une seule idempotence. Les séparer aurait remboursé
 * deux fois une mineure ayant déjà obtenu la garantie.
 *
 * ── TROIS DIFFÉRENCES AVEC LA GARANTIE, TOUTES VOULUES ──────────────────────────────────────────────────
 *
 * 1. AUCUNE CONDITION D'ÉLIGIBILITÉ. Ni les trois mois, ni « aucune branche posée ». Ce n'est pas une
 *    garantie de satisfaction : c'est un contrat qui n'aurait jamais dû exister. Le motif `minorite`
 *    dispense de `eligible_au_remboursement` côté SQL (0038).
 *
 * 2. ELLE NE LÈVE JAMAIS. La barrière de minorité est une mesure de SÉCURITÉ (FR-071) : elle doit
 *    aboutir même si Stripe est injoignable, même si le compte n'a jamais payé, même si la clé secrète
 *    manque. Faire échouer la suspension d'un compte mineur parce qu'un remboursement a échoué, ce
 *    serait subordonner la sécurité au commerce — l'inverse exact d'AD-9. L'échec est journalisé et
 *    rattrapable (la réservation reste en base avec sa clé) ; il n'interrompt rien.
 *
 * 3. AUCUNE DONNÉE ART. 9 NI PII DANS LE JOURNAL. Le nom de l'erreur, rien d'autre (NFR-022).
 */
export async function declencherRemboursement(cible: string): Promise<void> {
  try {
    const reservation = await reserverRemboursement(cible, "minorite");
    // `"non_eligible"` ne peut pas arriver sur ce motif (le SQL ne teste l'éligibilité que pour
    // `garantie`) — mais le type l'admet, et l'ignorer en silence serait supposer plutôt que vérifier.
    if (reservation === "non_eligible") return;
    // Revue du 2026-08-11 (M3), même défaut que la route de la garantie : `dejaDemande` seul ne
    // prouve RIEN — il dit qu'une réservation existe, pas qu'un euro est parti. Un premier appel
    // Stripe échoué rendait le remboursement d'une MINEURE définitivement impossible, en silence.
    // Tant que `confirmeLe` est nul, on rejoue avec la même clé ; l'idempotence Stripe interdit le
    // double remboursement.
    if (reservation.dejaDemande && reservation.confirmeLe) return;
    if (!reservation.subscriptionId) return; // compte jamais abonné : rien à rembourser, rien à dire
    const issue = await rembourserIntegralement(reservation.subscriptionId, cible, reservation.cle);
    if (issue === "rien_a_rembourser") {
      // Sans PII : la barrière de minorité a bien été posée, c'est l'argent qui n'a pas suivi.
      console.error("[barriere-minorite] aucun paiement retrouvé — résilié sans remboursement");
    }
  } catch (e) {
    console.error("[barriere-minorite] remboursement impossible", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
  }
}
