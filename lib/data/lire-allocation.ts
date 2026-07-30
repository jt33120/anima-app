import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * lire-allocation.ts — Le COMPTAGE des tours d'allocation résiduelle consommés ce mois (Story 3.4,
 * AC2/AC3). Compte les lignes `usage_ia` marquées `post_premiere_seance` (tour servi APRÈS la clôture
 * de la 1ʳᵉ séance) créées depuis le début du mois courant (UTC). `usage_ia` est deny-by-default → lu
 * via le client admin (service_role, tâche système autorisée AD-12 ; NON-art. 9, aucun contenu).
 *
 * Repli sûr (AD-15) : une panne de lecture LÈVE → l'appelant (la route) NE COUPE PAS (fail-open,
 * FR-058 : jamais coupé à zéro sur un doute). C'est l'INVERSE d'`estPremiumCourante` (où le doute
 * SUSPEND le commerce, 3.2) : ici le doute penche vers l'ACCÈS — le socle ne se ferme jamais par erreur.
 *
 * Fenêtre « ce mois-ci » = mois calendaire UTC (`Date.UTC(...,1)`). Le fuseau exact (Europe/Paris) est
 * un raffinement produit mineur (dérive de bord de mois) — cf. deferred-work.
 */
export async function compterToursResiduelsDuMois(
  utilisatriceId: string,
  cleIdempotenceCourante?: string,
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const maintenant = new Date();
  const debutMoisUtc = new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1),
  ).toISOString();
  let requete = admin
    .from("usage_ia")
    .select("*", { count: "exact", head: true })
    .eq("utilisatrice_id", utilisatriceId)
    .eq("post_premiere_seance", true)
    .gte("cree_le", debutMoisUtc);
  // Le tour LOGIQUE courant ne se compte JAMAIS lui-même (revue 3.4, F4/F5) : au « Réessayer » (même
  // jeton → même `cle_idempotence`), la ligne d'une 1ʳᵉ tentative avortée ne doit pas murer la
  // retentative. Le gate devient idempotent par tour logique, comme le métrage ; jamais coupé à tort (FR-058).
  if (cleIdempotenceCourante) requete = requete.neq("cle_idempotence", cleIdempotenceCourante);
  const { count, error } = await requete;
  if (error) throw new Error(`comptage allocation résiduelle a échoué (${error.code ?? "inconnu"}).`);
  return count ?? 0;
}
