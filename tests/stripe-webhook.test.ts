import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 3.1 (T3) — la route Webhook (`app/api/stripe/webhook/route.ts`). Non invocable en env node
 * → gardes de LECTURE DE SOURCE : runtime Node, CORPS BRUT (jamais `req.json()`), signature vérifiée
 * AVANT tout accès DB, projection via le dépôt écrivain-unique, codes 400 (signature)/500 (rejeu).
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const src = sansCommentaires(readFileSync(resolve(racine, "app/api/stripe/webhook/route.ts"), "utf-8"));

describe("Story 3.1 — route Webhook : raw body, signature avant DB, idempotence (AC2/AC3)", () => {
  it("runtime Node (crypto de constructEvent), jamais Edge", () => {
    expect(src).toMatch(/runtime\s*=\s*["']nodejs["']/);
  });

  it("lit le CORPS BRUT (request.text), JAMAIS request.json() (sinon signature HMAC cassée)", () => {
    expect(src).toMatch(/request\.text\(\)/);
    expect(src, "request.json() re-stringifierait le corps et casserait la signature").not.toMatch(
      /request\.json\(\)|req\.json\(\)/,
    );
  });

  it("en-tête stripe-signature lu depuis la requête", () => {
    expect(src).toMatch(/stripe-signature/);
  });

  it("vérifie la SIGNATURE avant tout accès DB (ordre)", () => {
    const iSig = src.indexOf("verifierEvenementStripe");
    const iDb = src.indexOf("creerDepotAbonnement");
    expect(iSig, "vérif de signature présente").toBeGreaterThan(-1);
    expect(iDb, "projection DB présente").toBeGreaterThan(-1);
    expect(iSig, "la signature est vérifiée AVANT la projection DB").toBeLessThan(iDb);
  });

  it("signature invalide → 400 ; projection via dépôt écrivain-unique ; erreur DB → 500 (rejeu Stripe)", () => {
    expect(src).toMatch(/400/);
    expect(src).toMatch(/traiterEvenement/);
    expect(src).toMatch(/500/);
  });
});
