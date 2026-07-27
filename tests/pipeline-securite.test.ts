import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, ReponseIa } from "@/lib/ai/port";
import {
  evaluerSecuriteDuTour,
  doitExecuterTravailSchema,
  type DepotEpisode,
  type AuditDetresse,
} from "@/lib/safety/pipeline";
import type { VerdictSecurite } from "@/lib/safety/classer-detresse";

/**
 * Story 2.3 — le pipeline sécurité-d'abord (AC1/AC3). La détection s'exécute EN PREMIER, l'audit est
 * émis pour chaque classification, le forçage vaut pour tout l'épisode (max), le veto court-circuite
 * le travail de schéma. On injecte des factices (le vrai détecteur tourne dessus).
 */

function supabaseFactice(consenti = true, barre = false): SupabaseClient {
  return {
    rpc: async (nom: string) => {
      if (nom === "a_consenti_art9") return { data: consenti, error: null };
      if (nom === "est_barre_minorite") return { data: barre, error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
}

function adaptateur(texte: string): AiPort {
  return {
    estZdrProuve: () => true,
    completer: async (): Promise<ReponseIa> => ({
      texte,
      tier: "fort",
      modele: "factice",
      usage: { tokensEntree: 0, tokensSortie: 0 },
    }),
    diffuser: async function* () {},
  };
}

const messages = [{ role: "user" as const, content: "coucou" }];

function depotFactice(ouvert: boolean) {
  const signaler = vi.fn(async () => {});
  const depot: DepotEpisode = { episodeOuvert: async () => ouvert, signaler };
  return { depot, signaler };
}

describe("evaluerSecuriteDuTour — pipeline sécurité-d'abord", () => {
  it("niveau 0 : verdict poursuivre, audit émis (tier fort), épisode NON signalé", async () => {
    const audits: AuditDetresse[] = [];
    const { depot, signaler } = depotFactice(false);
    const r = await evaluerSecuriteDuTour(
      {
        supabase: supabaseFactice(),
        adaptateur: adaptateur("NIVEAU: 0"),
        depotEpisode: depot,
        emettreAudit: async (a) => void audits.push(a),
      },
      messages,
    );
    expect(r).toEqual({ bloque: false, verdict: { niveau: 0, decision: "poursuivre", supprimerTravailSchema: false } });
    expect(audits).toEqual([{ niveau: 0, decision: "poursuivre", tier: "fort" }]);
    expect(signaler).not.toHaveBeenCalled();
  });

  it("niveau 2 : verdict intervenir, audit émis, épisode signalé au niveau 2", async () => {
    const audits: AuditDetresse[] = [];
    const { depot, signaler } = depotFactice(false);
    const r = await evaluerSecuriteDuTour(
      { supabase: supabaseFactice(), adaptateur: adaptateur("NIVEAU: 2"), depotEpisode: depot, emettreAudit: async (a) => void audits.push(a) },
      messages,
    );
    expect(r.bloque).toBe(false);
    if (!r.bloque) expect(r.verdict.niveau).toBe(2);
    expect(audits[0]).toEqual({ niveau: 2, decision: "intervenir", tier: "fort" });
    expect(signaler).toHaveBeenCalledWith(2);
  });

  it("ÉPISODE OUVERT + tour classé 0 → niveauEffectif = 1 (forçage pour TOUT l'épisode, couture 2.4)", async () => {
    const audits: AuditDetresse[] = [];
    const { depot, signaler } = depotFactice(true); // épisode ouvert
    const r = await evaluerSecuriteDuTour(
      { supabase: supabaseFactice(), adaptateur: adaptateur("NIVEAU: 0"), depotEpisode: depot, emettreAudit: async (a) => void audits.push(a) },
      messages,
    );
    expect(r.bloque).toBe(false);
    if (!r.bloque) {
      expect(r.verdict.niveau).toBe(1);
      expect(r.verdict.supprimerTravailSchema).toBe(true);
    }
    expect(audits[0].niveau).toBe(1);
    expect(signaler).toHaveBeenCalledWith(1);
  });

  it("BLOCAGE d'egress → propagé, AUCUN audit émis (rien n'a été classé)", async () => {
    const audits: AuditDetresse[] = [];
    const { depot, signaler } = depotFactice(false);
    const r = await evaluerSecuriteDuTour(
      { supabase: supabaseFactice(false), adaptateur: adaptateur("NIVEAU: 3"), depotEpisode: depot, emettreAudit: async (a) => void audits.push(a) },
      messages,
    );
    expect(r).toEqual({ bloque: true, raison: "consentement" });
    expect(audits).toHaveLength(0);
    expect(signaler).not.toHaveBeenCalled();
  });

  it("sans depotEpisode injecté : placeholder honnête (aucun épisode ouvert) → le tour vaut son niveau détecté", async () => {
    const r = await evaluerSecuriteDuTour(
      { supabase: supabaseFactice(), adaptateur: adaptateur("NIVEAU: 0"), emettreAudit: async () => {} },
      messages,
    );
    expect(r.bloque).toBe(false);
    if (!r.bloque) expect(r.verdict.niveau).toBe(0);
  });
});

describe("doitExecuterTravailSchema — le veto (FR-037)", () => {
  it("niveau 0 : le travail de schéma peut s'exécuter", () => {
    const v: VerdictSecurite = { niveau: 0, decision: "poursuivre", supprimerTravailSchema: false };
    expect(doitExecuterTravailSchema(v)).toBe(true);
  });
  it("niveau ≥ 1 : le travail de schéma est VETOÉ", () => {
    const v: VerdictSecurite = { niveau: 2, decision: "intervenir", supprimerTravailSchema: true };
    expect(doitExecuterTravailSchema(v)).toBe(false);
  });
});
