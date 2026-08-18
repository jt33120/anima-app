import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reposerConsentement } from "./_rig-consentement";
import { declarerMajorite } from "./_semis";

/**
 * Story 4.6 — le RENOMMAGE d'une branche (première écriture mutante de `branche`, migration 0022).
 * Preuves BLOQUANTES contre un vrai Supabase local. La LEÇON R1 est le cœur : `authenticated` a le grant
 * UPDATE table-level → un `.from("branche").update({nom})` DIRECT saute la RPC `renommer_branche` et n'est
 * borné QUE par la policy `branche_renommage` (WITH CHECK) + le trigger `branche_garde_renommage`. On prouve
 * donc l'UPDATE DIRECT, pas seulement la RPC :
 *  - renommage heureux (RPC et update direct du propriétaire consentant) ;
 *  - [R1] après révocation du consentement → refusé (mutation-cible : retirer `a_consenti_art9()` du WITH CHECK) ;
 *  - sous barrière minorité → refusé ;
 *  - [AC2] nom vide/Unicode → refusé (RPC + policy + CHECK, fonction branche_nom_significatif) ;
 *  - [R1 / trigger] update direct changeant etat/date/lien → REJETÉ par le trigger (mutation-cible : la clause) ;
 *  - isolation : renommer la branche d'autrui → sans effet.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-renommage-123!";

async function donnerConsentement(c: SupabaseClient, id: string) {
  const { error } = await c.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`consentement: ${error.message}`);
}

async function creerUtilisatrice(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  // 0066 : la majorité doit être POSITIVEMENT établie pour écrire de l'art. 9. Un compte créé par
  // `createUser` n'a pas de `date_naissance` — c'est exactement le trou que 0066 referme. Ce banc-là
  // teste autre chose ; il pose donc l'adulte que le parcours nominal aurait posée en `/naissance`.
  await declarerMajorite(admin, data.user!.id);
  return data.user!.id;
}

async function graverEntree(id: string, cleTour: string, contenu = "un tour d'utilisatrice"): Promise<string> {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: cleTour, role: "utilisatrice", contenu })
    .select("id")
    .single();
  if (error) throw new Error(`graverEntree: ${error.message}`);
  return data!.id as string;
}

/** Fait naître une branche directement (service_role bypasse le write-gate ; le CHECK nom mord quand même). */
async function poserBranche(id: string, entreeId: string, nom = "nom initial"): Promise<string> {
  const { data, error } = await admin
    .from("branche")
    .insert({ utilisatrice_id: id, extrait_source_id: entreeId, nom })
    .select("id")
    .single();
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

describe("branche renommage — write-gate art. 9 dans la policy (leçon R1), UPDATE DIRECT", () => {
  const u = { email: `ren-${t}@exemple.fr`, id: "", entree: "", branche: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
    u.id = await creerUtilisatrice(u.email);
    u.entree = await graverEntree(u.id, `ren-${t}`);
    u.branche = await poserBranche(u.id, u.entree);
  });
  // ISOLATION (revue 4.6) : plusieurs tests de ce bloc RÉVOQUENT le consentement ou posent la barrière
  // minorité et les restaurent en fin de test. Si l'un échoue avant sa restauration, les suivants passaient
  // VACUEUSEMENT (ils vérifient un refus… déjà garanti par l'état sale). On remet l'état propre AVANT chacun.
  beforeEach(async () => {
    await admin.from("utilisatrice").update({ barriere_minorite_le: null }).eq("id", u.id);
    // Depuis 0041 la révocation est TERMINALE (revue du 2026-08-11, S2) : un `upsert` remettant
    // `revoked_at: null` lève désormais, y compris sous `service_role`. Le rig détruit la preuve
    // et repose une ligne neuve — geste de banc d'essai, qu'aucun chemin applicatif ne fait.
    await reposerConsentement(admin, u.id);
  });
  afterAll(async () => purger(u.id));

  it("renommage heureux via la RPC : le nom change (et est trimé)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.rpc("renommer_branche", { p_branche_id: u.branche, p_nouveau_nom: "  mon nouveau nom  " });
    expect(error).toBeNull();
    const { data } = await c.from("branche").select("nom").eq("id", u.branche).single();
    expect(data!.nom).toBe("mon nouveau nom");
    await c.auth.signOut();
  });

  it("UPDATE DIRECT du propriétaire consentant : le nom change (la policy autorise)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.from("branche").update({ nom: "nom par update direct" }).eq("id", u.branche);
    expect(error).toBeNull();
    const { data } = await c.from("branche").select("nom").eq("id", u.branche).single();
    expect(data!.nom).toBe("nom par update direct");
    await c.auth.signOut();
  });

  it("[R1] UPDATE DIRECT après RÉVOCATION du consentement → REFUSÉ (mutation-cible : retirer a_consenti_art9 du WITH CHECK)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await c.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", u.id);
    const { error } = await c.from("branche").update({ nom: "après révocation" }).eq("id", u.branche);
    expect(error, "renommer dépose du contenu art. 9 → refusé sans consentement valide").not.toBeNull();
    // la lecture survit à la révocation : le nom n'a pas bougé
    const { data } = await c.from("branche").select("nom").eq("id", u.branche).single();
    expect(data!.nom).not.toBe("après révocation");
    // (Pas de restauration ici : la révocation est irréversible depuis 0041, et le `beforeEach`
    // repose une ligne neuve avant chaque test.)
    await c.auth.signOut();
  });

  it("[R1] UPDATE DIRECT sous barrière minorité → REFUSÉ (même avec consentement)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString(), echeance_suppression: "2099-01-01" }).eq("id", u.id);
    const { error } = await c.from("branche").update({ nom: "sous barrière" }).eq("id", u.branche);
    expect(error).not.toBeNull();
    await admin.from("utilisatrice").update({ barriere_minorite_le: null }).eq("id", u.id);
    await c.auth.signOut();
  });

  it("[AC2] renommer en nom vide / d'espaces / d'insécable → REFUSÉ (RPC ET update direct)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    for (const vide of ["", "   ", "\t", " ", " ", "﻿"]) {
      const rpc = await c.rpc("renommer_branche", { p_branche_id: u.branche, p_nouveau_nom: vide });
      expect(rpc.error, `RPC : nom invisible refusé (${JSON.stringify(vide)})`).not.toBeNull();
      const direct = await c.from("branche").update({ nom: vide }).eq("id", u.branche);
      expect(direct.error, `update direct : nom invisible refusé (${JSON.stringify(vide)})`).not.toBeNull();
    }
    await c.auth.signOut();
  });

  it("[R1 / trigger] UPDATE DIRECT changeant etat → REJETÉ par le trigger (mutation-cible : la clause etat)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    // la policy passerait (owner + consentement + nom valide) — seul le trigger fige `etat` (pré-emption 4.7).
    const { error } = await c.from("branche").update({ nom: "x", etat: "rayonnement" }).eq("id", u.branche);
    expect(error, "poser un état à la main est refusé (cycle de vie = 4.7)").not.toBeNull();
    const { data } = await c.from("branche").select("etat").eq("id", u.branche).single();
    expect(data!.etat).toBe("naissance");
    await c.auth.signOut();
  });

  it("[R1 / trigger] UPDATE DIRECT falsifiant date_naissance ou FAISANT RECULER l'intensité → REJETÉ", async () => {
    // 4.6 refusait TOUTE écriture d'`intensite` (« la feuillaison est la 4.7 »). Depuis 4.7 la matière a le
    // droit d'AVANCER — ce qui reste absolument interdit, c'est de reculer (FR-029) et de toucher l'origine.
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const forgeDate = await c.from("branche").update({ nom: "x", date_naissance: "2000-01-01T00:00:00Z" }).eq("id", u.branche);
    expect(forgeDate.error, "falsifier la date de naissance est refusé").not.toBeNull();
    const monte = await c.from("branche").update({ nom: "x", intensite: 0.6 }).eq("id", u.branche);
    expect(monte.error, "la matière a le droit d'avancer (c'est la Story 4.7)").toBeNull();
    const recule = await c.from("branche").update({ nom: "x", intensite: 0.1 }).eq("id", u.branche);
    expect(recule.error, "…mais jamais de reculer (FR-029)").not.toBeNull();
    await c.auth.signOut();
  });
});

describe("branche renommage — isolation & deny-by-default", () => {
  const u = { email: `ren-iso-${t}@exemple.fr`, id: "" };
  const victime = { email: `ren-victime-${t}@exemple.fr`, id: "", entree: "", branche: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    victime.id = await creerUtilisatrice(victime.email);
    victime.entree = await graverEntree(victime.id, `ren-victime-${t}`);
    victime.branche = await poserBranche(victime.id, victime.entree, "le nom de la victime");
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(victime.id);
  });

  it("renommer la branche d'autrui via la RPC est SANS EFFET (where utilisatrice_id = auth.uid())", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await c.rpc("renommer_branche", { p_branche_id: victime.branche, p_nouveau_nom: "volé" });
    const { data } = await admin.from("branche").select("nom").eq("id", victime.branche).single();
    expect(data!.nom, "le nom de la victime n'a pas changé").toBe("le nom de la victime");
    await c.auth.signOut();
  });

  it("UPDATE DIRECT de la branche d'autrui est SANS EFFET (policy using owner)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await c.from("branche").update({ nom: "volé direct" }).eq("id", victime.branche);
    const { data } = await admin.from("branche").select("nom").eq("id", victime.branche).single();
    expect(data!.nom).toBe("le nom de la victime");
    await c.auth.signOut();
  });
});
