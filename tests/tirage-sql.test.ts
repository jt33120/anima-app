import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * tirage-sql.test.ts — LES GARDES DE BASE DU JOURNAL DE TIRAGE (Story 5.7, migration 0050).
 *
 * Ce fichier frappe un Supabase LOCAL réel et éprouve ce qu'aucun test de domaine ne peut éprouver :
 * que la BASE refuse ce qu'elle doit refuser quand l'appelante est authentifiée sous sa propre
 * identité et parle directement à l'API REST.
 *
 * C'est le seul angle qui compte. `authenticated` détient les sept privilèges DML sur chaque table de
 * `public` : une garde écrite dans une Server Action, dans une route ou dans une RPC seule ne garde
 * rien. Ce dépôt l'a payé six fois (migrations 0041 à 0048).
 *
 *   AC2/AC3 — la ligne journalisée est REJOUABLE, et la base refuse ce qui ne le serait pas.
 *   AC7     — aucun tirage pendant une fenêtre de détresse, et la garde est en SQL.
 *   §immuable — un journal d'audit ne se corrige pas : il n'existe AUCUNE policy d'UPDATE.
 *   FR-067  — le journal part avec le compte.
 */

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

interface Utilisatrice {
  id: string;
  client: SupabaseClient;
}

async function creerUtilisatrice(suffixe: string): Promise<Utilisatrice> {
  const email = `tir-${suffixe}-${t}@exemple.fr`;
  const motDePasse = "test-tir-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const { error: e2 } = await admin.from("utilisatrice").update({ date_naissance: "1990-06-15" }).eq("id", id);
  if (e2) throw new Error(`date_naissance: ${e2.message}`);
  const client = clientScope();
  const { error: e3 } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (e3) throw new Error(`signIn: ${e3.message}`);
  return { id, client };
}

async function consentir(id: string): Promise<void> {
  const { error } = await admin
    .from("consentement")
    .upsert(
      { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
  if (error) throw new Error(`consentement: ${error.message}`);
}

async function revoquer(id: string): Promise<void> {
  const { error } = await admin
    .from("consentement")
    .update({ revoked_at: new Date().toISOString() })
    .eq("utilisatrice_id", id)
    .is("revoked_at", null);
  if (error) throw new Error(`revocation: ${error.message}`);
}

async function ouvrirEpisode(id: string): Promise<void> {
  const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: 2 });
  if (error) throw new Error(`ouvrirEpisode: ${error.message}`);
}

async function nettoyer(id: string): Promise<void> {
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

/** Un tirage valide et rejouable : `0x0000002a % 24 === 18`. */
const TIRAGE_VALIDE = { carte: "barque", graine: "0000002a", taille_jeu: 24 };

let alice: Utilisatrice;
let bob: Utilisatrice;

beforeAll(async () => {
  alice = await creerUtilisatrice("alice");
  bob = await creerUtilisatrice("bob");
  await consentir(alice.id);
  await consentir(bob.id);
}, 60_000);

afterAll(async () => {
  await nettoyer(alice.id);
  await nettoyer(bob.id);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. Le chemin nominal, et la propriété
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-12] le journal appartient à celle qui a tiré", () => {
  it("un dépôt sous sa propre identité passe", async () => {
    const { error } = await alice.client.from("tirage").insert({ utilisatrice_id: alice.id, ...TIRAGE_VALIDE });
    expect(error).toBeNull();
  });

  it("déposer POUR QUELQU'UN D'AUTRE est refusé", async () => {
    const { error } = await alice.client.from("tirage").insert({ utilisatrice_id: bob.id, ...TIRAGE_VALIDE });
    expect(error?.code).toBe("42501");
  });

  it("les tirages d'autrui sont invisibles", async () => {
    const { data } = await bob.client.from("tirage").select("id").eq("utilisatrice_id", alice.id);
    expect(data).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. LE JOURNAL EST IMMUABLE — la décision la plus structurante de 0050
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3] un tirage ne se corrige jamais — il n'existe aucune policy d'UPDATE", () => {
  it("un PATCH direct sur sa PROPRE ligne est refusé", async () => {
    // ⚠️ C'est ici que se joue la valeur de tout le journal. Une ligne modifiable a l'air d'une
    // preuve sans en être une : on pourrait tirer, voir la carte, puis réécrire la graine pour que
    // `rejouer()` confirme n'importe quoi. Postgres ne refuse pas par erreur — il n'y a simplement
    // AUCUNE policy `for update` sur cette table, donc rien n'autorise l'opération.
    const { data } = await alice.client.from("tirage").select("id").eq("utilisatrice_id", alice.id).limit(1);
    const id = data![0].id as string;

    const { error, count } = await alice.client
      .from("tirage")
      .update({ carte: "fleur" }, { count: "exact" })
      .eq("id", id);
    // Sans policy `for update`, la ligne n'est pas VISIBLE à l'écriture : zéro ligne touchée.
    expect(error).toBeNull();
    expect(count).toBe(0);

    // Et la vérité : la carte n'a pas bougé.
    const { data: apres } = await alice.client.from("tirage").select("carte").eq("id", id).single();
    expect(apres!.carte).toBe("barque");
  });

  it("le corpus de migrations ne contient AUCUNE policy d'update sur `tirage`", async () => {
    // Garde de source, complémentaire de la précédente : elle attrape l'ajout d'une policy AVANT
    // qu'elle n'atteigne une base, et elle dit pourquoi c'est grave.
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0050_tirage.sql"), "utf8");
    const sansCommentaires = sql
      .split("\n")
      .map((l) => l.replace(/--.*$/, ""))
      .join("\n");
    expect(sansCommentaires).not.toMatch(/create\s+policy\s+\w+\s+on\s+public\.tirage\s+for\s+update/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. La ligne journalisée doit rester REJOUABLE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3] la base refuse une ligne qu'on ne pourrait pas rejouer", () => {
  it.each([
    ["graine trop courte", { ...TIRAGE_VALIDE, graine: "2a" }],
    ["graine en majuscules (format non canonique)", { ...TIRAGE_VALIDE, graine: "0000002A" }],
    ["graine non hexadécimale", { ...TIRAGE_VALIDE, graine: "zzzzzzzz" }],
    ["taille de jeu à 1 — un « tirage » constant déguisé", { ...TIRAGE_VALIDE, taille_jeu: 1 }],
    ["taille de jeu absurde", { ...TIRAGE_VALIDE, taille_jeu: 100_000 }],
    ["clé de carte majuscule", { ...TIRAGE_VALIDE, carte: "Barque" }],
    ["clé de carte vide", { ...TIRAGE_VALIDE, carte: "" }],
    ["clé de carte bordée d'un tiret", { ...TIRAGE_VALIDE, carte: "-barque" }],
  ])("%s est refusée", async (_nom, ligne) => {
    const { error } = await alice.client.from("tirage").insert({ utilisatrice_id: alice.id, ...ligne });
    expect(error?.code).toBe("23514"); // check_violation
  });

  it("l'horodatage est posé par la BASE — un `tire_a` antidaté est écrasé", async () => {
    // Sur un journal d'audit, une heure choisie par l'écrivain n'atteste de rien. Le trigger
    // `tirage_horodatage` (patron 0046) la remplace pour tout écrivain sous JWT.
    const hier = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
    const { data, error } = await alice.client
      .from("tirage")
      .insert({ utilisatrice_id: alice.id, ...TIRAGE_VALIDE, tire_a: hier })
      .select("tire_a")
      .single();
    expect(error).toBeNull();
    expect(new Date(data!.tire_a as string).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. Les gardes du `with check`
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC7 · AD-17] aucun tirage pendant une fenêtre de détresse", () => {
  it("un épisode ouvert ferme le tirage", async () => {
    // Une carte tirée pendant un épisode ouvert, puis présentée comme porteuse de sens, c'est le
    // registre que §5 suspend au moment précis où le produit doit cesser d'être un oracle pour
    // devenir un filet. Même raison qu'`enneagramme_hypothese` (0049), en plus chargé.
    const carol = await creerUtilisatrice("carol");
    await consentir(carol.id);
    await ouvrirEpisode(carol.id);

    const { error } = await carol.client.from("tirage").insert({ utilisatrice_id: carol.id, ...TIRAGE_VALIDE });
    expect(error?.code).toBe("42501");

    await nettoyer(carol.id);
  }, 30_000);
});

describe("[AD-13] le consentement art. 9 garde la porte du rituel", () => {
  it("sans consentement, aucun tirage", async () => {
    // Le tirage OUVRE un rituel dont la suite immédiate — « qu'est-ce que tu vois ? » — recueille de
    // l'art. 9. On garde la porte, pas la pièce.
    const dana = await creerUtilisatrice("dana");
    const { error } = await dana.client.from("tirage").insert({ utilisatrice_id: dana.id, ...TIRAGE_VALIDE });
    expect(error?.code).toBe("42501");
    await nettoyer(dana.id);
  }, 30_000);

  it("une révocation EN VOL ferme le tirage, et laisse LIRE et EFFACER ce qui existe déjà", async () => {
    const eve = await creerUtilisatrice("eve");
    await consentir(eve.id);
    const { error: avant } = await eve.client.from("tirage").insert({ utilisatrice_id: eve.id, ...TIRAGE_VALIDE });
    expect(avant).toBeNull();

    await revoquer(eve.id);

    // Écrire : fermé.
    const { error: apres } = await eve.client.from("tirage").insert({ utilisatrice_id: eve.id, ...TIRAGE_VALIDE });
    expect(apres?.code).toBe("42501");

    // Lire : ouvert — l'export FR-067 en dépend, et un socle qui séquestre ce qu'il a déjà écrit
    // n'est pas un socle.
    const { data } = await eve.client.from("tirage").select("id").eq("utilisatrice_id", eve.id);
    expect(data!.length).toBe(1);

    // Effacer : ouvert — c'est précisément le geste de celle qui vient de révoquer.
    const { error: suppr } = await eve.client.from("tirage").delete().eq("utilisatrice_id", eve.id);
    expect(suppr).toBeNull();
    const { data: reste } = await eve.client.from("tirage").select("id").eq("utilisatrice_id", eve.id);
    expect(reste).toEqual([]);

    await nettoyer(eve.id);
  }, 30_000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 5. L'inventaire d'effacement (FR-067)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[FR-067] le journal de tirage part avec le compte", () => {
  it("supprimer l'utilisatrice emporte ses tirages (une table oubliée par l'effacement est un trou RGPD)", async () => {
    const frank = await creerUtilisatrice("frank");
    await consentir(frank.id);
    await frank.client.from("tirage").insert({ utilisatrice_id: frank.id, ...TIRAGE_VALIDE });

    const { count: avant } = await admin
      .from("tirage")
      .select("id", { count: "exact", head: true })
      .eq("utilisatrice_id", frank.id);
    expect(avant).toBe(1);

    await admin.auth.admin.deleteUser(frank.id);

    const { count: apres } = await admin
      .from("tirage")
      .select("id", { count: "exact", head: true })
      .eq("utilisatrice_id", frank.id);
    expect(apres).toBe(0);
  }, 30_000);
});
