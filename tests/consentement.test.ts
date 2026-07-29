import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { accordsComplets } from "@/app/(auth)/consentement/accords";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";

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

describe("Frontière art. 9 : le gabarit du write-gate existe, les vraies tables de contenu non (AC7 / AD-4 / FR-072)", () => {
  // Le write-gate art. 9 est désormais posé (Story 1.6) : le gabarit `art9_temoin` existe et est
  // gardé (comportement prouvé dans write-gate-art9.test.ts). Les VRAIES tables de contenu art. 9
  // (verbatim) n'existent toujours pas — elles arriveront dans leurs epics et copieront la policy du
  // gabarit. NB : `seance` (Story 2.7) existe désormais mais ne porte AUCUN verbatim (signaux
  // structurés, server-authoritative deny-by-default, comme `episode_detresse`) → hors de cette liste.
  const tablesContenu = ["journal", "tirage", "socle"];
  it("le gabarit `art9_temoin` existe (sonde vivante du write-gate)", async () => {
    const { error } = await admin.from("art9_temoin").select("*").limit(1);
    expect(error).toBeNull();
  });
  it("aucune VRAIE table de contenu art. 9 n'existe encore", async () => {
    for (const table of tablesContenu) {
      const { error } = await admin.from(table).select("*").limit(1);
      expect(error, `la table de contenu art. 9 « ${table} » ne devrait pas exister avant son epic`).not.toBeNull();
    }
  });
});

describe("Re-validation serveur des accords (AC5) — logique pure, couverte en CI", () => {
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  it("les deux accords cochés → valide", () => {
    expect(accordsComplets(fd({ art9: "on", cgu: "on" }))).toBe(true);
  });
  it("un seul accord → refusé", () => {
    expect(accordsComplets(fd({ art9: "on" }))).toBe(false);
    expect(accordsComplets(fd({ cgu: "on" }))).toBe(false);
  });
  it("valeur autre que 'on' ou champ absent → refusé (pas de faux positif)", () => {
    expect(accordsComplets(fd({ art9: "true", cgu: "true" }))).toBe(false);
    expect(accordsComplets(fd({}))).toBe(false);
  });
});

describe("La garde exige art9_accorde=true, pas la simple existence d'une ligne (revue 1.5)", () => {
  const u = { email: `cons-art9-${t}@exemple.fr`, password: "test-art9-123!", id: "" };

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    u.id = data.user!.id;
    // Majeure, date posée : sinon la garde s'arrête AVANT l'étape consentement.
    const { error: e2 } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1990-01-01" })
      .eq("id", u.id);
    if (e2) throw new Error(`date_naissance: ${e2.message}`);
  });

  afterAll(async () => {
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("une ligne art9_accorde=false NE débloque PAS la scène → étape 'consentement'", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: false, ia_reconnue: false, cgu_acceptees: false },
      { onConflict: "utilisatrice_id" },
    );
    expect(error).toBeNull();
    expect(await etapeOnboardingPour(c, u.id)).toBe("consentement");
    await c.auth.signOut();
  });

  it("art9_accorde=true + ia_reconnue=true → étape 'suite' (scène débloquée)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
    expect(error).toBeNull();
    expect(await etapeOnboardingPour(c, u.id)).toBe("suite");
    await c.auth.signOut();
  });
});
