"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { lireAccords } from "./accords";

export type EtatConsentement = { statut: "saisie" | "erreur"; message?: string };

/**
 * « Je commence » (AC5). Re-valide CÔTÉ SERVEUR que (1) les DEUX accords sont vrais — jamais
 * confiance au client — ET (2) l'onboarding en est bien à l'étape consentement (date posée,
 * majeure), via la source de vérité partagée `etapeOnboardingPour` (anti-divergence). Puis
 * écrit la preuve SOUS la session RLS (AD-12). Idempotent (upsert sur la PK utilisatrice_id).
 */
export async function donnerConsentement(
  _prev: EtatConsentement,
  formData: FormData,
): Promise<EtatConsentement> {
  const { art9, cgu } = lireAccords(formData);
  if (!art9 || !cgu) {
    // Ne devrait pas arriver (bouton désactivé) : garde-fou serveur.
    return { statut: "erreur", message: "Coche les deux accords pour continuer." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  // Garde d'état : on n'écrit un consentement QUE si l'onboarding est à cette étape. Empêche
  // un POST direct de persister une preuve (+ « 18 ans confirmé ») pour un compte sans date
  // ou mineur — l'action est un endpoint indépendant, non protégé par le middleware.
  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "suite") redirect("/"); // déjà consenti

  const { error } = await supabase.from("consentement").upsert(
    {
      utilisatrice_id: user.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
      revoked_at: null, // re-consentir efface une révocation éventuelle (évite la boucle en 1.6)
    },
    { onConflict: "utilisatrice_id" },
  );
  if (error) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie." };
  }

  redirect("/"); // la scène (prototype) — l'entrée est débloquée
}

/**
 * « Je ne veux pas » (AC6). Suppression IMMÉDIATE du compte — tâche système isolée via l'API
 * admin (`deleteUser`), jamais `service_role` sur du contenu (AD-12) ; aucun art. 9 n'existe
 * encore. On ne supprime que SON propre compte (getUser d'abord). En cas d'ÉCHEC : on NE
 * détruit PAS la session (elle permet de réessayer) et on le dit clairement — jamais
 * d'effacement silencieux sur un chemin RGPD. Succès SEULEMENT : signOut + sortie. Le
 * `on delete cascade` propage à `utilisatrice` puis `consentement`. Registre non culpabilisant.
 */
export async function refuser(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    // Session conservée (réessai possible), message explicite sur la halte.
    redirect("/consentement?erreur=suppression");
  }

  await supabase.auth.signOut(); // succès : on nettoie les cookies
  redirect("/entrer");
}
