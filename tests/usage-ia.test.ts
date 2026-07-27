import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Story 2.1 — la table `usage_ia` (métrage, AD-2, AC1). Preuves contre un vrai Supabase local :
 *  - deny-by-default : une session utilisatrice ne LIT ni n'ÉCRIT rien (server-authoritative) ;
 *  - idempotence : la même clé écrite deux fois n'ajoute qu'UNE ligne (on conflict do nothing) ;
 *  - NON-art. 9 : aucune colonne de contenu (prompt/réponse/verbatim).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

describe("usage_ia — métrage NON-art. 9, deny-by-default, idempotent (AD-2, AC1)", () => {
  const u = { email: `ui-${t}@exemple.fr`, password: "test-ui-123!", id: "" };
  const cle = `cle-${t}`;

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
    await admin.from("usage_ia").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("deny-by-default : une session utilisatrice ne LIT rien", async () => {
    await admin.from("usage_ia").insert({
      utilisatrice_id: u.id,
      cle_idempotence: `seed-${t}`,
      tier: "leger",
      modele: "m",
      tokens_entree: 1,
      tokens_sortie: 2,
    });
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { data, error } = await c.from("usage_ia").select("*");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // masqué (deny-by-default), la ligne existe pourtant
    await c.auth.signOut();
  });

  it("deny-by-default : une session utilisatrice ne PEUT PAS écrire (métrage server-authoritative)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c.from("usage_ia").insert({
      utilisatrice_id: u.id,
      cle_idempotence: `intrus-${t}`,
      tokens_entree: 0,
      tokens_sortie: 0,
    });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });

  it("idempotence : la même clé n'écrit qu'UNE ligne (on conflict do nothing)", async () => {
    const ligne = {
      utilisatrice_id: u.id,
      cle_idempotence: cle,
      tier: "leger",
      modele: "m",
      tokens_entree: 3,
      tokens_sortie: 4,
    };
    await admin.from("usage_ia").upsert(ligne, { onConflict: "utilisatrice_id,cle_idempotence", ignoreDuplicates: true });
    await admin
      .from("usage_ia")
      .upsert({ ...ligne, tokens_entree: 999 }, { onConflict: "utilisatrice_id,cle_idempotence", ignoreDuplicates: true });

    const { data } = await admin.from("usage_ia").select("tokens_entree").eq("cle_idempotence", cle);
    expect(data).toHaveLength(1);
    expect(data![0].tokens_entree).toBe(3); // la 2e tentative n'a rien réécrit
  });

  it("schéma SANS art. 9 : aucune colonne de contenu (prompt/réponse/verbatim)", async () => {
    const { data } = await admin.from("usage_ia").select("*").eq("cle_idempotence", cle).single();
    const colonnes = Object.keys(data!).sort();
    const permises = [
      "id",
      "utilisatrice_id",
      "cle_idempotence",
      "tier",
      "modele",
      "tokens_entree",
      "tokens_sortie",
      "cree_le",
    ].sort();
    expect(colonnes).toEqual(permises);
    for (const interdite of ["prompt", "reponse", "contenu", "texte", "message", "messages", "verbatim"]) {
      expect(colonnes).not.toContain(interdite);
    }
  });
});
