import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reposerConsentement } from "./_rig-consentement";

/**
 * Story 4.2 — la table `fait_extrait` (faits extraits, AD-8 couche 2). Preuves BLOQUANTES contre un
 * vrai Supabase local — miroir art. 9 « possédé sous JWT » de `entree-journal.test.ts` :
 *  - schéma : `origine`/`statut` (checks), `cle_dedoublonnage`, `contenu` (art. 9), `extrait_source_id`
 *    (FK → entree_journal, AC5 de 4.1), `id uuid`, `cree_le`/`maj_le timestamptz`, colonnes exactes (AC1) ;
 *  - art. 9 sous JWT (AD-12) : deny-by-default — une AUTRE utilisatrice ne lit rien, une session anonyme non plus ;
 *  - write-gate (AD-13) : insertion refusée sans consentement, refusée sous barrière minorité, LECTURE (export)
 *    encore permise après révocation ; suppression (soft) permise même après révocation (droit RGPD, point (a)) ;
 *  - [DUR] anti-résurrection (AD-18) : une écriture `origine='extrait'` sur un fait corrigé/supprimé/utilisatrice
 *    LÈVE (trigger, même service_role) ; le `delete` courant sous JWT est refusé (soft-delete) ; seul service_role
 *    supprime des lignes (effacement FR-067, Epic 6) ;
 *  - idempotence par la clé de dédoublonnage (AC2) : une info = une ligne (index unique).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = Date.now();
const MDP = "test-fait-123!";

/** Consentement art. 9 valide sous la session RLS (même chemin que « Je commence »). */
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

/** Grave une entrée de journal (source d'un fait — AC1/AC5) et renvoie son id stable. */
async function graverSource(id: string, contenu = "un tour source"): Promise<string> {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: `src-${t}-${Math.round(performance.now())}`, contenu })
    .select("id")
    .single();
  if (error) throw new Error(`graverSource: ${error.message}`);
  return data!.id as string;
}

describe("fait_extrait — schéma, provenance & lien source (AC1)", () => {
  const u = { email: `fe-schema-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("fait_extrait").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("colonnes exactes, id uuid, statut par défaut 'actif', lien source, cree_le/maj_le timestamptz", async () => {
    const source = await graverSource(u.id);
    const { data, error } = await admin
      .from("fait_extrait")
      .insert({
        utilisatrice_id: u.id,
        origine: "extrait",
        cle_dedoublonnage: `cle-schema-${t}`,
        contenu: "aime marcher en forêt le dimanche",
        extrait_source_id: source,
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(String(data!.id)).toMatch(UUID);
    expect(data!.statut).toBe("actif"); // défaut
    expect(data!.origine).toBe("extrait");
    expect(data!.extrait_source_id).toBe(source); // lien vers le message exact (AC1/AC5)
    expect(Number.isNaN(new Date(data!.cree_le as string).getTime())).toBe(false);
    expect(Number.isNaN(new Date(data!.maj_le as string).getTime())).toBe(false);

    const colonnes = Object.keys(data!).sort();
    expect(colonnes).toEqual(
      ["cle_dedoublonnage", "contenu", "cree_le", "extrait_source_id", "id", "maj_le", "origine", "statut", "utilisatrice_id"].sort(),
    );
  });

  it("check origine : une valeur hors ('extrait','utilisatrice') est refusée", async () => {
    const { error } = await admin
      .from("fait_extrait")
      .insert({ utilisatrice_id: u.id, origine: "sournois", cle_dedoublonnage: `cle-bad-org-${t}`, contenu: "x" });
    expect(error).not.toBeNull();
  });

  it("check statut : une valeur hors ('actif','corrige','supprime') est refusée", async () => {
    const { error } = await admin
      .from("fait_extrait")
      .insert({ utilisatrice_id: u.id, origine: "extrait", statut: "zombie", cle_dedoublonnage: `cle-bad-st-${t}`, contenu: "x" });
    expect(error).not.toBeNull();
  });

  it("index unique (utilisatrice_id, cle_dedoublonnage) : un doublon direct est refusé (AC2)", async () => {
    const cle = `cle-unique-${t}`;
    const a = await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "extrait", cle_dedoublonnage: cle, contenu: "un" });
    expect(a.error).toBeNull();
    const b = await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "extrait", cle_dedoublonnage: cle, contenu: "deux" });
    expect(b.error).not.toBeNull(); // violation d'unicité
  });
});

describe("fait_extrait — art. 9 sous JWT, deny-by-default (AC5)", () => {
  const u1 = { email: `fe-owner-${t}@exemple.fr`, id: "" };
  const u2 = { email: `fe-autre-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u1.id = await creerUtilisatrice(u1.email);
    u2.id = await creerUtilisatrice(u2.email);
    await admin.from("fait_extrait").insert({ utilisatrice_id: u1.id, origine: "extrait", cle_dedoublonnage: `iso-${t}`, contenu: "un fait privé" });
  });
  afterAll(async () => {
    await admin.from("fait_extrait").delete().eq("utilisatrice_id", u1.id);
    if (u1.id) await admin.auth.admin.deleteUser(u1.id);
    if (u2.id) await admin.auth.admin.deleteUser(u2.id);
  });

  it("une AUTRE utilisatrice ne lit RIEN de mes faits (RLS)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u2.email, password: MDP });
    const { data, error } = await c.from("fait_extrait").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // masqué : la ligne existe pourtant (deny-by-default)
    await c.auth.signOut();
  });

  it("une session NON authentifiée ne lit rien", async () => {
    const anon = clientScope();
    const { data, error } = await anon.from("fait_extrait").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull(); // (revue F) : la table existe et répond — pas un faux-vert « table absente »
    expect(data ?? []).toHaveLength(0); // masqué : la ligne de u1 existe pourtant (deny-by-default)
  });
});

describe("fait_extrait — write-gate art. 9 & droits RGPD survivants (AC5, point (a))", () => {
  const u = { email: `fe-wg-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("fait_extrait").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("sans consentement : l'insertion d'un fait est REFUSÉE (write-gate durci, AD-13)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);
    const { error } = await c.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "extrait", cle_dedoublonnage: `nc-${t}`, contenu: "avant consentement" });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });

  it("sous barrière minorité : l'insertion est refusée MÊME avec consentement (gabarit 0006/F1)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString(), echeance_suppression: "2099-01-01" }).eq("id", u.id);
    const { error } = await c.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "extrait", cle_dedoublonnage: `min-${t}`, contenu: "sous barrière" });
    expect(error).not.toBeNull();
    await admin.from("utilisatrice").update({ barriere_minorite_le: null }).eq("id", u.id); // nettoyage
    await c.auth.signOut();
  });

  it("[point (a)] la SUPPRESSION (soft) d'un fait survit à la révocation du consentement (droit RGPD)", async () => {
    const cle = `rgpd-${t}`;
    // Fait actif semé (l'utilisatrice a consenti à un moment).
    await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "extrait", cle_dedoublonnage: cle, contenu: "un fait à oublier" });
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);
    // Révocation art. 9.
    await c.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", u.id).is("revoked_at", null);
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);
    // Suppression soft (UPDATE simple, chemin utilisatrice) : DOIT réussir même sans consentement actif.
    const { error } = await c.from("fait_extrait").update({ statut: "supprime", origine: "utilisatrice", contenu: "" }).eq("cle_dedoublonnage", cle);
    expect(error).toBeNull();
    const { data } = await admin.from("fait_extrait").select("statut, contenu").eq("cle_dedoublonnage", cle).single();
    expect(data!.statut).toBe("supprime");
    expect(data!.contenu).toBe(""); // contenu vidé au tombstone (point (b))
    // La LECTURE (export) reste permise après révocation.
    const { data: lu, error: lec } = await c.from("fait_extrait").select("id").eq("utilisatrice_id", u.id);
    expect(lec).toBeNull();
    expect((lu ?? []).length).toBeGreaterThanOrEqual(1);
    await c.auth.signOut();
  });

  it("[revue A] la CORRECTION (contenu neuf) est REFUSÉE après révocation, mais la SUPPRESSION passe (write-gate trigger)", async () => {
    const cle = `corr-revoc-${t}`;
    await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "extrait", cle_dedoublonnage: cle, contenu: "un fait initial" });
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await reposerConsentement(admin, u.id); // le test précédent a révoqué — et 0041 rend ça irréversible
    await c.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", u.id).is("revoked_at", null);
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);

    // CORRECTION (contenu NON vide) via la RPC → doit LEVER (trigger content-gate, AD-13).
    const corr = await c.rpc("fusionner_fait_extrait", { p_origine: "utilisatrice", p_statut: "corrige", p_cle: cle, p_contenu: "un contenu tout neuf et sensible", p_extrait_source: null });
    expect(corr.error).not.toBeNull();
    const { data: apres } = await admin.from("fait_extrait").select("contenu, statut").eq("cle_dedoublonnage", cle).single();
    expect(apres!.contenu).toBe("un fait initial"); // rien déposé

    // SUPPRESSION (vider) via la RPC → AUTORISÉE même après révocation (droit à l'effacement).
    const sup = await c.rpc("fusionner_fait_extrait", { p_origine: "utilisatrice", p_statut: "supprime", p_cle: cle, p_contenu: "", p_extrait_source: null });
    expect(sup.error).toBeNull();
    const { data: fin } = await admin.from("fait_extrait").select("statut, contenu").eq("cle_dedoublonnage", cle).single();
    expect(fin).toMatchObject({ statut: "supprime", contenu: "" });
    await c.auth.signOut();
  });

  it("[revue A] le chemin utilisatrice REFUSE p_statut='actif' (pas de ré-activation forgée)", async () => {
    const cle = `noact-${t}`;
    await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "utilisatrice", statut: "supprime", cle_dedoublonnage: cle, contenu: "" });
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await reposerConsentement(admin, u.id); // même consentante, la ré-activation par le chemin utilisatrice est interdite
    const { error } = await c.rpc("fusionner_fait_extrait", { p_origine: "utilisatrice", p_statut: "actif", p_cle: cle, p_contenu: "re-actif", p_extrait_source: null });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });
});

describe("fait_extrait — anti-résurrection & soft-delete au niveau base (AC3 [DUR])", () => {
  const u = { email: `fe-tomb-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("fait_extrait").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("[DUR] une écriture origine='extrait' sur un TOMBSTONE (supprime) LÈVE — même service_role (trigger)", async () => {
    const cle = `tomb-sup-${t}`;
    await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "utilisatrice", statut: "supprime", cle_dedoublonnage: cle, contenu: "" });
    // Tentative de résurrection directe (bypass de la clause WHERE) → le trigger doit lever.
    const { error } = await admin.from("fait_extrait").update({ origine: "extrait", statut: "actif", contenu: "ressuscité" }).eq("cle_dedoublonnage", cle);
    expect(error).not.toBeNull(); // trigger fait_extrait_no_resurrection
    const { data } = await admin.from("fait_extrait").select("statut, origine").eq("cle_dedoublonnage", cle).single();
    expect(data!.statut).toBe("supprime"); // inchangé
    expect(data!.origine).toBe("utilisatrice");
  });

  it("[DUR] une écriture origine='extrait' sur un fait CORRIGÉ (utilisatrice) LÈVE (trigger)", async () => {
    const cle = `tomb-cor-${t}`;
    await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "utilisatrice", statut: "corrige", cle_dedoublonnage: cle, contenu: "ma version" });
    const { error } = await admin.from("fait_extrait").update({ origine: "extrait", contenu: "version auto imposée" }).eq("cle_dedoublonnage", cle);
    expect(error).not.toBeNull();
    const { data } = await admin.from("fait_extrait").select("contenu").eq("cle_dedoublonnage", cle).single();
    expect(data!.contenu).toBe("ma version"); // la correction utilisatrice prime
  });

  it("une ré-écriture origine='extrait' sur un fait extrait+actif est AUTORISÉE (rafraîchissement légitime)", async () => {
    const cle = `actif-${t}`;
    await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "extrait", statut: "actif", cle_dedoublonnage: cle, contenu: "v1" });
    const { error } = await admin.from("fait_extrait").update({ origine: "extrait", contenu: "v2" }).eq("cle_dedoublonnage", cle);
    expect(error).toBeNull(); // le trigger n'entrave PAS le chemin légitime (extrait+actif)
    const { data } = await admin.from("fait_extrait").select("contenu").eq("cle_dedoublonnage", cle).single();
    expect(data!.contenu).toBe("v2");
  });

  it("delete sous JWT ne supprime rien (soft-delete ; aucune policy delete) ; service_role RÉUSSIT (FR-067)", async () => {
    const cle = `del-${t}`;
    await admin.from("fait_extrait").insert({ utilisatrice_id: u.id, origine: "extrait", cle_dedoublonnage: cle, contenu: "à garder sous JWT" });
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);
    await c.from("fait_extrait").delete().eq("cle_dedoublonnage", cle);
    await c.auth.signOut();
    const { data: apres } = await admin.from("fait_extrait").select("id").eq("cle_dedoublonnage", cle);
    expect(apres?.length).toBe(1); // toujours là (pas de policy delete sous JWT)
    // service_role = siège de l'effacement FR-067 (Epic 6).
    const { error } = await admin.from("fait_extrait").delete().eq("cle_dedoublonnage", cle);
    expect(error).toBeNull();
    const { data: fin } = await admin.from("fait_extrait").select("id").eq("cle_dedoublonnage", cle);
    expect(fin?.length).toBe(0);
  });
});

describe("fait_extrait — merge bout-en-bout via fusionner_fait_extrait (T4 : AC2 idempotence, AC3 anti-résurrection)", () => {
  const u = { email: `fe-merge-${t}@exemple.fr`, id: "" };
  const cle = `merge-${t}`;

  const compter = async () => (await admin.from("fait_extrait").select("id").eq("utilisatrice_id", u.id)).data?.length ?? -1;
  const lire = async () => (await admin.from("fait_extrait").select("origine, statut, contenu").eq("cle_dedoublonnage", cle).single()).data!;

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("fait_extrait").delete().eq("utilisatrice_id", u.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("scénario complet : extraire → ré-extraire (idempotent) → corriger → ré-extraire (no-op) → supprimer → ré-extraire (no-op)", async () => {
    const source = await graverSource(u.id);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);

    // 1) Extraction auto → une ligne active.
    expect((await c.rpc("fusionner_fait_extrait", { p_origine: "extrait", p_statut: "actif", p_cle: cle, p_contenu: "aime la forêt", p_extrait_source: source })).error).toBeNull();
    expect(await compter()).toBe(1);
    expect((await lire()).statut).toBe("actif");

    // 2) Ré-extraction (même clé, contenu affiné) → TOUJOURS une ligne (AC2), contenu rafraîchi (fait auto actif).
    expect((await c.rpc("fusionner_fait_extrait", { p_origine: "extrait", p_statut: "actif", p_cle: cle, p_contenu: "aime marcher en forêt", p_extrait_source: source })).error).toBeNull();
    expect(await compter()).toBe(1); // aucun doublon
    expect((await lire()).contenu).toBe("aime marcher en forêt");

    // 3) L'utilisatrice CORRIGE → sa version prime, origine=utilisatrice.
    expect((await c.rpc("fusionner_fait_extrait", { p_origine: "utilisatrice", p_statut: "corrige", p_cle: cle, p_contenu: "aime la montagne, pas la forêt", p_extrait_source: null })).error).toBeNull();
    expect(await lire()).toMatchObject({ origine: "utilisatrice", statut: "corrige", contenu: "aime la montagne, pas la forêt" });

    // 4) [DUR] Ré-extraction après correction → NO-OP SILENCIEUX (pas d'erreur, pas d'écrasement).
    const reExtr = await c.rpc("fusionner_fait_extrait", { p_origine: "extrait", p_statut: "actif", p_cle: cle, p_contenu: "aime la forêt (auto)", p_extrait_source: source });
    expect(reExtr.error).toBeNull(); // chemin normal = no-op, PAS l'erreur du trigger
    expect((await lire()).contenu).toBe("aime la montagne, pas la forêt"); // la correction TIENT

    // 5) L'utilisatrice SUPPRIME (soft) → tombstone, contenu vidé.
    expect((await c.rpc("fusionner_fait_extrait", { p_origine: "utilisatrice", p_statut: "supprime", p_cle: cle, p_contenu: "", p_extrait_source: null })).error).toBeNull();
    expect(await lire()).toMatchObject({ statut: "supprime", contenu: "" });

    // 6) [DUR] Ré-extraction après suppression → NO-OP : le fait n'est PAS recréé (une seule ligne, tombstone intact).
    const reExtr2 = await c.rpc("fusionner_fait_extrait", { p_origine: "extrait", p_statut: "actif", p_cle: cle, p_contenu: "revenu de nulle part", p_extrait_source: source });
    expect(reExtr2.error).toBeNull();
    expect(await compter()).toBe(1); // toujours UNE ligne (le tombstone), pas de résurrection
    const fin = await lire();
    expect(fin.statut).toBe("supprime");
    expect(fin.contenu).toBe(""); // le contenu art. 9 ne revient PAS non plus (sans le WHERE, il serait ré-écrit)

    await c.auth.signOut();
  });

  it("[revue B] une ré-extraction avec une NOUVELLE source rafraîchit extrait_source_id (provenance = message courant, AC1)", async () => {
    const cleB = `srcref-${t}`;
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);
    const s1 = await graverSource(u.id, "tour 1 : aime la forêt");
    const s2 = await graverSource(u.id, "tour 2 : aime marcher en forêt le dimanche");
    await c.rpc("fusionner_fait_extrait", { p_origine: "extrait", p_statut: "actif", p_cle: cleB, p_contenu: "v1", p_extrait_source: s1 });
    await c.rpc("fusionner_fait_extrait", { p_origine: "extrait", p_statut: "actif", p_cle: cleB, p_contenu: "v2", p_extrait_source: s2 });
    const { data } = await admin.from("fait_extrait").select("contenu, extrait_source_id").eq("cle_dedoublonnage", cleB).single();
    expect(data!.contenu).toBe("v2");
    expect(data!.extrait_source_id).toBe(s2); // la source SUIT le contenu, jamais figée sur s1
    await c.auth.signOut();
  });
});

describe("fait_extrait — isolation inter-tenant de la source (revue D)", () => {
  const uA = { email: `fe-da-${t}@exemple.fr`, id: "" };
  const uB = { email: `fe-db-${t}@exemple.fr`, id: "" };
  let sourceDeB = "";

  beforeAll(async () => {
    uA.id = await creerUtilisatrice(uA.email);
    uB.id = await creerUtilisatrice(uB.email);
    // Une entrée de journal appartenant à B.
    const { data } = await admin.from("entree_journal").insert({ utilisatrice_id: uB.id, cle_tour: `srcB-${t}`, contenu: "le journal privé de B" }).select("id").single();
    sourceDeB = data!.id as string;
  });
  afterAll(async () => {
    await admin.from("fait_extrait").delete().eq("utilisatrice_id", uA.id);
    await admin.from("entree_journal").delete().eq("utilisatrice_id", uB.id);
    if (uA.id) await admin.auth.admin.deleteUser(uA.id);
    if (uB.id) await admin.auth.admin.deleteUser(uB.id);
  });

  it("A ne peut pas ancrer un fait sur le journal de B (extrait_source d'autrui → REFUSÉ)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: uA.email, password: MDP });
    await donnerConsentement(c, uA.id);
    const { error } = await c.rpc("fusionner_fait_extrait", { p_origine: "extrait", p_statut: "actif", p_cle: `xtenant-${t}`, p_contenu: "un fait de A", p_extrait_source: sourceDeB });
    expect(error).not.toBeNull(); // la garde d'appartenance lève (ni oracle d'UUID, ni provenance inter-tenant)
    const { data } = await admin.from("fait_extrait").select("id").eq("utilisatrice_id", uA.id);
    expect((data ?? []).length).toBe(0); // rien écrit
    await c.auth.signOut();
  });
});
