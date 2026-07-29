import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 3.1 (T4) + revue 3.2 — l'entitlement premium (`lib/data/lire-abonnement.ts`). La dérivation
 * `estPremium` est testée en pur (abonnement-domaine) et la policy SELECT propriétaire en DB
 * (abonnement.test). Ici : garde de LECTURE DE SOURCE (lecture SOUS JWT, dérivée) + test COMPORTEMENTAL
 * du repli sûr — une erreur PostgREST doit LEVER (sinon un appelant commercial proposerait la carte à
 * une abonnée active, revue 3.2), tandis qu'une absence normale de ligne (data null, error null) ne lève PAS.
 */

const maybeSingle = vi.fn();
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ select: () => ({ maybeSingle }) }),
  }),
}));

import { estPremiumCourante } from "@/lib/data/lire-abonnement";

const racine = process.cwd();
function sansCommentaires(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
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

  it("LIT le champ error et le RELANCE (sinon le repli commercial de l'appelant ne s'engage jamais, revue 3.2)", () => {
    expect(src, "l'erreur doit être déstructurée").toMatch(/\{\s*data\s*,\s*error\s*\}/);
    expect(src, "l'erreur doit être relancée").toMatch(/if\s*\(\s*error\s*\)\s*throw/);
  });
});

describe("Story 3.2 (revue) — repli sûr : une panne de lecture LÈVE, une absence normale non", () => {
  beforeEach(() => maybeSingle.mockReset());

  it("erreur PostgREST ({data:null, error}) → LÈVE (l'appelant applique « le doute suspend le commerce »)", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });
    await expect(estPremiumCourante()).rejects.toThrow(/abonnement/i);
  });

  it("abonnement actif → premium (true)", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { etat: "actif" }, error: null });
    expect(await estPremiumCourante()).toBe(true);
  });

  it("aucune ligne (data null, error null — cas NORMAL d'un compte gratuit) → non premium, jamais une levée", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await estPremiumCourante()).toBe(false);
  });
});
