import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 4.5 (T4) — l'orchestrateur d'ouverture. Le dépôt est MOCKÉ : on prouve la composition (lecture de la
 * proposition + voix déterministe) et le REPLI SÛR (toute panne → null : jamais bloquer l'ouverture de la scène).
 */

const chargerProposition = vi.fn();
vi.mock("@/lib/data/depot-reconceptualisation", () => ({
  creerDepotSignalReconcept: vi.fn(() => ({ chargerProposition })),
}));

import { chargerPropositionOuverture } from "@/lib/safety/ouverture-branche";

const supa = {} as SupabaseClient;
const MAINTENANT = new Date("2026-03-15T10:00:00+01:00");

describe("chargerPropositionOuverture", () => {
  beforeEach(() => chargerProposition.mockReset());

  it("aucune proposition → null (jamais sur l'instant / fenêtre détresse)", async () => {
    chargerProposition.mockResolvedValue(null);
    expect(await chargerPropositionOuverture(supa, MAINTENANT)).toBeNull();
  });

  it("proposition de la veille → { signalId, phrase } avec la voix déterministe (« hier »)", async () => {
    chargerProposition.mockResolvedValue({ signalId: "sig-7", signalCreeLe: new Date("2026-03-14T22:00:00+01:00") });
    const r = await chargerPropositionOuverture(supa, MAINTENANT);
    expect(r?.signalId).toBe("sig-7");
    expect(r?.phrase).toContain("hier");
    expect(r?.phrase).not.toContain("hier soir");
    expect(r?.phrase).toContain("Tu veux en faire une branche ?");
  });

  it("repli sûr : une donnée corrompue / panne → null (l'ouverture n'est jamais bloquée, incident sans art. 9)", async () => {
    // Un horodatage corrompu fait lever `phraseProposition` DANS le try → le catch doit rendre null, pas crasher.
    chargerProposition.mockResolvedValue({ signalId: "x", signalCreeLe: new Date("invalide") });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await chargerPropositionOuverture(supa, MAINTENANT)).toBeNull();
    expect(spy, "l'incident est journalisé (repli AD-15)").toHaveBeenCalled();
    spy.mockRestore();
  });
});
