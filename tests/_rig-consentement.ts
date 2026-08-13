import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Remet le consentement art. 9 d'un compte de test à l'état VALIDE.
 *
 * ── POURQUOI CE N'EST PAS UN `upsert` — REVUE DU 2026-08-11, TROUVAILLE S2 ─────────────────────
 *
 * Jusqu'à la migration 0041, ces tests restauraient leur fixture en écrivant `revoked_at: null`
 * sur une ligne révoquée. Ça marchait pour une seule raison : LE PRODUIT LE PERMETTAIT AUSSI. Un
 * `PATCH /rest/v1/consentement` sous son propre jeton rouvrait le write-gate art. 9 et la scène —
 * ce que `app/(auth)/consentement/actions.ts:43` interdit pourtant en toutes lettres (« JAMAIS de
 * reconquête », AD-13 / Story 1.6 AC4). La garde vivait dans une Server Action, c'est-à-dire nulle
 * part pour qui n'emprunte pas cette action.
 *
 * 0041 a descendu la garde dans la base : la révocation est TERMINALE, `service_role` compris.
 * Un harnais ne peut donc plus dé-révoquer. Il peut seulement DÉTRUIRE la preuve et repartir de
 * zéro — ce qu'aucun chemin applicatif ne fait jamais, et que seul `service_role` peut faire.
 * C'est exactement la frontière qu'on veut : le rig a un privilège que le produit n'a pas.
 *
 * ⚠️ N'utilise JAMAIS ce helper pour simuler un parcours utilisatrice. Il représente une remise à
 * zéro de banc d'essai, pas un geste que quiconque peut faire dans l'application.
 */
export async function reposerConsentement(
  admin: SupabaseClient,
  utilisatriceId: string,
): Promise<void> {
  const { error: eSuppression } = await admin
    .from("consentement")
    .delete()
    .eq("utilisatrice_id", utilisatriceId);
  if (eSuppression) throw new Error(`rig consentement (suppression) : ${eSuppression.message}`);

  const { error } = await admin.from("consentement").insert({
    utilisatrice_id: utilisatriceId,
    art9_accorde: true,
    ia_reconnue: true,
    cgu_acceptees: true,
    revoked_at: null,
  });
  if (error) throw new Error(`rig consentement (pose) : ${error.message}`);
}
