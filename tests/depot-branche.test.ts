import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.5 (T3) — les dépôts de la naissance de branche. Le client JWT est MOCKÉ (aucune base) : on prouve
 * le CÂBLAGE des trois chemins possédés (creer / ecarter / charger) et que rien ne LÈVE ni ne logge le `nom`
 * art. 9 en clair (NFR-022). Le comportement base réel (RLS, AD-17, isolation, « le lendemain », transitions)
 * est prouvé dans `branche.test.ts` et `branche-lendemain.test.ts`.
 */

const rpc = vi.fn();
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc })),
}));

import { creerDepotBranche } from "@/lib/data/depot-branche";
import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";

describe("depot-branche — câblage écriture « Oui » via la fonction possédée (AC2/AC3)", () => {
  beforeEach(() => rpc.mockReset());

  it("creerDepuisSignal appelle .rpc(creer_branche_depuis_signal, { p_signal_id, p_nom })", async () => {
    rpc.mockResolvedValue({ error: null });
    await creerDepotBranche().creerDepuisSignal({ signalId: "sig-1", nom: "mes mots" });
    expect(rpc).toHaveBeenCalledWith("creer_branche_depuis_signal", { p_signal_id: "sig-1", p_nom: "mes mots" });
  });

  it("lève si la RPC renvoie une erreur (write-gate / AD-17 / isolation / nom vide)", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "AD-17" } });
    await expect(creerDepotBranche().creerDepuisSignal({ signalId: "s", nom: "x" })).rejects.toThrow();
  });
});

describe("depot-reconceptualisation (extension 4.5) — chargerProposition & ecarter", () => {
  beforeEach(() => rpc.mockReset());

  it("chargerProposition mappe la première ligne en { signalId, signalCreeLe } (Date)", async () => {
    rpc.mockResolvedValue({ data: [{ signal_id: "sig-9", extrait_contenu: "verbatim art9", signal_cree_le: "2026-03-14T22:00:00Z" }], error: null });
    const p = await creerDepotSignalReconcept().chargerProposition();
    expect(rpc).toHaveBeenCalledWith("charger_proposition_branche");
    expect(p?.signalId).toBe("sig-9");
    expect(p?.signalCreeLe instanceof Date).toBe(true);
  });

  it("chargerProposition renvoie null quand aucune proposition (jamais sur l'instant / détresse)", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await creerDepotSignalReconcept().chargerProposition()).toBeNull();
  });

  it("ecarter appelle .rpc(ecarter_signal_reconceptualisation, { p_signal_id })", async () => {
    rpc.mockResolvedValue({ error: null });
    await creerDepotSignalReconcept().ecarter({ signalId: "sig-3" });
    expect(rpc).toHaveBeenCalledWith("ecarter_signal_reconceptualisation", { p_signal_id: "sig-3" });
  });
});

describe("depot-branche — anti-fuite RUNTIME du nom art. 9 (NFR-022)", () => {
  const NOM = "NOM_BRANCHE_SECRET_zzz";
  beforeEach(() => rpc.mockReset());

  it("creerDepuisSignal : aucun nom dans la console NI dans l'erreur levée", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "row-level security" } });
    const spies = ["log", "error", "warn", "info", "debug"].map((m) => vi.spyOn(console, m as "log").mockImplementation(() => {}));
    let leve: unknown;
    try {
      await creerDepotBranche().creerDepuisSignal({ signalId: "s", nom: NOM });
    } catch (e) {
      leve = e;
    }
    const dump = spies.flatMap((s) => s.mock.calls).map((a) => a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")).join("\n");
    const err = leve as Error | undefined;
    expect(dump, "un log porte le nom").not.toContain(NOM);
    expect(`${err?.message ?? ""}\n${err?.stack ?? ""}`, "l'erreur porte le nom").not.toContain(NOM);
    expect(err).toBeInstanceOf(Error);
    spies.forEach((s) => s.mockRestore());
  });
});

describe("depot-branche — server-only, sous JWT, sans fuite (AD-1/AD-12/NFR-022)", () => {
  it("lib/domain/branche.ts n'importe AUCUNE infra (domaine pur)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/domain/branche.ts"), "utf-8");
    expect(src).not.toMatch(/from\s+["'](@supabase|next\/|server-only|@\/lib\/data)/);
    expect(src, "le domaine n'importe aucune détresse (séparation)").not.toMatch(/detresse|episode/i);
  });

  it("l'adaptateur branche est server-only, sous JWT, et ne logge/lève JAMAIS le nom (NFR-022)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/data/depot-branche.ts"), "utf-8");
    expect(src).toMatch(/import\s+["']server-only["']/);
    expect(src).toMatch(/createSupabaseServerClient/);
    expect(src).not.toMatch(/createSupabaseAdminClient/);
    expect(src).not.toMatch(/(throw|console)[^;]*\bnom\b/);
  });
});
