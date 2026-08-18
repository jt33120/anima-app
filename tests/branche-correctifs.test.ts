import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { declarerMajorite } from "./_semis";

/**
 * Story 4.6 — CORRECTIFS DE LA REVUE ADVERSARIALE (migration 0023). Preuves bloquantes contre un vrai
 * Supabase local. Le cœur : la LEÇON R1 était appliquée à MOITIÉ — le trigger d'immuabilité de 0022 était
 * `BEFORE UPDATE` seulement, alors qu'`authenticated` a le grant table-level INSERT autant qu'UPDATE. Un
 * `.from("branche").insert({etat:'fruit', intensite:1, date_naissance:'1999'})` DIRECT passait (reproduit
 * en live par la revue : 201 Created), forgeant un « rayonnement » jamais déclaré, de façon irréversible.
 *
 * On prouve ici, EN INSERT DIRECT (pas via la RPC) :
 *  - [HAUTE] etat/intensite forgés à l'insertion → REFUSÉS (policy WITH CHECK + trigger, double défense) ;
 *  - les horodatages sont AUTORITAIRES en base sous JWT (date_naissance/cree_le antidatés → écrasés) ;
 *  - les 4 clauses du trigger UPDATE jamais éprouvées (extrait_source_id, utilisatrice_id, cree_le, id) ;
 *  - intensite hors bornes / NaN, nom trop long, nom SANS GLYPHE (U+200B, U+2800, U+3164, U+00AD) ;
 *  - `renommer_branche` ne réussit plus SILENCIEUSEMENT sur une branche non possédée ;
 *  - `charger_echange_source` : fenêtre bornée à ±2 h (jamais des tours d'une autre séance).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-correctifs-123!";

async function donnerConsentement(c: SupabaseClient, id: string) {
  const { error } = await c.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`consentement: ${error.message}`);
}
/**
 * Story 3.3 — TOUTE UTILISATRICE DE CE FICHIER EST ABONNÉE, et ce n'est pas une commodité.
 *
 * Depuis la migration 0037, `branche_insertion` porte `est_premium_courante()` : sans abonnement
 * actif, AUCUNE branche ne naît. Ce fichier n'éprouve pas le paywall (c'est
 * `tests/tronc-branche-sql.test.ts` qui s'en charge) — il éprouve le consentement art. 9, la barrière
 * minorité, la fenêtre de détresse (AD-17) et l'isolation.
 *
 * ⚠️ ET SURTOUT : sans cet abonnement, ses REFUS deviendraient ambigus. Un insert refusé pourrait
 * l'être à cause de la clause premium au lieu de la clause sous test, et chaque garde passerait pour
 * une raison qui n'est pas la sienne — le piège des défenses redondantes qui se couvrent l'une
 * l'autre. L'abonnement rétablit la précondition pour que chaque garde continue d'isoler CE qu'elle
 * prétend isoler.
 */
async function abonnerActive(id: string) {
  const { error } = await admin
    .from("abonnement")
    .upsert({ utilisatrice_id: id, etat: "actif", source_maj_le: new Date().toISOString() }, { onConflict: "utilisatrice_id" });
  if (error) throw new Error(`abonner: ${error.message}`);
}

async function creerUtilisatrice(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  await declarerMajorite(admin, data.user!.id);
  await abonnerActive(data.user!.id);
  return data.user!.id;
}
async function graverEntree(id: string, cleTour: string, contenu = "un tour", creeLe?: string): Promise<string> {
  const row: Record<string, unknown> = { utilisatrice_id: id, cle_tour: cleTour, role: "utilisatrice", contenu };
  if (creeLe) row.cree_le = creeLe;
  const { data, error } = await admin.from("entree_journal").insert(row).select("id").single();
  if (error) throw new Error(`graverEntree: ${error.message}`);
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

describe("[HAUTE / R1] INSERT DIRECT : l'état d'une branche ne peut pas être FORGÉ à la naissance", () => {
  const u = { email: `corr-insert-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("etat='fruit' à l'INSERT direct → REFUSÉ (mutation-cible : `and etat = 'naissance'` de la policy + clause TG_OP INSERT du trigger)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const e = await graverEntree(u.id, `corr-fruit-${t}`);
    const { error } = await c
      .from("branche")
      .insert({ utilisatrice_id: u.id, extrait_source_id: e, nom: "branche forgée en rayonnement", etat: "fruit" });
    expect(error, "forger un rayonnement à la naissance pré-empte la Story 4.7").not.toBeNull();
    await c.auth.signOut();
  });

  it("intensite=1 à l'INSERT direct → REFUSÉ (la feuillaison est la Story 4.7)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const e = await graverEntree(u.id, `corr-int-${t}`);
    const { error } = await c
      .from("branche")
      .insert({ utilisatrice_id: u.id, extrait_source_id: e, nom: "feuillue d'office", intensite: 1 });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });

  it("date_naissance/cree_le antidatés à l'INSERT direct → ÉCRASÉS par l'horodatage autoritaire (l'ordre de l'arbre n'est pas manipulable)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const e = await graverEntree(u.id, `corr-date-${t}`);
    const { data, error } = await c
      .from("branche")
      .insert({
        utilisatrice_id: u.id,
        extrait_source_id: e,
        nom: "antidatée",
        date_naissance: "1999-01-01T00:00:00Z",
        cree_le: "1999-01-01T00:00:00Z",
      })
      .select("date_naissance, cree_le")
      .single();
    expect(error).toBeNull();
    expect(new Date(data!.date_naissance as string).getUTCFullYear(), "la date de naissance est celle de la base").toBeGreaterThan(2020);
    expect(new Date(data!.cree_le as string).getUTCFullYear()).toBeGreaterThan(2020);
    await c.auth.signOut();
  });

  it("la naissance NORMALE passe toujours (contrôle positif : la garde ne bloque pas le chemin légitime)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const e = await graverEntree(u.id, `corr-ok-${t}`);
    const { error } = await c.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: e, nom: "un vrai nom" });
    expect(error).toBeNull();
    await c.auth.signOut();
  });
});

describe("[AC7] Les 4 clauses du trigger UPDATE jamais éprouvées", () => {
  const u = { email: `corr-trig-${t}@exemple.fr`, id: "", entree: "", branche: "" };
  const autre = { email: `corr-trig-autre-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    autre.id = await creerUtilisatrice(autre.email);
    u.entree = await graverEntree(u.id, `corr-trig-${t}`);
    const { data } = await admin
      .from("branche")
      .insert({ utilisatrice_id: u.id, extrait_source_id: u.entree, nom: "nom d'origine" })
      .select("id")
      .single();
    u.branche = data!.id as string;
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(autre.id);
  });

  it("repointer extrait_source_id vers une AUTRE entrée possédée → REJETÉ (FR-027 : le lien est figé)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const ailleurs = await graverEntree(u.id, `corr-trig-repoint-${t}`, "un moment sans rapport");
    const { error } = await c.from("branche").update({ nom: "x", extrait_source_id: ailleurs }).eq("id", u.branche);
    expect(error, "la branche ne peut pas changer de moment d'origine").not.toBeNull();
    await c.auth.signOut();
  });

  it("changer utilisatrice_id (donner sa branche à autrui) ou cree_le → REJETÉ", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const don = await c.from("branche").update({ nom: "x", utilisatrice_id: autre.id }).eq("id", u.branche);
    expect(don.error).not.toBeNull();
    const cree = await c.from("branche").update({ nom: "x", cree_le: "1999-01-01T00:00:00Z" }).eq("id", u.branche);
    expect(cree.error).not.toBeNull();
    await c.auth.signOut();
  });

  it("le nom, lui, reste modifiable (contrôle positif : le trigger ne fige pas TOUT)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.from("branche").update({ nom: "un nom neuf" }).eq("id", u.branche);
    expect(error).toBeNull();
    await c.auth.signOut();
  });
});

describe("Bornes de domaine : intensite, longueur du nom, caractères SANS GLYPHE", () => {
  const u = { email: `corr-bornes-${t}@exemple.fr`, id: "", entree: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.entree = await graverEntree(u.id, `corr-bornes-${t}`);
  });
  afterAll(async () => purger(u.id));

  it("intensite hors [0,1] ou NaN → REFUSÉ même en service_role (le rendu ne peut plus exploser)", async () => {
    for (const intensite of [1.5, -0.1, "NaN"]) {
      const e = await graverEntree(u.id, `corr-int-${intensite}-${t}`);
      const { error } = await admin
        .from("branche")
        .insert({ utilisatrice_id: u.id, extrait_source_id: e, nom: "x", intensite });
      expect(error, `intensite=${intensite} doit être refusée`).not.toBeNull();
    }
  });

  it("un nom de plus de 300 caractères → REFUSÉ (art. 9 : pas de dépôt illimité)", async () => {
    const { error } = await admin
      .from("branche")
      .insert({ utilisatrice_id: u.id, extrait_source_id: u.entree, nom: "a".repeat(301) });
    expect(error).not.toBeNull();
  });

  it("[AC2 DUR] un nom fait de caractères SANS GLYPHE → REFUSÉ (U+200B, U+2800, U+3164, U+00AD)", async () => {
    const invisibles: [string, string][] = [
      ["​", "zero-width space"],
      ["⠀", "braille blank"],
      ["ㅤ", "hangul filler"],
      ["­", "soft hyphen"],
      ["​⠀­", "mélange d'invisibles"],
    ];
    for (const [nom, quoi] of invisibles) {
      const e = await graverEntree(u.id, `corr-inv-${quoi.replace(/\W/g, "")}-${t}`);
      const { error } = await admin.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: e, nom });
      expect(error, `un nom fait de « ${quoi} » n'est pas un nom`).not.toBeNull();
    }
    // Contrôle positif : un vrai nom (accents, CJK, emoji) passe toujours.
    for (const nom of ["mes propres mots", "日本", "❤ ça"]) {
      const e = await graverEntree(u.id, `corr-vrai-${encodeURIComponent(nom)}-${t}`);
      const { error } = await admin.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: e, nom });
      expect(error, `« ${nom} » est un nom valide`).toBeNull();
    }
  });
});

describe("renommer_branche : plus de succès SILENCIEUX sur une branche non possédée", () => {
  const u = { email: `corr-ren-${t}@exemple.fr`, id: "" };
  const victime = { email: `corr-ren-victime-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    victime.id = await creerUtilisatrice(victime.email);
    const e = await graverEntree(victime.id, `corr-ren-v-${t}`);
    const { data } = await admin
      .from("branche")
      .insert({ utilisatrice_id: victime.id, extrait_source_id: e, nom: "le nom de la victime" })
      .select("id")
      .single();
    victime.branche = data!.id as string;
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(victime.id);
  });

  it("renommer la branche d'autrui LÈVE désormais (l'UI ne peut plus afficher un renommage fantôme)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.rpc("renommer_branche", { p_branche_id: victime.branche, p_nouveau_nom: "volé" });
    expect(error, "une branche non possédée doit lever, pas réussir en silence").not.toBeNull();
    const { data } = await admin.from("branche").select("nom").eq("id", victime.branche).single();
    expect(data!.nom).toBe("le nom de la victime");
    await c.auth.signOut();
  });

  it("renommer une branche INEXISTANTE lève aussi", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.rpc("renommer_branche", {
      p_branche_id: "00000000-0000-0000-0000-000000000000",
      p_nouveau_nom: "fantôme",
    });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });
});

describe("charger_echange_source : le voisinage est BORNÉ (jamais des tours d'une autre séance)", () => {
  const u = { email: `corr-ech-${t}@exemple.fr`, id: "", cible: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    // Une séance d'il y a 3 MOIS, puis la séance du jour autour de la cible.
    await graverEntree(u.id, `corr-vieux-${t}`, "un tour d'il y a trois mois", "2026-01-05T10:00:00Z");
    await graverEntree(u.id, `corr-avant-${t}`, "juste avant", "2026-04-05T10:00:00Z");
    u.cible = await graverEntree(u.id, `corr-cible-${t}`, "LE MESSAGE EXACT", "2026-04-05T10:01:00Z");
    await graverEntree(u.id, `corr-apres-${t}`, "juste après", "2026-04-05T10:02:00Z");
  });
  afterAll(async () => purger(u.id));

  it("le voisinage ne recolle PAS un tour d'une séance vieille de trois mois", async () => {
    const c = await session(u.email);
    const { data, error } = await c.rpc("charger_echange_source", { p_extrait_source_id: u.cible });
    expect(error).toBeNull();
    const contenus = (data ?? []).map((r: { contenu: string }) => r.contenu);
    expect(contenus).toContain("LE MESSAGE EXACT");
    expect(contenus).toContain("juste avant");
    expect(contenus).toContain("juste après");
    expect(contenus, "un tour d'il y a trois mois n'est pas le voisinage de ce moment").not.toContain(
      "un tour d'il y a trois mois",
    );
    await c.auth.signOut();
  });

  it("un message au MÊME instant que la cible n'est pas perdu (ex æquo sur cree_le, ordre total)", async () => {
    const jumeau = await graverEntree(u.id, `corr-jumeau-${t}`, "au même instant", "2026-04-05T10:01:00Z");
    const c = await session(u.email);
    const { data } = await c.rpc("charger_echange_source", { p_extrait_source_id: u.cible });
    const contenus = (data ?? []).map((r: { contenu: string }) => r.contenu);
    expect(contenus).toContain("au même instant");
    // la cible reste unique et correctement marquée
    expect((data ?? []).filter((r: { est_cible: boolean }) => r.est_cible)).toHaveLength(1);
    await c.auth.signOut();
    expect(jumeau).toBeTruthy();
  });
});

/**
 * RE-REVUE — LES GARDES QUI SURVIVAIENT À LEUR PROPRE MUTATION.
 *
 * La re-revue a démontré que le correctif PHARE de 0023 (la garde d'état à l'INSERT, leçon R1-ter) pouvait
 * être RETIRÉE sans qu'un seul des 1300 tests vire au rouge. La cause est subtile et vaut d'être écrite :
 * les tests d'insertion existants passent par une session JWT, où la POLICY et le TRIGGER bloquent tous
 * les deux. En muter UN laisse l'autre refuser → le test reste vert. Ils prouvaient donc « au moins une des
 * deux moitiés existe », jamais l'une NI l'autre.
 *
 * Ce bloc isole chaque moitié :
 *  • le TRIGGER est la SEULE défense sur le chemin `service_role` (la RLS ne s'y applique pas) — donc un
 *    insert service_role forgé le teste SEUL, et le tue quand on le retire ;
 *  • la clause d'état de la POLICY, elle, est redondante avec le trigger sous JWT : aucun comportement ne
 *    peut l'isoler. On la garde donc par LECTURE DU SCHÉMA — une garde structurelle, annoncée comme telle,
 *    plutôt qu'un test de comportement qui mentirait sur ce qu'il prouve.
 */
describe("[RE-REVUE] chaque moitié de la double défense est gardée SÉPARÉMENT", () => {
  const u = { email: `corr-mutant-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("[HAUTE / R1-ter] etat/intensite forgés en SERVICE_ROLE → refusés par le TRIGGER SEUL", async () => {
    // Ni le CHECK d'etat de 0021 (il accepte 'fruit') ni `branche_intensite_bornee` (il accepte 1) ne
    // rattrapent ces valeurs, et la RLS ne borne pas service_role : SEUL le trigger peut refuser ici.
    // Mutation-cible : le `raise` de la branche `TG_OP = 'INSERT'` (0023:24-25).
    for (const forge of [{ etat: "fruit" }, { intensite: 1 }, { etat: "feuillaison", intensite: 0.5 }]) {
      const e = await graverEntree(u.id, `corr-sr-${JSON.stringify(forge).replace(/\W/g, "")}-${t}`);
      const { error } = await admin
        .from("branche")
        .insert({ utilisatrice_id: u.id, extrait_source_id: e, nom: "forge service_role", ...forge });
      expect(error, `forger ${JSON.stringify(forge)} en service_role doit être refusé`).not.toBeNull();
    }
    // Contrôle positif : la naissance légitime en service_role passe toujours (l'écrivain d'Epic 6 vivra).
    const e = await graverEntree(u.id, `corr-sr-ok-${t}`);
    const { error } = await admin
      .from("branche")
      .insert({ utilisatrice_id: u.id, extrait_source_id: e, nom: "naissance légitime" });
    expect(error, "la naissance normale en service_role ne doit pas être bloquée").toBeNull();
  });

  it("[structurel] la POLICY d'insertion épingle elle aussi l'état (défense en profondeur, R1)", () => {
    // Garde de SOURCE, assumée comme telle : la migration EST la définition déployée (`db reset` la rejoue,
    // la CI part d'une base neuve). Aucun comportement ne peut isoler cette clause du trigger sous JWT ;
    // plutôt qu'un test de comportement qui prétendrait la prouver, on verrouille le texte de la migration.
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0023_branche_arbre_correctifs.sql"), "utf-8");
    const policy = sql.slice(sql.indexOf("create policy branche_insertion"));
    const corps = policy.slice(0, policy.indexOf(";"));
    expect(corps, "la policy d'insertion ne pince plus l'état").toMatch(/etat\s*=\s*'naissance'/);
    expect(corps, "la policy d'insertion ne pince plus l'intensité").toMatch(/intensite\s*=\s*0/);
    expect(corps, "le write-gate art. 9 a disparu de la policy d'insertion").toMatch(/a_consenti_art9\(\)/);
  });

  it("[HAUTE / re-revue] l'ORDRE de `charger_branches_arbre` est TOTAL — le placement de l'arbre ne vacille pas", async () => {
    // Le correctif (8) de 0023 survivait à sa suppression complète : aucun test ne l'exerçait. Ici on force
    // le cas où l'ordre du tas CONTREDIT l'ordre voulu — deux branches nées au MÊME instant, insérées dans
    // l'ordre d'id DÉCROISSANT. Sans `order by (date_naissance, id)`, la lecture rend l'ordre d'insertion ;
    // avec, elle rend l'ordre d'id croissant. Et comme la position d'une branche vient de son RANG
    // (render/arbre/geometrie.ts), un ordre instable ferait littéralement sauter l'arbre d'un rendu à l'autre.
    const MEME_INSTANT = "2026-05-01T12:00:00Z";
    const HAUT = "ffffffff-1111-4111-8111-111111111111";
    const BAS = "00000000-1111-4111-8111-111111111111";
    for (const id of [HAUT, BAS]) {
      const e = await graverEntree(u.id, `corr-ordre-${id.slice(0, 8)}-${t}`);
      const { error } = await admin.from("branche").insert({
        id,
        utilisatrice_id: u.id,
        extrait_source_id: e,
        nom: `ordre ${id.slice(0, 4)}`,
        date_naissance: MEME_INSTANT,
      });
      expect(error, `insertion de la branche ${id.slice(0, 8)}`).toBeNull();
    }

    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { data, error } = await c.rpc("charger_branches_arbre");
    expect(error).toBeNull();
    const rangs = (data ?? [])
      .map((b: { branche_id: string }) => b.branche_id)
      .filter((id: string) => id === HAUT || id === BAS);
    expect(rangs, "les deux branches ex æquo doivent être servies").toHaveLength(2);
    expect(rangs[0], "à date égale, l'ordre doit être TOTAL (par id croissant), pas l'ordre du tas").toBe(BAS);
    await c.auth.signOut();
  });
});
