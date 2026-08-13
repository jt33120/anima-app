import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";

/**
 * Confirmation du magic link (Story 1.3, AC2), puis onboarding (Story 1.4) : tant que la date de
 * naissance n'est pas posée (et pas mineure), on dirige vers /naissance.
 *
 * ══ UN SEUL FLUX, ET C'EST LE SUJET (revue du 2026-08-13) ═══════════════════════════════════════
 *
 * Cette route acceptait DEUX flux : `?code=` (PKCE) et `?token_hash=` (verifyOtp). Le second a été
 * RETIRÉ, parce qu'il permettait d'installer la session de quelqu'un d'autre dans le navigateur de
 * la personne qui clique. Éprouvé contre un vrai Supabase, de bout en bout :
 *
 *   1. l'attaquant demande un lien magique POUR SA PROPRE adresse ;
 *   2. il ouvre son courriel et en extrait le `token_hash` (le gabarit par défaut le contient) ;
 *   3. il envoie à la victime `…/auth/confirm?token_hash=<le sien>&type=magiclink` ;
 *   4. `verifyOtp` a RENDU UNE SESSION à un client neuf, sans le moindre `code_verifier`.
 *      Mesuré : « SESSION RENDUE : OUI », `getUser()` renvoyant l'adresse de l'ATTAQUANT.
 *
 * La victime navigue alors dans le compte de l'attaquant sans rien voir — et tout ce qu'elle
 * confie ensuite à Anam, c'est-à-dire de l'article 9, s'écrit chez lui, qui le relira.
 *
 * C'est très exactement ce que PKCE empêche : `exchangeCodeForSession` exige le cookie
 * `code-verifier` posé sur LE navigateur qui a demandé le lien. Garder à côté une porte qui ne le
 * demande pas annulait la garantie — la serrure était bonne, la fenêtre était ouverte.
 *
 * Vérifié avant de retirer : le projet de lancement n'utilise AUCUN gabarit personnalisé
 * (`mailer_templates_custom_contents` : tout à `false`), donc les liens partent avec
 * `{{ .ConfirmationURL }}`, qui passe par le `/auth/v1/verify` de Supabase et revient ici en
 * `?code=`. Le chemin retiré n'était emprunté par personne.
 */

/**
 * La destination après connexion, ramenée de force sur NOTRE origine.
 *
 * `new URL(next, origin)` n'est PAS une garde : la base est ignorée dès que `next` est absolu ou
 * protocol-relatif. Mesuré, avec `origin = https://anima.example` :
 *
 *     "https://evil.example"  →  https://evil.example/
 *     "//evil.example"        →  https://evil.example/
 *     "/\evil.example"        →  https://evil.example/     ← commence pourtant par « / »
 *
 * La troisième forme est la raison pour laquelle on ne teste PAS `next.startsWith("/")` : elle
 * passerait. On compare l'origine résolue, et on ne garde que le chemin.
 *
 * L'enjeu n'est pas théorique : la redirection s'exécute à la seconde où la personne vient
 * d'accorder sa confiance au lien reçu — le moment idéal pour lui servir une fausse page Anima.
 */
export function destinationSure(next: string, origin: string): string {
  let cible: URL;
  try {
    cible = new URL(next, origin);
  } catch {
    return "/";
  }
  if (cible.origin !== origin) return "/";
  return `${cible.pathname}${cible.search}${cible.hash}`;
}
async function destinationApresAuth(
  supabase: SupabaseClient,
  next: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return next;

  const etape = await etapeOnboardingPour(supabase, user.id);
  // Minorité DÉTECTÉE après coup (1.9, FR-071) : compte suspendu → /barriere, sans signOut
  // (l'export a besoin de la session). Prime sur tout.
  if (etape === "barre") return "/barriere";
  if (etape === "mineur") {
    // Barrière persistante : un mineur signalé est refusé à CHAQUE connexion (FR-070).
    await supabase.auth.signOut();
    return "/entrer?refus=age";
  }
  if (etape === "naissance") return "/naissance";
  if (etape === "consentement") return "/consentement";
  if (etape === "revoque") return "/consentement/revoque";
  return next; // suite
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = destinationSure(searchParams.get("next") ?? "/", origin);

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(await destinationApresAuth(supabase, next), origin),
      );
    }
  }

  return NextResponse.redirect(new URL("/entrer?erreur=lien", origin));
}
