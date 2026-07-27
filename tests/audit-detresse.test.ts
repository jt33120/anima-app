import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Story 2.3 — l'audit de détresse (migration 0009) contre un vrai Supabase local. Preuves :
 *  - deny-by-default : une session utilisatrice ne LIT ni n'ÉCRIT rien (server-authoritative) ;
 *  - la RPC `journaliser_audit_detresse` est RÉSERVÉE au service_role (révoquée pour authenticated) ;
 *  - idempotence PAR TOUR : la même clé n'écrit qu'UNE ligne ('detresse') ;
 *  - SANS art. 9 : niveau/tier/décision/horodatage seulement, aucune colonne de contenu.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

describe("audit_securite (détresse) — sans art. 9, deny-by-default, idempotent (FR-078, AD-16)", () => {
  const u = { email: `ad-${t}@exemple.fr`, password: "test-ad-123!", id: "" };
  const cle = `tour-${t}`;

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
    await admin.from("audit_securite").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("la RPC écrit un audit 'detresse' (niveau, décision, tier) via service_role", async () => {
    const { error } = await admin.rpc("journaliser_audit_detresse", {
      cible: u.id,
      p_niveau: 2,
      p_decision: "intervenir",
      p_tier: "fort",
      p_cle: cle,
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("audit_securite")
      .select("type, niveau, decision, tier")
      .eq("utilisatrice_id", u.id)
      .eq("type", "detresse");
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ type: "detresse", niveau: 2, decision: "intervenir", tier: "fort" });
  });

  it("idempotence PAR TOUR : la même clé n'écrit qu'UNE ligne (on conflict do nothing)", async () => {
    await admin.rpc("journaliser_audit_detresse", {
      cible: u.id,
      p_niveau: 3,
      p_decision: "urgence",
      p_tier: "fort",
      p_cle: cle, // même clé que le test précédent
    });
    const { data } = await admin
      .from("audit_securite")
      .select("niveau")
      .eq("utilisatrice_id", u.id)
      .eq("cle_idempotence", cle);
    expect(data).toHaveLength(1);
    expect(data![0].niveau).toBe(2); // la 2e tentative (niveau 3) n'a rien réécrit
  });

  it("CHECK défense en profondeur : niveau hors 0-3 et tier != 'fort' sont REJETÉS", async () => {
    const niveauInvalide = await admin.rpc("journaliser_audit_detresse", {
      cible: u.id, p_niveau: 99, p_decision: "poursuivre", p_tier: "fort", p_cle: `chk-niv-${t}`,
    });
    expect(niveauInvalide.error, "niveau=99 doit violer le CHECK").not.toBeNull();
    const tierInvalide = await admin.rpc("journaliser_audit_detresse", {
      cible: u.id, p_niveau: 2, p_decision: "intervenir", p_tier: "leger", p_cle: `chk-tier-${t}`,
    });
    expect(tierInvalide.error, "tier='leger' doit violer le CHECK (AD-5)").not.toBeNull();
  });

  it("deny-by-default : une session utilisatrice ne LIT rien", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { data, error } = await c.from("audit_securite").select("*");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // masqué : les lignes existent pourtant
    await c.auth.signOut();
  });

  it("la RPC est RÉSERVÉE au service_role : une cliente ne peut pas l'appeler", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c.rpc("journaliser_audit_detresse", {
      cible: u.id,
      p_niveau: 0,
      p_decision: "poursuivre",
      p_tier: "fort",
      p_cle: `intrus-${t}`,
    });
    expect(error).not.toBeNull(); // execute révoqué pour authenticated
    await c.auth.signOut();
  });

  it("SANS art. 9 : aucune colonne de contenu (prompt/réponse/verbatim)", async () => {
    const { data } = await admin
      .from("audit_securite")
      .select("*")
      .eq("utilisatrice_id", u.id)
      .eq("type", "detresse")
      .limit(1)
      .single();
    const colonnes = Object.keys(data!);
    for (const interdite of ["prompt", "reponse", "contenu", "texte", "message", "messages", "verbatim"]) {
      expect(colonnes).not.toContain(interdite);
    }
  });
});
