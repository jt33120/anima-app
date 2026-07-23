"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";

export type EtatConsentement = { statut: "saisie" | "erreur"; message?: string };

/**
 * « Je commence » (AC5). Re-valide CÔTÉ SERVEUR que les DEUX accords sont vrais — jamais
 * confiance au client — puis écrit la preuve de consentement SOUS la session RLS (AD-12).
 * Idempotent (upsert sur la PK utilisatrice_id). Débloque l'entrée dans la scène (FR-072).
 */
export async function donnerConsentement(
  _prev: EtatConsentement,
  formData: FormData,
): Promise<EtatConsentement> {
  const art9 = formData.get("art9") === "on";
  const cgu = formData.get("cgu") === "on";
  if (!art9 || !cgu) {
    // Ne devrait pas arriver (bouton désactivé) : garde-fou serveur.
    return { statut: "erreur", message: "Coche les deux accords pour continuer." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const { error } = await supabase.from("consentement").upsert(
    {
      utilisatrice_id: user.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    },
    { onConflict: "utilisatrice_id" },
  );
  if (error) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie." };
  }

  redirect("/"); // la scène (prototype) — l'entrée est débloquée
}

/**
 * « Je ne veux pas » (AC6). Suppression IMMÉDIATE du compte — tâche système isolée via
 * l'API admin (`deleteUser`), jamais `service_role` sur du contenu (AD-12) ; aucun art. 9
 * n'existe encore. On ne supprime que SON propre compte (getUser d'abord). Le
 * `on delete cascade` propage à `utilisatrice` puis `consentement`. Puis on nettoie les
 * cookies (signOut) et on sort. Aucune rétention, aucune reconquête (registre non culpabilisant).
 */
export async function refuser(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  await supabase.auth.signOut(); // efface les cookies de session dans tous les cas

  if (error) redirect("/entrer?erreur=suppression");
  redirect("/entrer");
}
