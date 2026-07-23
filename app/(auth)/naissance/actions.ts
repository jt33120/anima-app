"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { calculerAge } from "./age";

export type EtatAge = { statut: "saisie" | "mineur" | "erreur"; message?: string };

/**
 * Déclaration d'âge (Story 1.4). Contrôle de majorité CÔTÉ SERVEUR (NFR-023).
 * < 18 → drapeau `mineur_detecte` + déconnexion (aucune DOB stockée) ; suppression
 *        déférée à l'ordonnanceur (AD-14/FR-071).
 * ≥ 18 → `date_naissance` écrite une fois (immuable, trigger DB) puis parcours avance.
 * Écriture sous la session RLS de l'utilisatrice — jamais `service_role` (AD-12).
 */
export async function declarerAge(
  _prev: EtatAge,
  formData: FormData,
): Promise<EtatAge> {
  const valeur = String(formData.get("date_naissance") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    return { statut: "erreur", message: "Entre une date valide." };
  }
  const age = calculerAge(valeur);
  if (Number.isNaN(age) || age > 130) {
    return { statut: "erreur", message: "Cette date ne semble pas valide." };
  }
  if (age < 0) {
    return { statut: "erreur", message: "Cette date est dans le futur." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  if (age < 18) {
    await supabase
      .from("utilisatrice")
      .update({ mineur_detecte: true })
      .eq("id", user.id);
    await supabase.auth.signOut();
    return { statut: "mineur" };
  }

  const { error } = await supabase
    .from("utilisatrice")
    .update({ date_naissance: valeur })
    .eq("id", user.id);
  if (error) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie." };
  }

  redirect("/consentement");
}
