import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

/**
 * Confirmation du magic link (Story 1.3, AC2). Robuste aux DEUX flux Supabase :
 *  - `?code=…`        → exchangeCodeForSession (template par défaut, PKCE)
 *  - `?token_hash=…`  → verifyOtp (si un template token_hash est configuré)
 * verifyOtp/exchange établit la session (cookies). La ligne `utilisatrice` a déjà
 * été créée par le trigger DB au signup (AD-12).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/entrer?erreur=lien", origin));
}
