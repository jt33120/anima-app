import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { compterToursResiduelsDuMois } from "@/lib/data/lire-allocation";
import { metrerUsageIa } from "@/lib/ai/metrage";

/**
 * Story 3.4 (T4) — le COMPTAGE des tours d'allocation résiduelle du mois (AC2/AC3), contre un vrai
 * Supabase local. Seuls comptent les tours POST-SÉANCE (flag `post_premiere_seance` true) du MOIS
 * COURANT : la 1ʳᵉ séance (flag false, gratuite FR-059), les sous-coûts `:arc`/`:bilan` et les mois
 * passés sont exclus. `metrerUsageIa` écrit le flag ; sans flag il vaut false (défaut).
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const t = Date.now();

/** 15 du mois PRÉCÉDENT en UTC (gère janvier → décembre de l'an d'avant via Date.UTC). */
function moisPrecedentIso(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 15)).toISOString();
}

describe("compterToursResiduelsDuMois — tours post-séance du mois courant (AC2/AC3)", () => {
  const u = { email: `alloc-${t}@exemple.fr`, password: "test-alloc-123!", id: "" };

  beforeAll(async () => {
    if (!url || !secret) throw new Error("Supabase local requis (SUPABASE_URL / SECRET_KEY).");
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

  it("aucun tour → 0", async () => {
    expect(await compterToursResiduelsDuMois(u.id)).toBe(0);
  });

  it("compte SEULEMENT les tours post-séance (flag true) du mois courant", async () => {
    // Ce mois-ci (cree_le omis → défaut now()). Insert HOMOGÈNE (mêmes clés) : un batch hétérogène
    // enverrait `cree_le: null` aux lignes qui l'omettent → violation NOT NULL (le défaut ne couvre
    // qu'une colonne OMISE, pas un NULL explicite).
    const { error: e1 } = await admin.from("usage_ia").insert([
      { utilisatrice_id: u.id, cle_idempotence: `res1-${t}`, tokens_entree: 1, tokens_sortie: 1, post_premiere_seance: true },
      { utilisatrice_id: u.id, cle_idempotence: `res2-${t}`, tokens_entree: 1, tokens_sortie: 1, post_premiere_seance: true },
      // 1ʳᵉ séance (flag false) — NON comptée (gratuite, FR-059)
      { utilisatrice_id: u.id, cle_idempotence: `seance1-${t}`, tokens_entree: 1, tokens_sortie: 1, post_premiere_seance: false },
      // sous-coût :arc (flag false) — NON compté (ce n'est pas un « tour » de conversation)
      { utilisatrice_id: u.id, cle_idempotence: `res1-${t}:arc`, tokens_entree: 1, tokens_sortie: 1, post_premiere_seance: false },
    ]);
    expect(e1).toBeNull();
    // Mois PRÉCÉDENT, flag true — NON compté (hors fenêtre mensuelle) : insert séparé (cree_le explicite).
    const { error: e2 } = await admin
      .from("usage_ia")
      .insert({ utilisatrice_id: u.id, cle_idempotence: `vieux-${t}`, tokens_entree: 1, tokens_sortie: 1, post_premiere_seance: true, cree_le: moisPrecedentIso() });
    expect(e2).toBeNull();
    expect(await compterToursResiduelsDuMois(u.id)).toBe(2);
  });

  it("metrerUsageIa écrit le flag `post_premiere_seance` (source unique du comptage)", async () => {
    await metrerUsageIa({
      utilisatriceId: u.id,
      cleIdempotence: `metre-${t}`,
      tier: "leger",
      modele: "m",
      tokensEntree: 1,
      tokensSortie: 1,
      postPremiereSeance: true,
    });
    const { data } = await admin
      .from("usage_ia")
      .select("post_premiere_seance")
      .eq("cle_idempotence", `metre-${t}`)
      .single();
    expect(data!.post_premiere_seance).toBe(true);
    expect(await compterToursResiduelsDuMois(u.id)).toBe(3); // res1 + res2 + metre
  });

  it("métrage SANS flag → false (1ʳᵉ séance et sous-coûts non décomptés)", async () => {
    await metrerUsageIa({
      utilisatriceId: u.id,
      cleIdempotence: `metre-defaut-${t}`,
      tier: "leger",
      modele: "m",
      tokensEntree: 1,
      tokensSortie: 1,
    });
    const { data } = await admin
      .from("usage_ia")
      .select("post_premiere_seance")
      .eq("cle_idempotence", `metre-defaut-${t}`)
      .single();
    expect(data!.post_premiere_seance).toBe(false);
    expect(await compterToursResiduelsDuMois(u.id)).toBe(3); // inchangé (le tour sans flag ne compte pas)
  });

  it("EXCLUT la propre ligne du tour courant (revue F4/F5) : le gate ne se coupe pas au « Réessayer »", async () => {
    // À ce stade : 3 lignes post_premiere_seance=true (res1, res2, metre). En excluant SA propre clé
    // (celle du tour logique en cours de retry), le comptage retombe à 2 → la retentative n'est pas murée.
    expect(await compterToursResiduelsDuMois(u.id, `res1-${t}`)).toBe(2);
    expect(await compterToursResiduelsDuMois(u.id, `metre-${t}`)).toBe(2);
    // Une clé ABSENTE (aucune ligne) n'enlève rien : le comptage reste à 3.
    expect(await compterToursResiduelsDuMois(u.id, `inexistante-${t}`)).toBe(3);
  });
});
