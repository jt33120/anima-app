import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, ReponseIa } from "@/lib/ai/port";
import { evaluerSecuriteDuTour, type DepotEpisode } from "@/lib/safety/pipeline";

/**
 * Story 2.4 (T6) — le pipeline branche l'épisode CROSS-TOUR. Les deux points de fond :
 *   1. `enregistrerTour` est appelé à CHAQUE tour (même niveau 0), avec le niveau DÉTECTÉ BRUT
 *      (jamais l'effectif forcé) — sinon un épisode ouvert ne s'éteint jamais (paywall à vie).
 *   2. `ResultatSecurite` porte désormais `limitesLevees`, plombé depuis le retour du dépôt.
 */

function supabaseFactice(): SupabaseClient {
  return {
    rpc: async (nom: string) => {
      if (nom === "a_consenti_art9") return { data: true, error: null };
      if (nom === "est_barre_minorite") return { data: false, error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
}

function adaptateur(texte: string): AiPort {
  return {
    estZdrProuve: () => true,
    completer: async (): Promise<ReponseIa> => ({ texte, tier: "fort", modele: "factice", usage: { tokensEntree: 0, tokensSortie: 0 } }),
    diffuser: async function* () {},
  };
}

const messages = [{ role: "user" as const, content: "coucou" }];

function depot(ouvert: boolean, limitesApres: boolean) {
  const enregistrerTour = vi.fn(async () => ({ limitesLevees: limitesApres }));
  const d: DepotEpisode = { episodeOuvert: async () => ouvert, enregistrerTour };
  return { d, enregistrerTour };
}

async function evaluer(texte: string, ouvert: boolean, limitesApres: boolean) {
  const { d, enregistrerTour } = depot(ouvert, limitesApres);
  const r = await evaluerSecuriteDuTour(
    { supabase: supabaseFactice(), adaptateur: adaptateur(texte), depotEpisode: d, emettreAudit: async () => {} },
    messages,
  );
  return { r, enregistrerTour };
}

describe("pipeline — enregistrerTour à chaque tour, niveau BRUT (piège central 2.4)", () => {
  it("niveau 0 sans épisode : enregistrerTour(0) appelé quand même (compter/rien), limitesLevees=false", async () => {
    const { r, enregistrerTour } = await evaluer("NIVEAU: 0", false, false);
    expect(enregistrerTour).toHaveBeenCalledWith(0);
    expect(r.bloque).toBe(false);
    if (!r.bloque) expect(r.limitesLevees).toBe(false);
  });

  it("niveau 2 : enregistrerTour(2) appelé, limitesLevees=true (épisode ouvert par ce tour)", async () => {
    const { r, enregistrerTour } = await evaluer("NIVEAU: 2", false, true);
    expect(enregistrerTour).toHaveBeenCalledWith(2);
    if (!r.bloque) expect(r.limitesLevees).toBe(true);
  });

  it("ÉPISODE OUVERT + détecté 0 : enregistrerTour reçoit le BRUT 0 (PAS l'effectif 1) — sinon inextinguible", async () => {
    const { r, enregistrerTour } = await evaluer("NIVEAU: 0", true, true);
    // Le forçage donne un verdict effectif 1 (réponse au fort)…
    if (!r.bloque) expect(r.verdict.niveau).toBe(1);
    // …mais le comptage d'extinction voit le niveau DÉTECTÉ brut 0.
    expect(enregistrerTour).toHaveBeenCalledWith(0);
    expect(enregistrerTour).not.toHaveBeenCalledWith(1);
  });

  it("dernier tour d'un épisode qui s'éteint : verdict encore forcé (1) mais limitesLevees=false (retombées)", async () => {
    // Épisode ouvert au début du tour (force 1), mais enregistrerTour(0) l'éteint → limites retombées.
    const { r } = await evaluer("NIVEAU: 0", true, false);
    if (!r.bloque) {
      expect(r.verdict.niveau).toBe(1);
      expect(r.limitesLevees).toBe(false);
    }
  });

  it("repli sûr (sortie illisible) : enregistrerTour reçoit le niveau de repli (1), l'épisode s'ouvre/persiste", async () => {
    const { r, enregistrerTour } = await evaluer("blabla illisible", false, true);
    if (!r.bloque) expect(r.verdict.decision).toBe("repli_sur");
    expect(enregistrerTour).toHaveBeenCalledWith(1); // repli = niveau 1
  });

  it("blocage d'egress : enregistrerTour PAS appelé (rien classé)", async () => {
    const supa = {
      rpc: async (nom: string) => (nom === "a_consenti_art9" ? { data: false, error: null } : { data: false, error: null }),
    } as unknown as SupabaseClient;
    const { d, enregistrerTour } = depot(false, false);
    const r = await evaluerSecuriteDuTour(
      { supabase: supa, adaptateur: adaptateur("NIVEAU: 3"), depotEpisode: d, emettreAudit: async () => {} },
      messages,
    );
    expect(r.bloque).toBe(true);
    expect(enregistrerTour).not.toHaveBeenCalled();
  });
});
