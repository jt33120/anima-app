import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { creerDepotRythme, RYTHME_MARGE_JOURS } from "@/lib/data/depot-rythme";
import { APAISEMENT_JOURS, FENETRE_JOURS, SEUIL_SEANCES } from "@/lib/domain/rythme-pause";

/**
 * Story 6.4 (T2/T3) — LA RÉSERVATION DE LA PAROLE ET LA MESURE, CONTRE LE VRAI POSTGRES.
 *
 * ⚠️ UN SEUL FICHIER POUR LA MIGRATION ET LE DÉPÔT, ET C'EST DÉLIBÉRÉ. Les deux propriétés qui
 * comptent — « personne ne peut se faire taire Anam » et « B ne voit pas le rythme de A » — sont
 * portées par la BASE : la première par l'absence de policy sur `pause_rythme`, la seconde par la
 * RLS d'`entree_journal`. Une doublure de client les rendrait invérifiables par construction : on
 * prouverait que le faux client rend ce qu'on lui a dit de rendre. Les séparer en deux fichiers
 * dupliquerait soixante lignes de fixtures pour ne prouver rien de plus.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-pause-123!";
const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

async function creerUtilisatrice(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}

async function session(email: string): Promise<SupabaseClient> {
  const c = clientScope();
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

async function consentir(id: string) {
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  const { error } = await admin
    .from("consentement")
    .insert({ utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true });
  if (error) throw new Error(`consentir: ${error.message}`);
}

/** Grave un tour à `ilYaMs` dans le passé. Le rôle compte : seule l'utilisatrice fait du rythme. */
async function graver(id: string, ilYaMs: number, role: "utilisatrice" | "anam" = "utilisatrice") {
  const { error } = await admin.from("entree_journal").insert({
    utilisatrice_id: id,
    role,
    contenu: "matière de test",
    cle_tour: `pause-${t}-${Math.random()}`,
    cree_le: new Date(Date.now() - ilYaMs).toISOString(),
  });
  if (error) throw new Error(`graver: ${error.message}`);
}

/** Un rythme franchement au-dessus du seuil : sept grappes bien séparées. */
async function graverRythmeIntense(id: string) {
  for (let j = 0; j < SEUIL_SEANCES + 2; j++) await graver(id, j * 6 * HEURE);
}

async function purger(id: string) {
  if (!id) return;
  await admin.from("pause_rythme").delete().eq("utilisatrice_id", id);
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

/** Lit les lignes de réservation en `service_role` — aucune session ne peut le faire (c'est le point). */
async function lignesDePause(id: string) {
  const { data } = await admin.from("pause_rythme").select("seances, minutes, propose_le").eq("utilisatrice_id", id);
  return data ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.4/D7] `pause_rythme` est DENY-BY-DEFAULT — personne ne peut se faire taire Anam", () => {
  const email = `pause-rls-${t}@exemple.test`;
  let id = "";
  let c: SupabaseClient;

  beforeAll(async () => {
    id = await creerUtilisatrice(email);
    await consentir(id);
    c = await session(email);
  });
  afterAll(async () => purger(id));

  it("[LE CŒUR] une session ne peut PAS INSÉRER de ligne — sinon on se ferait taire pour un mois", () => {
    // ⚠️ Doctrine cardinale du dépôt : `authenticated` détient le DML sur toute table de `public`.
    // Une garde qui ne vivrait que dans la RPC ne garderait donc rien. Le scénario n'est même pas
    // exotique : insérer une ligne fraîche fait croire à la fonction qu'Anam a déjà parlé.
    return c
      .from("pause_rythme")
      .insert({ utilisatrice_id: id, seances: 99, minutes: 999 })
      .then(({ error }) => {
        expect(error, "l'insertion a été acceptée sous une session utilisatrice").not.toBeNull();
      });
  });

  it("[LE CŒUR] une session ne peut PAS SUPPRIMER — sinon on ferait parler Anam à volonté", async () => {
    await admin.from("pause_rythme").insert({ utilisatrice_id: id, seances: 6, minutes: 10 });
    await c.from("pause_rythme").delete().eq("utilisatrice_id", id);
    // Une suppression bloquée par RLS ne remonte PAS d'erreur : elle ne touche simplement aucune
    // ligne. C'est la ligne survivante qui fait foi, jamais l'absence d'erreur.
    expect(await lignesDePause(id), "la ligne a été supprimée sous une session").toHaveLength(1);
    await admin.from("pause_rythme").delete().eq("utilisatrice_id", id);
  });

  it("une session ne LIT rien non plus — les deux compteurs de revue produit ne fuient pas", async () => {
    await admin.from("pause_rythme").insert({ utilisatrice_id: id, seances: 7, minutes: 120 });
    const { data } = await c.from("pause_rythme").select("seances, minutes");
    expect(data ?? [], "les compteurs sont lisibles depuis le client").toEqual([]);
    await admin.from("pause_rythme").delete().eq("utilisatrice_id", id);
  });
});

describe("[6.4/AC3] la réservation EST la décision — au plus une fois par fenêtre d'apaisement", () => {
  const email = `pause-res-${t}@exemple.test`;
  let id = "";
  let c: SupabaseClient;

  beforeAll(async () => {
    id = await creerUtilisatrice(email);
    await consentir(id);
    c = await session(email);
  });
  beforeEach(async () => {
    await admin.from("pause_rythme").delete().eq("utilisatrice_id", id);
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  });
  afterAll(async () => purger(id));

  const reserver = (cl: SupabaseClient, seances = 6, minutes = 30) =>
    cl.rpc("reserver_pause_rythme", {
      p_seances: seances,
      p_minutes: minutes,
      p_apaisement_jours: APAISEMENT_JOURS,
    });

  it("la première fois, Anam a la parole — et la ligne PORTE la mesure (AC5)", async () => {
    const { data, error } = await reserver(c, 7, 95);
    expect(error).toBeNull();
    expect(data).toBe(true);
    expect(await lignesDePause(id)).toMatchObject([{ seances: 7, minutes: 95 }]);
  });

  it("[LE CŒUR] la seconde fois, elle se TAIT", async () => {
    // ⚠️ Mutation-cible : retirer la comparaison à la fenêtre. Le seuil reste franchi tant que le
    // rythme dure, donc la phrase repartirait à CHAQUE ouverture de l'application — et ce serait la
    // plus pénible des répétitions, celle qui se répète parce qu'elle n'a pas obéi (FR-034).
    expect(await reserver(c).then((r) => r.data)).toBe(true);
    expect(await reserver(c).then((r) => r.data)).toBe(false);
    expect(await lignesDePause(id), "une seconde ligne a été écrite").toHaveLength(1);
  });

  it("[LE CŒUR] la fenêtre passée, elle reprend la parole — SANS condition de réarmement", async () => {
    // ⚠️ Contrairement à l'invitation d'intégration (4.10, D3), il n'y a AUCUN « et si quelque chose
    // a bougé ». Le seul mouvement observable serait qu'elle ait ralenti, c'est-à-dire que le
    // produit vérifie si elle a obéi. Le test le prouve : rien n'a changé de son côté, et pourtant
    // la parole revient.
    await admin
      .from("pause_rythme")
      .insert({ utilisatrice_id: id, seances: 6, minutes: 30, propose_le: new Date(Date.now() - (APAISEMENT_JOURS + 1) * JOUR).toISOString() });
    expect(await reserver(c).then((r) => r.data)).toBe(true);
    expect(await lignesDePause(id)).toHaveLength(2);
  });

  it("[LE CŒUR / AD-17] en détresse elle se tait, ET LE REFUS NE CONSOMME PAS LA FENÊTRE", async () => {
    // ⚠️ MUTATION-CIBLE LA PLUS INSTRUCTIVE DE CETTE STORY : déplacer la garde de détresse APRÈS
    // l'`insert`. Le refus resterait « correct » — Anam se tait bien pendant l'épisode — mais la
    // ligne serait écrite, donc la fenêtre consommée : l'épisode ne DIFFÉRERAIT plus la pause, il la
    // SUPPRIMERAIT pour un mois. Un test qui ne vérifie que le `false` ne voit pas la différence.
    await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: 2 });

    expect(await reserver(c).then((r) => r.data), "Anam a parlé pendant un épisode").toBe(false);
    expect(await lignesDePause(id), "le refus a consommé la fenêtre").toHaveLength(0);

    // L'épisode se referme (fin + fenêtre 72 h déjà expirée) : la parole revient intacte.
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
    expect(await reserver(c).then((r) => r.data)).toBe(true);
  });

  it("sans session, la fonction est AVEUGLE — elle ne réserve pour personne", async () => {
    const anonyme = clientScope();
    const { data, error } = await reserver(anonyme);
    // `auth.uid()` est nul : la fonction rend `false` sans rien écrire. Aucune ligne ne peut donc
    // naître d'un appel non authentifié, quel que soit l'argument passé.
    expect(error === null ? data : false).toBe(false);
    expect(await lignesDePause(id)).toHaveLength(0);
  });

  it("des arguments absurdes LÈVENT plutôt que de s'écrire", async () => {
    // Une contre-métrique qui accepte n'importe quoi ne mesure plus rien : la ligne sert la revue
    // produit, elle doit rester vraie.
    expect((await reserver(c, -1, 30)).error, "des séances négatives sont passées").not.toBeNull();
    expect(
      (await c.rpc("reserver_pause_rythme", { p_seances: 6, p_minutes: 30, p_apaisement_jours: 0 })).error,
      "une fenêtre nulle est passée",
    ).not.toBeNull();
    expect(await lignesDePause(id)).toHaveLength(0);
  });
});

describe("[6.4/D1] la mesure ne regarde QUE ce que l'utilisatrice a écrit", () => {
  const emailA = `pause-a-${t}@exemple.test`;
  const emailB = `pause-b-${t}@exemple.test`;
  let idA = "";
  let idB = "";
  let cA: SupabaseClient;
  let cB: SupabaseClient;

  beforeAll(async () => {
    idA = await creerUtilisatrice(emailA);
    idB = await creerUtilisatrice(emailB);
    for (const id of [idA, idB]) await consentir(id);
    cA = await session(emailA);
    cB = await session(emailB);
  });
  afterAll(async () => {
    await purger(idA);
    await purger(idB);
  });
  beforeEach(async () => {
    for (const id of [idA, idB]) await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  });

  it("[CONTRÔLE NÉGATIF] un compte sans rien mesure zéro et zéro", async () => {
    expect(await creerDepotRythme(cA).mesurer()).toEqual({ seances: 0, minutes: 0 });
  });

  it("[LE CŒUR] les tours d'ANAM ne font pas de rythme", async () => {
    // ⚠️ Mutation-cible : retirer le `.eq("role", "utilisatrice")`. Anam répond à chaque message,
    // donc le compte de tours DOUBLERAIT — et comme ses réponses arrivent dans la même minute, elles
    // n'ouvriraient pas de séances mais gonfleraient les grappes. Le seuil des minutes deviendrait
    // franchissable par un rythme qui ne l'a pas franchi.
    for (let j = 0; j < 4; j++) await graver(idA, j * 6 * HEURE, "anam");
    expect(await creerDepotRythme(cA).mesurer()).toEqual({ seances: 0, minutes: 0 });
  });

  it("[LE CŒUR] B ne voit RIEN du rythme de A", async () => {
    await graverRythmeIntense(idA);
    expect((await creerDepotRythme(cB).mesurer()).seances, "B a vu le rythme de A").toBe(0);
    // …et le contrôle positif, sans lequel le refus ci-dessus serait vrai sur une base vide.
    expect((await creerDepotRythme(cA).mesurer()).seances).toBeGreaterThan(SEUIL_SEANCES);
  });

  it("[LE CŒUR] la FENÊTRE EXACTE est décidée par le domaine, pas par la requête", async () => {
    // ⚠️ La requête remonte huit jours, le domaine en garde sept. Un tour posé ENTRE LES DEUX est
    // donc lu par la base et écarté par le domaine — c'est la seule façon de prouver que la borne
    // vit à un seul endroit. Si les deux filtres étaient identiques, le mutant de l'un survivrait
    // grâce à l'autre, et cette story livrerait une garde qui ne garde rien.
    expect(RYTHME_MARGE_JOURS).toBeGreaterThan(FENETRE_JOURS);
    await graver(idA, (FENETRE_JOURS + 0.5) * JOUR);
    expect(await creerDepotRythme(cA).mesurer()).toEqual({ seances: 0, minutes: 0 });

    // Contrôle positif : le même tour, à six jours, compte bien.
    await graver(idA, 6 * JOUR);
    expect((await creerDepotRythme(cA).mesurer()).seances).toBe(1);
  });

  it("le dépôt refuse de réserver sur une mesure NON franchie — la journalisation reste vraie", async () => {
    // La ligne de `pause_rythme` sert la revue produit : une ligne écrite alors qu'aucune parole
    // n'a été dite fausserait la contre-métrique qu'elle est censée alimenter.
    const reserve = await creerDepotRythme(cA).reserver({ seances: 1, minutes: 2 });
    expect(reserve).toBe(false);
    expect(await lignesDePause(idA)).toHaveLength(0);
  });

  it("le chemin COMPLET : un rythme intense obtient la parole, une fois", async () => {
    await graverRythmeIntense(idA);
    const depot = creerDepotRythme(cA);
    const mesure = await depot.mesurer();
    expect(await depot.reserver(mesure)).toBe(true);
    expect(await depot.reserver(mesure), "elle a parlé deux fois").toBe(false);
    expect(await lignesDePause(idA)).toMatchObject([{ seances: mesure.seances }]);
    await admin.from("pause_rythme").delete().eq("utilisatrice_id", idA);
  });
});
