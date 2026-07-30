import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 4.4 — le RÉCEPTEUR `signal_reconceptualisation` (signal EN ATTENTE, germe de branche) + la
 * fonction de merge possédée `enregistrer_signal_reconceptualisation(p_cle_tour)`. Preuves BLOQUANTES
 * contre un vrai Supabase local — miroir art. 9 « possédé sous JWT » de `resume-glissant`/`fait-extrait` :
 *  - schéma : pointeur-seul (aucun contenu art. 9), `entree_journal_id`, `statut`, unique (utilisatrice, entrée) ;
 *  - art. 9 sous JWT (AD-12) : deny-by-default — une AUTRE utilisatrice ne lit rien, une session anonyme non plus ;
 *  - write-gate (AD-13) : refusé sans consentement / sous barrière minorité / après révocation ; lecture survit ;
 *  - AC4 isolation : un `cle_tour` sans entrée de l'appelante LÈVE (jamais de signal orphelin ni d'oracle) ;
 *  - AC4 idempotence + anti-résurrection : deux appels → UN signal ; un `consomme` n'est jamais ré-ouvert ;
 *  - [DUR / AD-17] la garde AU POINT D'ÉCRITURE : épisode ouvert OU dans les 72 h → LÈVE (mutation-cible :
 *    retirer `branche_bloquee_par_detresse()`) ; hors fenêtre → réussit ;
 *  - effacement FR-067 : `delete` sous JWT refusé (aucune policy) ; service_role supprime ; cascade depuis l'entrée.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = Date.now();
const MDP = "test-reconcept-123!";
const FENETRE_POST_EPISODE_MS = 72 * 3600 * 1000;

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

/** Grave une entrée de journal (côté utilisatrice) directement — l'ancre exacte d'un signal. Renvoie son id. */
async function graverEntree(id: string, cleTour: string, contenu = "un tour d'utilisatrice"): Promise<string> {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: cleTour, role: "utilisatrice", contenu })
    .select("id")
    .single();
  if (error) throw new Error(`graverEntree: ${error.message}`);
  return data!.id as string;
}

/** Ouvre un épisode de détresse (fin NULL). Un seul ouvert par utilisatrice (index unique). */
async function ouvrirEpisode(id: string, niveau = 2) {
  const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: niveau });
  if (error) throw new Error(`ouvrirEpisode: ${error.message}`);
}

/** Épisode CLOS il y a `heures` heures, fenêtre 72 h posée à la clôture (dans la fenêtre si heures < 72). */
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

describe("signal_reconceptualisation — schéma & réceptacle art. 9 pointeur-seul (AC4)", () => {
  const u = { email: `sr-schema-${t}@exemple.fr`, id: "", entree: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
    u.id = await creerUtilisatrice(u.email);
    u.entree = await graverEntree(u.id, `sch-${t}`);
  });
  afterAll(async () => {
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("colonnes exactes (pointeur-seul, AUCUN contenu art. 9), id uuid, statut par défaut en_attente", async () => {
    const { data, error } = await admin
      .from("signal_reconceptualisation")
      .insert({ utilisatrice_id: u.id, entree_journal_id: u.entree })
      .select()
      .single();
    expect(error).toBeNull();
    expect(String(data!.id)).toMatch(UUID);
    expect(data!.statut).toBe("en_attente");
    expect(Number.isNaN(new Date(data!.cree_le as string).getTime())).toBe(false);
    const colonnes = Object.keys(data!).sort();
    expect(colonnes).toEqual(["cree_le", "entree_journal_id", "id", "maj_le", "statut", "utilisatrice_id"].sort());
    // Pointeur-seul : aucune colonne de contenu/verbatim/note en clair.
    expect(colonnes).not.toContain("contenu");
    expect(colonnes).not.toContain("note");
  });

  it("unicité (utilisatrice_id, entree_journal_id) : deux signaux sur la MÊME entrée → refusé (idempotence)", async () => {
    const a = await admin.from("signal_reconceptualisation").insert({ utilisatrice_id: u.id, entree_journal_id: u.entree });
    expect(a.error).not.toBeNull();
  });

  it("statut hors énumération refusé (check en_attente|consomme|ecarte)", async () => {
    const autre = await graverEntree(u.id, `sch2-${t}`);
    const bad = await admin
      .from("signal_reconceptualisation")
      .insert({ utilisatrice_id: u.id, entree_journal_id: autre, statut: "actif" });
    expect(bad.error).not.toBeNull();
  });
});

describe("signal_reconceptualisation — art. 9 sous JWT, deny-by-default (AC4)", () => {
  const u1 = { email: `sr-owner-${t}@exemple.fr`, id: "", entree: "" };
  const u2 = { email: `sr-autre-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u1.id = await creerUtilisatrice(u1.email);
    u2.id = await creerUtilisatrice(u2.email);
    u1.entree = await graverEntree(u1.id, `deny-${t}`);
    await admin.from("signal_reconceptualisation").insert({ utilisatrice_id: u1.id, entree_journal_id: u1.entree });
  });
  afterAll(async () => {
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", u1.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u1.id);
    if (u1.id) await admin.auth.admin.deleteUser(u1.id);
    if (u2.id) await admin.auth.admin.deleteUser(u2.id);
  });

  it("une AUTRE utilisatrice ne lit RIEN de mon signal (RLS)", async () => {
    const c = await session(u2.email);
    const { data, error } = await c.from("signal_reconceptualisation").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // masqué : la ligne existe pourtant (deny-by-default)
    await c.auth.signOut();
  });

  it("une session NON authentifiée ne lit rien (mais la table répond — pas un faux-vert « table absente »)", async () => {
    const anon = clientScope();
    const { data, error } = await anon.from("signal_reconceptualisation").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("le propriétaire LIT son propre signal (export FR-067)", async () => {
    const c = await session(u1.email);
    const { data, error } = await c.from("signal_reconceptualisation").select("statut").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    await c.auth.signOut();
  });
});

describe("enregistrer_signal_reconceptualisation — write-gate art. 9 & lecture survivante (AC4)", () => {
  const u = { email: `sr-wg-${t}@exemple.fr`, id: "", entree: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.entree = await graverEntree(u.id, `wg-${t}`);
  });
  afterAll(async () => {
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("sans consentement : l'enregistrement est REFUSÉ (write-gate durci, AD-13) — l'entrée existe pourtant", async () => {
    const c = await session(u.email);
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);
    const { error } = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `wg-${t}` });
    expect(error).not.toBeNull(); // échoue au write-gate (étape 3), pas à l'isolation (l'entrée existe)
    await c.auth.signOut();
  });

  it("sous barrière minorité : refusé MÊME avec consentement (gabarit 0006/F1)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString(), echeance_suppression: "2099-01-01" }).eq("id", u.id);
    const { error } = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `wg-${t}` });
    expect(error).not.toBeNull();
    await admin.from("utilisatrice").update({ barriere_minorite_le: null }).eq("id", u.id);
    await c.auth.signOut();
  });

  it("avec consentement : l'enregistrement passe ; après révocation, la LECTURE survit mais l'écriture est refusée", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const ok = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `wg-${t}` });
    expect(ok.error).toBeNull();
    // Révocation art. 9.
    await c.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", u.id).is("revoked_at", null);
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);
    // La LECTURE (export FR-067) survit à la révocation.
    const { data: lu, error: lec } = await c.from("signal_reconceptualisation").select("statut").eq("utilisatrice_id", u.id).single();
    expect(lec).toBeNull();
    expect(lu!.statut).toBe("en_attente");
    // Un NOUVEL enregistrement (autre entrée) est REFUSÉ après révocation.
    const autre = await graverEntree(u.id, `wg2-${t}`);
    expect(autre).toMatch(UUID);
    const maj = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `wg2-${t}` });
    expect(maj.error).not.toBeNull();
    await c.auth.signOut();
  });
});

describe("enregistrer_signal_reconceptualisation — isolation, idempotence, anti-résurrection (AC4)", () => {
  const u = { email: `sr-idem-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("isolation : un cle_tour sans entrée de l'appelante LÈVE (jamais de signal orphelin)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `inexistant-${t}` });
    expect(error).not.toBeNull(); // aucune entrée (auth.uid(), cle_tour, 'utilisatrice') → raise
    await c.auth.signOut();
  });

  it("idempotence : deux appels au même tour → UN seul signal", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await graverEntree(u.id, `idem-${t}`);
    const a = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `idem-${t}` });
    const b = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `idem-${t}` });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const { data } = await c.from("signal_reconceptualisation").select("id").eq("utilisatrice_id", u.id);
    expect((data ?? []).length).toBe(1);
    await c.auth.signOut();
  });

  it("anti-résurrection : un signal passé à 'consomme' (par 4.5) n'est jamais ré-ouvert en 'en_attente'", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const entree = await graverEntree(u.id, `resur-${t}`);
    await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `resur-${t}` });
    // Simule la consommation par la Story 4.5 (service_role — il n'y a pas encore de policy update sous JWT).
    await admin.from("signal_reconceptualisation").update({ statut: "consomme" }).eq("entree_journal_id", entree);
    // Une re-détection tente de ré-enregistrer → on conflict do nothing → reste 'consomme'.
    const re = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `resur-${t}` });
    expect(re.error).toBeNull();
    const { data } = await c.from("signal_reconceptualisation").select("statut").eq("entree_journal_id", entree).single();
    expect(data!.statut).toBe("consomme"); // jamais ressuscité
    await c.auth.signOut();
  });
});

describe("enregistrer_signal_reconceptualisation — [DUR / AD-17] garde de détresse au point d'écriture", () => {
  const u = { email: `sr-ad17-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", u.id);
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("épisode OUVERT → l'enregistrement LÈVE (mutation-cible : retirer branche_bloquee_par_detresse)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await graverEntree(u.id, `ad17-ouvert-${t}`);
    await ouvrirEpisode(u.id, 2);
    const { error } = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `ad17-ouvert-${t}` });
    expect(error, "aucun signal ne naît pendant un épisode ouvert (AD-17)").not.toBeNull();
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    await c.auth.signOut();
  });

  it("DANS les 72 h après extinction → LÈVE ; HORS des 72 h → réussit", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const entree = await graverEntree(u.id, `ad17-fenetre-${t}`);

    // Épisode clos il y a 24 h → DANS la fenêtre 72 h.
    await fermerEpisode(u.id, 24);
    const dans = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `ad17-fenetre-${t}` });
    expect(dans.error, "24 h après extinction : encore bloqué (AD-17)").not.toBeNull();

    // Épisode clos il y a 100 h → HORS de la fenêtre → l'enregistrement passe.
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    await fermerEpisode(u.id, 100);
    const hors = await c.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: `ad17-fenetre-${t}` });
    expect(hors.error, "100 h après extinction : plus bloqué").toBeNull();
    const { data } = await c.from("signal_reconceptualisation").select("statut").eq("entree_journal_id", entree).single();
    expect(data!.statut).toBe("en_attente");
    await c.auth.signOut();
  });
});

describe("signal_reconceptualisation — garde au VRAI point d'écriture (RLS), insert DIRECT (revue 4.4, R1/R3)", () => {
  // Le chemin exploité par la revue : `authenticated` a le grant INSERT table-level → un `.from().insert()`
  // DIRECT saute la RPC. Les gardes AD-17 + isolation DOIVENT donc être dans la policy WITH CHECK, pas seulement
  // dans la RPC — sinon la double-défense est illusoire. Ces tests prouvent la policy sur le chemin direct.
  const u = { email: `sr-direct-${t}@exemple.fr`, id: "" };
  const victime = { email: `sr-victime-${t}@exemple.fr`, id: "", entree: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    victime.id = await creerUtilisatrice(victime.email);
    victime.entree = await graverEntree(victime.id, `victime-${t}`);
  });
  afterAll(async () => {
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", u.id);
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", victime.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
    if (victime.id) await admin.auth.admin.deleteUser(victime.id);
  });

  it("[DUR/AD-17] un INSERT DIRECT (bypass RPC) pendant un épisode ouvert est REFUSÉ par la policy (mutation-cible : retirer `not branche_bloquee` du WITH CHECK)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const entree = await graverEntree(u.id, `direct-ad17-${t}`);
    await ouvrirEpisode(u.id, 2);
    const { error } = await c.from("signal_reconceptualisation").insert({ utilisatrice_id: u.id, entree_journal_id: entree });
    expect(error, "un insert direct pendant la détresse doit être refusé par la RLS (AD-17 au point d'écriture)").not.toBeNull();
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    await c.auth.signOut();
  });

  it("[isolation/AC4] un INSERT DIRECT pointant l'entrée d'une AUTRE utilisatrice est REFUSÉ (mutation-cible : retirer l'`exists`)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    // u tente de rattacher un signal à l'entrée de journal de la victime (le FK seul l'autoriserait).
    const { error } = await c.from("signal_reconceptualisation").insert({ utilisatrice_id: u.id, entree_journal_id: victime.entree });
    expect(error, "un signal ne peut pas pointer le journal d'autrui (isolation)").not.toBeNull();
    await c.auth.signOut();
  });

  it("contrôle positif : un INSERT DIRECT sur SA PROPRE entrée, consentie, hors détresse → réussit (la policy ne bloque pas tout)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const entree = await graverEntree(u.id, `direct-ok-${t}`);
    const { error } = await c.from("signal_reconceptualisation").insert({ utilisatrice_id: u.id, entree_journal_id: entree });
    expect(error).toBeNull();
    await c.auth.signOut();
  });
});

describe("signal_reconceptualisation — effacement FR-067 (delete sous JWT refusé ; service_role ; cascade)", () => {
  const u = { email: `sr-erase-${t}@exemple.fr`, id: "", entree: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.entree = await graverEntree(u.id, `erase-${t}`);
    await admin.from("signal_reconceptualisation").insert({ utilisatrice_id: u.id, entree_journal_id: u.entree });
  });
  afterAll(async () => {
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("un DELETE sous JWT est REFUSÉ (aucune policy delete) — la ligne survit", async () => {
    const c = await session(u.email);
    await c.from("signal_reconceptualisation").delete().eq("utilisatrice_id", u.id);
    await c.auth.signOut();
    const { data } = await admin.from("signal_reconceptualisation").select("id").eq("utilisatrice_id", u.id);
    expect((data ?? []).length).toBe(1); // toujours là : le JWT ne peut pas supprimer
  });

  it("service_role supprime (siège de l'effacement FR-067) ; le cascade depuis l'entrée purge aussi", async () => {
    // cascade : supprimer l'entrée de journal doit emporter le signal (on delete cascade).
    const del = await admin.from("entree_journal").delete().eq("id", u.entree);
    expect(del.error).toBeNull();
    const { data } = await admin.from("signal_reconceptualisation").select("id").eq("utilisatrice_id", u.id);
    expect((data ?? []).length).toBe(0);
  });
});
