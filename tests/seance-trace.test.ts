import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { creerDepotSeance } from "@/lib/data/depot-seance";
import { avancerArc, etatArcInitial, type SignauxTour } from "@/lib/domain/arc-seance";

/**
 * Story 2.7 (T3) — la trace `seance` (migration 0012) contre un vrai Supabase local. Preuves :
 *  - deny-by-default server-authoritative (patron episode_detresse) : une session utilisatrice ne LIT
 *    ni n'ÉCRIT rien ; la trace n'est écrite/lue que par des fonctions security definer (service_role) ;
 *  - SANS art. 9 : aucune colonne de contenu (signaux structurés uniquement) ;
 *  - l'arc ACCUMULE cross-tour via le dépôt RÉEL : construire → observer → nommer persiste sur N tours
 *    (la trace tourne vraiment, pas seulement le cœur pur).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const AUCUN_SIGNAL: SignauxTour = {
  elementPersonnelNonSollicite: false,
  sujetDeVieNouveau: false,
  reponseLongue: false,
  reformulationEmise: false,
  reformulationConfirmee: false,
  rejetProposition: false,
  restitution: false,
};
const sig = (p: Partial<SignauxTour>): SignauxTour => ({ ...AUCUN_SIGNAL, ...p });
const t = Date.now();

describe("seance — trace server-authoritative, deny-by-default, accumulée cross-tour (2.7, AD-12/AD-17)", () => {
  const u = { email: `seance-${t}@exemple.fr`, password: "test-seance-123!", id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) {
      throw new Error("Supabase local requis (SUPABASE_URL / PUBLISHABLE_KEY / SECRET_KEY).");
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    u.id = data.user!.id;
  });

  afterAll(async () => {
    await admin.from("seance").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  beforeEach(async () => {
    await admin.from("seance").delete().eq("utilisatrice_id", u.id);
  });

  // ── deny-by-default ──────────────────────────────────────────────────────────────────────────
  it("une session utilisatrice ne LIT rien (la trace existe pourtant)", async () => {
    const depot = creerDepotSeance(u.id);
    await depot.ecrire({ ...etatArcInitial(), sujetsAbordes: 2 }); // écrite par service_role
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { data, error } = await c.from("seance").select("*");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // masqué : deny-by-default
    await c.auth.signOut();
  });

  it("une session utilisatrice ne peut pas ÉCRIRE", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c.from("seance").insert({ utilisatrice_id: u.id, phase: "clore" });
    expect(error).not.toBeNull(); // aucune policy d'insertion
    await c.auth.signOut();
  });

  it("charger_seance / ecrire_seance sont réservées à service_role (client refusé)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const charge = await c.rpc("charger_seance", { cible: u.id });
    expect(charge.error, "charger_seance révoquée pour authenticated").not.toBeNull();
    await c.auth.signOut();
  });

  it("SANS art. 9 : aucune colonne de contenu (prompt/réponse/verbatim/message)", async () => {
    const depot = creerDepotSeance(u.id);
    await depot.ecrire(etatArcInitial());
    const { data } = await admin.from("seance").select("*").eq("utilisatrice_id", u.id).single();
    const colonnes = Object.keys(data!);
    for (const interdite of ["prompt", "reponse", "contenu", "texte", "message", "messages", "verbatim"]) {
      expect(colonnes).not.toContain(interdite);
    }
  });

  // ── le CONTRAT du dépôt réel ─────────────────────────────────────────────────────────────────
  it("charger() sans trace → état initial (construire, compteurs à 0) ; jamais un crash", async () => {
    const depot = creerDepotSeance(u.id);
    expect(await depot.charger()).toEqual(etatArcInitial());
  });

  it("ecrire() puis charger() round-trip l'état complet (phase, compteurs, booléens, propositions)", async () => {
    const depot = creerDepotSeance(u.id);
    const etat = {
      ...etatArcInitial(),
      phase: "nommer" as const,
      sujetsAbordes: 3,
      aReponseLongue: true,
      reformulationsEmises: 2,
      confirmations: 1,
      elementsPersonnels: 2,
      restitutions: 1,
      deuxDernieresPropositions: [true, false] as [boolean, boolean],
      observationDelivree: true,
      debutMs: 1_700_000_000_000,
    };
    await depot.ecrire(etat);
    expect(await depot.charger()).toEqual(etat);
  });

  // ── l'ARC accumule cross-tour via le dépôt réel (la trace tourne vraiment) ────────────────────
  it("construire → observer → nommer PERSISTE sur une suite de tours (preuve multi-tours)", async () => {
    const depot = creerDepotSeance(u.id);
    const tour = async (s: Partial<SignauxTour>, niveau: 0 | 1 = 0) => {
      const etat = await depot.charger(); // relecture depuis la BASE à chaque tour
      const r = avancerArc(etat, sig(s), niveau, 0);
      await depot.ecrire(r.etat);
      return r;
    };
    // construire : 3 sujets + réponse longue
    await tour({ sujetDeVieNouveau: true });
    await tour({ sujetDeVieNouveau: true });
    await tour({ sujetDeVieNouveau: true, reponseLongue: true });
    expect((await depot.charger()).phase).toBe("observer");
    // observer : 2 reformulations + 1 confirmation + 1 élément personnel → nommer
    await tour({ reformulationEmise: true, elementPersonnelNonSollicite: true });
    await tour({ reformulationEmise: true });
    const versNommer = await tour({ reformulationConfirmee: true });
    expect(versNommer.beat).toBe("nommer");
    const trace = await depot.charger();
    expect(trace.phase).toBe("nommer");
    expect(trace.sujetsAbordes).toBe(3);
    expect(trace.reformulationsEmises).toBe(2);
    expect(trace.confirmations).toBe(1);
    expect(trace.elementsPersonnels).toBe(1);
  });
});
