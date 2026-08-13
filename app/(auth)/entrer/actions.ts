"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { appliquerBarriereMinorite } from "@/lib/safety/appliquer-barriere";
import { origineDuSite } from "@/lib/courriel/origine";

export type EtatEntree = { ok: boolean; message?: string };

/** Les seuls hôtes pour lesquels `http:` reste acceptable — miroir de `lib/courriel/origine.ts`. */
const HOTES_LOCAUX = new Set(["localhost", "127.0.0.1"]);

/**
 * L'origine sur laquelle le lien de connexion ramènera — CONFIGURÉE d'abord, déduite ensuite.
 *
 * ── CE QUI A ÉTÉ TROUVÉ (revue du 2026-08-13) ──────────────────────────────────────────────────
 *
 * Le lien était construit ainsi :
 *
 *     const proto = h.get("x-forwarded-proto") ?? "http";
 *
 * Le repli sur `"http"` est un repli OUVERT : quand l'en-tête manque — proxy mal réglé, edge
 * intermédiaire, exécution hors Vercel — le lien de connexion part EN CLAIR par courriel. Il est
 * alors interceptable, et il rétrograde la session vers une origine non chiffrée.
 *
 * Le contraste interne est ce qui rend le défaut net : `lib/courriel/origine.ts` refuse déjà
 * exactement ça (« un lien en clair dans un courriel est interceptable et rétrogradable ») — mais
 * il ne gardait QUE le courriel de synthèse. Le courriel de CONNEXION, celui qui ouvre le compte,
 * n'en bénéficiait pas. On lui donne le même validateur, et le repli déduit passe en `https` sauf
 * pour un hôte local nommé.
 */
async function origineDuLien(): Promise<string> {
  const configuree = origineDuSite();
  if (configuree) return configuree;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = HOTES_LOCAUX.has(host.split(":")[0]);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origineDuLien()}/auth/confirm` },
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
async function assurerSessionDemoConsentie(
  email = process.env.DEMO_EMAIL || "demo@anam.local",
): Promise<string> {
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
  //    (idempotent). Résultat : état « suite ».
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

  return uid;
}

/**
 * DEV UNIQUEMENT — Entrée sans email (le magic link built-in de Supabase ne délivre pas
 * sans SMTP ; en local, aucun mail réel n'est envoyé). Neutralisée en production : le
 * bouton n'est pas rendu ET l'action se dérobe. La démo pré-onboardée arrive DIRECTEMENT
 * dans la scène, sans repasser par le tunnel.
 */
export async function entreeDemo(): Promise<void> {
  // Refus écrit à l'ENVERS, exprès : la forme naturelle (`=== "production"`) échoue OUVERT
  // quand `NODE_ENV` manque, et cette porte ouvre un client `service_role` depuis une page
  // publique. Écrite ainsi, une variable absente REFUSE.
  if (process.env.NODE_ENV !== "development") redirect("/entrer");
  await assurerSessionDemoConsentie();
  redirect("/"); // → la scène
}

/**
 * DEV UNIQUEMENT (Story 1.9) — Entrer dans un compte SUSPENDU pour minorité détectée, afin de
 * VOIR l'écran /barriere sans attendre le classifieur (Epic 2). Neutralisée en production.
 * On applique la barrière sur SON PROPRE compte (self) : `appliquerBarriereMinorite` n'est jamais
 * exposée avec un uid arbitraire côté client (elle est `server-only`).
 */
export async function entreeDemoSuspendue(): Promise<void> {
  // Refus écrit à l'ENVERS, exprès : la forme naturelle (`=== "production"`) échoue OUVERT
  // quand `NODE_ENV` manque, et cette porte ouvre un client `service_role` depuis une page
  // publique. Écrite ainsi, une variable absente REFUSE.
  if (process.env.NODE_ENV !== "development") redirect("/entrer");
  // Compte démo DÉDIÉ (jamais le compte démo normal) : la barrière n'étant jamais levée en Epic 1
  // (le moteur de rétention = Story 6.8), suspendre le compte partagé le laisserait « barre » à
  // vie et le bouton « démo » normal atterrirait ensuite toujours sur /barriere (revue 1.9).
  const uid = await assurerSessionDemoConsentie(
    process.env.DEMO_EMAIL_SUSPENDU || "demo-suspendu@anam.local",
  );
  await appliquerBarriereMinorite(uid); // injection contrôlée du drapeau (le vrai détecteur = Epic 2)
  redirect("/barriere"); // → l'écran de suspension
}
