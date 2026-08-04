import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 4.6 — la LECTURE de la projection de l'arbre (migration 0022, security invoker) :
 *  - `charger_branches_arbre()`  : les branches de l'appelante + le VERBATIM de leur extrait source (la fiche) ;
 *  - `charger_echange_source()`  : le message exact (est_cible) + son voisinage (« Voir dans la conversation »).
 * Preuves : isolation (RLS propriétaire), verbatim remonté (FR-027), anon refusé (grant authenticated seul).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-arbre-123!";

async function creerUtilisatrice(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}

async function graverEntreeAt(id: string, cleTour: string, contenu: string, role = "utilisatrice", creeLe?: string): Promise<string> {
  const row: Record<string, unknown> = { utilisatrice_id: id, cle_tour: cleTour, role, contenu };
  if (creeLe) row.cree_le = creeLe;
  const { data, error } = await admin.from("entree_journal").insert(row).select("id").single();
  if (error) throw new Error(`graverEntree: ${error.message}`);
  return data!.id as string;
}

async function poserBranche(id: string, entreeId: string, nom: string): Promise<string> {
  const { data, error } = await admin.from("branche").insert({ utilisatrice_id: id, extrait_source_id: entreeId, nom }).select("id").single();
  if (error) throw new Error(`poserBranche: ${error.message}`);
  return data!.id as string;
}

async function session(email: string): Promise<SupabaseClient> {
  const c = clientScope();
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

async function purger(id: string) {
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  if (id) await admin.auth.admin.deleteUser(id);
}

describe("charger_branches_arbre — projection possédée + verbatim (AC1/AC3)", () => {
  const u = { email: `arbre-${t}@exemple.fr`, id: "", e1: "", e2: "" };
  const autre = { email: `arbre-autre-${t}@exemple.fr`, id: "", e: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
    u.id = await creerUtilisatrice(u.email);
    autre.id = await creerUtilisatrice(autre.email);
    u.e1 = await graverEntreeAt(u.id, `arbre-e1-${t}`, "je crois que je lui en veux pour autre chose", "utilisatrice", "2026-03-10T10:00:00Z");
    u.e2 = await graverEntreeAt(u.id, `arbre-e2-${t}`, "arrêter de payer la mauvaise facture", "utilisatrice", "2026-03-12T10:00:00Z");
    await poserBranche(u.id, u.e1, "en vouloir à la bonne personne");
    await poserBranche(u.id, u.e2, "arrêter de payer la mauvaise facture");
    autre.e = await graverEntreeAt(autre.id, `arbre-autre-e-${t}`, "un secret d'autrui", "utilisatrice");
    await poserBranche(autre.id, autre.e, "la branche d'autrui");
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(autre.id);
  });

  it("remonte MES branches + le verbatim de leur extrait source, ordonnées par date_naissance", async () => {
    const c = await session(u.email);
    const { data, error } = await c.rpc("charger_branches_arbre");
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(2);
    const noms = (data ?? []).map((r: { nom: string }) => r.nom);
    expect(noms).toContain("en vouloir à la bonne personne");
    // le verbatim de l'extrait est présent (la fiche le rend « comme un tour d'utilisatrice », FR-027)
    const ligne = (data ?? []).find((r: { extrait_source_id: string }) => r.extrait_source_id === u.e2);
    expect(ligne.extrait_contenu).toBe("arrêter de payer la mauvaise facture");
    expect(ligne.etat).toBe("naissance");
    await c.auth.signOut();
  });

  it("ne remonte JAMAIS les branches d'autrui (isolation RLS)", async () => {
    const c = await session(u.email);
    const { data } = await c.rpc("charger_branches_arbre");
    const noms = (data ?? []).map((r: { nom: string }) => r.nom);
    expect(noms).not.toContain("la branche d'autrui");
    await c.auth.signOut();
  });

  it("anon (non authentifié) : la RPC est refusée (grant authenticated seul)", async () => {
    const anon = clientScope();
    const { error } = await anon.rpc("charger_branches_arbre");
    expect(error, "execute révoqué de anon").not.toBeNull();
  });
});

describe("charger_echange_source — le message exact + son voisinage (AC4)", () => {
  const u = { email: `echange-${t}@exemple.fr`, id: "", cible: "" };
  const autre = { email: `echange-autre-${t}@exemple.fr`, id: "", e: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    autre.id = await creerUtilisatrice(autre.email);
    // 5 tours autour d'une cible (e2), horodatés pour un ordre déterministe.
    await graverEntreeAt(u.id, `ech-0-${t}`, "tour 0", "utilisatrice", "2026-03-12T10:00:00Z");
    await graverEntreeAt(u.id, `ech-1-${t}`, "tour 1 (anam)", "anam", "2026-03-12T10:01:00Z");
    u.cible = await graverEntreeAt(u.id, `ech-2-${t}`, "LE MESSAGE EXACT", "utilisatrice", "2026-03-12T10:02:00Z");
    await graverEntreeAt(u.id, `ech-3-${t}`, "tour 3 (anam)", "anam", "2026-03-12T10:03:00Z");
    await graverEntreeAt(u.id, `ech-4-${t}`, "tour 4", "utilisatrice", "2026-03-12T10:04:00Z");
    autre.e = await graverEntreeAt(autre.id, `ech-autre-${t}`, "extrait d'autrui", "utilisatrice");
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(autre.id);
  });

  it("renvoie le message exact (est_cible=true) + son voisinage, ordonné par cree_le", async () => {
    const c = await session(u.email);
    const { data, error } = await c.rpc("charger_echange_source", { p_extrait_source_id: u.cible });
    expect(error).toBeNull();
    const lignes = data ?? [];
    const cible = lignes.filter((r: { est_cible: boolean }) => r.est_cible);
    expect(cible).toHaveLength(1);
    expect(cible[0].contenu).toBe("LE MESSAGE EXACT");
    // le voisinage est présent (avant et après)
    const contenus = lignes.map((r: { contenu: string }) => r.contenu);
    expect(contenus).toContain("tour 1 (anam)");
    expect(contenus).toContain("tour 3 (anam)");
    // ordre chronologique
    const temps = lignes.map((r: { cree_le: string }) => new Date(r.cree_le).getTime());
    expect(temps).toEqual([...temps].sort((a, b) => a - b));
    await c.auth.signOut();
  });

  it("isolation : demander l'extrait d'autrui → rien (jamais le journal d'autrui)", async () => {
    const c = await session(u.email);
    const { data } = await c.rpc("charger_echange_source", { p_extrait_source_id: autre.e });
    expect((data ?? []).length).toBe(0);
    await c.auth.signOut();
  });
});
