"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";

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

/**
 * DEV UNIQUEMENT — Entrée sans email (le magic link built-in de Supabase ne délivre pas
 * sans SMTP ; en local, aucun mail réel n'est envoyé). Neutralisée en production : le
 * bouton n'est pas rendu ET l'action se dérobe.
 *
 * Compte démo à mot de passe fixe. L'admin (tâche système AUTH, JAMAIS du contenu → AD-12
 * respecté) garantit le compte + son mot de passe ; puis on ouvre une VRAIE session RLS
 * (signInWithPassword) qui pose les cookies — chemin robuste, vérifié de bout en bout.
 * La démo est ensuite pré-onboardée SOUS RLS (elle se consent à elle-même) → elle arrive
 * DIRECTEMENT dans la scène, sans repasser par le tunnel.
 */
export async function entreeDemo(): Promise<void> {
  if (process.env.NODE_ENV === "production") redirect("/entrer");
  const email = process.env.DEMO_EMAIL || "demo@anam.local";
  const password = process.env.DEMO_PASSWORD || "demo-anam-local-000";

  // 1. Garantir le compte démo AVEC ce mot de passe (idempotent).
  const admin = createSupabaseAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    // Existe déjà → (re)poser le mot de passe pour garantir la connexion.
    const { data } = await admin.auth.admin.listUsers();
    const existant = data?.users?.find((u) => u.email === email);
    if (existant) {
      await admin.auth.admin.updateUserById(existant.id, { password, email_confirm: true });
    }
  }

  // 2. Ouvrir la session côté serveur RLS → pose les cookies (comme un vrai login).
  const supabase = await createSupabaseServerClient();
  const { data: sign, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signErr || !sign.user) redirect("/entrer?erreur=demo");

  // 3. Pré-onboarder la démo SOUS RLS (jamais l'admin sur du contenu → AD-12) : elle pose
  //    sa propre date (seulement si nulle — immuable ensuite, AD-6) et son consentement
  //    (idempotent). Résultat : état « suite » → la scène directement.
  const uid = sign.user.id;
  await supabase
    .from("utilisatrice")
    .update({ date_naissance: "1990-01-01" })
    .eq("id", uid)
    .is("date_naissance", null);
  await supabase.from("consentement").upsert(
    {
      utilisatrice_id: uid,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
      revoked_at: null,
    },
    { onConflict: "utilisatrice_id" },
  );

  redirect("/"); // → la scène
}
