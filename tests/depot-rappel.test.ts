import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.3 (T4) — le dépôt du rappel. Le client JWT est MOCKÉ (aucune base) : on prouve le CÂBLAGE —
 * le résumé via `.from("resume_glissant")`, les faits via la fonction possédée `.rpc("charger_faits_actifs")`,
 * la délégation au domaine pur `assemblerRappel`, l'`enregistrerResume` en upsert — et que le dépôt LÈVE
 * sur erreur réelle. Le comportement base réel (RLS, tombstone, write-gate) est prouvé dans `resume-glissant.test.ts`.
 */

const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from, rpc })),
}));

import { creerDepotRappel } from "@/lib/data/depot-rappel";

describe("depot-rappel — câblage lecture (assembler) via résumé + fonction possédée (T4/AC1/AC3)", () => {
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
  });

  it("assembler lit le résumé (.from resume_glissant) ET les faits (.rpc charger_faits_actifs), délègue au pur", async () => {
    from.mockReturnValue({ select: () => ({ maybeSingle: async () => ({ data: { contenu: "elle revient sur son père" }, error: null }) }) });
    rpc.mockResolvedValue({
      data: [
        { cle_dedoublonnage: "recent", contenu: "aime la forêt", cree_le: "2026-07-20T00:00:00Z", maj_le: "2026-07-20T00:00:00Z" },
        { cle_dedoublonnage: "vieux", contenu: "aimait la ville", cree_le: "2026-07-01T00:00:00Z", maj_le: "2026-07-01T00:00:00Z" },
      ],
      error: null,
    });
    const r = await creerDepotRappel("u-1").assembler(5);
    expect(from).toHaveBeenCalledWith("resume_glissant");
    expect(rpc).toHaveBeenCalledWith("charger_faits_actifs");
    expect(r.resume).toBe("elle revient sur son père");
    expect(r.faits.map((f) => f.cleDedoublonnage)).toEqual(["recent", "vieux"]); // trié daté décroissant par le pur
    expect(r.aDeLaMatiere).toBe(true);
  });

  it("sans résumé ni fait : assembler renvoie la structure vide et honnête (AC5)", async () => {
    from.mockReturnValue({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) });
    rpc.mockResolvedValue({ data: [], error: null });
    const r = await creerDepotRappel("u-1").assembler();
    expect(r).toEqual({ resume: null, faits: [], aDeLaMatiere: false });
  });

  it("enregistrerResume fait un upsert (resume_glissant) sur onConflict utilisatrice_id, avec l'id de construction", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    await creerDepotRappel("u-1").enregistrerResume("nouveau résumé glissant");
    expect(from).toHaveBeenCalledWith("resume_glissant");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ utilisatrice_id: "u-1", contenu: "nouveau résumé glissant" }),
      { onConflict: "utilisatrice_id" },
    );
  });

  it("lève si la lecture des faits renvoie une erreur réelle (RLS/DB)", async () => {
    from.mockReturnValue({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) });
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "row-level security" } });
    await expect(creerDepotRappel("u-1").assembler()).rejects.toThrow();
  });

  it("lève si l'écriture du résumé renvoie une erreur réelle (write-gate/DB)", async () => {
    from.mockReturnValue({ upsert: async () => ({ error: { code: "42501", message: "row-level security" } }) });
    await expect(creerDepotRappel("u-1").enregistrerResume("x")).rejects.toThrow();
  });
});

describe("depot-rappel — anti-fuite art. 9 RUNTIME, même sur chemin d'erreur (NFR-022, revue 4.3 A)", () => {
  // Filet ROBUSTE : inspecte la sortie réelle (console + erreur levée), pas un motif syntaxique. Attrape un
  // futur `console.error(faitsRes)` / dump d'objet englobant / variable intermédiaire — invisibles au regex statique.
  const SECRETS = ["PHRASE_ART9_RESUME_zzz", "PHRASE_ART9_FAIT_zzz", "CLE_DEDOUB_zzz"];

  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
  });

  it("assembler : aucun secret art. 9 dans la console NI dans l'erreur levée (data ET error présentes)", async () => {
    from.mockReturnValue({ select: () => ({ maybeSingle: async () => ({ data: { contenu: SECRETS[0] }, error: { code: "XXXXX" } }) }) });
    rpc.mockResolvedValue({
      data: [{ cle_dedoublonnage: SECRETS[2], contenu: SECRETS[1], cree_le: "2026-07-20T00:00:00Z", maj_le: "2026-07-20T00:00:00Z" }],
      error: { code: "42501", message: "row-level security" },
    });
    const spies = ["log", "error", "warn", "info", "debug"].map((m) => vi.spyOn(console, m as "log").mockImplementation(() => {}));
    let leve: unknown;
    try {
      await creerDepotRappel("u-1").assembler(5);
    } catch (e) {
      leve = e;
    }
    const dumpConsole = spies
      .flatMap((s) => s.mock.calls)
      .map((args) => args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
      .join("\n");
    const err = leve as Error | undefined;
    for (const s of SECRETS) {
      expect(dumpConsole, "un log porte l'art. 9").not.toContain(s);
      expect(`${err?.message ?? ""}\n${err?.stack ?? ""}`, "l'erreur levée porte l'art. 9").not.toContain(s);
    }
    expect(err, "le chemin d'erreur EST bien exercé").toBeInstanceOf(Error);
    spies.forEach((s) => s.mockRestore());
  });

  it("enregistrerResume : aucun secret art. 9 dans la console NI dans l'erreur levée", async () => {
    from.mockReturnValue({ upsert: async () => ({ error: { code: "42501", message: "row-level security" } }) });
    const spies = ["log", "error", "warn", "info", "debug"].map((m) => vi.spyOn(console, m as "log").mockImplementation(() => {}));
    let leve: unknown;
    try {
      await creerDepotRappel("u-1").enregistrerResume(SECRETS[0]);
    } catch (e) {
      leve = e;
    }
    const dumpConsole = spies
      .flatMap((s) => s.mock.calls)
      .map((args) => args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
      .join("\n");
    const err = leve as Error | undefined;
    for (const s of SECRETS) {
      expect(dumpConsole).not.toContain(s);
      expect(`${err?.message ?? ""}\n${err?.stack ?? ""}`).not.toContain(s);
    }
    expect(err).toBeInstanceOf(Error);
    spies.forEach((s) => s.mockRestore());
  });
});

describe("depot-rappel — le PORT domaine reste pur ; pas de fuite art. 9 (AD-1/NFR-022)", () => {
  it("lib/domain/rappel.ts n'importe AUCUNE infra (domaine pur)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/domain/rappel.ts"), "utf-8");
    expect(src).not.toMatch(/from\s+["'](@supabase|next\/|server-only|@\/lib\/data)/);
  });

  it("l'adaptateur est server-only, sous JWT, et ne logge/lève JAMAIS le contenu (NFR-022)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/data/depot-rappel.ts"), "utf-8");
    expect(src).toMatch(/import\s+["']server-only["']/); // barrière anti-client
    expect(src).toMatch(/createSupabaseServerClient/); // JWT
    expect(src).not.toMatch(/createSupabaseAdminClient/); // JAMAIS service_role (AD-12)
    expect(src).not.toMatch(/(throw|console)[^;]*\.(contenu|cleDedoublonnage)/); // ni throw ni log ne porte l'art. 9
  });
});
