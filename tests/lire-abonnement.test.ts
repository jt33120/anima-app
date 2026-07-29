import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 3.1 (T4) — l'entitlement premium (`lib/data/lire-abonnement.ts`). La dérivation `estPremium`
 * est testée en pur (abonnement-domaine) et la policy SELECT propriétaire en DB (abonnement.test).
 * Ici, garde de LECTURE DE SOURCE : la lecture passe SOUS JWT (RLS), jamais via le client admin, et
 * l'entitlement est DÉRIVÉ, jamais dupliqué.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const src = sansCommentaires(readFileSync(resolve(racine, "lib/data/lire-abonnement.ts"), "utf-8"));

describe("Story 3.1 — entitlement premium lu sous JWT, dérivé (AC4, AD-12)", () => {
  it("lit l'abonnement SOUS JWT (RLS SELECT propriétaire), jamais via le client admin", () => {
    expect(src).toMatch(/createSupabaseServerClient/);
    expect(src, "l'entitlement se lit sous RLS, pas via service_role/admin").not.toMatch(/createSupabaseAdminClient/);
  });

  it("dérive l'entitlement via estPremium (aucun état dupliqué)", () => {
    expect(src).toMatch(/estPremium/);
    expect(src).toMatch(/from "@\/lib\/domain\/abonnement"/);
  });
});
