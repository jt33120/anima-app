import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";

/**
 * Story 1.6 — write-gate art. 9 AU NIVEAU BASE (AD-13). Preuves BLOQUANTES en CI :
 *  - AC1 : sans consentement valide, la base REFUSE toute écriture art. 9 (RLS with check).
 *  - AC2 : avec un consentement valide et non révoqué, la base AUTORISE l'écriture.
 *  - AC3 : après révocation (revoked_at posé), l'écriture est de NOUVEAU refusée ; la LECTURE
 *          des lignes déjà posées reste permise (export RGPD avant suppression).
 *
 * La garde est portée par la table témoin `art9_temoin` (gabarit du write-gate) + la fonction
 * `a_consenti_art9`. Aucun écran n'intervient : c'est la base qui refuse.
 *
 * Les 3 cas suivent le CYCLE DE VIE du consentement d'UNE utilisatrice (ordre intentionnel :
 * pas de consentement → consentement → révocation) — Vitest exécute les `it` d'un describe en séquence.
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

describe("Write-gate art. 9 — la base refuse l'écriture sans consentement (AC1/AC2/AC3)", () => {
  const u = { email: `wg-${t}@exemple.fr`, password: "test-wg-123!", id: "" };

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    u.id = data.user!.id;
    // Majeure, date posée : réaliste (le gate ne l'exige pas, mais l'utilisatrice type est passée par là).
    const { error: e2 } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1990-01-01" })
      .eq("id", u.id);
    if (e2) throw new Error(`date_naissance: ${e2.message}`);
  });

  afterAll(async () => {
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("AC1 — sans consentement valide : l'écriture art. 9 est REFUSÉE par la base", async () => {
    const c = clientScope();
    const { error: sign } = await c.auth.signInWithPassword({
      email: u.email,
      password: u.password,
    });
    expect(sign).toBeNull();

    // Le prédicat de garde répond « non ».
    const { data: consenti } = await c.rpc("a_consenti_art9");
    expect(consenti).toBe(false);

    // Toute écriture art. 9 est refusée (RLS with check), même sous SA propre identité.
    const { error } = await c
      .from("art9_temoin")
      .insert({ utilisatrice_id: u.id, note: "une confidence" });
    expect(error).not.toBeNull();

    await c.auth.signOut();
  });

  it("AC2 — avec consentement valide et non révoqué : l'écriture art. 9 est AUTORISÉE", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });

    // Même chemin que « Je commence » : consentement écrit sous la session RLS.
    const { error: cons } = await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
      { onConflict: "utilisatrice_id" },
    );
    expect(cons).toBeNull();

    const { data: consenti } = await c.rpc("a_consenti_art9");
    expect(consenti).toBe(true);

    const { error } = await c
      .from("art9_temoin")
      .insert({ utilisatrice_id: u.id, note: "une confidence" });
    expect(error).toBeNull(); // la garde autorise

    await c.auth.signOut();
  });

  it("AC3 — après révocation (revoked_at) : écriture REFUSÉE de nouveau, lecture encore permise (export)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });

    // Révoquer = poser revoked_at sous la session RLS (jamais service_role). On reproduit
    // FIDÈLEMENT revoquerConsentement, `.is("revoked_at", null)` compris (idempotence testée plus bas).
    const premiereRevocation = new Date().toISOString();
    const { error: rev } = await c
      .from("consentement")
      .update({ revoked_at: premiereRevocation })
      .eq("utilisatrice_id", u.id)
      .is("revoked_at", null);
    expect(rev).toBeNull();

    const { data: consenti } = await c.rpc("a_consenti_art9");
    expect(consenti).toBe(false);

    // L'utilisatrice bascule en « traitement art. 9 suspendu » (état 'revoque').
    expect(await etapeOnboardingPour(c, u.id)).toBe("revoque");

    // L'écriture art. 9 est de nouveau refusée.
    const { error: ins } = await c
      .from("art9_temoin")
      .insert({ utilisatrice_id: u.id, note: "après révocation" });
    expect(ins).not.toBeNull();

    // MAIS la lecture des lignes déjà posées reste permise (droit d'accès / export avant suppression).
    const { data: lignes, error: lec } = await c
      .from("art9_temoin")
      .select("id, note")
      .eq("utilisatrice_id", u.id);
    expect(lec).toBeNull();
    expect(lignes?.length).toBe(1); // la confidence écrite en AC2 reste exportable

    // Idempotence de la révocation (comme revoquerConsentement) : une 2e tentative ne réécrit
    // PAS revoked_at — le `.is("revoked_at", null)` ne matche plus aucune ligne.
    await c
      .from("consentement")
      .update({ revoked_at: "2099-01-01T00:00:00.000Z" })
      .eq("utilisatrice_id", u.id)
      .is("revoked_at", null);
    const { data: apres } = await c
      .from("consentement")
      .select("revoked_at")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(new Date(apres!.revoked_at as string).getTime()).toBe(
      new Date(premiereRevocation).getTime(),
    ); // inchangé — la 1re révocation tient

    await c.auth.signOut();
  });
});
