import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 4.5 (T4) — l'endpoint d'écriture `POST /api/anam/branche`. Client Supabase MOCKÉ : on prouve l'auth
 * (401 sans session), le routage des deux actions vers les fonctions possédées, le refus du nom vide (AC2)
 * AVANT toute RPC, et l'absence de fuite art. 9 sur le chemin d'erreur (NFR-022). Le comportement base réel
 * (RLS, AD-17, isolation) est prouvé dans `branche.test.ts`.
 */

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));

import { POST } from "@/app/api/anam/branche/route";

function req(body: unknown): Request {
  return new Request("http://local/api/anam/branche", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/anam/branche — auth & routage (AC2/AC4)", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
  });

  it("401 sans session (AD-2 : jamais d'écriture sans identité)", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const r = await POST(req({ action: "creer", signalId: "s", nom: "x" }));
    expect(r.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creer : route vers creer_branche_depuis_signal et renvoie ok", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ error: null });
    const r = await POST(req({ action: "creer", signalId: "sig", nom: "mes mots" }));
    expect(r.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("creer_branche_depuis_signal", { p_signal_id: "sig", p_nom: "mes mots" });
  });

  it("[AC2] creer avec nom vide/espaces → 400 AVANT toute RPC (une branche sans nom n'existe pas)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    const r = await POST(req({ action: "creer", signalId: "sig", nom: "   " }));
    expect(r.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refus : route vers ecarter_signal_reconceptualisation", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ error: null });
    const r = await POST(req({ action: "refus", signalId: "sig" }));
    expect(r.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("ecarter_signal_reconceptualisation", { p_signal_id: "sig" });
  });

  it("action inconnue / signal manquant → 400", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    expect((await POST(req({ action: "autre", signalId: "s" }))).status).toBe(400);
    expect((await POST(req({ action: "creer", nom: "x" }))).status).toBe(400);
  });

  it("renommer : route vers renommer_branche (brancheId + nom donné par elle)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ error: null });
    const r = await POST(req({ action: "renommer", brancheId: "b1", nom: "nouveau nom" }));
    expect(r.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("renommer_branche", { p_branche_id: "b1", p_nouveau_nom: "nouveau nom" });
  });

  it("[AC2] renommer avec nom vide → 400 avant RPC ; branche manquante → 400", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    expect((await POST(req({ action: "renommer", brancheId: "b1", nom: "  " }))).status).toBe(400);
    expect((await POST(req({ action: "renommer", nom: "x" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("[NFR-022] REFUS d'une garde → 403 { code } sans art. 9 (ni nom, ni message d'erreur)", async () => {
    // P0001 = `raise` d'un de nos triggers (AD-17 détresse, immuabilité). C'est un REFUS, pas une panne :
    // il ne doit PAS s'annoncer comme une indisponibilité de RPC de sécurité (re-revue).
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ error: { code: "P0001", message: "AD-17 detresse SECRET" } });
    const alerte = vi.spyOn(console, "error").mockImplementation(() => {});
    const avert = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await POST(req({ action: "creer", signalId: "sig", nom: "NOM_SECRET_zzz" }));
    expect(r.status).toBe(403);
    const body = JSON.stringify(await r.json());
    expect(body).not.toContain("NOM_SECRET_zzz");
    expect(body).not.toContain("SECRET");
    expect(alerte, "un refus de garde n'est pas un incident de sécurité").not.toHaveBeenCalled();
    expect(avert, "il reste tout de même tracé pour le diagnostic").toHaveBeenCalled();
    // Et le journal lui-même ne porte aucun art. 9.
    expect(JSON.stringify(avert.mock.calls)).not.toContain("SECRET");
    alerte.mockRestore();
    avert.mockRestore();
  });

  it("[NFR-022] PANNE réelle → 500, et elle, va bien dans le canal des incidents de sécurité", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ error: { code: "08006", message: "connection failure" } });
    const alerte = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(req({ action: "creer", signalId: "sig", nom: "un nom" }));
    expect(r.status).toBe(500);
    expect(alerte, "une vraie panne doit rester un incident").toHaveBeenCalled();
    alerte.mockRestore();
  });
});
