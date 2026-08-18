import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 2.5 (T3) — le prédicat de garde de MONTAGE `limitesCommercialesLevees` (AC4, AD-9/AD-17).
 * On mocke le client admin : on prouve le CÂBLAGE et le REPLI SÛR (AD-15) — une panne SUSPEND le
 * commerce (le doute protège, FR-043), jamais un fail-open qui laisserait un paywall frapper un
 * épisode invisible.
 *
 * ⚠️ LA SOURCE A CHANGÉ DE FORME (revue des Epics 1 à 4) : l'état d'épisode n'est plus un booléen
 * mais un NIVEAU (`niveau_plancher_episode` — le niveau ATTEINT, 0 s'il n'y a pas d'épisode), et le
 * booléen commercial en DÉRIVE. C'est la même exigence qu'avant, dite plus précisément : la garde et
 * le pipeline lisent LA MÊME ligne par LE MÊME appel, jamais deux dérivations qui divergent (R1).
 */

const rpc = vi.fn();
vi.mock("@/lib/data/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

import { limitesCommercialesLevees } from "@/lib/safety/limites-commerciales";

const CIBLE = "22222222-2222-2222-2222-222222222222";

beforeEach(() => rpc.mockReset());

describe("limitesCommercialesLevees — la garde de montage (AC4, AD-9)", () => {
  it("appelle niveau_plancher_episode(cible) : un épisode OUVERT lève les limites", async () => {
    rpc.mockResolvedValueOnce({ data: 1, error: null });
    expect(await limitesCommercialesLevees(CIBLE)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("niveau_plancher_episode", { cible: CIBLE });
  });

  it("et un épisode monté PLUS HAUT lève tout autant — c'est « ouvert » qui compte ici, pas le niveau", async () => {
    // La garde commerciale ne gradue pas : à partir du moment où un épisode court, aucun paywall,
    // aucun quota, aucun bilan (AD-9). Le NIVEAU sert au pipeline, pas au commerce.
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    expect(await limitesCommercialesLevees(CIBLE)).toBe(true);
  });

  it("épisode fermé (plancher 0) ⇒ limites NON levées (le commerce peut se monter)", async () => {
    rpc.mockResolvedValueOnce({ data: 0, error: null });
    expect(await limitesCommercialesLevees(CIBLE)).toBe(false);
  });

  it("REPLI SÛR : erreur RPC ⇒ true (le doute SUSPEND le commerce, FR-043) + incident journalisé", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await limitesCommercialesLevees(CIBLE)).toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("REPLI SÛR : exception ⇒ true + incident journalisé", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockRejectedValueOnce(new Error("réseau"));
    expect(await limitesCommercialesLevees(CIBLE)).toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
