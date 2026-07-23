import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { calculerAge, estMajeur } from "@/app/(auth)/naissance/age";

/** Story 1.4 — barrière 18 ans + date immuable. */

describe("Règle de majorité — pure, appliquée côté serveur (NFR-023)", () => {
  const now = new Date("2026-07-23T12:00:00Z");

  it("la veille du 18e anniversaire → mineur (17)", () => {
    expect(calculerAge("2008-07-24", now)).toBe(17);
    expect(estMajeur("2008-07-24", now)).toBe(false);
  });
  it("pile 18 ans le jour anniversaire → majeur", () => {
    expect(estMajeur("2008-07-23", now)).toBe(true);
  });
  it("bien plus de 18 ans → majeur", () => {
    expect(estMajeur("1990-01-01", now)).toBe(true);
  });
  it("16 ans → mineur", () => {
    expect(estMajeur("2010-06-15", now)).toBe(false);
  });
  it("date future ou invalide → non majeur", () => {
    expect(estMajeur("2030-01-01", now)).toBe(false);
    expect(estMajeur("pas-une-date", now)).toBe(false);
  });
});

describe("date_naissance en base — stockage + immuabilité (AD-6)", () => {
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  let id = "";

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `dn-${Date.now()}@exemple.fr`,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    id = data.user!.id;
  });
  afterAll(async () => {
    if (id) await admin.auth.admin.deleteUser(id);
  });

  it("une date ≥ 18 se stocke une première fois", async () => {
    const { error } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1990-01-01" })
      .eq("id", id);
    expect(error).toBeNull();
    const { data } = await admin
      .from("utilisatrice")
      .select("date_naissance")
      .eq("id", id)
      .single();
    expect(data?.date_naissance).toBe("1990-01-01");
  });

  it("elle est immuable : une 2e écriture différente est refusée", async () => {
    const { error } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1991-02-02" })
      .eq("id", id);
    expect(error).not.toBeNull(); // le trigger lève « date_naissance est immuable »
  });
});
