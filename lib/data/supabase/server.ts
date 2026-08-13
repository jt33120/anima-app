import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { OPTIONS_COOKIE_SESSION } from "./cookies-session";

/**
 * Client Supabase SERVEUR — scopé à l'utilisatrice via ses cookies de session, RLS active.
 *
 * AD-2  : seul le serveur parle à Supabase ; la clé n'est jamais exposée au client.
 * AD-12 : accès au contenu utilisateur SOUS RLS, via le JWT porté par les cookies.
 *         La clé service_role n'est JAMAIS utilisée ici (elle contournerait la RLS).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Le cookie porte l'access_token ET le refresh_token : il ne doit être ni lisible par le
      // JavaScript de page, ni transmis en clair (voir `cookies-session.ts`).
      cookieOptions: OPTIONS_COOKIE_SESSION,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll appelé depuis un Server Component : ignorable si le refresh
            // de session est géré par le middleware (à venir dans une story ultérieure).
          }
        },
      },
    },
  );
}
