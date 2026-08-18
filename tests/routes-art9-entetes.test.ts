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
    // ⚠️ AUCUNE ORIGINE EXTERNE DANS UNE DIRECTIVE QUI PORTE DE LA DONNÉE — et la garde a dû
    // devenir PRÉCISE plutôt que de céder (revue adversariale, R6).
    //
    // Elle refusait tout `http(s)://` dans le fichier, ce qui était une bonne approximation tant
    // qu'aucun hôte tiers n'y avait sa place. `form-action` en a désormais un : `form-action` suit
    // TOUTE la chaîne de redirection d'une soumission, et le paiement redirige vers la session
    // hébergée de Stripe — sans cet hôte, le seul chemin d'abonnement du produit est mort sur
    // Chrome et Safari (mesuré le 2026-08-18).
    //
    // Ce qui compte n'a pas bougé d'un pouce : soumettre un formulaire ne transporte pas d'art. 9
    // vers un tiers, ouvrir une socket, si. Les directives qui portent de la donnée restent
    // hermétiques, une par une, et la seule ouverture est nommée et bornée à un hôte exact.
    for (const directive of ["connect-src", "img-src", "script-src", "default-src", "style-src", "font-src"]) {
      const lignes = s.split("\n").filter((l) => l.includes(`${directive} `));
      expect(lignes.length, `la directive ${directive} doit exister pour être gardée`).toBeGreaterThan(0);
      for (const l of lignes) {
        expect(l, `origine externe dans ${directive}`).not.toMatch(/https?:\/\//);
      }
    }
    // La seule ouverture tolérée, nommée : un hôte exact, aucun joker, et dans `form-action` seule.
    const externes = [...s.matchAll(/https?:\/\/[^\s"'`,]+/g)].map((m) => m[0]);
    expect(externes, "un seul hôte externe, et c'est celui du paiement").toEqual([
      "https://checkout.stripe.com",
    ]);
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

describe("Route de conversation en streaming (Story 2.2, AC2/AC3/AC4)", () => {
  const s = lire(ROUTE_ART9);

  it("répond en flux NDJSON (pas une réponse JSON complète)", () => {
    expect(s).toMatch(/application\/x-ndjson/);
    expect(s).toMatch(/new ReadableStream/);
  });

  it("passe par l'egress-guard STREAMING (gardes art. 9 avant le 1er octet)", () => {
    expect(s).toMatch(/diffuserSousEgressArt9/);
  });

  it("résout le tier CÔTÉ SERVEUR et ne le lit JAMAIS du corps client (AD-5, anti-injection)", () => {
    expect(s).toMatch(/tierPour\(/); // la politique unique est appelée dans la route
    expect(s).toMatch(/CAPACITE[:\s]*(?:CapaciteIa\s*=\s*)?["']echange["']/); // capacité = constante serveur
    // Le tier dérive d'une capacité SERVEUR (`capaciteGeneration`), jamais du client. Depuis 2.7 elle
    // vaut la constante `CAPACITE` sauf en phase nommer (reconceptualisation) — décidée serveur.
    expect(s).toMatch(/tierPour\(capaciteGeneration/);
    expect(s).toMatch(/capaciteGeneration[^=]*=[^;]*CAPACITE/); // retombe sur la constante serveur
    // le corps client n'est lu QUE via extraireMessages — jamais un tier/niveau/capacité client :
    expect(s).toMatch(/extraireMessages\(/);
    expect(s, "tier lu du corps client").not.toMatch(/corps\s*[.[]\s*["']?tier/);
    expect(s, "niveau lu du corps client").not.toMatch(/corps\s*[.[]\s*["']?niveauSecurite/);
    expect(s, "capacité lue du corps client").not.toMatch(/corps\s*[.[]\s*["']?capacite/);
  });

  it("métré APRÈS la réponse via after() (survit au serverless), source honnête resoudreMetrage (NFR-014)", () => {
    expect(s).toMatch(/metrerUsageIa/);
    expect(s).toMatch(/\bafter\(/); // métrage post-réponse, jamais après un close() perdu au gel serverless
    expect(s).toMatch(/resoudreMetrage/); // décision de métrage honnête (fin.modele autoritaire)
    expect(s).toMatch(/crypto\.randomUUID/); // clé d'idempotence SERVEUR
  });
});
