import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 4.5 — « le lendemain, jamais sur l'instant » (AC1 [DUR]) + les transitions du signal (AC4).
 *  - `charger_proposition_branche()` ne renvoie qu'un signal EN ATTENTE d'un jour civil Paris ANTÉRIEUR,
 *    HORS fenêtre de détresse (AC5/FR-042), le plus ancien d'abord ; jamais un signal du jour même ;
 *  - `ecarter_signal_reconceptualisation()` passe en_attente→ecarte (chemin « Non ») ; jamais rejoué (AC4) ;
 *  - le trigger de transition interdit toute écriture sur un signal terminal (anti-résurrection) et toute
 *    cible illégale (seules consomme/ecarte) — mord aussi service_role.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-lendemain-123!";
const FENETRE_POST_EPISODE_MS = 72 * 3600 * 1000;
const HIER = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 2 jours → jour civil Paris strictement antérieur

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
  return data.user!.id;
}

/** Pose un signal EN ATTENTE avec un `cree_le` explicite (service_role peut fixer la colonne). */
async function poserSignalDate(id: string, cleTour: string, creeLe: string, contenu: string): Promise<{ signalId: string; entreeId: string }> {
  const { data: e, error: ee } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: cleTour, role: "utilisatrice", contenu })
    .select("id")
    .single();
  if (ee) throw new Error(`entree: ${ee.message}`);
  const entreeId = e!.id as string;
  const { data, error } = await admin
    .from("signal_reconceptualisation")
    .insert({ utilisatrice_id: id, entree_journal_id: entreeId, cree_le: creeLe })
    .select("id")
    .single();
  if (error) throw new Error(`signal: ${error.message}`);
  return { signalId: data!.id as string, entreeId };
}

async function fermerEpisode(id: string, heures: number) {
  const fin = new Date(Date.now() - heures * 3600 * 1000);
  const { error } = await admin.from("episode_detresse").insert({
    utilisatrice_id: id,
    niveau_max: 2,
    debut: new Date(fin.getTime() - 3600 * 1000).toISOString(),
    fin: fin.toISOString(),
    fenetre_expire_at: new Date(fin.getTime() + FENETRE_POST_EPISODE_MS).toISOString(),
  });
  if (error) throw new Error(`fermerEpisode: ${error.message}`);
}

async function session(email: string): Promise<SupabaseClient> {
  const c = clientScope();
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

async function purger(id: string) {
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", id);
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  if (id) await admin.auth.admin.deleteUser(id);
}

describe("charger_proposition_branche — « le lendemain, jamais sur l'instant » (AC1 [DUR])", () => {
  const u = { email: `lend-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("un signal du JOUR MÊME n'est PAS proposé (jamais sur l'instant)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await poserSignalDate(u.id, `lend-jour-${t}`, new Date().toISOString(), "je vois ça autrement maintenant");
    const { data, error } = await c.rpc("charger_proposition_branche");
    expect(error).toBeNull();
    expect(data ?? [], "aucune proposition le jour même").toHaveLength(0);
    await c.auth.signOut();
  });

  it("un signal d'un jour civil ANTÉRIEUR est proposé (AC1) — POINTEUR seul, aucun verbatim art. 9 (revue #6/#11)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { signalId } = await poserSignalDate(u.id, `lend-hier-${t}`, HIER, "avant je pensais que c'était ma faute");
    const { data, error } = await c.rpc("charger_proposition_branche");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    const ligne = (data as { signal_id: string }[]).find((r) => r.signal_id === signalId);
    expect(ligne, "le signal de la veille est proposé").toBeTruthy();
    // Minimisation art. 9 : la RPC ne remonte QUE le pointeur (signal_id + horodatage), jamais le verbatim.
    expect(Object.keys(ligne!).sort()).toEqual(["signal_cree_le", "signal_id"]);
    await c.auth.signOut();
  });

  it("le PLUS ANCIEN signal éligible est proposé en premier (une proposition à la fois)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const vieux = await poserSignalDate(u.id, `lend-vieux-${t}`, new Date(Date.now() - 96 * 3600 * 1000).toISOString(), "le plus ancien");
    await poserSignalDate(u.id, `lend-recent-${t}`, HIER, "plus récent");
    const { data } = await c.rpc("charger_proposition_branche");
    expect((data as { signal_id: string }[])[0].signal_id).toBe(vieux.signalId);
    await c.auth.signOut();
  });
});

describe("charger_proposition_branche — bloqué en fenêtre de détresse (AC5 / FR-042)", () => {
  const u = { email: `lend-ad17-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("un signal éligible n'est PAS proposé si un épisode s'est éteint il y a moins de 72 h", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await poserSignalDate(u.id, `lend-detresse-${t}`, HIER, "moment de bascule");
    await fermerEpisode(u.id, 24); // fenêtre 72 h encore active
    const { data, error } = await c.rpc("charger_proposition_branche");
    expect(error).toBeNull();
    expect(data ?? [], "aucune proposition en fenêtre de détresse (FR-042)").toHaveLength(0);
    await c.auth.signOut();
  });
});

describe("ecarter_signal_reconceptualisation — chemin « Non », jamais rejoué (AC4)", () => {
  const u = { email: `ecart-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("un « Non » passe le signal à ecarte, et il n'est JAMAIS re-proposé", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { signalId } = await poserSignalDate(u.id, `ecart-non-${t}`, HIER, "un moment");
    // Il est d'abord proposable.
    const avant = await c.rpc("charger_proposition_branche");
    expect((avant.data as { signal_id: string }[]).some((r) => r.signal_id === signalId)).toBe(true);
    // « Non ».
    const ec = await c.rpc("ecarter_signal_reconceptualisation", { p_signal_id: signalId });
    expect(ec.error).toBeNull();
    const { data: sig } = await c.from("signal_reconceptualisation").select("statut").eq("id", signalId).single();
    expect(sig!.statut).toBe("ecarte");
    // Plus jamais proposé.
    const apres = await c.rpc("charger_proposition_branche");
    expect((apres.data as { signal_id: string }[]).some((r) => r.signal_id === signalId)).toBe(false);
    await c.auth.signOut();
  });

  it("écarter survit à la révocation art. 9 (c'est un rejet, pas un dépôt de contenu)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { signalId } = await poserSignalDate(u.id, `ecart-revoc-${t}`, HIER, "un autre moment");
    await c.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", u.id).is("revoked_at", null);
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);
    const ec = await c.rpc("ecarter_signal_reconceptualisation", { p_signal_id: signalId });
    expect(ec.error, "écarter survit à la révocation").toBeNull();
    await c.auth.signOut();
  });
});

describe("signal_reconceptualisation — trigger de transition (anti-résurrection, cibles légales)", () => {
  const u = { email: `trans-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("un signal terminal (consomme) ne peut jamais revenir à en_attente — même service_role (anti-résurrection)", async () => {
    const { signalId } = await poserSignalDate(u.id, `trans-consomme-${t}`, HIER, "x");
    await admin.from("signal_reconceptualisation").update({ statut: "consomme" }).eq("id", signalId);
    const resur = await admin.from("signal_reconceptualisation").update({ statut: "en_attente" }).eq("id", signalId);
    expect(resur.error, "un signal consommé ne renaît pas").not.toBeNull();
  });

  it("une transition vers une cible illégale (hors consomme|ecarte) est refusée par le trigger", async () => {
    const { signalId } = await poserSignalDate(u.id, `trans-illegal-${t}`, HIER, "y");
    const bad = await admin.from("signal_reconceptualisation").update({ statut: "actif" }).eq("id", signalId);
    expect(bad.error).not.toBeNull();
  });
});

describe("signal_reconceptualisation — la policy UPDATE re-vérifie l'appartenance (revue #4/#8)", () => {
  const u = { email: `repoint-${t}@exemple.fr`, id: "" };
  const victime = { email: `repoint-victime-${t}@exemple.fr`, id: "", entree: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    victime.id = await creerUtilisatrice(victime.email);
    victime.entree = (await poserSignalDate(victime.id, `repoint-v-${t}`, HIER, "journal d'autrui")).entreeId;
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(victime.id);
  });

  it("un UPDATE sous JWT repointant entree_journal_id vers le journal d'AUTRUI est REFUSÉ (mutation-cible : l'exists de signal_reconceptualisation_maj)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { signalId } = await poserSignalDate(u.id, `repoint-u-${t}`, HIER, "mon moment");
    // Tente de rattacher SON signal à l'entrée de journal de la victime, en passant par une cible de statut légale.
    const { error } = await c
      .from("signal_reconceptualisation")
      .update({ entree_journal_id: victime.entree, statut: "ecarte" })
      .eq("id", signalId);
    expect(error, "repointage vers le journal d'autrui refusé (isolation au point d'écriture UPDATE)").not.toBeNull();
    await c.auth.signOut();
  });
});
