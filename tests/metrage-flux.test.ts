import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { metrerUsageIa } from "@/lib/ai/metrage";

/**
 * Story 2.2 — le métrage du flux, EXACTEMENT UNE FOIS, réconcilié à la fin/à l'avortement (NFR-014).
 * `metrerUsageIa` est extrait de la route pour être testable en SQL réel, indépendamment du stream.
 *  - un flux complet → UNE ligne (compteurs finaux) ;
 *  - REJEU de la même clé (retry après avortement) → toujours UNE ligne (on conflict do nothing) ;
 *  - un flux avorté (compteurs partiels) est métré une fois aussi, via la même clé.
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

describe("Métrage du flux — exactement une fois (NFR-014, AD-2)", () => {
  const u = { email: `mf-${t}@exemple.fr`, password: "test-mf-123!", id: "" };

  beforeAll(async () => {
    if (!url || !secret) throw new Error("Supabase local requis.");
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

  it("un flux complet écrit UNE ligne avec les compteurs finaux", async () => {
    const cle = `flux-${t}`;
    await metrerUsageIa({
      utilisatriceId: u.id,
      cleIdempotence: cle,
      tier: "leger",
      modele: "factice",
      tokensEntree: 7,
      tokensSortie: 42,
    });
    const { data } = await admin.from("usage_ia").select("*").eq("cle_idempotence", cle);
    expect(data).toHaveLength(1);
    expect(data![0].tokens_sortie).toBe(42);
    expect(data![0].modele).toBe("factice");
  });

  it("REJEU de la même clé (retry après avortement) → toujours UNE ligne", async () => {
    const cle = `rejeu-${t}`;
    const base = {
      utilisatriceId: u.id,
      cleIdempotence: cle,
      tier: "leger" as const,
      modele: "factice",
      tokensEntree: 3,
      tokensSortie: 10,
    };
    await metrerUsageIa(base);
    // Rejeu (ex. reprise après un premier envoi avorté) avec des compteurs différents :
    await metrerUsageIa({ ...base, tokensSortie: 999 });
    const { data } = await admin.from("usage_ia").select("tokens_sortie").eq("cle_idempotence", cle);
    expect(data).toHaveLength(1);
    expect(data![0].tokens_sortie).toBe(10); // la 1re écriture prime (on conflict do nothing)
  });

  it("un flux AVORTÉ (compteurs partiels) est tout de même métré une fois", async () => {
    const cle = `avorte-${t}`;
    await metrerUsageIa({
      utilisatriceId: u.id,
      cleIdempotence: cle,
      tier: "leger",
      modele: "factice",
      tokensEntree: 5,
      tokensSortie: 2, // partiel : le `fin` n'est jamais arrivé
    });
    const { data } = await admin.from("usage_ia").select("*").eq("cle_idempotence", cle);
    expect(data).toHaveLength(1);
  });
});
