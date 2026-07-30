import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.4 (T4) — le dépôt du signal. Le client JWT est MOCKÉ (aucune base) : on prouve le CÂBLAGE —
 * l'écriture via la fonction possédée `.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour })` —
 * et que le dépôt LÈVE sur erreur réelle sans porter le `cle_tour` en clair (NFR-022, statique + runtime).
 * Le comportement base réel (RLS, write-gate, isolation, idempotence, garde AD-17) est prouvé dans
 * `signal-reconceptualisation.test.ts`.
 */

const rpc = vi.fn();
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc })),
}));

import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";

describe("depot-reconceptualisation — câblage écriture via la fonction possédée (T4/AC4)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("enregistrer appelle .rpc(enregistrer_signal_reconceptualisation, { p_cle_tour })", async () => {
    rpc.mockResolvedValue({ error: null });
    await creerDepotSignalReconcept().enregistrer({ cleTour: "tour-42" });
    expect(rpc).toHaveBeenCalledWith("enregistrer_signal_reconceptualisation", { p_cle_tour: "tour-42" });
  });

  it("lève si la RPC renvoie une erreur réelle (write-gate / AD-17 / isolation / DB)", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "AD-17 detresse" } });
    await expect(creerDepotSignalReconcept().enregistrer({ cleTour: "tour-42" })).rejects.toThrow();
  });
});

describe("depot-reconceptualisation — anti-fuite RUNTIME, même sur chemin d'erreur (NFR-022, patron 4.3)", () => {
  const CLE = "CLE_TOUR_SECRET_zzz"; // le cle_tour (idempotence) ne doit jamais fuiter (NFR-022)

  beforeEach(() => rpc.mockReset());

  it("enregistrer : aucun cle_tour dans la console NI dans l'erreur levée (error présente)", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "row-level security" } });
    const spies = ["log", "error", "warn", "info", "debug"].map((m) => vi.spyOn(console, m as "log").mockImplementation(() => {}));
    let leve: unknown;
    try {
      await creerDepotSignalReconcept().enregistrer({ cleTour: CLE });
    } catch (e) {
      leve = e;
    }
    const dumpConsole = spies
      .flatMap((s) => s.mock.calls)
      .map((args) => args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
      .join("\n");
    const err = leve as Error | undefined;
    expect(dumpConsole, "un log porte le cle_tour").not.toContain(CLE);
    expect(`${err?.message ?? ""}\n${err?.stack ?? ""}`, "l'erreur levée porte le cle_tour").not.toContain(CLE);
    expect(err, "le chemin d'erreur EST bien exercé").toBeInstanceOf(Error);
    spies.forEach((s) => s.mockRestore());
  });
});

describe("depot-reconceptualisation — adaptateur server-only, sous JWT, sans fuite (AD-1/AD-12/NFR-022)", () => {
  it("lib/domain/reconceptualisation.ts n'importe AUCUNE infra (domaine pur)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/domain/reconceptualisation.ts"), "utf-8");
    expect(src).not.toMatch(/from\s+["'](@supabase|next\/|server-only|@\/lib\/data)/);
  });

  it("l'adaptateur est server-only, sous JWT, et ne logge/lève JAMAIS le cle_tour (NFR-022)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/data/depot-reconceptualisation.ts"), "utf-8");
    expect(src).toMatch(/import\s+["']server-only["']/); // barrière anti-client
    expect(src).toMatch(/createSupabaseServerClient/); // JWT (la RPC a besoin de auth.uid())
    expect(src).not.toMatch(/createSupabaseAdminClient/); // JAMAIS service_role (AD-12)
    expect(src).not.toMatch(/(throw|console)[^;]*\bcleTour\b/); // ni throw ni log ne porte le cle_tour
  });
});
