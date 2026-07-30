import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.2 (T3) — le dépôt des faits extraits. Le client JWT est MOCKÉ (aucune base ici) : on prouve le
 * CÂBLAGE vers l'unique fonction possédée `fusionner_fait_extrait` (bons arguments par chemin), et que le
 * dépôt LÈVE sur erreur réelle. Le comportement base réel (idempotence, anti-résurrection, RLS) est prouvé
 * de bout en bout dans `fait-extrait.test.ts` et `depot-faits` (intégration, plus bas).
 *
 * Décision de dev : l'identité vient du JWT (`auth.uid()` dans la RPC), donc `creerDepotFaits()` ne prend
 * PAS d'`utilisatriceId` (contraste avec `creerDepotJournal(id)` : ici l'id n'est jamais fourni par l'appelant).
 */

const rpc = vi.fn();
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc })),
}));

import { creerDepotFaits } from "@/lib/data/depot-faits";

describe("depot-faits — câblage vers l'unique fonction de merge possédée (T3/AC4)", () => {
  beforeEach(() => rpc.mockReset());

  it("fusionner (auto) appelle fusionner_fait_extrait avec origine='extrait', statut='actif', lien source", async () => {
    rpc.mockResolvedValue({ error: null });
    await creerDepotFaits().fusionner({ cleDedoublonnage: "cle-1", contenu: "aime la forêt", extraitSourceId: "src-1" });
    expect(rpc).toHaveBeenCalledWith("fusionner_fait_extrait", {
      p_origine: "extrait",
      p_statut: "actif",
      p_cle: "cle-1",
      p_contenu: "aime la forêt",
      p_extrait_source: "src-1",
    });
  });

  it("corriger (utilisatrice) appelle avec origine='utilisatrice', statut='corrige', la version utilisatrice", async () => {
    rpc.mockResolvedValue({ error: null });
    await creerDepotFaits().corriger("cle-2", "en réalité, la montagne");
    expect(rpc).toHaveBeenCalledWith("fusionner_fait_extrait", {
      p_origine: "utilisatrice",
      p_statut: "corrige",
      p_cle: "cle-2",
      p_contenu: "en réalité, la montagne",
      p_extrait_source: null,
    });
  });

  it("supprimer (utilisatrice) appelle avec statut='supprime' et contenu VIDÉ (tombstone, point (b))", async () => {
    rpc.mockResolvedValue({ error: null });
    await creerDepotFaits().supprimer("cle-3");
    expect(rpc).toHaveBeenCalledWith("fusionner_fait_extrait", {
      p_origine: "utilisatrice",
      p_statut: "supprime",
      p_cle: "cle-3",
      p_contenu: "",
      p_extrait_source: null,
    });
  });

  it("lève si la base renvoie une erreur réelle (RLS/write-gate/trigger/DB)", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "row-level security" } });
    await expect(creerDepotFaits().fusionner({ cleDedoublonnage: "c", contenu: "x", extraitSourceId: "s" })).rejects.toThrow();
  });
});

describe("depot-faits — le PORT domaine reste pur ; pas de fuite art. 9 (AD-1/NFR-022)", () => {
  it("lib/domain/fusion-fait.ts n'importe AUCUNE infra (domaine pur)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/domain/fusion-fait.ts"), "utf-8");
    expect(src).not.toMatch(/from\s+["'](@supabase|next\/|server-only|@\/lib\/data)/);
  });

  it("l'adaptateur est server-only, sous JWT, et ne logge/lève JAMAIS le contenu ni la clé (NFR-022)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/data/depot-faits.ts"), "utf-8");
    expect(src).toMatch(/import\s+["']server-only["']/); // barrière anti-client
    expect(src).toMatch(/createSupabaseServerClient/); // JWT
    expect(src).not.toMatch(/createSupabaseAdminClient/); // JAMAIS service_role (AD-12)
    expect(src).not.toMatch(/(throw|console)[^;]*\.(contenu|cleDedoublonnage)/); // ni throw ni log ne porte l'art. 9
  });
});
