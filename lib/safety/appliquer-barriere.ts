import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { echeanceSuppression } from "./barriere-minorite";

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
 * Point de déclenchement du remboursement intégral (AC5, FR-071). En Epic 1, AUCUN paiement
 * n'existe (Stripe = Epic 3) : stub HONNÊTE — il ne prétend rien rembourser. Le seam est posé
 * ici pour que l'intégration abonnement (Epic 3) recherche un encaissement pour `cible` et
 * déclenche un remboursement intégral réel.
 */
export async function declencherRemboursement(cible: string): Promise<void> {
  void cible; // Epic 3 : brancher Stripe (rechercher l'encaissement, rembourser intégralement)
  return Promise.resolve();
}
