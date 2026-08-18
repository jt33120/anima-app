"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { destinationApresAuth } from "@/app/(auth)/destination-apres-auth";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { appliquerBarriereMinorite } from "@/lib/safety/appliquer-barriere";
import { origineDuSite } from "@/lib/courriel/origine";

/**
 * `ok` — le courriel est parti, l'écran passe à la saisie du code. `adresse` sert UNIQUEMENT à
 * l'afficher : « J'ai envoyé un code à toi@exemple.fr ». C'est une garde, pas un ornement — voir
 * `COOKIE_ATTENTE` ci-dessous.
 */
export type EtatEntree = { ok: boolean; message?: string; adresse?: string };
export type EtatCode = { message?: string };

/**
 * ══ LE CODE À SIX CHIFFRES — POURQUOI, ET CE QUI LE REND SÛR ══════════════════════════════════
 *
 * Le lien magique seul est PKCE : `exchangeCodeForSession` exige un cookie posé sur LE navigateur
 * qui a demandé le lien. Demander sur l'ordinateur, ouvrir le courriel sur le téléphone, et la
 * porte se ferme — « lien invalide », sans explication. C'est le cas le plus banal du monde, et
 * c'est celui qui a empêché Julian de se reconnecter le 15/08 (deux liens sur trois perdus).
 *
 * Le code répare exactement ça : il voyage par les YEUX. Il se lit où le courriel arrive, il se
 * tape où la demande a été faite. La propriété « même navigateur » est donc CONSERVÉE, pas
 * abandonnée — c'est ce qui distingue cette porte de celle que la revue du 2026-08-13 a condamnée.
 *
 * ⚠️ CE QUE LE COOKIE EMPÊCHE, ET C'EST TOUT SON OBJET. L'attaque retirée en août consistait à
 * envoyer à quelqu'un une URL portant le `token_hash` de l'ATTAQUANT : la victime cliquait et se
 * retrouvait, sans le voir, dans le compte de l'attaquant — où tout ce qu'elle confierait ensuite à
 * Anam, c'est-à-dire de l'article 9, s'écrirait chez lui.
 *
 * Ici, l'adresse vérifiée NE VIENT JAMAIS DU FORMULAIRE. Elle est lue dans un cookie `httpOnly`
 * posé au moment de la demande. Un attaquant ne peut donc pas faire vérifier SON code contre une
 * session qu'il choisit : il faudrait qu'il pose le cookie dans le navigateur de la victime ET
 * qu'elle tape un code qu'elle n'a pas reçu. L'écran affiche par-dessus l'adresse visée — si ce
 * n'est pas la sienne, elle le voit avant de taper.
 *
 * ⚠️ LA LIMITE DE FORCE BRUTE N'EST PAS ICI, ET IL FAUT LE DIRE. Six chiffres, c'est un million de
 * possibilités. Le compteur d'essais ci-dessous sert l'UTILISATRICE (« tu t'es trompée, redemande
 * un code ») — il ne défend rien, puisqu'il vit dans un cookie que celui qu'on craint contrôle. Ce
 * qui défend est côté Supabase : `rate_limit_verify = 30` par tranche de cinq minutes et par IP,
 * mesuré sur le projet le 2026-08-18. Un million d'essais à ce rythme demande des mois. Écrire ici
 * une garde qui ne garde pas serait pire que de ne rien écrire : ça ferait cesser de chercher.
 */
const COOKIE_ATTENTE = "anam_entree_attente";
/** Aligné sur `mailer_otp_exp` du projet (3 600 s, mesuré le 2026-08-18) : le cookie ne survit pas au code. */
const DUREE_ATTENTE_S = 3600;
/** Ce qu'on tolère avant de renvoyer demander un code neuf. Confort, pas garde — voir ci-dessus. */
const ESSAIS_MAX = 5;

type Attente = { readonly adresse: string; readonly essais: number };

async function lireAttente(): Promise<Attente | null> {
  const brut = (await cookies()).get(COOKIE_ATTENTE)?.value;
  if (!brut) return null;
  try {
    const v = JSON.parse(brut) as Partial<Attente>;
    if (typeof v.adresse !== "string" || !v.adresse.includes("@")) return null;
    return { adresse: v.adresse, essais: typeof v.essais === "number" ? v.essais : 0 };
  } catch {
    return null;
  }
}

async function poserAttente(attente: Attente | null): Promise<void> {
  const jar = await cookies();
  if (!attente) {
    jar.delete(COOKIE_ATTENTE);
    return;
  }
  jar.set(COOKIE_ATTENTE, JSON.stringify(attente), {
    httpOnly: true,
    // ⚠️ ÉCRIT À L'ENVERS, EXPRÈS — et c'est une garde de ce dépôt qui me l'a fait corriger.
    // La forme naturelle (`=== "production"`) rend `false` quand `NODE_ENV` manque : le cookie
    // partirait alors SANS `Secure` sur un déploiement réel, donc en clair. Écrite ainsi, une
    // variable absente donne `Secure`. Le seul cas qui l'abaisse est nommé : `development`, où le
    // site est en http://localhost et où un cookie `Secure` ne serait jamais posé.
    // Même patron que les portes de démo plus bas, et `tests/auth-magic-link.test.ts` le vérifie.
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_ATTENTE_S,
  });
}

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
  // Le courriel porte DEUX portes : le lien (PKCE, ce navigateur-ci) et le code (n'importe quel
  // appareil pour le LIRE, ce navigateur-ci pour le TAPER). On note l'adresse visée.
  await poserAttente({ adresse: email, essais: 0 });
  return { ok: true, adresse: email };
}

/**
 * Vérifie le code à six chiffres et ouvre la session.
 *
 * ⚠️ `type: "email"` — MESURÉ, PAS SUPPOSÉ. `EmailOtpType` en propose six ; le 2026-08-18, contre
 * le stack local, `verifyOtp({ email, token, type: "email" })` a rendu une session sur un client
 * NEUF (aucun `code_verifier`), ce qui est précisément la propriété inter-appareils recherchée.
 * `magiclink` et `signup` n'ont pas été départagés — le code est à usage unique, et le premier
 * essai a réussi. Si l'un d'eux devenait nécessaire, le test d'intégration le dira.
 */
export async function verifierCode(_prev: EtatCode, formData: FormData): Promise<EtatCode> {
  const attente = await lireAttente();
  // Le cookie a expiré, ou on arrive ici sans être passée par la demande. On ne devine pas une
  // adresse : sans elle, il n'y a rien à vérifier, et le formulaire repart de zéro.
  if (!attente) {
    return { message: "Ta demande a expiré. Redemande un code, il n'y a rien d'autre à faire." };
  }

  // ⚠️ UNE PLAGE, PAS UN NOMBRE — ET ÇA VIENT D'UN VRAI COURRIEL (2026-08-18).
  //
  // Le stack local envoie six chiffres (`otp_length = 6` dans `config.toml`) ; le projet de
  // PRODUCTION en envoyait HUIT (`mailer_otp_length: 8`, la valeur par défaut de Supabase). Un
  // `!== 6` aurait donc refusé tous les codes réels, et personne n'aurait pu entrer — sur la porte
  // écrite exactement pour réparer une impossibilité d'entrer. Aucun test local n'aurait pu le
  // voir : ce sont deux projets, et le second n'est pas dans le dépôt.
  //
  // La production a été ramenée à 6 pour que l'écran dise vrai. La plage reste, parce que la
  // prochaine dérive de configuration doit dégrader — un code accepté à huit chiffres n'est
  // qu'un code PLUS difficile à deviner — au lieu de fermer la porte à tout le monde (AD-15).
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 8) {
    return { message: "Le code fait six chiffres. Recopie-le tel qu'il est dans le message." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: attente.adresse, // ⚠️ DU COOKIE, JAMAIS DU FORMULAIRE — c'est toute la garde.
    token: code,
    type: "email",
  });

  if (error) {
    const essais = attente.essais + 1;
    if (essais >= ESSAIS_MAX) {
      await poserAttente(null);
      return { message: "Trop d'essais. Redemande un code — celui-là ne sert plus." };
    }
    await poserAttente({ ...attente, essais });
    return { message: "Ce code ne correspond pas. Vérifie-le, ou redemande-en un." };
  }

  await poserAttente(null);
  // LA MÊME machine d'état que le lien magique — jamais une seconde (leçon 1.4).
  redirect(await destinationApresAuth(supabase, "/"));
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
