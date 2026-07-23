import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/data/supabase/middleware";

// Rafraîchit la session à chaque requête (Story 1.3). Aucune protection de route
// ici (viendra plus tard) — uniquement le maintien de session (AC4).
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Exclut les assets statiques (pas de refresh de session inutile dessus).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|scene/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
