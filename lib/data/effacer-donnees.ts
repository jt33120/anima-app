import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fenetreDepuisTexte } from "@/lib/domain/effacement";

/**
 * effacer-donnees.ts — L'APPEL DU MOTEUR UNIQUE (Story 6.7, AC1 · AD-14).
 *
 * Sous le JWT : c'est `auth.uid()` qui décide de QUI est effacé, jamais un identifiant passé en
 * argument. La fonction SQL n'en accepte aucun — il n'existe aucune façon d'en effacer une autre.
 *
 * ⚠️ AUCUN REPLI SILENCIEUX ICI, ET C'EST L'INVERSE DE LA PLUPART DES CHEMINS DE CE DÉPÔT. Ailleurs,
 * une panne retombe sur un défaut sûr et le produit continue. Ici, une panne qui se tairait
 * afficherait « tout est effacé » à quelqu'un dont rien ne l'est. On lève, l'écran le dit, et elle
 * peut recommencer.
 *
 * NFR-022 : seul le CODE remonte, jamais le message de Postgres.
 */
export async function effacerToutesSesDonnees(supabase: SupabaseClient): Promise<string> {
  // AD-14 : l'échéance est LUE À L'EXÉCUTION et passée en argument, jamais écrite dans le SQL.
  const fenetre = fenetreDepuisTexte(process.env.EFFACEMENT_FENETRE_PITR_JOURS);

  const { data, error } = await supabase.rpc("effacer_toutes_mes_donnees", {
    p_fenetre_pitr_jours: fenetre,
  });

  if (error) throw new Error(`effacement: ${error.code ?? "echec"}`);
  // La fonction rend l'identifiant de la TRACE. Rien d'autre ne prouve que le moteur est allé au bout :
  // un `null` voudrait dire qu'on a répondu sans effacer.
  if (typeof data !== "string" || data === "") throw new Error("effacement: sans_trace");

  return data;
}
