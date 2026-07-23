import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Preuve d'ISOLATION de `utilisatrice` (Story 1.3, AC3) — le jumeau de la preuve RLS de 1.1.
 * Deux utilisatrices distinctes : chacune ne voit QUE sa propre ligne. Bloquant en CI.
 *
 * Note : on crée les comptes avec un mot de passe UNIQUEMENT dans ce test, pour minter
 * deux sessions scopées. L'application, elle, reste sans mot de passe (FR-073).
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
  { email: `iso-a-${t}@exemple.fr`, password: "test-iso-A-123!", id: "" },
  { email: `iso-b-${t}@exemple.fr`, password: "test-iso-B-123!", id: "" },
];

describe("Isolation RLS de utilisatrice (AC3)", () => {
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

  it("le trigger a créé exactement une ligne utilisatrice par compte", async () => {
    for (const u of users) {
      const { data } = await admin.from("utilisatrice").select("id").eq("id", u.id);
      expect(data?.length).toBe(1);
    }
  });

  it("chaque utilisatrice ne voit QUE sa propre ligne", async () => {
    for (const u of users) {
      const c = clientScope();
      const { error } = await c.auth.signInWithPassword({
        email: u.email,
        password: u.password,
      });
      expect(error).toBeNull();
      const { data } = await c.from("utilisatrice").select("id");
      expect(data?.length).toBe(1);
      expect(data?.[0]?.id).toBe(u.id);
      await c.auth.signOut();
    }
  });

  it("une utilisatrice ne peut PAS lire la ligne d'une autre", async () => {
    const [a, b] = users;
    const c = clientScope();
    await c.auth.signInWithPassword({ email: a.email, password: a.password });
    const { data } = await c.from("utilisatrice").select("id").eq("id", b.id);
    expect(data?.length).toBe(0); // la RLS masque la ligne de l'autre
    await c.auth.signOut();
  });
});
