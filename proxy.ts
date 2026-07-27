import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/data/supabase/middleware";
import { cspPageArt9 } from "@/lib/ai/entetes-art9";

/**
 * proxy.ts (Next 16 — ex-`middleware.ts`) : deux responsabilités par requête.
 *  1. Rafraîchir la session Supabase (Story 1.3, AC4) — via `updateSession`.
 *  2. Poser la CSP NONCE des PAGES art. 9 (Story 2.2, B1) — LE verrou anti-exfiltration effectif.
 *
 * ⚠️ Un proxy tourne TOUJOURS en Node : **aucun `export const runtime`** (sinon erreur de build
 * E1031 « Route segment config is not allowed in Proxy file »). Le nonce est posé sur la REQUÊTE
 * (`x-nonce` + en-tête CSP) — indispensable pour que Next nonce ses scripts d'hydratation RSC,
 * sinon ÉCRAN BLANC — ET sur la RÉPONSE (le navigateur applique la CSP d'un document).
 *
 * `/api` est exclu de la CSP de page : la route art. 9 pose ses propres en-têtes (`ENTETES_ART9`)
 * et une CSP ne s'applique pas à une réponse `fetch`. La session, elle, se rafraîchit partout.
 */
export async function proxy(request: NextRequest) {
  // Une CSP de PAGE n'a de sens que sur un document (pas /api). `/api/` exact (pas `/apiX…`) pour ne
  // pas priver de CSP une future route racine commençant par « api ». La session tourne dans les 2 cas.
  const { pathname } = request.nextUrl;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return await updateSession(request);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = cspPageArt9(nonce, { dev: process.env.NODE_ENV !== "production" });

  // Nonce + CSP AJOUTÉS aux en-têtes de la requête propagée (updateSession les merge sur des
  // `request.headers` relus à chaque fois → cookies frais préservés). Sur la REQUÊTE, la CSP est ce
  // dont Next EXTRAIT le nonce pour signer ses scripts d'hydratation RSC (sinon écran blanc).
  const response = await updateSession(request, {
    "x-nonce": nonce,
    "Content-Security-Policy": csp,
  });
  // Sur la RÉPONSE : la CSP que le navigateur applique réellement au document.
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Exclut les assets statiques (pas de refresh de session ni de CSP dessus). `/api` N'EST PAS
  // exclu ici (la session s'y rafraîchit) ; la CSP de page y est écartée dans `proxy` ci-dessus.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|scene/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
