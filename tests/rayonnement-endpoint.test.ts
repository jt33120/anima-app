import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { declarerMajorite } from "./_semis";

/**
 * Story 4.7 — LE GESTE IRRÉVERSIBLE, de bout en bout : la route → le dépôt → la RPC → la base.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. La revue a montré que le seul chemin d'écriture du rayonnement n'avait
 * AUCUN test de comportement : ni l'adaptateur (`declarerRayonnement`), ni l'action `rayonnement` de la
 * route. Trois mutants — inverser la garde de session, avaler l'erreur de la RPC, appeler la RPC avec le
 * mauvais paramètre — passaient à travers la totalité de la suite. Or c'est le geste qui écrit un état
 * qu'on ne peut PLUS retirer : c'est précisément là qu'un silence de test coûte le plus cher.
 *
 * On monte la vraie route contre le vrai Supabase local, sous un vrai JWT.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const t = Date.now();
const MDP = "test-geste-123!";

/** La route lit sa session via `createSupabaseServerClient` (cookies) : on lui injecte le client JWT. */
const clientCourant = { valeur: null as SupabaseClient | null };
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => clientCourant.valeur,
}));

const { POST } = await import("@/app/api/anam/branche/route");

function req(body: unknown): Request {
  return new Request("http://local/api/anam/branche", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function creerUtilisatrice(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  await declarerMajorite(admin, data.user!.id);
  return data.user!.id;
}
async function session(email: string): Promise<SupabaseClient> {
  const c = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}
async function donnerConsentement(c: SupabaseClient, id: string) {
  const { error } = await c.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`consentement: ${error.message}`);
}
async function creerBranche(id: string, marqueur: string): Promise<string> {
  const { data: e, error: ee } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: `geste-${marqueur}-${t}`, role: "utilisatrice", contenu: "un tour" })
    .select("id")
    .single();
  if (ee) throw new Error(`entree: ${ee.message}`);
  const { data, error } = await admin
    .from("branche")
    .insert({ utilisatrice_id: id, extrait_source_id: e!.id, nom: `branche ${marqueur}` })
    .select("id")
    .single();
  if (error) throw new Error(`branche: ${error.message}`);
  return data!.id as string;
}
async function etatDe(brancheId: string) {
  const { data } = await admin.from("branche").select("etat, date_rayonnement").eq("id", brancheId).single();
  return data as { etat: string; date_rayonnement: string | null };
}
async function purger(id: string) {
  if (!id) return;
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

describe("POST /api/anam/branche — action `rayonnement` (le seul chemin vers la pleine lumière)", () => {
  const u = { email: `geste-${t}@exemple.fr`, id: "" };
  const autre = { email: `geste-autre-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
    u.id = await creerUtilisatrice(u.email);
    autre.id = await creerUtilisatrice(autre.email);
    autre.branche = await creerBranche(autre.id, "victime");
    clientCourant.valeur = await session(u.email);
    await donnerConsentement(clientCourant.valeur, u.id);
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(autre.id);
  });

  it("le geste écrit RÉELLEMENT l'état et sa date en base (bout en bout, pas un mock)", async () => {
    const b = await creerBranche(u.id, "nominal");
    const r = await POST(req({ action: "rayonnement", brancheId: b }));
    expect(r.status).toBe(200);
    const apres = await etatDe(b);
    expect(apres.etat).toBe("rayonnement");
    expect(apres.date_rayonnement, "AC5 : la fiche doit pouvoir dire depuis quand").not.toBeNull();
  });

  it("un second POST est IDEMPOTENT — même statut, et la date d'origine ne bouge pas", async () => {
    const b = await creerBranche(u.id, "idem");
    await POST(req({ action: "rayonnement", brancheId: b }));
    const premiere = (await etatDe(b)).date_rayonnement;
    const r = await POST(req({ action: "rayonnement", brancheId: b }));
    expect(r.status, "un double-tap ne doit pas afficher d'échec").toBe(200);
    expect((await etatDe(b)).date_rayonnement).toBe(premiere);
  });

  it("SANS SESSION → 401, et rien n'est écrit", async () => {
    const b = await creerBranche(u.id, "anon");
    const avecSession = clientCourant.valeur;
    clientCourant.valeur = createClient(url, publishable, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const r = await POST(req({ action: "rayonnement", brancheId: b }));
    expect(r.status).toBe(401);
    expect((await etatDe(b)).etat).toBe("naissance");
    clientCourant.valeur = avecSession;
  });

  it("la branche d'AUTRUI → refus, et son arbre n'a pas bougé (isolation)", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spyE = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(req({ action: "rayonnement", brancheId: autre.branche }));
    expect(r.status, "un refus métier, pas une panne").toBe(403);
    expect((await etatDe(autre.branche)).etat).toBe("naissance");
    spy.mockRestore();
    spyE.mockRestore();
  });

  it("`brancheId` manquant, vide, ou d'un autre type → 400 (validation d'entrée)", async () => {
    for (const corps of [
      { action: "rayonnement" },
      { action: "rayonnement", brancheId: "" },
      { action: "rayonnement", brancheId: 42 },
      { action: "rayonnement", brancheId: null },
      { action: "rayonnement", brancheId: ["a"] },
      { action: "rayonnement", brancheId: { id: "a" } },
    ]) {
      const r = await POST(req(corps));
      expect(r.status, JSON.stringify(corps)).toBe(400);
    }
  });

  it("un identifiant BIEN FORMÉ mais inexistant est refusé, pas avalé en silence", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spyE = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(req({ action: "rayonnement", brancheId: "00000000-0000-4000-8000-000000000000" }));
    expect(r.status).toBe(403);
    spy.mockRestore();
    spyE.mockRestore();
  });

  it("[AD-17 / D3] pendant un épisode de détresse, le geste est REFUSÉ et rien n'est écrit", async () => {
    // La garde vit au point d'écriture (0025). Ici on prouve qu'elle traverse bien toute la pile
    // jusqu'au statut HTTP — c'est ce statut qui décide du message affiché, et un 500 ferait promettre
    // « tu peux réessayer » à quelqu'un qui sort d'une crise.
    const b = await creerBranche(u.id, "detresse");
    await admin.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 2 });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spyE = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(req({ action: "rayonnement", brancheId: b }));
    expect(r.status, "un REFUS (403), pas une panne (500) — le message affiché en dépend").toBe(403);
    expect((await etatDe(b)).etat).toBe("naissance");
    spy.mockRestore();
    spyE.mockRestore();
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
  });

  it("[NFR-022] ni la réponse ni le journal ne portent le NOM de la branche", async () => {
    const b = await creerBranche(u.id, "art9");
    await admin.from("branche").update({ nom: "NOM_ART9_TRES_SECRET" }).eq("id", b);
    const canaux = (["error", "warn", "log"] as const).map((n) => vi.spyOn(console, n).mockImplementation(() => {}));
    const r = await POST(req({ action: "rayonnement", brancheId: b }));
    const corps = await r.text();
    const journal = canaux.flatMap((s) => s.mock.calls).map((a) => JSON.stringify(a)).join("\n");
    expect(corps, "le nom ne revient pas dans la réponse").not.toContain("NOM_ART9_TRES_SECRET");
    expect(journal, "ni dans le journal").not.toContain("NOM_ART9_TRES_SECRET");
    for (const s of canaux) s.mockRestore();
  });
});
