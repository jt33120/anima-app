import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 2.7 (revue) — le dépôt RÉEL `creerDepotSeance`, client admin mocké. Preuve du REPLI correct
 * (trouvé en revue) : `charger` distingue « aucune trace » (→ état initial) d'un « échec de lecture »
 * (→ LÈVE, pour que la route saute l'écriture et NE réinitialise PAS une séance avancée). `ecrire`
 * avale ses erreurs (le tour ne plante jamais, AD-15).
 */

const rpc = vi.fn();
vi.mock("@/lib/data/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

import { creerDepotSeance } from "@/lib/data/depot-seance";
import { etatArcInitial } from "@/lib/domain/arc-seance";

const CIBLE = "22222222-2222-2222-2222-222222222222";
beforeEach(() => rpc.mockReset());

describe("creerDepotSeance — charger : absence de trace ≠ échec de lecture (revue 2.7)", () => {
  it("aucune trace (setof → tableau vide) → état initial (première séance)", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await creerDepotSeance(CIBLE).charger()).toEqual(etatArcInitial());
  });

  it("erreur RPC → LÈVE (jamais un état initial de repli qu'un ecrire réussi écraserait)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    await expect(creerDepotSeance(CIBLE).charger()).rejects.toThrow();
    expect(err).toHaveBeenCalled(); // incident journalisé sans art. 9
    err.mockRestore();
  });

  it("exception (réseau / client admin) → LÈVE aussi", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockRejectedValueOnce(new Error("réseau"));
    await expect(creerDepotSeance(CIBLE).charger()).rejects.toThrow();
    err.mockRestore();
  });

  it("trace présente → la mappe (setof → 1re ligne, snake_case → EtatArc)", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          phase: "observer",
          sujets_abordes: 3,
          a_reponse_longue: true,
          reformulations: 2,
          confirmations: 1,
          elements_personnels: 1,
          restitutions: 0,
          deux_dernieres_propositions: [false, false],
          observation_delivree: false,
          fin_proposee: false,
          debut: "2026-07-29T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const e = await creerDepotSeance(CIBLE).charger();
    expect(e.phase).toBe("observer");
    expect(e.reformulationsEmises).toBe(2); // reformulations → reformulationsEmises
    expect(e.confirmations).toBe(1);
  });
});

describe("creerDepotSeance — ecrire : avale les erreurs (ne plante jamais le tour, AD-15)", () => {
  it("erreur RPC → no-op + incident, jamais de throw", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(creerDepotSeance(CIBLE).ecrire(etatArcInitial())).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("exception → no-op, jamais de throw", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockRejectedValueOnce(new Error("réseau"));
    await expect(creerDepotSeance(CIBLE).ecrire(etatArcInitial())).resolves.toBeUndefined();
    err.mockRestore();
  });
});
