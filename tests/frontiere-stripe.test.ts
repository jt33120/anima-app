import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 3.1 — la FRONTIÈRE Stripe (AD-2/AD-3), prouvée par lecture de fichiers (miroir de
 * `frontiere-serveur.test.ts`). Le SDK `stripe` et les SECRETS Stripe ne fuient jamais hors de
 * `lib/stripe/`. On grep le nom de package QUOTÉ (attrape `from "stripe"`, `import("stripe")`,
 * `require("stripe")`) et les noms de variables-secrets bruts. Commentaires retirés avant match.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function fichiersTs(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => resolve(racine, dir, f));
}

const tousSource = [...fichiersTs("app"), ...fichiersTs("lib"), ...fichiersTs("render")];
// `lib/stripe/` possède le SDK ; `app/api/stripe/` l'utilise VIA `lib/stripe` (jamais le SDK en direct).
const horsLibStripe = tousSource.filter((f) => !f.includes("/lib/stripe/"));

// Package `stripe` quoté exactement : `"stripe"` / `'stripe'` (pas `@/lib/stripe/...` ni `stripe-signature`).
const PKG_STRIPE = /["']stripe["']/;
const SECRET_STRIPE = /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/;

describe("Frontière Stripe — SDK et secrets confinés à lib/stripe/ (AD-2/AD-3)", () => {
  it("a bien scanné du code applicatif", () => {
    expect(horsLibStripe.length).toBeGreaterThan(10);
  });

  it("SEUL lib/stripe/ importe le SDK `stripe`", () => {
    for (const f of horsLibStripe) {
      expect(lire(f), `SDK stripe hors lib/stripe/ : ${f}`).not.toMatch(PKG_STRIPE);
    }
    // Contrôle positif : lib/stripe/client.ts l'importe bien → la garde n'est pas vide.
    expect(lire(resolve(racine, "lib/stripe/client.ts"))).toMatch(PKG_STRIPE);
  });

  it("aucun SECRET Stripe (clé secrète / secret de webhook) hors de lib/stripe/", () => {
    for (const f of horsLibStripe) {
      expect(lire(f), `secret Stripe hors lib/stripe/ : ${f}`).not.toMatch(SECRET_STRIPE);
    }
    expect(lire(resolve(racine, "lib/stripe/client.ts"))).toMatch(/STRIPE_SECRET_KEY/);
  });

  it("aucun secret Stripe en NEXT_PUBLIC_ (jamais exposé au client, AC1)", () => {
    for (const f of tousSource) {
      expect(lire(f), `secret Stripe public : ${f}`).not.toMatch(/NEXT_PUBLIC_STRIPE_SECRET|NEXT_PUBLIC_STRIPE_WEBHOOK/);
      expect(lire(f), `secret générique public : ${f}`).not.toMatch(/NEXT_PUBLIC_\w*(SECRET|WEBHOOK)/);
    }
  });
});
