import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.7 (T1) — LA GARANTIE D'ÉCRITURE du cycle de vie, prouvée contre un vrai Supabase local.
 *
 * 4.6 a livré un filet anti-régression AU RENDU (`reconcilierProjection`). Ici vit la vraie garantie :
 * `naissance → feuillaison → rayonnement` est strictement monotone, et **rien** ne peut faire reculer un
 * arbre (FR-029) — ni un client sous JWT, ni `service_role`, que la RLS ne borne pas.
 *
 * ⚠️ LE PIÈGE DE LA DÉFENSE EN PROFONDEUR (mémoire `gardes-doivent-tuer-leur-mutant`) : quand deux gardes
 * couvrent le même invariant, un test qui passe par le chemin où les DEUX s'appliquent ne peut isoler ni
 * l'une ni l'autre — muter l'une laisse l'autre refuser, le test reste vert. Chaque clause de monotonie est
 * donc éprouvée **en `service_role`**, le seul chemin où le trigger joue SEUL (la RLS ne s'y applique pas,
 * et aucun CHECK de colonne ne connaît l'état précédent).
 *
 * CE QUI EST GARANTI ICI, ET CE QUI NE L'EST PAS — à lire avant de « durcir » :
 *  • GARANTI : aucun écrivain, quel qu'il soit, ne peut faire RECULER `etat` ou `intensite`, ni réécrire une
 *    date de transition déjà posée. C'est FR-029, et c'est absolu.
 *  • GARANTI : aucun chemin AUTOMATIQUE (pipeline, modèle, tâche de fond) ne peut écrire `rayonnement` —
 *    `progresser_feuillaison` ne sait littéralement pas prononcer ce mot, et la garde d'architecture prouve
 *    que `declarer_rayonnement` n'a qu'un seul appelant, la route du geste (AC3, « jamais inféré »).
 *  • NON GARANTI, ASSUMÉ : l'utilisatrice qui ouvrirait sa console pourrait avancer son propre arbre par un
 *    UPDATE direct. C'est le même acte que d'appuyer sur le bouton — son arbre, son geste, aucune donnée
 *    d'autrui, aucun score à truquer. Verrouiller ça coûterait la TESTABILITÉ de la monotonie (plus aucun
 *    chemin ne pourrait tenter une régression, donc plus aucun test ne pourrait tuer son mutant) — un très
 *    mauvais échange.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-cycle-123!";

async function creerUtilisatrice(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}
async function donnerConsentement(c: SupabaseClient, id: string) {
  const { error } = await c.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`consentement: ${error.message}`);
}
async function graverEntree(id: string, cleTour: string, contenu = "un tour"): Promise<string> {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: cleTour, role: "utilisatrice", contenu })
    .select("id")
    .single();
  if (error) throw new Error(`graverEntree: ${error.message}`);
  return data!.id as string;
}
async function creerBranche(id: string, marqueur: string): Promise<string> {
  const e = await graverEntree(id, `cycle-${marqueur}-${t}`);
  const { data, error } = await admin
    .from("branche")
    .insert({ utilisatrice_id: id, extrait_source_id: e, nom: `branche ${marqueur}` })
    .select("id")
    .single();
  if (error) throw new Error(`creerBranche: ${error.message}`);
  return data!.id as string;
}
async function etatDe(brancheId: string) {
  const { data, error } = await admin
    .from("branche")
    .select("etat, intensite, date_feuillaison, date_rayonnement")
    .eq("id", brancheId)
    .single();
  if (error) throw new Error(`etatDe: ${error.message}`);
  return data as { etat: string; intensite: number; date_feuillaison: string | null; date_rayonnement: string | null };
}
async function session(email: string): Promise<SupabaseClient> {
  const c = clientScope();
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}
async function ouvrirEpisode(id: string) {
  const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: 2 });
  if (error) throw new Error(`ouvrirEpisode: ${error.message}`);
}
async function purger(id: string) {
  if (!id) return;
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}
/** Recule d'un jour tous les retours déjà consignés : le tour suivant compte alors comme un AUTRE jour. */
async function antidaterRetours(brancheId: string) {
  const { data } = await admin.from("branche_retour").select("entree_journal_id, jour_paris").eq("branche_id", brancheId);
  for (const r of data ?? []) {
    const j = new Date(`${(r as { jour_paris: string }).jour_paris}T00:00:00Z`);
    j.setUTCDate(j.getUTCDate() - 1);
    await admin
      .from("branche_retour")
      .update({ jour_paris: j.toISOString().slice(0, 10) })
      .eq("branche_id", brancheId)
      .eq("entree_journal_id", (r as { entree_journal_id: string }).entree_journal_id);
  }
}

const SQL_0025 = () => readFileSync(resolve(process.cwd(), "supabase/migrations/0025_branche_cycle_vie.sql"), "utf-8");

// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[D2] l'enum d'état parle la langue du produit : `rayonnement`, plus jamais `fruit`", () => {
  const u = { email: `cyc-enum-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "enum");
  });
  afterAll(async () => purger(u.id));

  it("`fruit` n'est plus une valeur d'état légale — même en service_role", async () => {
    const { error } = await admin.from("branche").update({ etat: "fruit" }).eq("id", u.branche);
    expect(error, "la métaphore du fruit a été bannie du produit : elle ne doit plus exister en base").not.toBeNull();
  });

  it("`rayonnement` est la valeur légale du troisième état", async () => {
    const { error } = await admin
      .from("branche")
      .update({ etat: "rayonnement", date_rayonnement: new Date().toISOString() })
      .eq("id", u.branche);
    expect(error).toBeNull();
    expect((await etatDe(u.branche)).etat).toBe("rayonnement");
  });
});

describe("[AC1/AC4 DUR] MONOTONIE — l'arbre ne recule jamais, y compris en service_role", () => {
  const u = { email: `cyc-mono-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("rayonnement → feuillaison et rayonnement → naissance sont REFUSÉS (mutation-cible : la clause de monotonie d'état du trigger)", async () => {
    const b = await creerBranche(u.id, "recul-etat");
    // `service_role` : ni la RLS, ni un CHECK de colonne (aucun ne voit la ligne PRÉCÉDENTE) ne s'appliquent
    // ici — SEUL le trigger peut refuser. C'est ce qui rend la mutation de cette clause détectable.
    await admin.from("branche").update({ etat: "rayonnement", date_rayonnement: new Date().toISOString() }).eq("id", b);
    for (const etat of ["feuillaison", "naissance"]) {
      const { error } = await admin.from("branche").update({ etat }).eq("id", b);
      expect(error, `rayonnement → ${etat} doit être refusé (FR-029)`).not.toBeNull();
    }
    expect((await etatDe(b)).etat, "l'état persisté n'a pas bougé").toBe("rayonnement");
  });

  it("feuillaison → naissance est REFUSÉ aussi (le premier recul possible est déjà interdit)", async () => {
    const b = await creerBranche(u.id, "recul-feuil");
    await admin.from("branche").update({ etat: "feuillaison", intensite: 0.4 }).eq("id", b);
    const { error } = await admin.from("branche").update({ etat: "naissance" }).eq("id", b);
    expect(error).not.toBeNull();
    expect((await etatDe(b)).etat).toBe("feuillaison");
  });

  it("une intensité qui BAISSE est refusée (le feuillage ne se dégarnit pas)", async () => {
    const b = await creerBranche(u.id, "recul-intensite");
    await admin.from("branche").update({ etat: "feuillaison", intensite: 0.6 }).eq("id", b);
    const { error } = await admin.from("branche").update({ intensite: 0.2 }).eq("id", b);
    expect(error, "0.6 → 0.2 doit être refusé").not.toBeNull();
    expect((await etatDe(b)).intensite).toBeCloseTo(0.6, 5);
  });

  it("une date de transition déjà posée ne se RÉÉCRIT pas (l'histoire d'une branche ne se réinvente pas)", async () => {
    const b = await creerBranche(u.id, "date-writeonce");
    await admin.from("branche").update({ etat: "feuillaison", date_feuillaison: new Date().toISOString() }).eq("id", b);
    const { date_feuillaison: origine } = await etatDe(b);
    expect(origine).not.toBeNull();
    const antidate = await admin.from("branche").update({ date_feuillaison: "1999-01-01T00:00:00Z" }).eq("id", b);
    expect(antidate.error, "antidater une feuillaison doit être refusé").not.toBeNull();
    const efface = await admin.from("branche").update({ date_feuillaison: null }).eq("id", b);
    expect(efface.error, "effacer une date de transition doit être refusé").not.toBeNull();
    expect((await etatDe(b)).date_feuillaison).toBe(origine);
  });

  it("un état AVANCE toujours (contrôle positif : la garde n'est pas un mur)", async () => {
    const b = await creerBranche(u.id, "avance");
    const pas1 = await admin
      .from("branche")
      .update({ etat: "feuillaison", intensite: 0.2, date_feuillaison: new Date().toISOString() })
      .eq("id", b);
    expect(pas1.error).toBeNull();
    const pas2 = await admin
      .from("branche")
      .update({ etat: "rayonnement", intensite: 0.8, date_rayonnement: new Date().toISOString() })
      .eq("id", b);
    expect(pas2.error).toBeNull();
    const apres = await etatDe(b);
    expect(apres.etat).toBe("rayonnement");
    expect(apres.intensite).toBeCloseTo(0.8, 5);
  });

  it("l'identité et l'origine restent FIGÉES (la clause héritée de 0022 survit à l'ouverture du cycle)", async () => {
    const b = await creerBranche(u.id, "fige");
    const ailleurs = await graverEntree(u.id, `cyc-fige-ailleurs-${t}`);
    const repoint = await admin.from("branche").update({ extrait_source_id: ailleurs }).eq("id", b);
    expect(repoint.error, "une branche ne change pas de moment d'origine").not.toBeNull();
    const antidate = await admin.from("branche").update({ date_naissance: "1999-01-01T00:00:00Z" }).eq("id", b);
    expect(antidate.error, "une branche ne change pas de date de naissance").not.toBeNull();
  });

  it("un état incohérent avec sa date est refusé (rayonnante sans date, ou datée sans l'être)", async () => {
    const b = await creerBranche(u.id, "coherence");
    const sansDate = await admin.from("branche").update({ etat: "rayonnement" }).eq("id", b);
    expect(sansDate.error, "« en pleine lumière » sans savoir depuis quand ne veut rien dire (AC5)").not.toBeNull();
    const dateSeule = await admin.from("branche").update({ date_rayonnement: new Date().toISOString() }).eq("id", b);
    expect(dateSeule.error, "une date de pleine lumière sur une branche qui ne rayonne pas est un mensonge").not.toBeNull();
  });
});

describe("[AC3 DUR] le chemin AUTOMATIQUE ne peut pas mener à la pleine lumière", () => {
  it("[structurel] `progresser_feuillaison` ne contient NULLE PART le littéral `rayonnement`", () => {
    // Garde de SOURCE, assumée comme telle : la seule façon de prouver « ce chemin ne peut pas y mener »
    // sans énumérer l'infini des entrées, c'est de constater que la valeur n'est pas écrite dans le corps.
    // Le pendant COMPORTEMENTAL (neuf retours espacés → toujours `feuillaison`) vit plus bas.
    const sql = SQL_0025();
    const debut = sql.indexOf("create function public.progresser_feuillaison");
    expect(debut, "la RPC de feuillaison est introuvable dans 0025").toBeGreaterThan(-1);
    const fin = sql.indexOf("$;", debut);
    expect(fin, "corps de fonction non délimité").toBeGreaterThan(debut);
    expect(
      sql.slice(debut, fin),
      "le chemin automatique ne doit jamais pouvoir nommer la pleine lumière",
    ).not.toMatch(/rayonnement/);
  });

  it("[structurel / REVUE] `progresser_feuillaison` SÉRIALISE sur la branche (`for update`)", () => {
    // Garde de SOURCE assumée : la course est réelle mais trop étroite pour qu'un test de comportement
    // la tue de façon fiable (voir le test de concurrence). Sans ce verrou, deux tours simultanés le
    // même jour incrémentent tous les deux — +0,4 au lieu de +0,2, et l'arbre ne régresse jamais, donc
    // c'est définitif. La migration EST la définition déployée (`db reset` la rejoue, la CI part d'une
    // base neuve) : verrouiller son texte est la façon honnête de garder cet invariant.
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0026_branche_cycle_correctifs.sql"), "utf-8");
    const debut = sql.indexOf("create or replace function public.progresser_feuillaison");
    expect(debut, "la RPC corrigée est introuvable dans 0026").toBeGreaterThan(-1);
    const corps = sql.slice(debut, sql.indexOf("$;", debut));
    const verrou = corps.slice(corps.indexOf("select b.etat into v_etat"));
    expect(verrou.slice(0, verrou.indexOf(";") + 1), "le select de la branche doit poser un verrou").toMatch(
      /for\s+update/,
    );
    // …et le verrou doit être posé AVANT la lecture du ledger, sinon il ne sérialise rien d'utile.
    expect(corps.indexOf("for update"), "verrou posé après la lecture du ledger : inutile").toBeLessThan(
      corps.indexOf("insert into public.branche_retour"),
    );
  });

  it("[MÉTA] cette garde attraperait bien un mutant (elle n'est pas vraie par accident)", () => {
    // Sans ce contrôle, la garde ci-dessus passerait tout aussi bien si la fonction n'existait plus.
    const mutant = "create function public.progresser_feuillaison()\nbegin\n set etat = 'rayonnement';\nend;\n$;";
    const corps = mutant.slice(0, mutant.indexOf("$;"));
    expect(corps).toMatch(/rayonnement/);
  });
});

describe("[AC2 DUR] `progresser_feuillaison` — par degrés, un retour par jour, idempotent", () => {
  const u = { email: `cyc-feuil-${t}@exemple.fr`, id: "", branche: "" };
  let pas = 0;

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "feuil");
    const { data, error } = await admin.rpc("branche_pas_feuillaison");
    if (error) throw new Error(`branche_pas_feuillaison: ${error.message}`);
    pas = Number(data);
  });
  afterAll(async () => purger(u.id));

  it("le pas de feuillaison est un réel strictement entre 0 et 1 (une feuillaison PROGRESSIVE, jamais un flip)", () => {
    expect(pas).toBeGreaterThan(0);
    expect(pas).toBeLessThan(1);
  });

  it("le PREMIER retour amorce la feuillaison : etat, un pas d'intensité, et une date", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await graverEntree(u.id, `cyc-feuil-j1-${t}`);
    const { error } = await c.rpc("progresser_feuillaison", { p_branche_id: u.branche, p_cle_tour: `cyc-feuil-j1-${t}` });
    expect(error).toBeNull();
    const apres = await etatDe(u.branche);
    expect(apres.etat).toBe("feuillaison");
    expect(apres.intensite).toBeCloseTo(pas, 5);
    expect(apres.date_feuillaison, "AC5 : la fiche doit pouvoir dire QUAND").not.toBeNull();
    await c.auth.signOut();
  });

  it("REJOUER le même tour ne change rien (idempotence au retry — patron 2-4b)", async () => {
    const c = await session(u.email);
    const avant = await etatDe(u.branche);
    const { error } = await c.rpc("progresser_feuillaison", { p_branche_id: u.branche, p_cle_tour: `cyc-feuil-j1-${t}` });
    expect(error).toBeNull();
    expect((await etatDe(u.branche)).intensite).toBeCloseTo(avant.intensite, 5);
    await c.auth.signOut();
  });

  it("un SECOND tour le MÊME jour ne compte pas pour un second retour (« au fil des semaines », pas au fil des minutes)", async () => {
    const c = await session(u.email);
    const avant = await etatDe(u.branche);
    await graverEntree(u.id, `cyc-feuil-j1bis-${t}`);
    const { error } = await c.rpc("progresser_feuillaison", {
      p_branche_id: u.branche,
      p_cle_tour: `cyc-feuil-j1bis-${t}`,
    });
    expect(error).toBeNull();
    expect((await etatDe(u.branche)).intensite, "revenir trois fois dans la même soirée, c'est UN retour").toBeCloseTo(
      avant.intensite,
      5,
    );
    await c.auth.signOut();
  });

  it("des retours espacés font monter le feuillage jusqu'au plein — sans JAMAIS franchir vers la pleine lumière", async () => {
    const c = await session(u.email);
    for (let jour = 1; jour <= 8; jour++) {
      await antidaterRetours(u.branche); // le lendemain : un nouveau tour compte pour un nouveau retour
      const cle = `cyc-feuil-jn-${jour}-${t}`;
      await graverEntree(u.id, cle);
      const { error } = await c.rpc("progresser_feuillaison", { p_branche_id: u.branche, p_cle_tour: cle });
      expect(error, `retour du jour ${jour}`).toBeNull();
    }
    const apres = await etatDe(u.branche);
    expect(apres.intensite, "l'intensité ne dépasse jamais 1").toBeLessThanOrEqual(1);
    expect(apres.intensite, "après neuf retours espacés, le feuillage est plein").toBeCloseTo(1, 5);
    expect(apres.etat, "[AC3] la feuillaison ne mène JAMAIS toute seule à la pleine lumière").toBe("feuillaison");
    await c.auth.signOut();
  });

  it("[REVUE] deux tours CONCURRENTS le même jour ne donnent qu'UN seul incrément", async () => {
    // Séquence perdante d'origine : deux tours partent presque en même temps (double envoi, retry
    // réseau, deux onglets). Chacun insère SA ligne de retour — clés différentes, aucun conflit — puis
    // chacun demande « existe-t-il un AUTRE retour aujourd'hui ? ». En READ COMMITTED, aucune des deux
    // transactions ne voit encore la ligne de l'autre : les deux répondent non, les deux incrémentent.
    // +0,4 pour une seule journée, et l'arbre ne régresse jamais (FR-029) — donc définitivement.
    const b = await creerBranche(u.id, "course");
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    // ⚠️ CE QUE CE TEST PROUVE, ET CE QU'IL NE PROUVE PAS. Il vérifie qu'un déluge d'appels simultanés
    // n'écrit qu'UN pas et n'échoue jamais — c'est le comportement qui compte pour Sanela. Il n'est PAS
    // un tueur de mutant fiable : sans `for update`, il ne rougit qu'une fois sur trois ou quatre, parce
    // que PostgREST sérialise déjà une partie du trafic par son pool de connexions (la course est bien
    // plus ouverte en production, où les connexions abondent). Le `for update` est donc verrouillé EN
    // PLUS par une garde structurelle plus bas — annoncée comme telle, plutôt qu'un test de comportement
    // qui prétendrait prouver ce qu'il n'attrape qu'au hasard.
    const cles = Array.from({ length: 6 }, (_, i) => `cyc-course-${i}-${t}`);
    for (const cle of cles) await graverEntree(u.id, cle);

    const avant = (await etatDe(b)).intensite;
    const resultats = await Promise.all(
      cles.map((cle) => c.rpc("progresser_feuillaison", { p_branche_id: b, p_cle_tour: cle })),
    );
    for (const r of resultats) expect(r.error, "aucun des appels ne doit échouer").toBeNull();
    expect(resultats.filter((r) => r.data === true), "un seul retour compte par jour civil").toHaveLength(1);
    expect((await etatDe(b)).intensite - avant, "un seul pas, quel que soit le nombre d'appels").toBeCloseTo(pas, 5);
    // Les SIX retours restent consignés : ce sont des faits, seul leur EFFET est plafonné.
    const ledger = await admin.from("branche_retour").select("entree_journal_id").eq("branche_id", b);
    expect(ledger.data).toHaveLength(6);
    await c.auth.signOut();
  });

  it("un tour qui n'appartient pas à l'appelante LÈVE (isolation)", async () => {
    const c = await session(u.email);
    const { error } = await c.rpc("progresser_feuillaison", {
      p_branche_id: u.branche,
      p_cle_tour: `tour-qui-n-existe-pas-${t}`,
    });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });

  it("une branche NON POSSÉDÉE ne progresse pas (et ne réussit pas en silence)", async () => {
    const autre = { email: `cyc-feuil-autre-${t}@exemple.fr`, id: "", branche: "" };
    autre.id = await creerUtilisatrice(autre.email);
    autre.branche = await creerBranche(autre.id, "feuil-autre");
    const c = await session(u.email);
    await graverEntree(u.id, `cyc-feuil-vol-${t}`);
    const { error } = await c.rpc("progresser_feuillaison", {
      p_branche_id: autre.branche,
      p_cle_tour: `cyc-feuil-vol-${t}`,
    });
    expect(error, "faire pousser l'arbre d'autrui doit lever").not.toBeNull();
    expect((await etatDe(autre.branche)).etat).toBe("naissance");
    await c.auth.signOut();
    await purger(autre.id);
  });
});

describe("[AC3 DUR] `declarer_rayonnement` — le seul chemin vers la pleine lumière", () => {
  const u = { email: `cyc-ray-${t}@exemple.fr`, id: "", branche: "" };
  const autre = { email: `cyc-ray-autre-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    autre.id = await creerUtilisatrice(autre.email);
    u.branche = await creerBranche(u.id, "ray");
    autre.branche = await creerBranche(autre.id, "ray-autre");
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(autre.id);
  });

  it("la déclaration pose l'état ET sa date (AC5 : « depuis quand »)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.rpc("declarer_rayonnement", { p_branche_id: u.branche });
    expect(error).toBeNull();
    const apres = await etatDe(u.branche);
    expect(apres.etat).toBe("rayonnement");
    expect(apres.date_rayonnement).not.toBeNull();
    await c.auth.signOut();
  });

  it("déclarer DEUX FOIS est sans effet et sans erreur (idempotent — la date d'origine est conservée)", async () => {
    const c = await session(u.email);
    const avant = await etatDe(u.branche);
    const { error } = await c.rpc("declarer_rayonnement", { p_branche_id: u.branche });
    expect(error).toBeNull();
    expect((await etatDe(u.branche)).date_rayonnement, "la date de la première fois ne bouge pas").toBe(
      avant.date_rayonnement,
    );
    await c.auth.signOut();
  });

  it("déclarer la branche d'AUTRUI lève, et ne touche rien (plus de succès silencieux — patron 0023 §6)", async () => {
    const c = await session(u.email);
    const { error } = await c.rpc("declarer_rayonnement", { p_branche_id: autre.branche });
    expect(error).not.toBeNull();
    expect((await etatDe(autre.branche)).etat).toBe("naissance");
    await c.auth.signOut();
  });

  it("une branche encore en NAISSANCE peut entrer en pleine lumière sans passer par la feuillaison", async () => {
    // Monotone ≠ obligation de gravir chaque marche : elle peut avoir vécu la chose sans jamais y revenir
    // en séance. Interdire le saut refuserait un geste légitime — et c'est ELLE qui sait.
    const c = await session(u.email);
    const directe = await creerBranche(u.id, "saut");
    const { error } = await c.rpc("declarer_rayonnement", { p_branche_id: directe });
    expect(error).toBeNull();
    const apres = await etatDe(directe);
    expect(apres.etat).toBe("rayonnement");
    expect(apres.date_feuillaison, "elle n'a jamais feuillu : la fiche ne doit pas prétendre le contraire").toBeNull();
    await c.auth.signOut();
  });
});

describe("[AC6 DUR / AD-17, D3] pendant un épisode de détresse, le cycle de vie s'arrête", () => {
  const u = { email: `cyc-detresse-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "detresse");
  });
  afterAll(async () => purger(u.id));

  it("un UPDATE DIRECT qui ferait AVANCER l'arbre est refusé pendant l'épisode (mutation-cible : la clause AD-17 du TRIGGER)", async () => {
    // ISOLATION. Ce chemin ne croise AUCUNE autre garde de détresse : la policy `branche_maj` n'en porte
    // pas (elle ne peut pas — renommer une branche pendant un épisode doit rester possible), et le ledger
    // `branche_retour` n'est pas touché. Seul le trigger peut refuser ici : sa mutation est donc mortelle.
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await ouvrirEpisode(u.id);
    const ray = await c
      .from("branche")
      .update({ etat: "rayonnement", date_rayonnement: new Date().toISOString() })
      .eq("id", u.branche);
    expect(ray.error, "l'arbre ne pousse pas pendant une détresse (FR-046)").not.toBeNull();
    const feuil = await c.from("branche").update({ intensite: 0.5 }).eq("id", u.branche);
    expect(feuil.error, "la matière non plus ne progresse pas").not.toBeNull();
    expect((await etatDe(u.branche)).etat).toBe("naissance");
    await c.auth.signOut();
  });

  it("RENOMMER reste possible pendant l'épisode (contrôle positif : la garde vise la croissance, pas la parole)", async () => {
    const c = await session(u.email);
    const { error } = await c.rpc("renommer_branche", { p_branche_id: u.branche, p_nouveau_nom: "un nom en crise" });
    expect(error, "interdire de renommer une branche pendant une détresse serait absurde et cruel").toBeNull();
    await c.auth.signOut();
  });

  it("`progresser_feuillaison` LÈVE, avec le message CLAIR (mutation-cible : son fast-fail, pas la policy du ledger)", async () => {
    // Le fast-fail est REDONDANT avec le WITH CHECK de `branche_retour` : les deux refusent, donc aucun test
    // « ça échoue » ne peut isoler l'un des deux. Ce qui les distingue est OBSERVABLE : le fast-fail rend un
    // message explicite (P0001), la policy une violation RLS générique (42501) — et ce message EST sa raison
    // d'être. L'asserter, c'est asserter exactement ce que cette garde apporte en plus.
    const c = await session(u.email);
    await graverEntree(u.id, `cyc-det-${t}`);
    const { error } = await c.rpc("progresser_feuillaison", { p_branche_id: u.branche, p_cle_tour: `cyc-det-${t}` });
    expect(error, "l'arbre ne pousse pas pendant une détresse (FR-046)").not.toBeNull();
    expect(error!.message, "le refus doit DIRE qu'il vient de la garde détresse").toMatch(/détresse/i);
    expect((await etatDe(u.branche)).etat).toBe("naissance");
    await c.auth.signOut();
  });

  it("[D3] `declarer_rayonnement` LÈVE aussi — un basculement vécu en crise n'est pas un basculement stable", async () => {
    const c = await session(u.email);
    const { error } = await c.rpc("declarer_rayonnement", { p_branche_id: u.branche });
    expect(error, "le geste est IRRÉVERSIBLE : on ne le laisse pas se faire dans la fenêtre").not.toBeNull();
    expect(error!.message, "le refus doit DIRE qu'il vient de la garde détresse").toMatch(/détresse/i);
    expect((await etatDe(u.branche)).etat).toBe("naissance");
    await c.auth.signOut();
  });

  it("hors fenêtre, les deux chemins repassent (contrôle positif : la garde n'est pas un mur permanent)", async () => {
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    const c = await session(u.email);
    const feuil = await c.rpc("progresser_feuillaison", { p_branche_id: u.branche, p_cle_tour: `cyc-det-${t}` });
    expect(feuil.error).toBeNull();
    const ray = await c.rpc("declarer_rayonnement", { p_branche_id: u.branche });
    expect(ray.error).toBeNull();
    expect((await etatDe(u.branche)).etat).toBe("rayonnement");
    await c.auth.signOut();
  });
});

describe("La projection remonte les dates de transition (AC5)", () => {
  const u = { email: `cyc-proj-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "proj");
    const maintenant = new Date().toISOString();
    await admin
      .from("branche")
      .update({ etat: "feuillaison", intensite: 0.4, date_feuillaison: maintenant })
      .eq("id", u.branche);
    await admin
      .from("branche")
      .update({ etat: "rayonnement", intensite: 1, date_rayonnement: maintenant })
      .eq("id", u.branche);
  });
  afterAll(async () => purger(u.id));

  it("`charger_branches_arbre` sert `date_feuillaison` et `date_rayonnement`", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { data, error } = await c.rpc("charger_branches_arbre");
    expect(error).toBeNull();
    const ligne = (data ?? []).find((b: { branche_id: string }) => b.branche_id === u.branche);
    expect(ligne, "la branche doit être servie").toBeTruthy();
    expect(ligne.etat).toBe("rayonnement");
    expect(ligne.date_feuillaison).not.toBeNull();
    expect(ligne.date_rayonnement).not.toBeNull();
    await c.auth.signOut();
  });
});

describe("[FR-067] le ledger `branche_retour` est purgé AVEC sa branche (inventaire d'effacement)", () => {
  const u = { email: `cyc-eff-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "effacement");
  });
  afterAll(async () => purger(u.id));

  it("supprimer la branche emporte ses retours (une table oubliée par l'effacement est un trou RGPD)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    await graverEntree(u.id, `cyc-eff-${t}`);
    const { error } = await c.rpc("progresser_feuillaison", { p_branche_id: u.branche, p_cle_tour: `cyc-eff-${t}` });
    expect(error).toBeNull();
    const avant = await admin.from("branche_retour").select("branche_id").eq("branche_id", u.branche);
    expect(avant.data, "un retour a bien été consigné").toHaveLength(1);

    await admin.from("branche").delete().eq("id", u.branche);
    const apres = await admin.from("branche_retour").select("branche_id").eq("branche_id", u.branche);
    expect(apres.data, "le ledger de retours suit sa branche dans la tombe").toHaveLength(0);
    await c.auth.signOut();
  });

  it("le ledger est ISOLÉ : personne ne lit les retours d'autrui", async () => {
    const autre = { email: `cyc-eff-autre-${t}@exemple.fr`, id: "" };
    autre.id = await creerUtilisatrice(autre.email);
    const b = await creerBranche(u.id, "isolation-ledger");
    const c = await session(u.email);
    await graverEntree(u.id, `cyc-eff-iso-${t}`);
    await c.rpc("progresser_feuillaison", { p_branche_id: b, p_cle_tour: `cyc-eff-iso-${t}` });
    await c.auth.signOut();

    const intrus = await session(autre.email);
    const { data } = await intrus.from("branche_retour").select("branche_id").eq("branche_id", b);
    expect(data ?? [], "le rythme de retour d'une autre est une donnée art. 9 dérivée").toHaveLength(0);
    await intrus.auth.signOut();
    await purger(autre.id);
  });
});
