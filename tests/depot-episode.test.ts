import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 2.4 (T5) — le dépôt serveur RÉEL `creerDepotEpisode`. On mocke le client admin : on prouve
 * le CÂBLAGE (bonnes RPC, bons arguments, niveau DÉTECTÉ passé, seuils lus dans le pur) et le REPLI
 * SÛR (AD-15) — une panne RPC ne plante jamais le tour et penche vers la protection.
 */

const rpc = vi.fn();
vi.mock("@/lib/data/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

import { creerDepotEpisode } from "@/lib/safety/depot-episode";
import { SEUIL_TOURS_SURS, DUREE_MIN_EPISODE_MS, FENETRE_POST_EPISODE_MS } from "@/lib/safety/episode-detresse";

const CIBLE = "11111111-1111-1111-1111-111111111111";

beforeEach(() => rpc.mockReset());

describe("creerDepotEpisode — câblage vers les fonctions possédées", () => {
  it("episodeOuvert() appelle episode_detresse_ouvert(cible) et renvoie son booléen", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    const depot = creerDepotEpisode(CIBLE);
    expect(await depot.episodeOuvert()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("episode_detresse_ouvert", { cible: CIBLE });
  });

  it("enregistrerTour(niveau) passe le niveau DÉTECTÉ + les seuils du pur, renvoie limitesLevees", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null }); // limites retombées (extinction)
    const depot = creerDepotEpisode(CIBLE);
    const r = await depot.enregistrerTour(0);
    expect(r).toEqual({ limitesLevees: false });
    expect(rpc).toHaveBeenCalledWith("enregistrer_tour_detresse", {
      cible: CIBLE,
      p_niveau: 0,
      p_seuil_tours: SEUIL_TOURS_SURS,
      p_duree_min_s: DUREE_MIN_EPISODE_MS / 1000,
      p_fenetre_s: FENETRE_POST_EPISODE_MS / 1000,
    });
  });

  it("enregistrerTour d'un niveau ≥ 1 renvoie limitesLevees=true (épisode ouvert)", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    const depot = creerDepotEpisode(CIBLE);
    expect(await depot.enregistrerTour(2)).toEqual({ limitesLevees: true });
  });
});

describe("creerDepotEpisode — repli sûr (AD-15) : jamais planter, pencher vers la protection", () => {
  it("enregistrerTour : erreur RPC → limitesLevees=true par défaut + incident (jamais de paywall sur un doute)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    const depot = creerDepotEpisode(CIBLE);
    expect(await depot.enregistrerTour(2)).toEqual({ limitesLevees: true });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("enregistrerTour : exception → limitesLevees=true par défaut + incident", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockRejectedValueOnce(new Error("réseau"));
    const depot = creerDepotEpisode(CIBLE);
    expect(await depot.enregistrerTour(1)).toEqual({ limitesLevees: true });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("episodeOuvert : erreur RPC → true par défaut (le doute force le fort) + incident", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    const depot = creerDepotEpisode(CIBLE);
    expect(await depot.episodeOuvert()).toBe(true); // repli : suppose ouvert → force fort
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
