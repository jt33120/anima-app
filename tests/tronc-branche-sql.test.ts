import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { declarerMajorite } from "./_semis";

/**
 * Story 3.3 (T2) — « LES BRANCHES SONT PREMIUM » (FR-088/AC3 [DUR]), prouvé contre un vrai Supabase local
 * ET contre le TEXTE des migrations.
 *
 * Deux garanties distinctes vivent ici, et il faut les deux :
 *
 *  (1) LA GARDE EXISTE ET MORD — éprouvée par le chemin qu'un appelant malveillant emprunterait :
 *      `.from("branche").insert()` DIRECT sous JWT, jamais la RPC. Tester le premium via
 *      `creer_branche_depuis_signal` ne prouverait RIEN : `authenticated` détient le grant INSERT
 *      table-level, donc une garde qui ne vivrait que dans la RPC serait décorative (leçon R1).
 *
 *  (2) AUCUNE CLAUSE N'A ÉTÉ PERDUE EN CHEMIN — éprouvée sur le texte SQL. C'est la faute exacte de la
 *      4.10 : `reserver_notification`, réécrite depuis sa version 0030, avait effacé EN SILENCE la garde
 *      de désabonnement ajoutée par 0034. Rien ne le disait ; seul un test de comportement l'a rattrapée,
 *      et par chance. Ici, la conservation des clauses est ASSERTÉE, pas espérée.
 *
 * CONTRÔLES POSITIFS PARTOUT. Une policy qui refuserait TOUT satisferait la moitié de ce fichier, et un
 * refus muet est tout aussi cassé qu'une porte ouverte — simplement plus discret.
 */

const racine = process.cwd();
const MIGRATIONS = resolve(racine, "supabase/migrations");

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// (1) LE TEXTE DES POLICIES — un analyseur, et la preuve que l'analyseur n'est pas complaisant
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** Les migrations dans l'ORDRE de leur numéro (c'est l'ordre d'application, donc l'ordre des amendements). */
function migrationsOrdonnees(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Retire les commentaires `-- …` sans toucher au contenu des littéraux (`'naissance'` n'en contient pas). */
function sansCommentairesSql(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

/**
 * Le corps parenthésé qui suit `with check` à partir de `depuis`, parenthèses ÉQUILIBRÉES.
 *
 * ⚠️ Ne PAS découper sur la première `)` : la dernière clause de `branche_insertion` est un `exists (…)`
 * imbriqué sur deux niveaux. C'est le piège `corpsDuType` de la revue 4.10, transposé au SQL — un
 * découpage naïf renvoie un fragment, et chercher une clause dans un fragment échoue silencieusement
 * dans le bon sens.
 */
function corpsParenthese(sql: string, depuis: number): string | null {
  const debut = sql.indexOf("(", depuis);
  if (debut < 0) return null;
  let profondeur = 0;
  for (let i = debut; i < sql.length; i++) {
    if (sql[i] === "(") profondeur++;
    else if (sql[i] === ")") {
      profondeur--;
      if (profondeur === 0) return sql.slice(debut + 1, i);
    }
  }
  return null; // parenthèses non refermées → on rend `null` plutôt qu'un fragment
}

/** Découpe sur les `and` de PROFONDEUR ZÉRO seulement (ceux d'un `exists (… and …)` n'en sont pas). */
function clausesDe(corps: string): string[] {
  const clauses: string[] = [];
  let profondeur = 0;
  let debut = 0;
  for (let i = 0; i < corps.length; i++) {
    const c = corps[i];
    if (c === "(") profondeur++;
    else if (c === ")") profondeur--;
    else if (profondeur === 0 && /\s/.test(c) && /^\s+and\s/i.test(corps.slice(i))) {
      clauses.push(corps.slice(debut, i));
      const suite = corps.slice(i).match(/^\s+and\s/i)!;
      i += suite[0].length - 1;
      debut = i + 1;
    }
  }
  clauses.push(corps.slice(debut));
  return clauses.map((c) => c.replace(/\s+/g, " ").trim()).filter((c) => c.length > 0);
}

/** Le `with check` de la DERNIÈRE définition de `nom` dans l'historique des migrations, découpé en clauses. */
function clausesDerniereDefinition(nom: string): { fichier: string; clauses: string[] } | null {
  let trouve: { fichier: string; clauses: string[] } | null = null;
  for (const f of migrationsOrdonnees()) {
    const sql = sansCommentairesSql(readFileSync(resolve(MIGRATIONS, f), "utf-8"));
    const re = new RegExp(`create\\s+policy\\s+${nom}\\s+on\\s`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const iCheck = sql.toLowerCase().indexOf("with check", m.index);
      if (iCheck < 0) continue;
      const corps = corpsParenthese(sql, iCheck);
      if (corps) trouve = { fichier: f, clauses: clausesDe(corps) };
    }
  }
  return trouve;
}

/** Toutes les définitions ANTÉRIEURES à `fichierFinal` (l'historique des amendements à ne pas perdre). */
function clausesHistoriques(nom: string, fichierFinal: string): { fichier: string; clauses: string[] }[] {
  const out: { fichier: string; clauses: string[] }[] = [];
  for (const f of migrationsOrdonnees()) {
    if (f >= fichierFinal) break;
    const sql = sansCommentairesSql(readFileSync(resolve(MIGRATIONS, f), "utf-8"));
    const re = new RegExp(`create\\s+policy\\s+${nom}\\s+on\\s`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const iCheck = sql.toLowerCase().indexOf("with check", m.index);
      if (iCheck < 0) continue;
      const corps = corpsParenthese(sql, iCheck);
      if (corps) out.push({ fichier: f, clauses: clausesDe(corps) });
    }
  }
  return out;
}

describe("[T2-1] L'ANALYSEUR de policy — non-tautologique, prouvé sur des cas connus", () => {
  it("il découpe sur les `and` de tête et JAMAIS sur ceux d'un sous-`exists`", () => {
    // Sans cette preuve, tout ce fichier reposerait sur un analyseur qu'aucun test ne regarde — et un
    // analyseur qui rend `[]` fait passer au vert toute assertion de la forme « aucune clause perdue ».
    const corps = "a = b and f(x) and exists (select 1 from t where t.i = j and t.u = (select auth.uid()))";
    expect(clausesDe(corps)).toEqual([
      "a = b",
      "f(x)",
      "exists (select 1 from t where t.i = j and t.u = (select auth.uid()))",
    ]);
  });

  it("il rend `null` plutôt qu'un FRAGMENT quand les parenthèses ne se referment pas", () => {
    // Le piège de la 4.10 : un extrait tronqué ne fait rougir personne, il fait juste échouer la
    // recherche — c'est-à-dire réussir l'assertion d'absence.
    expect(corpsParenthese("with check (a and (b", 0)).toBeNull();
    expect(corpsParenthese("with check (a and (b))", 0)).toBe("a and (b)");
  });

  it("il ignore les clauses mises en COMMENTAIRE (sinon 0037 se prouverait lui-même par sa doc)", () => {
    expect(clausesDe(sansCommentairesSql("a = b -- and f(x)\n and g(y)"))).toEqual(["a = b", "g(y)"]);
  });
});

describe("[T2-1 / AC3] `branche_insertion` : la clause premium est là, et RIEN n'a été perdu", () => {
  const finale = clausesDerniereDefinition("branche_insertion");

  it("[NON-VACUITÉ] la policy est trouvée, dans 0037, avec un corps non vide", () => {
    // Assertion de PRÉSENCE avant toute assertion de conservation : sans elle, un analyseur qui ne
    // trouverait rien rendrait `[]` et « aucune clause perdue » serait vrai par vacuité.
    expect(finale, "aucune définition de `branche_insertion` trouvée dans les migrations").not.toBeNull();
    expect(finale!.fichier).toBe("0037_branche_naissance_premium.sql");
    expect(finale!.clauses.length, "corps vide — l'analyseur regarde au mauvais endroit").toBeGreaterThan(5);
  });

  it("[LE CŒUR / AC3] elle porte `est_premium_courante()`", () => {
    // Mutation-cible : retirer la clause de 0037. C'est TOUT le sujet de la story.
    expect(finale!.clauses).toContain("public.est_premium_courante()");
  });

  it("[LE CŒUR] toutes les clauses des définitions ANTÉRIEURES survivent, une par une", () => {
    // ⚠️ C'EST LA GARDE QUI MANQUAIT EN 4.10. `reserver_notification` avait été réécrite depuis 0030 en
    // perdant la garde de désabonnement de 0034 — silencieusement. Ici, chaque clause de 0021 et de 0023
    // est nommée dans le message d'échec : une réécriture qui en perd une dit LAQUELLE.
    const anterieures = clausesHistoriques("branche_insertion", finale!.fichier);
    expect(anterieures.length, "aucun historique — la garde de conservation serait vide").toBeGreaterThan(1);
    for (const def of anterieures) {
      for (const clause of def.clauses) {
        expect(finale!.clauses, `clause perdue depuis ${def.fichier} : « ${clause} »`).toContain(clause);
      }
    }
  });

  it("et RIEN d'autre n'a été ajouté en douce : la seule nouveauté est le premium", () => {
    // L'autre sens de la même garde. Une clause ajoutée sans être décidée est aussi grave qu'une clause
    // perdue — c'est comme ça qu'un paywall se met à garder autre chose que ce qu'on croit.
    const anterieures = clausesHistoriques("branche_insertion", finale!.fichier).flatMap((d) => d.clauses);
    const nouvelles = finale!.clauses.filter((c) => !anterieures.includes(c));
    expect(nouvelles).toEqual(["public.est_premium_courante()"]);
  });
});

describe("[T2-3 / D1-A] `branche_maj` NE reçoit PAS la clause premium — c'est le contrat", () => {
  const maj = clausesDerniereDefinition("branche_maj");

  it("[NON-VACUITÉ] la policy UPDATE est trouvée et porte bien ses clauses connues", () => {
    // ⚠️ LA CONDITION DE VALIDITÉ de l'assertion d'absence qui suit. Chercher un mot absent dans un
    // extrait vide réussit TOUJOURS (revue 4.10, deux fois sur le même test). On prouve d'abord que
    // l'extrait examiné est le bon, par une clause qu'on sait y être.
    expect(maj, "aucune définition de `branche_maj` — l'assertion d'absence serait vide de sens").not.toBeNull();
    expect(maj!.clauses).toContain("public.branche_nom_significatif(nom)");
    expect(maj!.clauses).toContain("public.a_consenti_art9()");
  });

  it("[LE CŒUR] aucune clause premium : renommer, feuiller et déclarer la pleine lumière restent ouverts", () => {
    // `branche_maj` (0025) est l'UNIQUE policy UPDATE de `branche` et couvre les TROIS gestes. Y poser le
    // premium empêcherait quelqu'un dont l'abonnement s'est éteint de corriger le nom d'une branche
    // qu'elle a nommée elle-même, et de dire « c'est devenu vrai en moi » (FR-028).
    // Mutation-cible : ajouter `est_premium_courante()` à `branche_maj` → ce test doit rougir.
    for (const c of maj!.clauses) {
      expect(c, `clause premium sur la policy UPDATE : « ${c} » (rouvrir D1 avec le PO)`).not.toMatch(
        /est_premium_courante/,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// (2) LE COMPORTEMENT RÉEL — contre un Supabase local
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-tronc-123!";

async function creerUtilisatrice(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  await declarerMajorite(admin, data.user!.id);
  return data.user!.id;
}

async function session(email: string): Promise<SupabaseClient> {
  const c = clientScope();
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

async function consentir(id: string) {
  const { error } = await admin
    .from("consentement")
    .upsert(
      { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
      { onConflict: "utilisatrice_id" },
    );
  if (error) throw new Error(`consentir: ${error.message}`);
}

/** `etat = null` → AUCUNE ligne d'abonnement : le compte gratuit tel qu'il existe vraiment. */
async function abonner(id: string, etat: string | null) {
  if (etat === null) {
    await admin.from("abonnement").delete().eq("utilisatrice_id", id);
    return;
  }
  const { error } = await admin
    .from("abonnement")
    .upsert({ utilisatrice_id: id, etat, source_maj_le: new Date().toISOString() }, { onConflict: "utilisatrice_id" });
  if (error) throw new Error(`abonner: ${error.message}`);
}

async function graverEntree(id: string, cle: string): Promise<string> {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: cle, role: "utilisatrice", contenu: "un tour" })
    .select("id")
    .single();
  if (error) throw new Error(`graverEntree: ${error.message}`);
  return data!.id as string;
}

async function poserSignal(id: string, entreeId: string): Promise<string> {
  const { data, error } = await admin
    .from("signal_reconceptualisation")
    .insert({ utilisatrice_id: id, entree_journal_id: entreeId })
    .select("id")
    .single();
  if (error) throw new Error(`poserSignal: ${error.message}`);
  return data!.id as string;
}

async function purger(id: string) {
  if (!id) return;
  await admin.from("intention").delete().eq("utilisatrice_id", id);
  await admin.from("branche_retour").delete().eq("utilisatrice_id", id);
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", id);
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.from("abonnement").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

/** L'insert DIRECT — le chemin qui saute la RPC, celui où le WITH CHECK joue SEUL (leçon R1). */
async function naitreEnDirect(s: SupabaseClient, id: string, entreeId: string, nom: string) {
  return s.from("branche").insert({ utilisatrice_id: id, extrait_source_id: entreeId, nom });
}

describe("[AC3 DUR] la naissance d'une branche est gardée AU POINT D'ÉCRITURE, pas dans la RPC", () => {
  const gratuite = { email: `tronc-gratuit-${t}@exemple.fr`, id: "" };
  const premium = { email: `tronc-premium-${t}@exemple.fr`, id: "" };
  let sGratuite: SupabaseClient;
  let sPremium: SupabaseClient;

  beforeAll(async () => {
    gratuite.id = await creerUtilisatrice(gratuite.email);
    premium.id = await creerUtilisatrice(premium.email);
    await consentir(gratuite.id);
    await consentir(premium.id);
    await abonner(gratuite.id, null);
    await abonner(premium.id, "actif");
    sGratuite = await session(gratuite.email);
    sPremium = await session(premium.email);
  });
  afterAll(async () => {
    await purger(gratuite.id);
    await purger(premium.id);
  });

  it("[CONTRÔLE POSITIF] premium → l'insert direct RÉUSSIT", async () => {
    // Sans ce contrôle, une policy qui refuserait TOUT LE MONDE satisferait tous les tests ci-dessous.
    const e = await graverEntree(premium.id, `tronc-ok-${t}`);
    const { error } = await naitreEnDirect(sPremium, premium.id, e, "ma branche");
    expect(error, "un compte premium doit pouvoir faire naître une branche").toBeNull();
  });

  it("[LE CŒUR] gratuit → l'insert direct est REFUSÉ par la policy (42501), pas par la RPC", async () => {
    // Mutation-cible : retirer `est_premium_courante()` du WITH CHECK de 0037 → ce test rougit, et il est
    // le seul chemin où la garde joue vraiment : `authenticated` a le grant INSERT table-level, donc un
    // client qui appelle PostgREST directement ne voit jamais la RPC.
    const e = await graverEntree(gratuite.id, `tronc-ko-${t}`);
    const { error } = await naitreEnDirect(sGratuite, gratuite.id, e, "ma branche");
    expect(error, "un compte gratuit ne doit PAS pouvoir faire naître une branche").not.toBeNull();
    expect(error!.code, "le refus doit venir de la POLICY (RLS), pas d'un trigger").toBe("42501");
  });

  it("un abonnement ÉTEINT (`expire`) ne fait pas naître non plus — l'entitlement est `actif`, pas « a payé »", async () => {
    await abonner(gratuite.id, "expire");
    const e = await graverEntree(gratuite.id, `tronc-expire-${t}`);
    const { error } = await naitreEnDirect(sGratuite, gratuite.id, e, "ma branche");
    expect(error?.code).toBe("42501");
    await abonner(gratuite.id, null);
  });

  it("NFR-022 : le refus ne porte AUCUN contenu art. 9 (ni le nom, ni l'extrait)", async () => {
    const e = await graverEntree(gratuite.id, `tronc-art9-${t}`);
    const NOM_INTIME = "ce que je n ai jamais dit a personne";
    const { error } = await naitreEnDirect(sGratuite, gratuite.id, e, NOM_INTIME);
    const tout = JSON.stringify(error);
    expect(tout, "le nom art. 9 ne doit apparaître nulle part dans l'erreur").not.toContain(NOM_INTIME);
    expect(tout).not.toContain("un tour"); // le verbatim de l'extrait source
  });
});

describe("[T2-2] le fast-fail de la RPC : lisible, et il parle APRÈS la sécurité (AD-9)", () => {
  const u = { email: `tronc-rpc-${t}@exemple.fr`, id: "" };
  let s: SupabaseClient;

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id, null);
    s = await session(u.email);
  });
  afterAll(async () => purger(u.id));

  it("gratuit → la RPC refuse avec un message qui NOMME la raison (P0001)", async () => {
    const e = await graverEntree(u.id, `rpc-gratuit-${t}`);
    const sig = await poserSignal(u.id, e);
    const { error } = await s.rpc("creer_branche_depuis_signal", { p_signal_id: sig, p_nom: "essai" });
    expect(error, "le fast-fail doit refuser").not.toBeNull();
    expect(error!.code, "un `raise exception` plpgsql, pas un refus RLS opaque").toBe("P0001");
    expect(error!.message).toMatch(/abonnement actif/);
  });

  it("[LE CŒUR / AD-9] en DÉTRESSE, c'est la sécurité qui parle — jamais le commerce", async () => {
    // ⚠️ L'ORDRE DES DEUX GARDES EST LE TEST. Si le fast-fail premium passait AVANT celui de la détresse,
    // quelqu'un qui sort d'un épisode recevrait un refus qui parle d'abonnement — le commerce s'interposant
    // sur la sécurité, c'est-à-dire AD-9 violé, à l'endroit précis où ça fait le plus de mal.
    // Mutation-cible : intervertir les deux `if` dans 0037 → ce test rougit, et lui seul.
    await admin.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 2 });
    const e = await graverEntree(u.id, `rpc-detresse-${t}`);
    const sig = await poserSignal(u.id, e);
    const { error } = await s.rpc("creer_branche_depuis_signal", { p_signal_id: sig, p_nom: "essai" });
    expect(error!.message, "la détresse doit parler la première").toMatch(/détresse/);
    expect(error!.message, "et surtout PAS l'abonnement").not.toMatch(/abonnement/);
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
  });

  it("[CONTRÔLE POSITIF] premium → la RPC fait bien naître la branche et consomme le signal", async () => {
    await abonner(u.id, "actif");
    const e = await graverEntree(u.id, `rpc-premium-${t}`);
    const sig = await poserSignal(u.id, e);
    const { error } = await s.rpc("creer_branche_depuis_signal", { p_signal_id: sig, p_nom: "mes mots" });
    expect(error, "le chemin nominal doit rester intact").toBeNull();
    const { data } = await admin.from("signal_reconceptualisation").select("statut").eq("id", sig).single();
    expect(data!.statut).toBe("consomme");
    await abonner(u.id, null);
  });

  it("[T2-5] `anon` ne peut pas appeler la RPC (leçon 0007 : `revoke from public` ne retire pas `anon`)", async () => {
    const anon = clientScope();
    const { error } = await anon.rpc("creer_branche_depuis_signal", {
      p_signal_id: "00000000-0000-0000-0000-000000000000",
      p_nom: "x",
    });
    expect(error, "sans jeton, la RPC doit être hors de portée").not.toBeNull();
  });
});

describe("[D1-A / FR-029] l'abonnement s'éteint : ce qui est né reste À ELLE", () => {
  const u = { email: `tronc-eteint-${t}@exemple.fr`, id: "" };
  let s: SupabaseClient;
  let brancheId = "";

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id, "actif");
    s = await session(u.email);
    const e = await graverEntree(u.id, `eteint-${t}`);
    const { data, error } = await s
      .from("branche")
      .insert({ utilisatrice_id: u.id, extrait_source_id: e, nom: "ma branche à moi" })
      .select("id")
      .single();
    if (error) throw new Error(`naissance: ${error.message}`);
    brancheId = data!.id as string;
    // …et l'abonnement s'éteint.
    await abonner(u.id, "expire");
  });
  afterAll(async () => purger(u.id));

  it("elle LIT toujours sa branche (un paywall qui séquestre l'écrit n'est pas un paywall)", async () => {
    const { data, error } = await s.rpc("charger_branches_arbre");
    expect(error).toBeNull();
    expect((data as { branche_id: string }[]).map((b) => b.branche_id)).toContain(brancheId);
  });

  it("[LE CŒUR] elle peut encore la RENOMMER — `branche_maj` n'a pas de clause premium", async () => {
    // Mutation-cible : poser `est_premium_courante()` sur `branche_maj`. Le renommage d'un nom qu'elle a
    // écrit elle-même deviendrait payant, ce qui n'a jamais été le contrat (D1-A).
    const { error } = await s.rpc("renommer_branche", { p_branche_id: brancheId, p_nouveau_nom: "un autre nom" });
    expect(error, "corriger le nom de sa propre branche ne se facture pas").toBeNull();
  });

  it("elle peut encore déclarer la PLEINE LUMIÈRE (FR-028 : un geste de dignité, pas une fonctionnalité)", async () => {
    const { error } = await s.rpc("declarer_rayonnement", { p_branche_id: brancheId });
    expect(error, "« c'est devenu vrai en moi » ne se vend pas").toBeNull();
  });

  it("mais une NOUVELLE branche ne naît plus : le paywall porte sur ce qui s'AJOUTE", async () => {
    const e = await graverEntree(u.id, `eteint-2-${t}`);
    const { error } = await naitreEnDirect(s, u.id, e, "une branche de plus");
    expect(error?.code).toBe("42501");
  });
});
