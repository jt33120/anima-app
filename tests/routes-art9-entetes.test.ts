import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.1 — les routes art. 9 : `no-store`/`dynamic` + CSP stricte (AC5, AD-4, NFR-002/NFR-020).
 * Aucun moniteur/APM tiers, aucun SDK fournisseur importé par une route.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function routesApi(): string[] {
  return (readdirSync(resolve(racine, "app/api"), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => resolve(racine, "app/api", f));
}

const ROUTE_ART9 = resolve(racine, "app/api/anam/message/route.ts");
const ENTETES = resolve(racine, "lib/ai/entetes-art9.ts");

describe("Routes art. 9 — no-store + CSP stricte + zéro tiers (AC5)", () => {
  it("la route art. 9 force le no-cache (dynamic / fetchCache / runtime nodejs)", () => {
    const s = lire(ROUTE_ART9);
    expect(s).toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
    expect(s).toMatch(/export const fetchCache\s*=\s*["']force-no-store["']/);
    expect(s).toMatch(/export const runtime\s*=\s*["']nodejs["']/);
  });

  it("la route art. 9 applique les en-têtes art. 9 (no-store + CSP)", () => {
    expect(lire(ROUTE_ART9)).toMatch(/ENTETES_ART9/);
  });

  it("la CSP art. 9 verrouille connect-src 'self' sans aucun hôte tiers", () => {
    const s = lire(ENTETES);
    expect(s).toMatch(/["']Cache-Control["']/);
    expect(s).toMatch(/no-store/);
    expect(s).toMatch(/connect-src 'self'/);
    expect(s).toMatch(/frame-ancestors 'none'/);
    expect(s).toMatch(/object-src 'none'/);
    // aucune origine externe (http(s)://…) dans la CSP.
    expect(s).not.toMatch(/https?:\/\//);
  });

  it("AUCUNE route API n'importe un SDK fournisseur ni un traceur/APM", () => {
    const routes = routesApi();
    expect(routes.length).toBeGreaterThan(0);
    for (const f of routes) {
      const s = lire(f);
      expect(s, `SDK fournisseur dans ${f}`).not.toMatch(/@mistralai\/mistralai/);
      expect(s, `traceur/APM dans ${f}`).not.toMatch(
        /analytics|gtag|mixpanel|posthog|plausible|sentry|datadog/i,
      );
    }
  });
});
