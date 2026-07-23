import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Story 1.5 — halte de consentement art. 9. Preuves BLOQUANTES en CI :
 *  - AC5 : la preuve de consentement s'écrit sous l'identité (RLS), horodatée, non révoquée ;
 *          impossible d'écrire pour une autre (with check) ni de lire celui d'une autre.
 *  - AC6 : la suppression du compte retire l'utilisatrice ET son consentement (cascade).
 *  - AC7 : aucune table de contenu art. 9 n'existe encore (le write-gate est la Story 1.6).
 *
 * On crée les comptes avec un mot de passe UNIQUEMENT dans ce test, pour minter des
 * sessions scopées. L'application, elle, reste sans mot de passe (FR-073).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const clientScope = () =>
  createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const t = Date.now();
const users = [
  { email: `cons-a-${t}@exemple.fr`, password: "test-cons-A-123!", id: "" },
  { email: `cons-b-${t}@exemple.fr`, password: "test-cons-B-123!", id: "" },
];

describe("Consentement — preuve écrite sous RLS (AC5)", () => {
  beforeAll(async () => {
    for (const u of users) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      u.id = data.user!.id;
    }
  });

  afterAll(async () => {
    for (const u of users) if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("écrit une ligne de consentement horodatée, sous SON identité, non révoquée (upsert idempotent)", async () => {
    const [a] = users;
    const c = clientScope();
    const { error: sign } = await c.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });
    expect(sign).toBeNull();

    // Même chemin que la Server Action « Je commence » : upsert sous la session RLS.
    const ligne = {
      utilisatrice_id: a.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    };
    const { error } = await c
      .from("consentement")
      .upsert(ligne, { onConflict: "utilisatrice_id" });
    expect(error).toBeNull();

    const { data } = await c
      .from("consentement")
      .select("art9_accorde, ia_reconnue, cgu_acceptees, cree_le, revoked_at")
      .eq("utilisatrice_id", a.id)
      .single();
    expect(data?.art9_accorde).toBe(true);
    expect(data?.ia_reconnue).toBe(true);
    expect(data?.cgu_acceptees).toBe(true);
    expect(data?.cree_le).toBeTruthy(); // horodaté
    expect(data?.revoked_at).toBeNull(); // révocation = Story 1.6

    // Idempotence : un second « Je commence » ne casse pas et ne duplique pas.
    const { error: err2 } = await c
      .from("consentement")
      .upsert(ligne, { onConflict: "utilisatrice_id" });
    expect(err2).toBeNull();
    const { data: apres } = await c.from("consentement").select("utilisatrice_id").eq("utilisatrice_id", a.id);
    expect(apres?.length).toBe(1);
    await c.auth.signOut();
  });

  it("ne peut PAS écrire un consentement au nom d'une autre (with check RLS)", async () => {
    const [a, b] = users;
    const c = clientScope();
    await c.auth.signInWithPassword({ email: a.email, password: a.password });
    const { error } = await c.from("consentement").insert({
      utilisatrice_id: b.id, // usurpation
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    });
    expect(error).not.toBeNull(); // la RLS with check refuse
    await c.auth.signOut();
  });

  it("ne peut PAS lire le consentement d'une autre (RLS masque)", async () => {
    const [a, b] = users;
    // b consent — préparé via admin (contourne la RLS pour poser la donnée).
    await admin.from("consentement").upsert(
      { utilisatrice_id: b.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
    const c = clientScope();
    await c.auth.signInWithPassword({ email: a.email, password: a.password });
    const { data } = await c
      .from("consentement")
      .select("utilisatrice_id")
      .eq("utilisatrice_id", b.id);
    expect(data?.length).toBe(0); // invisible
    await c.auth.signOut();
  });
});

describe("Refus → suppression immédiate du compte (AC6)", () => {
  it("supprimer le compte retire l'utilisatrice ET son consentement (cascade)", async () => {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: `cons-del-${t}@exemple.fr`,
      password: "test-del-123!",
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    const id = created.user!.id;

    await admin.from("consentement").upsert(
      { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
    const avant = await admin.from("utilisatrice").select("id").eq("id", id);
    expect(avant.data?.length).toBe(1);

    const { error: del } = await admin.auth.admin.deleteUser(id);
    expect(del).toBeNull();

    const u = await admin.from("utilisatrice").select("id").eq("id", id);
    expect(u.data?.length).toBe(0); // cascade auth.users → utilisatrice
    const cons = await admin.from("consentement").select("utilisatrice_id").eq("utilisatrice_id", id);
    expect(cons.data?.length).toBe(0); // cascade utilisatrice → consentement
  });
});

describe("Frontière art. 9 : aucune écriture avant consentement (AC7 / AD-4 / FR-072)", () => {
  // Tripwire : ces tables de CONTENU art. 9 n'existent pas encore. Leur write-gate
  // est la Story 1.6 (AD-13) ; quand elles arriveront, elles devront être gardées.
  const tablesArt9 = ["journal", "seance", "tirage", "socle"];
  it("aucune table de contenu art. 9 n'existe (seuls utilisatrice/consentement/probe)", async () => {
    for (const table of tablesArt9) {
      const { error } = await admin.from(table).select("*").limit(1);
      expect(error, `la table art. 9 « ${table} » ne devrait pas exister avant le write-gate (Story 1.6)`).not.toBeNull();
    }
  });
});
