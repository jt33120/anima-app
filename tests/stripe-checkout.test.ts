import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 3.1 (T2) — la route Checkout (`app/api/stripe/checkout/route.ts`). Non invocable en env node
 * (Stripe + Supabase server) → gardes de LECTURE DE SOURCE : runtime Node, auth d'abord, garde AD-9
 * AVANT la création de session, montant via la constante partagée (jamais un flottant €), mapping
 * `subscription_data.metadata` (résolution utilisatrice sans dépendance d'ordre), libellé via config.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const src = sansCommentaires(readFileSync(resolve(racine, "app/api/stripe/checkout/route.ts"), "utf-8"));

describe("Story 3.1 — route Checkout : session hébergée, garde AD-9, secret confiné (AC1, AC6)", () => {
  it("runtime Node + dynamic (secret serveur, jamais Edge ni cache)", () => {
    expect(src).toMatch(/runtime\s*=\s*["']nodejs["']/);
    expect(src).toMatch(/dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("auth d'abord : getUser, puis la PORTE (jamais un 401 nu — revue 1-4, #16)", () => {
    expect(src).toMatch(/getUser\(\)/);
    // L'effet est exercé dans `stripe-checkout-garde.test.ts` ; ici on tient l'ORDRE.
    // ⚠️ ANCRÉ SUR L'APPEL, PAS SUR LE NOM : `indexOf("limitesCommercialesLevees")` attrapait la
    // ligne d'IMPORT en tête de fichier, donc l'ordre mesuré n'était jamais celui du code exécuté.
    expect(src.indexOf("getUser()")).toBeLessThan(src.indexOf("await limitesCommercialesLevees("));
  });

  it("garde AD-9 : la CONDITION limitesCommercialesLevees mène au REFUS, AVANT la session (effet exercé dans stripe-checkout-garde.test)", () => {
    // Condition→destination liées dans UNE regex (refuse la négation `if (!(await …))` et le résultat jeté).
    // La destination a changé de FORME, pas de rôle : `vente_fermee` au lieu d'un 409 en JSON (#16).
    expect(src, "la garde doit être branchée dans un `if (await …)` menant au refus").toMatch(
      /if\s*\(\s*await\s+limitesCommercialesLevees\([^)]*\)\s*\)[\s\S]{0,400}?vente_fermee/,
    );
    // + ordre : la garde précède la création de session.
    expect(src.indexOf("limitesCommercialesLevees")).toBeLessThan(src.indexOf("checkout.sessions.create"));
  });

  it("session hébergée `subscription`, montant COUPLÉ à la constante partagée (jamais un flottant €)", () => {
    expect(src).toMatch(/mode:\s*["']subscription["']/);
    // Couplage direct en UNE assertion : unit_amount reçoit exactement la constante (pas un chiffre).
    expect(src).toMatch(/unit_amount:\s*PRIX_ABONNEMENT_ANNUEL_CENTIMES/);
    expect(src, "aucun montant en dur").not.toMatch(/unit_amount:\s*\d/);
  });

  it("aucune clé d'idempotence STATIQUE dérivée du seul user.id (sinon session Stripe en cache 24 h)", () => {
    expect(src, "clé statique `checkout:${user.id}` → réabonnement bloqué 24 h").not.toMatch(
      /idempotencyKey:\s*[`"']checkout:\$\{user\.id\}[`"']/,
    );
  });

  it("mapping SANS dépendance d'ordre : subscription_data.metadata porte l'utilisatrice", () => {
    expect(src).toMatch(/subscription_data/);
    expect(src).toMatch(/utilisatriceId/);
    expect(src).toMatch(/client_reference_id/);
  });

  it("libellé de relevé lu depuis config, jamais codé en dur (AC6)", () => {
    expect(src).toMatch(/libelleReleveBancaire\(\)/);
  });

  it("redirige vers session.url en 303 (page hébergée Stripe)", () => {
    expect(src).toMatch(/redirect\(session\.url,\s*303\)/);
  });
});
