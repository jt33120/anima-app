"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

export type EtatEntree = { ok: boolean; message?: string };

/**
 * Envoie le magic link (Story 1.3, AC1). SANS mot de passe (FR-073).
 * signInWithOtp avec shouldCreateUser=true (défaut) → crée le compte si besoin.
 * Le message de retour est IDENTIQUE que le compte existe ou non (aucune fuite).
 */
export async function envoyerLien(
  _prev: EtatEntree,
  formData: FormData,
): Promise<EtatEntree> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Entre une adresse e-mail valide." };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${proto}://${host}/auth/confirm` },
  });

  if (error) {
    // Enveloppe neutre, jamais signée Anam (Conventions).
    return { ok: false, message: "L'envoi a échoué. Réessaie dans un instant." };
  }
  return { ok: true };
}
