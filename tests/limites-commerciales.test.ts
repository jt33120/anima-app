import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 2.5 (T3) — le prédicat de garde de MONTAGE `limitesCommercialesLevees` (AC4, AD-9/AD-17).
 * On mocke le client admin : on prouve le CÂBLAGE (dérive de `episode_detresse_ouvert` = `fin IS
 * NULL`) et le REPLI SÛR (AD-15) — une panne SUSPEND le commerce (le doute protège, FR-043), jamais
 * un fail-open qui laisserait un paywall frapper un épisode invisible.
 */

const rpc = vi.fn();
vi.mock("@/lib/data/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

import { limitesCommercialesLevees } from "@/lib/safety/limites-commerciales";

const CIBLE = "22222222-2222-2222-2222-222222222222";

beforeEach(() => rpc.mockReset());

describe("limitesCommercialesLevees — la garde de montage (AC4, AD-9)", () => {
  it("appelle episode_detresse_ouvert(cible) et renvoie son booléen (fin IS NULL ⇒ levées)", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await limitesCommercialesLevees(CIBLE)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("episode_detresse_ouvert", { cible: CIBLE });
  });

  it("épisode fermé ⇒ limites NON levées (le commerce peut se monter)", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
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
