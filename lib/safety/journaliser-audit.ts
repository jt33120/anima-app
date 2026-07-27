import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import type { NiveauSecurite } from "@/lib/ai/port";
import type { DecisionSecurite } from "./classer-detresse";

/**
 * Écriture de l'audit de détresse (Story 2.3, FR-078) dans `audit_securite`, SANS art. 9.
 *
 * Décision SYSTÈME → passe par la fonction security definer `journaliser_audit_detresse` via le
 * client admin (service_role, tâche autorisée AD-12 : `audit_securite` n'est pas du contenu art. 9).
 * Best-effort et **ne lève JAMAIS** : perdre une ligne d'audit dégrade la MESURE (FR-078), pas la
 * SÉCURITÉ (le verdict qui protège l'utilisatrice a déjà été appliqué). Journalisé sans art. 9
 * (code d'erreur seul — NFR-022). Même patron que `metrerUsageIa`.
 */
export interface AuditDetresseEcriture {
  utilisatriceId: string;
  cleIdempotence: string;
  niveau: NiveauSecurite;
  decision: DecisionSecurite;
  tier: "fort";
}

export async function journaliserAuditDetresse(a: AuditDetresseEcriture): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("journaliser_audit_detresse", {
      cible: a.utilisatriceId,
      p_niveau: a.niveau,
      p_decision: a.decision,
      p_tier: a.tier,
      p_cle: a.cleIdempotence,
    });
    if (error) console.error("audit_detresse échoué", { code: error.code });
  } catch (e) {
    console.error("audit_detresse : exception", { nom: e instanceof Error ? e.name : "inconnu" });
  }
}
