import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ITEMS } from "@/lib/domain/enneagramme-items";

/**
 * enneagramme-sql.test.ts — LES GARDES DE BASE (Story 5.5, migration 0049).
 *
 * Ce fichier frappe un Supabase LOCAL réel, et il éprouve ce qu'aucun test de domaine ne peut
 * éprouver : que la BASE refuse ce qu'elle doit refuser quand l'appelante est authentifiée sous sa
 * propre identité et parle directement à l'API REST.
 *
 * C'est le seul angle qui compte. `authenticated` détient les sept privilèges DML sur chaque table
 * de `public` : une garde écrite dans une Server Action, dans une route ou dans une RPC seule ne
 * garde rien. Ce dépôt l'a payé six fois (migrations 0041, 0042, 0043, 0046, 0047, 0048).
 *
 *   AC4 — l'hypothèse ne naît pas pendant un épisode de détresse, et la garde est en SQL.
 *   AC5 — toutes les gardes d'écriture sont dans le WITH CHECK : le PATCH direct est refusé.
 *   AC6 — refuser et effacer SURVIVENT à la révocation du consentement.
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
  const email = `enn-${suffixe}-${t}@exemple.fr`;
  const motDePasse = "test-enn-123!";
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC5 — le write-gate art. 9 mord sur les trois tables, via l'API REST
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC5 DUR] aucune écriture d'ennéagramme sans consentement art. 9", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("gate");
  });
  afterAll(async () => nettoyer(u.id));

  it("sans consentement : le type posté DIRECTEMENT sous son propre JWT est refusé", async () => {
    const { error } = await u.client.from("enneagramme").insert({ utilisatrice_id: u.id, type: 4, origine: "test" });
    expect(error, "la base a accepté un type art. 9 sans consentement").not.toBeNull();
    const { count } = await admin
      .from("enneagramme")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", u.id);
    expect(count).toBe(0);
  });

  it("sans consentement : la tentative en cours est refusée elle aussi", async () => {
    // Les réponses brutes sont un matériau PLUS intime que le type : les laisser entrer avant le
    // consentement serait la faute que FR-072 nomme.
    const { error } = await u.client
      .from("enneagramme_tentative")
      .insert({ utilisatrice_id: u.id, reponses: { e1a: 3 } });
    expect(error).not.toBeNull();
  });

  it("sous BARRIÈRE DE MINORITÉ, consentement pourtant valide : refusé", async () => {
    await consentir(u.id);
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString() }).eq("id", u.id);
    const { error } = await u.client.from("enneagramme").insert({ utilisatrice_id: u.id, type: 4, origine: "test" });
    expect(error, "un compte barré pour minorité a pu déposer un profil psychologique").not.toBeNull();
    await admin.from("utilisatrice").update({ barriere_minorite_le: null }).eq("id", u.id);
  });

  it("[CONTRÔLE POSITIF] avec consentement et sans barrière, le dépôt PASSE", async () => {
    // Sans ce contrôle, les trois tests ci-dessus seraient satisfaits par une policy qui refuse tout.
    const { error } = await u.client.from("enneagramme").insert({ utilisatrice_id: u.id, type: 4, origine: "test" });
    expect(error, error?.message).toBeNull();
  });

  it("l'isolation entre locataires tient : on n'écrit pas chez une autre", async () => {
    const autre = await creerUtilisatrice("autre");
    await consentir(autre.id);
    const { error } = await u.client.from("enneagramme").insert({ utilisatrice_id: autre.id, type: 7, origine: "test" });
    expect(error).not.toBeNull();
    const { data } = await admin.from("enneagramme").select("type").eq("utilisatrice_id", autre.id).maybeSingle();
    expect(data).toBeNull();
    await nettoyer(autre.id);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC6 — refuser et effacer survivent à la révocation
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC6 DUR] après révocation : on ne dépose plus, mais on peut RETIRER", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("revoc");
    await consentir(u.id);
    await u.client.from("enneagramme").insert({ utilisatrice_id: u.id, type: 4, origine: "test" });
    await admin.from("enneagramme_hypothese").insert({ utilisatrice_id: u.id, type: 7 });
    await revoquer(u.id);
  });
  afterAll(async () => nettoyer(u.id));

  it("[CONTRÔLE] le dépôt d'un AUTRE type est bien refusé après révocation", async () => {
    /*
     * ⚠️ LES DEUX MOITIÉS D'UNE POLICY D'UPDATE N'ÉCHOUENT PAS DE LA MÊME FAÇON, et le dépôt ne
     * l'avait jamais écrit. Mesuré ici, contre la vraie base :
     *
     *   `using` qui ne passe pas      → la ligne n'est pas VISIBLE → zéro ligne, AUCUNE erreur
     *   `with check` qui ne passe pas → la ligne est visible mais l'écriture est refusée → ERREUR
     *
     * La leçon écrite dans 0036 — « une update bloquée par la RLS ne lève aucune erreur, elle
     * renvoie zéro ligne » — ne vaut donc que pour le premier cas. Ici c'est le second : elle est
     * propriétaire (le `using` passe), mais son consentement est révoqué (le `with check` refuse).
     *
     * La conséquence pratique est inversée par rapport à l'intuition : côté appelant, il faut
     * TOUJOURS relire la ligne, parce qu'on ne sait pas d'avance laquelle des deux moitiés mordra.
     * C'est ce que fait la seconde assertion, et c'est elle qui compte.
     */
    const { error } = await u.client.from("enneagramme").update({ type: 9 }).eq("utilisatrice_id", u.id).select();
    expect(error?.code, "la correction aurait dû être refusée par le WITH CHECK").toBe("42501");
    const { data: relu } = await admin.from("enneagramme").select("type").eq("utilisatrice_id", u.id).single();
    expect(relu?.type, "le type a changé alors que la RLS devait l'en empêcher").toBe(4);
  });

  it("[LE CŒUR] REFUSER l'hypothèse réussit après révocation", async () => {
    // C'est le moment où ça compte : celle qui révoque son consentement est précisément celle qui
    // veut que l'étiquette disparaisse. Une garde de consentement sur cette transition la lui
    // laisserait sur le dos, en affichant « c'est noté ».
    const { data } = await u.client
      .from("enneagramme_hypothese")
      .update({ statut: "refusee" })
      .eq("utilisatrice_id", u.id)
      .select();
    expect(data, "le refus a été bloqué par la révocation").toHaveLength(1);
    const { data: relu } = await admin
      .from("enneagramme_hypothese")
      .select("statut")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(relu?.statut).toBe("refusee");
  });

  it("[LE CŒUR] EFFACER son type réussit après révocation", async () => {
    const { data } = await u.client.from("enneagramme").delete().eq("utilisatrice_id", u.id).select();
    expect(data, "l'effacement a été bloqué par la révocation").toHaveLength(1);
    const { count } = await admin
      .from("enneagramme")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", u.id);
    expect(count).toBe(0);
  });

  it("la LECTURE reste ouverte après révocation — l'export FR-067 en dépend", async () => {
    const { error } = await u.client.from("enneagramme_hypothese").select("type").eq("utilisatrice_id", u.id);
    expect(error).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC4 — la garde de détresse vit dans le SQL
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC4 DUR] pendant un épisode de détresse, aucune hypothèse ne naît", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("detresse");
    await consentir(u.id);
  });
  afterAll(async () => nettoyer(u.id));

  it("[CONTRÔLE POSITIF] hors épisode, le germe entre", async () => {
    const { error } = await u.client.from("enneagramme_hypothese").insert({ utilisatrice_id: u.id, type: 3 });
    expect(error, error?.message).toBeNull();
    await admin.from("enneagramme_hypothese").delete().eq("utilisatrice_id", u.id);
  });

  it("[LE CŒUR] épisode ouvert : le germe est REFUSÉ par la base, pas par du TypeScript", async () => {
    await ouvrirEpisode(u.id);
    const { error } = await u.client.from("enneagramme_hypothese").insert({ utilisatrice_id: u.id, type: 3 });
    expect(error, "une typologie de personnalité a pu naître pendant un épisode de détresse").not.toBeNull();
  });

  it("le TEST COURT, lui, reste ouvert pendant un épisode — c'est un geste D'ELLE", async () => {
    // Décision explicite, écrite dans l'en-tête de 0049 : le socle n'est pas suspendu (patron
    // `theme_natal`), et retirer un geste qu'elle a choisi serait la punir de son état.
    const { error } = await u.client
      .from("enneagramme_tentative")
      .insert({ utilisatrice_id: u.id, reponses: { e1a: 2 } });
    expect(error, error?.message).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le germe : anti-forge, anti-résurrection, unicité
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5] l'hypothèse naît en attente, et ne revient pas d'un état terminal", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("germe");
    await consentir(u.id);
  });
  afterAll(async () => nettoyer(u.id));

  it("[LE CŒUR] un germe forgé directement « acceptee » est refusé", async () => {
    // Sans l'anti-forge à l'INSERT, un POST REST fabriquerait une hypothèse déjà acceptée : Anam
    // aurait « proposé » une chose qu'elle n'a jamais formulée.
    const { error } = await u.client
      .from("enneagramme_hypothese")
      .insert({ utilisatrice_id: u.id, type: 5, statut: "acceptee" });
    expect(error).not.toBeNull();
  });

  it("un germe forgé déjà DIT est refusé", async () => {
    const { error } = await u.client
      .from("enneagramme_hypothese")
      .insert({ utilisatrice_id: u.id, type: 5, dite_le: new Date().toISOString() });
    expect(error).not.toBeNull();
  });

  it("[LE CŒUR] une hypothèse refusée ne redevient jamais acceptée", async () => {
    const { data: cree } = await u.client
      .from("enneagramme_hypothese")
      .insert({ utilisatrice_id: u.id, type: 5 })
      .select()
      .single();
    await u.client.from("enneagramme_hypothese").update({ statut: "refusee" }).eq("id", cree!.id);
    const { error } = await u.client
      .from("enneagramme_hypothese")
      .update({ statut: "acceptee" })
      .eq("id", cree!.id);
    expect(error, "un état terminal a été rouvert").not.toBeNull();
  });

  it("le TYPE proposé ne se réécrit pas — sinon elle accepterait autre chose que ce qu'on lui a montré", async () => {
    const { data: cree } = await u.client
      .from("enneagramme_hypothese")
      .insert({ utilisatrice_id: u.id, type: 2 })
      .select()
      .single();
    const { error } = await u.client.from("enneagramme_hypothese").update({ type: 8 }).eq("id", cree!.id);
    expect(error).not.toBeNull();
    await admin.from("enneagramme_hypothese").delete().eq("id", cree!.id);
  });

  it("[LE CŒUR] une SEULE hypothèse en attente à la fois", async () => {
    // L'étage `after()` qui produit le germe ne consulte jamais `signal.aborted` : il peut tourner
    // deux fois. Sans l'unicité en base, Anam accumulerait des hypothèses et en dirait une par
    // chargement.
    await admin.from("enneagramme_hypothese").delete().eq("utilisatrice_id", u.id);
    const premier = await u.client.from("enneagramme_hypothese").insert({ utilisatrice_id: u.id, type: 1 });
    expect(premier.error, premier.error?.message).toBeNull();
    const second = await u.client.from("enneagramme_hypothese").insert({ utilisatrice_id: u.id, type: 6 });
    expect(second.error, "deux hypothèses en attente coexistent").not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La forme des réponses, les horodatages, les privilèges
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5] la tentative : forme bornée et horodatage autoritaire", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("forme");
    await consentir(u.id);
  });
  afterAll(async () => nettoyer(u.id));

  it("[CONTRÔLE POSITIF] un jeu de réponses conforme entre", async () => {
    const reponses = Object.fromEntries(ITEMS.map((i) => [i.id, 2]));
    const { error } = await u.client.from("enneagramme_tentative").insert({ utilisatrice_id: u.id, reponses });
    expect(error, error?.message).toBeNull();
  });

  it("une valeur hors échelle est refusée", async () => {
    const { error } = await u.client
      .from("enneagramme_tentative")
      .update({ reponses: { e1a: 7 } })
      .eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
  });

  it("une clé qui n'a pas la forme d'un énoncé est refusée", async () => {
    const { error } = await u.client
      .from("enneagramme_tentative")
      .update({ reponses: { "'; drop table": 1 } })
      .eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
  });

  it("[DÉFENSE REDONDANTE, NOMMÉE] la borne à dix-huit est INATTEIGNABLE, et c'est voulu", async () => {
    /*
     * `reponses_enneagramme_valides` porte DEUX contraintes : au plus dix-huit clés, et chaque clé
     * de la forme `e<1-9><a|b>`. Or ce motif n'admet QUE dix-huit chaînes distinctes, et un objet
     * JSON ne peut pas porter deux fois la même clé. La borne de comptage ne peut donc jamais
     * mordre : le motif refuse toujours en premier.
     *
     * Elle reste, comme ceinture le jour où le motif s'élargirait (ailes, instincts). Mais elle est
     * écrite ICI plutôt que tue, parce que ce dépôt a une leçon de campagne de mutation qui dit
     * exactement ça : « deux défenses redondantes se couvrent l'une l'autre » — retirer la borne ne
     * fera survivre aucun mutant, et quelqu'un en conclura à tort qu'elle ne sert à rien.
     */
    const dixHuit = Object.fromEntries(ITEMS.map((i) => [i.id, 1]));
    expect(Object.keys(dixHuit), "le motif admet exactement dix-huit chaînes").toHaveLength(18);
    const { data: conforme } = await admin.rpc("reponses_enneagramme_valides", { p_reponses: dixHuit });
    expect(conforme).toBe(true);
    // La dix-neuvième clé possible n'existe pas ; toute clé supplémentaire est hors motif.
    const { data: horsMotif } = await admin.rpc("reponses_enneagramme_valides", {
      p_reponses: { ...dixHuit, e10a: 1 },
    });
    expect(horsMotif, "c'est le MOTIF qui refuse, pas le comptage").toBe(false);
  });

  it("[LE CŒUR] un horodatage ANTIDATÉ est écrasé par la base", async () => {
    // `default now()` n'est qu'un défaut : sans trigger, un insert direct le remplace (0046).
    await admin.from("enneagramme_tentative").delete().eq("utilisatrice_id", u.id);
    const hier = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
    await u.client.from("enneagramme_tentative").insert({ utilisatrice_id: u.id, reponses: {}, cree_le: hier });
    const { data } = await admin
      .from("enneagramme_tentative")
      .select("cree_le")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(new Date(data!.cree_le).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("[5.5/AC5] anon n'a AUCUN privilège sur les trois tables", () => {
  it("le refus tombe au PRIVILÈGE (42501), pas seulement à la RLS", async () => {
    // Depuis 0041, « zéro ligne » ne suffit plus : on exige le code d'erreur de privilège.
    const anon = clientScope();
    for (const table of ["enneagramme", "enneagramme_tentative", "enneagramme_hypothese"]) {
      const { error } = await anon.from(table).select("*").limit(1);
      expect(error?.code, `${table} est lisible par anon`).toBe("42501");
    }
  });
});

describe("[5.5/AC5] le TEXTE de la migration dit ce qu'aucune requête ne peut montrer", () => {
  const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0049_enneagramme.sql"), "utf-8");

  it("[CONTRÔLE DU CONTRÔLE] la migration est bien lue et parle bien du bon sujet", () => {
    expect(migration.length).toBeGreaterThan(2000);
    expect(migration).toMatch(/create table public\.enneagramme\b/);
  });

  it("les trois tables ont RLS activée ET forcée", () => {
    // `force row level security` n'a aucune manifestation observable via PostgREST : il empêche le
    // PROPRIÉTAIRE de la table de contourner ses propres policies. Seul le texte peut l'attester.
    for (const table of ["enneagramme", "enneagramme_tentative", "enneagramme_hypothese"]) {
      expect(migration, `${table} : enable`).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      );
      expect(migration, `${table} : force`).toMatch(
        new RegExp(`alter table public\\.${table} force\\s+row level security`),
      );
    }
  });

  it("[LE CŒUR] la garde de détresse est dans la policy de l'HYPOTHÈSE, et nulle part ailleurs", () => {
    const depotHypothese = /create policy enneagramme_hypothese_depot[\s\S]*?;/.exec(migration)?.[0] ?? "";
    expect(depotHypothese, "témoin : la policy de dépôt du germe a bien été extraite").toContain("with check");
    expect(depotHypothese).toContain("branche_bloquee_par_detresse");

    const reponse = /create policy enneagramme_hypothese_reponse[\s\S]*?;/.exec(migration)?.[0] ?? "";
    expect(reponse, "témoin : la policy de réponse a bien été extraite").toContain("with check");
    // ⚠️ RÉPONDRE ne doit PAS être bloqué par la détresse : refuser une hypothèse reste possible en
    // toutes circonstances. C'est l'inverse de la garde ci-dessus, sur la même table.
    expect(reponse).not.toContain("branche_bloquee_par_detresse");
    expect(reponse, "la réponse à une hypothèse s'est mise à exiger le consentement").not.toContain(
      "a_consenti_art9",
    );
  });

  it("[LE CŒUR] aucune policy de RETRAIT n'exige le consentement", () => {
    for (const nom of ["enneagramme_retrait", "enneagramme_tentative_retrait", "enneagramme_hypothese_retrait"]) {
      const policy = new RegExp(`create policy ${nom}[\\s\\S]*?;`).exec(migration)?.[0] ?? "";
      expect(policy, `témoin : ${nom} a bien été extraite`).toContain("for delete");
      expect(policy, `${nom} exige le consentement pour EFFACER`).not.toContain("a_consenti_art9");
    }
  });

  it("aucune clause PREMIUM n'a été copiée du gabarit 0036 (FR-055, gratuit à vie)", () => {
    expect(migration).not.toMatch(/est_premium_courante/);
  });

  it("le trigger du germe garde l'INSERT autant que l'UPDATE", () => {
    // Le trigger qui ne garde que l'UPDATE est le défaut récurrent du dépôt : 0039→0041, 0021→0046.
    expect(migration).toMatch(/before insert or update on public\.enneagramme_hypothese/);
  });

  it("anon est révoqué explicitement sur les trois tables", () => {
    for (const table of ["enneagramme", "enneagramme_tentative", "enneagramme_hypothese"]) {
      expect(migration).toMatch(new RegExp(`revoke all on public\\.${table}\\s+from anon`));
    }
  });
});

describe("[5.5] le miroir de forme entre la base et le domaine", () => {
  it("[LE CŒUR] tout identifiant d'énoncé passe le motif que la base impose", async () => {
    // ⚠️ `reponses_enneagramme_valides` porte un motif `^e[1-9][ab]$` qui est un MIROIR de
    // `lib/domain/enneagramme-items.ts`. C'est une divergence en attente — la base ne lit pas le
    // TypeScript. On ne peut pas la supprimer, on peut la GARDER : renommer un énoncé sans toucher
    // au motif ferait échouer toutes les tentatives, en production, silencieusement.
    const reponses = Object.fromEntries(ITEMS.map((i) => [i.id, 0]));
    const { data, error } = await admin.rpc("reponses_enneagramme_valides", { p_reponses: reponses });
    expect(error, error?.message).toBeNull();
    expect(data, "un identifiant d'énoncé ne passe plus le motif de la base").toBe(true);
  });

  it("[CONTRÔLE] un identifiant hors forme est bien refusé par le même prédicat", async () => {
    const { data } = await admin.rpc("reponses_enneagramme_valides", { p_reponses: { item_1: 0 } });
    expect(data).toBe(false);
  });
});
