import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";

/**
 * Confirmation du magic link (Story 1.3, AC2). Robuste aux DEUX flux Supabase :
 *  - `?code=…`        → exchangeCodeForSession (template par défaut, PKCE)
 *  - `?token_hash=…`  → verifyOtp (si un template token_hash est configuré)
 * Puis onboarding (Story 1.4) : tant que la date de naissance n'est pas posée
 * (et pas mineure), on dirige vers /naissance.
 */
async function destinationApresAuth(
  supabase: SupabaseClient,
  next: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return next;

  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "mineur") {
    // Barrière persistante : un mineur signalé est refusé à CHAQUE connexion (FR-070).
    await supabase.auth.signOut();
    return "/entrer?refus=age";
  }
  if (etape === "naissance") return "/naissance";
  if (etape === "consentement") return "/consentement";
  return next; // suite
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(await destinationApresAuth(supabase, next), origin),
      );
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(
        new URL(await destinationApresAuth(supabase, next), origin),
      );
    }
  }

  return NextResponse.redirect(new URL("/entrer?erreur=lien", origin));
}
