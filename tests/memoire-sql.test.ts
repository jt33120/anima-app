import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lireFaitsRetenus } from "@/lib/data/lire-memoire";
import { declarerMajorite } from "./_semis";

/**
 * Story 6.5 (T1/T3/T6) — CONTRE LE VRAI POSTGRES.
 *
 * Trois propriétés que rien d'autre ne peut prouver :
 *   • la contrainte de 0056 ferme le trou mesuré dans 4.2 (une correction vide) ;
 *   • le droit à l'effacement SURVIT à la révocation, et la correction non (D2) ;
 *   • supprimer un fait ne touche AUCUNE autre couche de mémoire (AC6).
 *
 * Une doublure de client rendrait les trois invérifiables par construction : elles sont portées par
 * une contrainte, un trigger et une RLS.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-memoire-123!";

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

async function consentir(id: string, revoque = false) {
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  const { error } = await admin.from("consentement").insert({
    utilisatrice_id: id,
    art9_accorde: true,
    ia_reconnue: true,
    cgu_acceptees: true,
    revoked_at: revoque ? new Date().toISOString() : null,
  });
  if (error) throw new Error(`consentir: ${error.message}`);
}

async function graverJournal(id: string, contenu: string): Promise<string> {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, role: "utilisatrice", contenu, cle_tour: `mem-${t}-${Math.random()}` })
    .select("id")
    .single();
  if (error) throw new Error(`journal: ${error.message}`);
  return data!.id as string;
}

/** Pose un fait par le SEUL chemin d'écriture (4.2) — jamais un `insert` direct. */
async function poserFait(c: SupabaseClient, cle: string, contenu: string, source: string | null) {
  const { error } = await c.rpc("fusionner_fait_extrait", {
    p_origine: "extrait",
    p_statut: "actif",
    p_cle: cle,
    p_contenu: contenu,
    p_extrait_source: source,
  });
  if (error) throw new Error(`poserFait: ${error.message}`);
}

const fusionner = (c: SupabaseClient, o: string, s: string, cle: string, contenu: string) =>
  c.rpc("fusionner_fait_extrait", {
    p_origine: o,
    p_statut: s,
    p_cle: cle,
    p_contenu: contenu,
    p_extrait_source: null,
  });

async function purger(id: string) {
  if (!id) return;
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("fait_extrait").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

const lignes = async (id: string) =>
  (await admin.from("fait_extrait").select("origine, statut, contenu, extrait_source_id").eq("utilisatrice_id", id)).data ?? [];

// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5/D1] la contrainte de 0056 ferme le trou mesuré dans 4.2", () => {
  const email = `mem-trou-${t}@exemple.test`;
  let id = "";
  let c: SupabaseClient;

  beforeAll(async () => {
    id = await creerUtilisatrice(email);
    await consentir(id);
    c = await session(email);
  });
  beforeEach(async () => admin.from("fait_extrait").delete().eq("utilisatrice_id", id));
  afterAll(async () => purger(id));

  it("[LE CŒUR] une CORRECTION VIDE est refusée — c'était une suppression déguisée", async () => {
    // ⚠️ CECI PASSAIT AVANT 0056, et c'est la mesure qui a motivé la migration :
    //     fusionner_fait_extrait('utilisatrice','corrige','k','',null) → aucune erreur,
    //     ligne { origine:'utilisatrice', statut:'corrige', contenu:'' }
    // Ni affichable ni tombstone : le statut d'une correction, le contenu d'une suppression. Le
    // write-gate art. 9 du trigger ne la voit pas (il ne se déclenche que sur un contenu NON vide,
    // exprès, pour laisser passer la suppression après révocation).
    await poserFait(c, "k-vide", "elle aime la mer", null);
    const { error } = await fusionner(c, "utilisatrice", "corrige", "k-vide", "");
    expect(error, "une correction vide est encore acceptée").not.toBeNull();
    expect(await lignes(id)).toMatchObject([{ statut: "actif", contenu: "elle aime la mer" }]);
  });

  it("[LE CŒUR] un TOMBSTONE QUI GARDE SON CONTENU est refusé aussi — l'équivalence va dans les deux sens", async () => {
    // ⚠️ Le sens inverse est PIRE : un geste d'effacement qui laisserait l'art. 9 en place. Une
    // implication simple (`supprime ⇒ vide`) l'aurait laissé passer.
    await poserFait(c, "k-plein", "elle aime la mer", null);
    const { error } = await fusionner(c, "utilisatrice", "supprime", "k-plein", "il en reste quelque chose");
    expect(error, "un tombstone a pu garder son contenu").not.toBeNull();
  });

  it("[CONTRÔLE POSITIF] les deux gestes légitimes passent toujours", async () => {
    await poserFait(c, "k-ok", "elle aime la mer", null);
    expect((await fusionner(c, "utilisatrice", "corrige", "k-ok", "elle aime la montagne")).error).toBeNull();
    expect((await fusionner(c, "utilisatrice", "supprime", "k-ok", "")).error).toBeNull();
    expect(await lignes(id)).toMatchObject([{ statut: "supprime", contenu: "" }]);
  });
});

describe("[6.5/D2] le droit à l'effacement SURVIT à la révocation — la correction, non", () => {
  const email = `mem-revoc-${t}@exemple.test`;
  let id = "";
  let c: SupabaseClient;

  beforeAll(async () => {
    id = await creerUtilisatrice(email);
    await consentir(id);
    c = await session(email);
    await poserFait(c, "k-r", "elle a changé de ville", null);
    // La révocation vient APRÈS que le fait existe — sinon il n'y aurait rien à supprimer.
    await consentir(id, true);
  });
  afterAll(async () => purger(id));

  it("[LE CŒUR] après révocation, elle voit encore ses faits", async () => {
    // ⚠️ C'est ce qui rend D2 possible : ON NE PEUT PAS SUPPRIMER CE QU'ON NE VOIT PAS. Si la policy
    // de lecture exigeait un consentement vivant, toute la construction de 4.2 (une suppression qui
    // survit à la révocation) serait inatteignable au moment exact où elle sert.
    const faits = await lireFaitsRetenus(c);
    expect(faits.map((f) => f.contenu)).toEqual(["elle a changé de ville"]);
  });

  it("[LE CŒUR] corriger est REFUSÉ", async () => {
    const { error } = await fusionner(c, "utilisatrice", "corrige", "k-r", "elle est revenue");
    expect(error, "un contenu art. 9 a été déposé sans consentement").not.toBeNull();
  });

  it("[LE CŒUR] supprimer PASSE, et le tombstone est posé", async () => {
    expect((await fusionner(c, "utilisatrice", "supprime", "k-r", "")).error).toBeNull();
    expect(await lignes(id)).toMatchObject([{ statut: "supprime", contenu: "" }]);
    // …et l'écran ne le montre plus.
    expect(await lireFaitsRetenus(c)).toEqual([]);
  });
});

describe("[6.5/AC1+AC6] ce que l'écran lit, et ce qu'une suppression laisse intact", () => {
  const emailA = `mem-a-${t}@exemple.test`;
  const emailB = `mem-b-${t}@exemple.test`;
  let idA = "";
  let idB = "";
  let cA: SupabaseClient;
  let cB: SupabaseClient;
  let sourceId = "";

  beforeAll(async () => {
    idA = await creerUtilisatrice(emailA);
    idB = await creerUtilisatrice(emailB);
    for (const id of [idA, idB]) await consentir(id);
    cA = await session(emailA);
    cB = await session(emailB);
    sourceId = await graverJournal(idA, "J'ai quitté Paris en mars, et je ne le regrette pas.");
    await poserFait(cA, "k-1", "elle a quitté Paris", sourceId);
  });
  afterAll(async () => {
    await purger(idA);
    await purger(idB);
  });

  it("[AC1] le fait descend avec sa DATE et son EXTRAIT SOURCE", async () => {
    const [f] = await lireFaitsRetenus(cA);
    expect(f.contenu).toBe("elle a quitté Paris");
    expect(f.jour, "la date manque").toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.source?.texte, "l'extrait source manque").toBe(
      "J'ai quitté Paris en mars, et je ne le regrette pas.",
    );
  });

  it("[AC1] AUCUN score ne descend — il n'en existe aucun à descendre", async () => {
    // ⚠️ Le type l'interdit déjà ; ceci attrape la dérivation à partir de rien. « Anam est sûre à
    // 82 % que tu n'aimes pas ton travail » est une phrase qu'aucune personne ne devrait avoir à
    // lire sur elle-même.
    const [f] = await lireFaitsRetenus(cA);
    for (const clef of Object.keys(f)) {
      expect(clef, `le champ « ${clef} » ressemble à un score`).not.toMatch(/score|confiance|certitude|poids/i);
    }
    expect(Object.values(f).some((v) => typeof v === "number"), "un nombre a traversé").toBe(false);
  });

  it("[LE CŒUR] B ne voit RIEN des faits de A", async () => {
    expect(await lireFaitsRetenus(cB)).toEqual([]);
    expect((await lireFaitsRetenus(cA)).length, "contrôle positif").toBe(1);
  });

  it("[LE CŒUR / AC6] supprimer un fait NE TOUCHE PAS le journal brut", async () => {
    // ⚠️ Les trois couches de mémoire (AD-8) sont invisibles pour l'utilisatrice : elle ne peut pas
    // deviner qu'effacer une phrase d'Anam n'efface pas ses messages. C'est pour ça que
    // l'introduction de l'écran le dit — et c'est pour ça que ce test existe.
    await fusionner(cA, "utilisatrice", "supprime", "k-1", "");
    const { data } = await admin.from("entree_journal").select("id, contenu").eq("id", sourceId);
    expect(data, "le journal brut a été touché").toHaveLength(1);
    expect(data![0].contenu).toBe("J'ai quitté Paris en mars, et je ne le regrette pas.");
  });

  it("[LE CŒUR / D3] le LIEN vers la source survit à la suppression — et donc à l'annulation", async () => {
    // ⚠️ C'est ce qui rend l'annulation acceptable : le tombstone vide le CONTENU, jamais le lien.
    // Une annulation re-dépose donc une phrase qui pointe encore vers le bon message.
    expect(await lignes(idA)).toMatchObject([{ statut: "supprime", extrait_source_id: sourceId }]);

    // Et l'annulation, qui est une re-déposition en `corrige` :
    expect((await fusionner(cA, "utilisatrice", "corrige", "k-1", "elle a quitté Paris")).error).toBeNull();
    const [f] = await lireFaitsRetenus(cA);
    expect(f.statut, "après annulation, le fait est POSSÉDÉ par elle").toBe("corrige");
    expect(f.source?.texte, "le lien vers la source a été perdu").toBe(
      "J'ai quitté Paris en mars, et je ne le regrette pas.",
    );
  });

  it("[AC4] une ré-extraction ne ressuscite ni ne réécrit ce qu'elle possède", async () => {
    // 4.2 le prouve déjà en base ; ce test-ci le prouve DEPUIS L'ÉCRAN — c'est-à-dire sur le chemin
    // que 6.5 vient d'ouvrir, et avec les mots de l'AC4.
    await poserFait(cA, "k-1", "elle a quitté Paris pour la mer", sourceId);
    const [f] = await lireFaitsRetenus(cA);
    expect(f.contenu, "la ré-extraction a écrasé la correction de l'utilisatrice").toBe("elle a quitté Paris");
  });
});
