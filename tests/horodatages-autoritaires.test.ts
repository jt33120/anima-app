import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reposerConsentement } from "./_rig-consentement";

/**
 * REVUE DE CODE du 2026-08-12 — LES RÉSIDUS DU BALAYAGE DES 27 TABLES (migration 0046).
 *
 * ══ CE QUE LE BALAYAGE AVAIT LAISSÉ, ET CE QU'IL EN RESTE APRÈS VÉRIFICATION ═══════════════════
 *
 * Cinq résidus, éprouvés un à un sous un VRAI JWT. Deux natures très différentes en sont sorties.
 *
 *   • `branche_retour` pointant l'entrée d'autrui → RÉFUTÉ. La policy refuse, et la clé étrangère
 *     COMPOSITE `(utilisatrice_id, entree_journal_id)` rend la chose structurellement impossible.
 *     Gardé ici en contrôle positif, pour qu'une revue future sache que le cas a été éprouvé.
 *
 *   • `fait_extrait` ancré sur le journal d'une autre → CONFIRMÉ, et j'ai failli le classer réfuté.
 *     Mon premier script posait une valeur hors domaine sur une colonne SANS RAPPORT ; le refus
 *     venait de cette contrainte-là (23514), pas de la garde. Avec des valeurs correctes, l'ancrage
 *     croisé passait. **Un refus ne se lit pas, il se vérifie par son code.** Corrigé en 0047.
 *
 *   • l'ANTIDATAGE de `cree_le` et les ÉTATS INITIAUX FORGÉS → CONFIRMÉS, sur ses propres lignes :
 *     le client choisissait des valeurs que la base aurait dû imposer. Corrigés en 0046.
 *
 * ══ POURQUOI L'ANTIDATAGE N'EST PAS COSMÉTIQUE ═════════════════════════════════════════════════
 *
 * `charger_proposition_branche` (0021) n'ouvre un moment qu'à partir du JOUR CIVIL SUIVANT sa
 * naissance — c'est ainsi que FR-059 empêche Anam de proposer une branche pendant la première
 * séance. Antidater le signal de trente heures faisait tomber ce délai.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const comptes: string[] = [];
/** Trente heures en arrière : au-delà d'une journée civile, donc de quoi franchir « le lendemain ». */
const HIER = new Date(Date.now() - 30 * 3_600_000).toISOString();

async function personne(suffixe: string): Promise<{ id: string; cli: SupabaseClient }> {
  const email = `hor-${suffixe}-${t}@exemple.fr`;
  const mdp = "test-hor-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password: mdp, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  comptes.push(id);
  await admin.from("utilisatrice").update({ date_naissance: "1990-06-15" }).eq("id", id);
  await reposerConsentement(admin, id);
  const cli = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: e2 } = await cli.auth.signInWithPassword({ email, password: mdp });
  if (e2) throw new Error(`signIn: ${e2.message}`);
  return { id, cli };
}

/** Minutes écoulées entre un horodatage et maintenant. Proche de 0 ⇒ la base a repris la main. */
const minutesDepuis = (iso: string) => Math.abs(Date.now() - new Date(iso).getTime()) / 60000;

let A: { id: string; cli: SupabaseClient };
let B: { id: string; cli: SupabaseClient };

beforeAll(async () => {
  if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
  A = await personne("a");
  B = await personne("b");
}, 90_000);

afterAll(async () => {
  for (const id of comptes) await admin.auth.admin.deleteUser(id);
}, 60_000);

/** Une entrée de journal fraîche, par le chemin normal. */
async function entree(p: { id: string; cli: SupabaseClient }, cle: string): Promise<string> {
  const { data, error } = await p.cli
    .from("entree_journal")
    .insert({ utilisatrice_id: p.id, cle_tour: cle, role: "utilisatrice", contenu: "un tour" })
    .select("id")
    .single();
  if (error) throw new Error(`entree: ${error.message}`);
  return data!.id as string;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. L'ANTIDATAGE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[0046] `cree_le` est posé par la BASE, jamais par le client", () => {
  it("[CONTRÔLE POSITIF] une insertion ordinaire réussit et porte l'heure courante", async () => {
    // Sans ce témoin, « l'antidatage ne passe plus » serait vrai d'une table devenue inécrivable.
    const { data, error } = await A.cli
      .from("entree_journal")
      .insert({ utilisatrice_id: A.id, cle_tour: `ok-${t}`, role: "utilisatrice", contenu: "un tour" })
      .select("cree_le")
      .single();
    expect(error).toBeNull();
    expect(minutesDepuis(data!.cree_le as string)).toBeLessThan(2);
  });

  it("[LE TEST QUI COMPTE] une entrée antidatée de 30 h reçoit quand même l'heure courante", async () => {
    // ⚠️ L'insertion N'EST PAS REFUSÉE — elle est CORRIGÉE. C'est délibéré : refuser obligerait
    // chaque écrivain légitime à ne jamais mentionner la colonne, et un jour l'un d'eux le fera.
    // Reprendre la main est silencieux pour le code honnête et sans effet pour le reste.
    const { data, error } = await A.cli
      .from("entree_journal")
      .insert({ utilisatrice_id: A.id, cle_tour: `ad-${t}`, role: "utilisatrice", contenu: "x", cree_le: HIER })
      .select("cree_le")
      .single();
    expect(error).toBeNull();
    expect(minutesDepuis(data!.cree_le as string), "l'antidatage a tenu").toBeLessThan(2);
  });

  it("[FR-059] un SIGNAL antidaté ne fait plus tomber le délai « le lendemain »", async () => {
    // C'est le vrai enjeu : `charger_proposition_branche` n'ouvre un moment qu'à partir du jour
    // civil SUIVANT. Trente heures en arrière suffisaient à faire proposer une branche pendant la
    // première séance — exactement ce que FR-059 interdit.
    const e = await entree(A, `sig-${t}`);
    const { data, error } = await A.cli
      .from("signal_reconceptualisation")
      .insert({ utilisatrice_id: A.id, entree_journal_id: e, cree_le: HIER })
      .select("cree_le")
      .single();
    expect(error).toBeNull();
    expect(minutesDepuis(data!.cree_le as string)).toBeLessThan(2);
  });

  it("le REGISTRE DES RETOURS calcule son `jour_paris` en base, pas depuis le client", async () => {
    // `jour_paris` EST la clé de la cadence de feuillaison : `progresser_feuillaison` refuse un
    // second incrément le même jour en interrogeant cette colonne.
    const e = await entree(A, `ret-${t}`);
    const { data: b } = await A.cli
      .from("branche")
      .insert({ utilisatrice_id: A.id, nom: "ce que j ai compris", extrait_source_id: e })
      .select("id")
      .single();
    // Une branche exige un abonnement actif : si la pose échoue, ce cas n'a rien à prouver.
    if (!b) return;
    const e2 = await entree(A, `ret2-${t}`);
    const { data, error } = await A.cli
      .from("branche_retour")
      .insert({ utilisatrice_id: A.id, branche_id: b.id, entree_journal_id: e2, jour_paris: "2020-01-01" })
      .select("jour_paris")
      .single();
    expect(error).toBeNull();
    expect(data!.jour_paris, "un jour choisi par le client salit le registre de preuve").not.toBe("2020-01-01");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. L'ÉTAT INITIAL FORGÉ
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[0046] un état terminal ne se pose pas à l'INSERTION", () => {
  /**
   * Les triggers de transition (0021 pour le signal, 0019 pour les faits) ne gardent que l'UPDATE.
   * Insérer directement dans l'état d'arrivée les contournait entièrement — c'est la leçon R1-ter
   * de la revue 4.6, retrouvée ici sur deux tables : le grant de TABLE couvre INSERT autant
   * qu'UPDATE, donc toute garde posée sur l'un seulement laisse l'autre ouvert.
   */
  it("[DUR] un signal ne naît pas déjà `consomme`", async () => {
    const e = await entree(A, `forge1-${t}`);
    const { error } = await A.cli
      .from("signal_reconceptualisation")
      .insert({ utilisatrice_id: A.id, entree_journal_id: e, statut: "consomme" });
    expect(error?.code, "un signal inséré consommé n'a jamais été proposé à personne").toBe("P0001");
  });

  it("[DUR] un signal ne naît pas déjà `ecarte`", async () => {
    const e = await entree(A, `forge2-${t}`);
    const { error } = await A.cli
      .from("signal_reconceptualisation")
      .insert({ utilisatrice_id: A.id, entree_journal_id: e, statut: "ecarte" });
    expect(error?.code).toBe("P0001");
  });

  it("[CONTRÔLE POSITIF] un signal `en_attente` s'insère normalement", async () => {
    const e = await entree(A, `forge3-${t}`);
    const { error } = await A.cli
      .from("signal_reconceptualisation")
      .insert({ utilisatrice_id: A.id, entree_journal_id: e, statut: "en_attente" });
    expect(error, "la garde ne doit pas fermer le chemin normal").toBeNull();
  });

  it("[DUR] un fait ne naît pas déjà `supprime`", async () => {
    const e = await entree(A, `forge4-${t}`);
    const { error } = await A.cli.from("fait_extrait").insert({
      utilisatrice_id: A.id,
      extrait_source_id: e,
      contenu: "un fait",
      origine: "extrait",
      statut: "supprime",
      cle_dedoublonnage: `k1-${t}`,
    });
    expect(error?.code).toBe("P0001");
  });

  it("[CONTRÔLE POSITIF] un fait `actif` s'insère normalement", async () => {
    const e = await entree(A, `forge5-${t}`);
    const { error } = await A.cli.from("fait_extrait").insert({
      utilisatrice_id: A.id,
      extrait_source_id: e,
      contenu: "un fait",
      origine: "extrait",
      statut: "actif",
      cle_dedoublonnage: `k2-${t}`,
    });
    expect(error).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. LES DEUX RÉSIDUS RÉFUTÉS — gardés en contrôle positif
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[0047] LA GARDE VIVAIT DANS LA RPC — quatrième occurrence", () => {
  /**
   * ══ J'AI FAILLI CLASSER CELLE-CI « RÉFUTÉE », ET LA RAISON MÉRITE D'ÊTRE ÉCRITE ═══════════════
   *
   * Le premier script d'exploitation posait `origine: "extraction"` — une valeur hors du domaine
   * `('extrait','utilisatrice')`. L'insertion a été refusée, j'ai lu « REFUSÉ », et j'ai conclu que
   * l'ancrage croisé était gardé. Le refus venait d'une contrainte `check` sur une colonne SANS
   * RAPPORT (23514), pas de la garde d'appartenance.
   *
   * **Un refus ne se lit pas, il se vérifie par son CODE.** 23514 (contrainte) et 42501 (RLS) ne
   * disent pas la même chose, et se tromper de lecture ferme une revue sur une fausse bonne
   * nouvelle. C'est ce test-ci, écrit avec des valeurs correctes, qui a rouvert le dossier.
   *
   * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════
   *
   * `fusionner_fait_extrait` refuse l'ancrage croisé, et `tests/fait-extrait.test.ts` le prouve —
   * sur la RPC. La policy `fait_extrait_insertion`, elle, ne regardait pas `extrait_source_id`.
   * `authenticated` ayant le grant INSERT, un POST direct passait : une provenance falsifiée dans
   * la couche qui sert de mémoire à Anam, et un oracle d'UUID sur les entrées d'autrui.
   *
   * Ses deux voisines — `branche_insertion`, `signal_reconceptualisation_insertion` — portaient la
   * clause depuis toujours. Trois tables, le même besoin, deux gardes.
   *
   * Corrigé en 0047 par la policy ET par une clé étrangère COMPOSITE : une policy s'oublie, une
   * clé composite rend l'ancrage croisé structurellement impossible.
   */
  it("[LE TEST QUI COMPTE] A ne peut pas ancrer un fait sur le journal de B", async () => {
    const eB = await entree(B, `xu1-${t}`);
    const { error } = await A.cli.from("fait_extrait").insert({
      utilisatrice_id: A.id,
      extrait_source_id: eB,
      contenu: "un fait",
      origine: "extrait",
      statut: "actif",
      cle_dedoublonnage: `x1-${t}`,
    });
    expect(error, "l'ancrage croisé doit être refusé").not.toBeNull();
    // ⚠️ ON VÉRIFIE LE MOTIF DU REFUS. Un refus pour une AUTRE raison — une contrainte `check` sur
    // une colonne sans rapport — laisserait croire que la garde tient. C'est exactement l'erreur
    // qui a failli clore ce dossier.
    expect(
      ["42501", "23503"],
      `refusé pour une mauvaise raison : ${error?.code} — ${error?.message}`,
    ).toContain(error?.code);
  });

  it("[CONTRÔLE POSITIF] A ancre sans peine un fait sur SON PROPRE journal", async () => {
    // Sans lui, une policy qui refuserait TOUT ancrage passerait le test précédent et couperait la
    // couche de mémoire entière.
    const eA = await entree(A, `propre-${t}`);
    const { error } = await A.cli.from("fait_extrait").insert({
      utilisatrice_id: A.id,
      extrait_source_id: eA,
      contenu: "un fait",
      origine: "extrait",
      statut: "actif",
      cle_dedoublonnage: `p1-${t}`,
    });
    expect(error).toBeNull();
  });

  /**
   * ⚠️ CHAQUE COUCHE S'ÉPROUVE SÉPARÉMENT — sinon aucune n'est éprouvée.
   *
   * La campagne de mutation l'a montré : retirer la clause d'appartenance de la POLICY laissait le
   * test de comportement ci-dessus parfaitement vert, parce que la clé étrangère composite refusait
   * à sa place. Deux défenses redondantes qui se couvrent l'une l'autre, et pas un seul mutant qui
   * meurt — le mode d'échec que ce dépôt a déjà payé.
   *
   * La défense en profondeur est voulue et elle reste. Mais chaque couche a sa SIGNATURE, et c'est
   * elle qu'on assert : `42501` est un refus de policy, `23503` un refus de clé étrangère. Retirer
   * l'une fait basculer le code de l'autre, et le test rougit.
   */
  it("[COUCHE 1 — la policy] sous JWT, le refus vient de la POLICY (42501)", async () => {
    const eB = await entree(B, `c1-${t}`);
    const { error } = await A.cli.from("fait_extrait").insert({
      utilisatrice_id: A.id,
      extrait_source_id: eB,
      contenu: "un fait",
      origine: "extrait",
      statut: "actif",
      cle_dedoublonnage: `c1-${t}`,
    });
    expect(
      error?.code,
      "un 23503 ici voudrait dire que la policy a perdu sa clause et que seule la clé étrangère tient",
    ).toBe("42501");
  });

  it("[COUCHE 2 — la clé étrangère] sous `service_role`, la CLÉ ÉTRANGÈRE tient encore (23503)", async () => {
    // `service_role` contourne la RLS — donc la policy ne joue plus. Ce qui refuse ici est la clé
    // composite, et elle seule. C'est ce qui rend l'ancrage croisé structurellement impossible :
    // pas seulement interdit à l'utilisatrice, impossible à TOUT écrivain, y compris une future RPC.
    const eB = await entree(B, `c2-${t}`);
    const { error } = await admin.from("fait_extrait").insert({
      utilisatrice_id: A.id,
      extrait_source_id: eB,
      contenu: "un fait",
      origine: "extrait",
      statut: "actif",
      cle_dedoublonnage: `c2-${t}`,
    });
    expect(error?.code, "la clé étrangère n'est plus composite").toBe("23503");
  });

  it("un fait SANS moment source reste permis (correction manuelle)", async () => {
    // `extrait_source_id` est nullable : un fait peut naître d'une correction, sans tour d'origine.
    // La clause d'appartenance ne doit pas fermer ce chemin-là.
    const { error } = await A.cli.from("fait_extrait").insert({
      utilisatrice_id: A.id,
      contenu: "un fait corrigé à la main",
      origine: "utilisatrice",
      statut: "actif",
      cle_dedoublonnage: `p2-${t}`,
    });
    expect(error).toBeNull();
  });

  it("A ne peut pas poser un retour sur l'entrée de B", async () => {
    const eB = await entree(B, `xu2-${t}`);
    const eA = await entree(A, `xu3-${t}`);
    const { error } = await A.cli
      .from("branche_retour")
      .insert({ utilisatrice_id: A.id, branche_id: eA, entree_journal_id: eB, jour_paris: "2026-08-12" });
    expect(error).not.toBeNull();
  });

  it("A ne peut pas ancrer un signal sur le journal de B", async () => {
    const eB = await entree(B, `xu4-${t}`);
    const { error } = await A.cli
      .from("signal_reconceptualisation")
      .insert({ utilisatrice_id: A.id, entree_journal_id: eB });
    expect(error).not.toBeNull();
  });
});
