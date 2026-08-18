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
const CLE = "22222222-2222-2222-2222-222222222222"; // jeton de tour LOGIQUE (idempotence 2-4b)

beforeEach(() => rpc.mockReset());

describe("creerDepotEpisode — câblage vers les fonctions possédées", () => {
  it("plancherEpisode() appelle niveau_plancher_episode(cible) et renvoie le niveau ATTEINT", async () => {
    // Revue Epics 1-4 : c'était `episode_detresse_ouvert`, et le plancher valait donc toujours 1.
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    const depot = creerDepotEpisode(CIBLE, CLE);
    expect(await depot.plancherEpisode()).toBe(3);
    expect(rpc).toHaveBeenCalledWith("niveau_plancher_episode", { cible: CIBLE });
  });

  it("aucun épisode ouvert → 0 : le plancher ne force rien", async () => {
    rpc.mockResolvedValueOnce({ data: 0, error: null });
    expect(await creerDepotEpisode(CIBLE, CLE).plancherEpisode()).toBe(0);
  });

  it("enregistrerTour(niveau) passe le niveau DÉTECTÉ + les seuils du pur + le JETON DE TOUR (2-4b), renvoie limitesLevees", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null }); // limites retombées (extinction)
    const depot = creerDepotEpisode(CIBLE, CLE);
    const r = await depot.enregistrerTour(0);
    expect(r).toEqual({ limitesLevees: false });
    expect(rpc).toHaveBeenCalledWith("enregistrer_tour_detresse", {
      cible: CIBLE,
      p_niveau: 0,
      p_seuil_tours: SEUIL_TOURS_SURS,
      p_duree_min_s: DUREE_MIN_EPISODE_MS / 1000,
      p_fenetre_s: FENETRE_POST_EPISODE_MS / 1000,
      p_cle_tour: CLE, // idempotence au retry (Story 2-4b) : baquée à la construction du dépôt
    });
  });

  it("enregistrerTour d'un niveau ≥ 1 renvoie limitesLevees=true (épisode ouvert)", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    const depot = creerDepotEpisode(CIBLE, CLE);
    expect(await depot.enregistrerTour(2)).toEqual({ limitesLevees: true });
  });
});

describe("creerDepotEpisode — repli sûr (AD-15) : jamais planter, pencher vers la protection", () => {
  it("enregistrerTour : erreur RPC → limitesLevees=true par défaut + incident (jamais de paywall sur un doute)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    const depot = creerDepotEpisode(CIBLE, CLE);
    expect(await depot.enregistrerTour(2)).toEqual({ limitesLevees: true });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("enregistrerTour : exception → limitesLevees=true par défaut + incident", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockRejectedValueOnce(new Error("réseau"));
    const depot = creerDepotEpisode(CIBLE, CLE);
    expect(await depot.enregistrerTour(1)).toEqual({ limitesLevees: true });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("plancherEpisode : erreur RPC → 1 (le doute force le fort, sans INVENTER un niveau) + incident", async () => {
    // ⚠️ 1 ET PAS 3. Une panne de RPC ne dit rien du niveau : inventer 3 mettrait quelqu'un qui va
    // bien en protocole de crise sur un incident réseau. 1 est exactement ce que l'ancien booléen
    // garantissait — le repli ne régresse sur rien, et ne surjoue rien.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    const depot = creerDepotEpisode(CIBLE, CLE);
    expect(await depot.plancherEpisode()).toBe(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
