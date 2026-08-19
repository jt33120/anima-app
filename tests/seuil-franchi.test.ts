import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * seuil-franchi.test.ts — LA MARQUE DU PREMIER PASSAGE (migration 0078, H4)
 *
 * ── CE QUE CE FICHIER GARDE, PAR ORDRE D'IMPORTANCE ────────────────────────────────────────────
 *
 * 1. **Personne ne peut re-déclencher le texte.** `authenticated` détient un grant colonne par
 *    colonne sur `utilisatrice`, et la policy `utilisatrice_proprietaire` est en `ALL` avec
 *    `WITH CHECK (auth.uid() = id)` : si la colonne recevait un `grant update`, une remise à `null`
 *    depuis un POST direct sur `/rest/v1/` re-servirait la présentation à volonté. Ce n'est pas une
 *    faille de sécurité — c'est la promesse « le seuil ne se lève qu'une fois » rendue tenable, et
 *    c'est le même raisonnement que le revoke de `socle_complete_annonce_le` (0040/0045).
 * 2. **La date est celle du PREMIER passage.** Sans le `is null` du WHERE, chaque franchissement
 *    réécrirait `now()` et la colonne cesserait de dire ce que son nom promet — sans qu'aucun écran
 *    ne change.
 * 3. **La lecture est possible.** Une colonne neuve n'hérite d'aucun privilège sur cette table :
 *    sans `grant select`, la page lirait `null` pour tout le monde et le texte reviendrait à chaque
 *    chargement. Le défaut serait silencieux et parfaitement plausible.
 */

const URL_SB = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PUB =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const admin = () => createClient(URL_SB, SERVICE, { auth: { persistSession: false } });

let email: string;
let motDePasse: string;
let uid: string;
/** La session de la personne — le seul rôle sous lequel une garde se prouve. */
let sienne: SupabaseClient;

beforeAll(async () => {
  email = `seuil-${Date.now()}@exemple.test`;
  motDePasse = `mdp-${Date.now()}-anam`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`création du compte : ${error?.message}`);
  uid = data.user.id;

  sienne = createClient(URL_SB, PUB, { auth: { persistSession: false } });
  const { error: e } = await sienne.auth.signInWithPassword({ email, password: motDePasse });
  if (e) throw new Error(`connexion : ${e.message}`);
});

const lireSousSonJwt = async () =>
  (
    await sienne
      .from("utilisatrice")
      .select("seuil_franchi_le")
      .eq("id", uid)
      .maybeSingle<{ seuil_franchi_le: string | null }>()
  ).data?.seuil_franchi_le ?? null;

describe("[0078] la marque se pose une fois", () => {
  it("[LE CŒUR] un compte neuf n'a jamais franchi — la lecture le dit SOUS SON PROPRE JWT", () => {
    // ⚠️ SOUS SON JWT, PAS SOUS `service_role`. Une colonne sans `grant select` se lirait très bien
    // en admin et rendrait `null` pour la vraie session : le texte reviendrait à chaque chargement,
    // et la garde serait verte.
    return expect(lireSousSonJwt()).resolves.toBeNull();
  });

  it("[LE CŒUR] le premier appel pose la date et rend `true`", async () => {
    const { data, error } = await sienne.rpc("marquer_seuil_franchi");
    expect(error).toBeNull();
    expect(data).toBe(true);
    expect(await lireSousSonJwt(), "la date n'a pas été posée").not.toBeNull();
  });

  it("[LE CŒUR] le second appel ne bouge RIEN et rend `false`", async () => {
    const avant = await lireSousSonJwt();
    const { data } = await sienne.rpc("marquer_seuil_franchi");
    expect(data, "un second franchissement s'est cru premier").toBe(false);
    expect(
      await lireSousSonJwt(),
      "la date a été réécrite : la colonne dit le DERNIER passage, pas le premier",
    ).toBe(avant);
  });
});

describe("[0078] la garde : la présentation ne se re-déclenche pas", () => {
  it("[L'EXPLOIT] sous son propre JWT, remettre la date à `null` est REFUSÉ", async () => {
    // Le chemin évident : la policy autorise `ALL` sur sa propre ligne. C'est l'ABSENCE de grant
    // UPDATE sur cette colonne, et elle seule, qui arrête ce POST.
    const { error } = await sienne
      .from("utilisatrice")
      .update({ seuil_franchi_le: null })
      .eq("id", uid);
    expect(error, "n'importe qui peut se re-servir la présentation").not.toBeNull();
    expect(error!.code).toBe("42501");
    expect(await lireSousSonJwt(), "la date a sauté").not.toBeNull();
  });

  it("[L'EXPLOIT] et la reculer dans le passé ne marche pas davantage", async () => {
    // La variante qu'on oublie : pas `null`, une VRAIE date — celle d'hier, pour se refaire
    // présenter le lieu sans que la colonne paraisse vide.
    const { error } = await sienne
      .from("utilisatrice")
      .update({ seuil_franchi_le: "2020-01-01T00:00:00Z" })
      .eq("id", uid);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("[L'EXPLOIT] `anon` ne peut pas exécuter la fonction", async () => {
    const anonyme = createClient(URL_SB, PUB, { auth: { persistSession: false } });
    const { error } = await anonyme.rpc("marquer_seuil_franchi");
    expect(error, "la fonction est exécutable sans session").not.toBeNull();
  });

  it("la marque d'une autre personne est hors d'atteinte", async () => {
    // La RPC ne prend AUCUN paramètre : elle ne lit que `auth.uid()`. C'est ce qui rend ce
    // chemin-là inexistant, et pas une vérification faite quelque part.
    const a = admin();
    const autre = `seuil-autre-${Date.now()}@exemple.test`;
    const { data: cree } = await a.auth.admin.createUser({ email: autre, email_confirm: true });
    const idAutre = cree!.user!.id;

    await sienne.rpc("marquer_seuil_franchi");

    const { data: ligne } = await a
      .from("utilisatrice")
      .select("seuil_franchi_le")
      .eq("id", idAutre)
      .maybeSingle<{ seuil_franchi_le: string | null }>();
    expect(ligne?.seuil_franchi_le, "le seuil d'une autre a été franchi").toBeNull();
  });
});
