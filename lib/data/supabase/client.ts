import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase NAVIGATEUR — clé publique uniquement.
 * Ne détient JAMAIS la clé service_role (AD-2, AD-12).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
