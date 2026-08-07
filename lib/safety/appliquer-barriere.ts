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
    if (reservation === "non_eligible" || reservation.dejaDemande) return;
    if (!reservation.subscriptionId) return; // compte jamais abonné : rien à rembourser, rien à dire
    await rembourserIntegralement(reservation.subscriptionId, cible, reservation.cle);
  } catch (e) {
    console.error("[barriere-minorite] remboursement impossible", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
  }
}
