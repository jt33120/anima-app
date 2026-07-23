import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit silencieusement la session à chaque requête (Story 1.3, AC4).
 *
 * `getUser()` — JAMAIS `getSession()` en code serveur : getUser revalide le token
 * auprès du serveur Auth et le rafraîchit s'il a expiré. C'est ce qui garantit une
 * session longue sans ré-authentification qui interrompt (WCAG 2.2.1).
 * Clé publishable + cookies uniquement ; jamais service_role (AD-2, AD-12).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}
