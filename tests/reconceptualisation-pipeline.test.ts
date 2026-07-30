import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluerReconceptualisationDuTour, type DepotSignalReconcept } from "@/lib/safety/reconceptualisation-pipeline";
import { classerDetresse } from "@/lib/safety/classer-detresse";
import type { AiPort, MessageIa } from "@/lib/ai/port";

/**
 * Story 4.4 (T4) — l'orchestrateur `evaluerReconceptualisationDuTour`. Dépendances FAUSSES (le vrai egress
 * art. 9 est exercé, mais l'adaptateur et le client sont des doublures) :
 *  - AC3 [DUR / AD-17] garde de PIPELINE : verdict qui supprime le schéma OU fenêtre active → AUCUN appel
 *    fort, aucune persistance (l'adaptateur n'est JAMAIS interrogé) ;
 *  - AC2 : hors garde, l'egress fort tourne ; `RECONCEPTUALISATION: oui` → persistance appelée UNE fois ;
 *  - non détecté → jamais persisté, mais `usage` renvoyé (le coût fort est métré) ;
 *  - egress bloqué (consentement race) → aucun signal, aucun usage ;
 *  - un échec de persistance ne fait PAS échouer l'orchestrateur (repli, incident sans art. 9).
 */

const MESSAGES: MessageIa[] = [{ role: "user", content: "avant je pensais que c'était ma faute, maintenant non" }];

/** Client JWT factice pour l'egress-guard : consentement OK, non barré (les seules RPC lues par l'egress). */
const supabaseOk = {
  rpc: async (name: string) => ({ data: name === "a_consenti_art9", error: null }),
} as unknown as SupabaseClient;

/** Adaptateur factice : `completer` renvoie le texte structuré voulu ; `estZdrProuve` vrai (in-process). */
function fauxAdaptateur(texte: string) {
  const completer = vi.fn(async () => ({
    texte,
    tier: "fort" as const,
    modele: "factice-test",
    usage: { tokensEntree: 3, tokensSortie: 4 },
  }));
  const adaptateur = {
    estZdrProuve: () => true,
    completer,
    diffuser: async function* () {},
  } as unknown as AiPort;
  return { adaptateur, completer };
}

function fauxDepot(): DepotSignalReconcept & { enregistrer: ReturnType<typeof vi.fn> } {
  return { enregistrer: vi.fn(async () => {}) };
}

describe("evaluerReconceptualisationDuTour — AC3 [DUR / AD-17] garde de pipeline", () => {
  it("verdict qui supprime le schéma (détresse niv. 2) → supprime, AUCUN appel fort, aucune persistance", async () => {
    const { adaptateur, completer } = fauxAdaptateur("RECONCEPTUALISATION: oui");
    const depotSignal = fauxDepot();
    const r = await evaluerReconceptualisationDuTour(
      { supabase: supabaseOk, adaptateur, depotSignal, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: classerDetresse(2), cleTour: "t1" },
    );
    expect(r.supprime).toBe(true);
    expect(r.detecte).toBe(false);
    expect(r.usage).toBeNull();
    expect(completer).not.toHaveBeenCalled(); // aucun coût fort en détresse
    expect(depotSignal.enregistrer).not.toHaveBeenCalled();
  });

  it("fenêtre détresse active (même hors détresse ce tour, ex. 72 h) → supprime, aucun appel fort", async () => {
    const { adaptateur, completer } = fauxAdaptateur("RECONCEPTUALISATION: oui");
    const depotSignal = fauxDepot();
    const r = await evaluerReconceptualisationDuTour(
      { supabase: supabaseOk, adaptateur, depotSignal, fenetreDetresseActive: async () => true },
      { messages: MESSAGES, verdict: classerDetresse(0), cleTour: "t1" },
    );
    expect(r.supprime).toBe(true);
    expect(completer).not.toHaveBeenCalled();
    expect(depotSignal.enregistrer).not.toHaveBeenCalled();
  });
});

describe("evaluerReconceptualisationDuTour — hors garde : détection & persistance (AC2, AC4)", () => {
  it("`RECONCEPTUALISATION: oui` → persistance appelée UNE fois avec le cleTour ; usage renvoyé (métrage)", async () => {
    const { adaptateur, completer } = fauxAdaptateur("RECONCEPTUALISATION: oui");
    const depotSignal = fauxDepot();
    const r = await evaluerReconceptualisationDuTour(
      { supabase: supabaseOk, adaptateur, depotSignal, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: classerDetresse(0), cleTour: "tour-xyz" },
    );
    expect(completer).toHaveBeenCalledTimes(1); // AC2 : un appel fort
    expect(r.detecte).toBe(true);
    expect(depotSignal.enregistrer).toHaveBeenCalledWith({ cleTour: "tour-xyz" });
    expect(r.usage).toEqual({ tier: "fort", modele: "factice-test", tokensEntree: 3, tokensSortie: 4 });
    expect(r.supprime).toBe(false);
  });

  it("`RECONCEPTUALISATION: non` → jamais persisté, mais usage renvoyé (le coût fort est métré)", async () => {
    const { adaptateur } = fauxAdaptateur("RECONCEPTUALISATION: non");
    const depotSignal = fauxDepot();
    const r = await evaluerReconceptualisationDuTour(
      { supabase: supabaseOk, adaptateur, depotSignal, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: classerDetresse(0), cleTour: "t1" },
    );
    expect(r.detecte).toBe(false);
    expect(depotSignal.enregistrer).not.toHaveBeenCalled();
    expect(r.usage).not.toBeNull();
  });

  it("egress bloqué (consentement race) → aucun signal, aucun usage", async () => {
    const supabaseBloque = { rpc: async () => ({ data: false, error: null }) } as unknown as SupabaseClient; // a_consenti_art9 = false
    const { adaptateur, completer } = fauxAdaptateur("RECONCEPTUALISATION: oui");
    const depotSignal = fauxDepot();
    const r = await evaluerReconceptualisationDuTour(
      { supabase: supabaseBloque, adaptateur, depotSignal, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: classerDetresse(0), cleTour: "t1" },
    );
    expect(completer).not.toHaveBeenCalled(); // egress bloque AVANT l'appel adaptateur
    expect(r.detecte).toBe(false);
    expect(r.usage).toBeNull();
    expect(depotSignal.enregistrer).not.toHaveBeenCalled();
  });

  it("un échec de persistance ne fait PAS échouer l'orchestrateur (repli) ; usage encore renvoyé (métré)", async () => {
    const { adaptateur } = fauxAdaptateur("RECONCEPTUALISATION: oui");
    const depotSignal: DepotSignalReconcept = { enregistrer: vi.fn(async () => { throw new Error("42501"); }) };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await evaluerReconceptualisationDuTour(
      { supabase: supabaseOk, adaptateur, depotSignal, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: classerDetresse(0), cleTour: "t1" },
    );
    expect(r.detecte).toBe(true);
    expect(r.usage).not.toBeNull(); // le coût fort déjà consommé reste métré
    spy.mockRestore();
  });
});
