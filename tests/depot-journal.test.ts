import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.1 (T4) — le dépôt du journal brut. Le client JWT est MOCKÉ (aucune base ici) : on prouve le
 * contrat du dépôt — mapping de l'entrée, upsert IDEMPOTENT (onConflict + ignoreDuplicates), et lève
 * SEULEMENT sur erreur réelle (→ 500 route, retry idempotent). Le comportement base réel (RLS,
 * write-gate, idempotence) est prouvé de bout en bout dans `entree-journal.test.ts`.
 */

const upsert = vi.fn();
const from = vi.fn(() => ({ upsert }));
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from })),
}));

import { creerDepotJournal } from "@/lib/data/depot-journal";

describe("depot-journal — dépôt sous JWT, idempotent (T4)", () => {
  beforeEach(() => {
    upsert.mockReset();
    from.mockClear();
  });

  it("consigner mappe l'entrée et fait un upsert IDEMPOTENT sur (utilisatrice_id, cle_tour, role)", async () => {
    upsert.mockResolvedValue({ error: null });
    await creerDepotJournal("u-1").consigner({ cleTour: "jeton-x", role: "utilisatrice", contenu: "mes mots" });
    expect(from).toHaveBeenCalledWith("entree_journal");
    expect(upsert).toHaveBeenCalledWith(
      { utilisatrice_id: "u-1", cle_tour: "jeton-x", role: "utilisatrice", contenu: "mes mots" },
      { onConflict: "utilisatrice_id,cle_tour,role", ignoreDuplicates: true },
    );
  });

  it("lève si la base renvoie une erreur réelle (RLS/write-gate/DB) → 500 route", async () => {
    upsert.mockResolvedValue({ error: { code: "42501", message: "row-level security" } });
    await expect(
      creerDepotJournal("u-1").consigner({ cleTour: "j", role: "utilisatrice", contenu: "x" }),
    ).rejects.toThrow();
  });

  it("un conflit ignoré (ignoreDuplicates → error null) ne lève PAS (idempotence silencieuse)", async () => {
    upsert.mockResolvedValue({ error: null });
    await expect(
      creerDepotJournal("u-1").consigner({ cleTour: "j", role: "utilisatrice", contenu: "x" }),
    ).resolves.toBeUndefined();
  });
});

describe("depot-journal — le PORT domaine reste pur ; pas de fuite art. 9 en log (AD-1/NFR-022)", () => {
  it("lib/domain/depot-journal.ts n'importe AUCUNE infra (domaine pur)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/domain/depot-journal.ts"), "utf-8");
    expect(src).not.toMatch(/from\s+["'](@supabase|next\/|server-only|@\/lib\/data)/);
  });

  it("l'adaptateur ne logge / ne lève JAMAIS le contenu art. 9 (NFR-022)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/data/depot-journal.ts"), "utf-8");
    expect(src).toMatch(/import\s+["']server-only["']/); // barrière anti-client
    expect(src).toMatch(/createSupabaseServerClient/); // JWT
    expect(src).not.toMatch(/createSupabaseAdminClient/); // JAMAIS service_role (AD-12)
    expect(src).not.toMatch(/(throw|console)[^;]*\.contenu/); // ni throw ni log ne porte le verbatim
  });
});
