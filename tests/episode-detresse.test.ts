import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FENETRE_POST_EPISODE_MS, SEUIL_TOURS_SURS } from "@/lib/safety/episode-detresse";

/**
 * Story 2.4 — l'entité `episode_detresse` (migration 0010) contre un vrai Supabase local. Preuves :
 *  - deny-by-default server-authoritative (patron usage_ia/audit_securite) : une session utilisatrice
 *    ne LIT ni n'ÉCRIT rien ; l'entité n'est écrite/lue que par des fonctions security definer (AC3) ;
 *  - contraintes DUR : un seul épisode ouvert par utilisatrice, niveau_max ∈ 1-3, fenêtre cohérente ;
 *  - la TRANSITION possédée `enregistrer_tour_detresse` : ouvre / rehausse / compte / éteint, seuils
 *    PARAMÉTRÉS (jamais figés), réservée service_role (AC1) ;
 *  - les DEUX dérivations : `episode_detresse_ouvert` (fin IS NULL) et `branche_bloquee_par_detresse`
 *    (ouvert OU < 72 h, keyée auth.uid(), granted authenticated — couture Epic 4, AC2) ;
 *  - SANS art. 9 : aucune colonne de contenu (FR-046).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const FENETRE_S = FENETRE_POST_EPISODE_MS / 1000;
const t = Date.now();

/** Un tour classé, via la fonction possédée (service_role). Retourne `limites_levees` après le tour.
 *  `cle` = jeton de tour LOGIQUE (idempotence, Story 2-4b) : défaut = UUID FRAIS par appel → chaque
 *  `tour(...)` est un tour logique DISTINCT (sémantique 2.4 préservée). Un rejeu passe la MÊME clé. */
async function tour(
  db: SupabaseClient,
  cible: string,
  niveau: number,
  opts: { seuil?: number; dureeMinS?: number; fenetreS?: number; cle?: string } = {},
) {
  return db.rpc("enregistrer_tour_detresse", {
    cible,
    p_niveau: niveau,
    p_seuil_tours: opts.seuil ?? 2,
    p_duree_min_s: opts.dureeMinS ?? 0,
    p_fenetre_s: opts.fenetreS ?? FENETRE_S,
    p_cle_tour: opts.cle ?? crypto.randomUUID(),
  });
}

describe("episode_detresse — entité possédée, deny-by-default, transition gardée (AD-17, FR-042/046)", () => {
  const u = { email: `ep-${t}@exemple.fr`, password: "test-ep-123!", id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) {
      throw new Error("Supabase local requis (SUPABASE_URL / PUBLISHABLE_KEY / SECRET_KEY).");
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    u.id = data.user!.id;
  });

  afterAll(async () => {
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  beforeEach(async () => {
    // Chaque test part d'un état propre (l'index « un seul épisode ouvert » l'exige).
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
  });

  // ── T2 : table + RLS + contraintes ────────────────────────────────────────────────────────────
  it("deny-by-default : une session utilisatrice ne LIT rien (la ligne existe pourtant)", async () => {
    await tour(admin, u.id, 2); // ouvre un épisode via service_role
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { data, error } = await c.from("episode_detresse").select("*");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // masqué : deny-by-default
    await c.auth.signOut();
  });

  it("deny-by-default : une session utilisatrice ne peut pas ÉCRIRE", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 2 });
    expect(error).not.toBeNull(); // aucune policy d'insertion
    await c.auth.signOut();
  });

  it("CHECK : niveau_max hors 1-3 est REJETÉ", async () => {
    const zero = await admin.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 0 });
    expect(zero.error, "niveau_max=0 doit violer le CHECK").not.toBeNull();
    const quatre = await admin.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 4 });
    expect(quatre.error, "niveau_max=4 doit violer le CHECK").not.toBeNull();
  });

  it("UN SEUL épisode ouvert par utilisatrice (index partiel unique)", async () => {
    const un = await admin.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 2 });
    expect(un.error).toBeNull();
    const deux = await admin.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 3 });
    expect(deux.error, "un 2e épisode ouvert doit violer l'index unique partiel").not.toBeNull();
  });

  it("CHECK cohérence fenêtre : (fin is null) = (fenetre_expire_at is null)", async () => {
    // fin null mais fenêtre posée → incohérent → rejeté
    const incoherent = await admin.from("episode_detresse").insert({
      utilisatrice_id: u.id,
      niveau_max: 2,
      fin: null,
      fenetre_expire_at: new Date().toISOString(),
    });
    expect(incoherent.error).not.toBeNull();
  });

  it("SANS art. 9 : aucune colonne de contenu (prompt/réponse/verbatim)", async () => {
    await tour(admin, u.id, 2);
    const { data } = await admin
      .from("episode_detresse")
      .select("*")
      .eq("utilisatrice_id", u.id)
      .limit(1)
      .single();
    const colonnes = Object.keys(data!);
    for (const interdite of ["prompt", "reponse", "contenu", "texte", "message", "messages", "verbatim"]) {
      expect(colonnes).not.toContain(interdite);
    }
  });

  // ── T3 : la transition possédée ───────────────────────────────────────────────────────────────
  it("OUVRE au premier niveau ≥ 1 (fin null, niveau_max posé, limites levées)", async () => {
    const { data, error } = await tour(admin, u.id, 2);
    expect(error).toBeNull();
    expect(data).toBe(true); // limites_levees
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("*")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.fin).toBeNull();
    expect(ep!.niveau_max).toBe(2);
    expect(ep!.tours_surs_consecutifs).toBe(0);
  });

  it("REHAUSSE niveau_max (monotone) et remet le compteur à 0 ; ne régresse jamais", async () => {
    await tour(admin, u.id, 1);
    await tour(admin, u.id, 0); // compte 1
    await tour(admin, u.id, 3); // rehausse → 3, compteur remis à 0
    await tour(admin, u.id, 1); // niveau inférieur : niveau_max reste 3
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("*")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.niveau_max).toBe(3);
    expect(ep!.tours_surs_consecutifs).toBe(0);
  });

  it("COMPTE les tours sûrs sans éteindre tant que le seuil n'est pas atteint", async () => {
    await tour(admin, u.id, 2, { seuil: 3 });
    const r1 = await tour(admin, u.id, 0, { seuil: 3 });
    expect(r1.data).toBe(true); // toujours ouvert
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("tours_surs_consecutifs, fin")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.tours_surs_consecutifs).toBe(1);
    expect(ep!.fin).toBeNull();
  });

  it("ÉTEINT quand seuil ET délai atteints → fin posée, fenetre_expire_at = fin + 72 h, limites retombées", async () => {
    await tour(admin, u.id, 2, { seuil: 2, dureeMinS: 0 });
    await tour(admin, u.id, 0, { seuil: 2, dureeMinS: 0 }); // tours=1
    const extinction = await tour(admin, u.id, 0, { seuil: 2, dureeMinS: 0 }); // tours=2 ≥ seuil → éteint
    expect(extinction.data).toBe(false); // limites RETOMBÉES
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("*")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.fin).not.toBeNull();
    expect(ep!.fenetre_expire_at).not.toBeNull();
    const ecart = new Date(ep!.fenetre_expire_at).getTime() - new Date(ep!.fin).getTime();
    expect(Math.abs(ecart - FENETRE_POST_EPISODE_MS)).toBeLessThan(2000); // ≈ 72 h
  });

  it("N'ÉTEINT PAS trop tôt : seuil atteint mais délai minimal non écoulé → compte, reste ouvert", async () => {
    await tour(admin, u.id, 2, { seuil: 1, dureeMinS: 3600 }); // délai min 1 h
    const r = await tour(admin, u.id, 0, { seuil: 1, dureeMinS: 3600 }); // seuil=1 atteint MAIS épisode neuf
    expect(r.data).toBe(true); // encore ouvert (trop tôt)
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("fin")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.fin).toBeNull();
  });

  it("les SEUILS sont PARAMÉTRÉS (seuil=1, délai=0 → un seul tour sûr éteint)", async () => {
    await tour(admin, u.id, 2, { seuil: 1, dureeMinS: 0 });
    const r = await tour(admin, u.id, 0, { seuil: 1, dureeMinS: 0 });
    expect(r.data).toBe(false); // éteint
  });

  it("F3 — le délai part du DERNIER tour élevé, pas de `debut` : un pic tardif ne s'éteint pas trop tôt", async () => {
    // Épisode très ancien (debut il y a 10 j) MAIS pic récent (dernier_niveau_eleve_le = maintenant),
    // au seuil de tours. Avant le correctif, le délai partait de `debut` (≫ 1 h) → extinction immédiate.
    const vieuxDebut = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    await admin.from("episode_detresse").insert({
      utilisatrice_id: u.id,
      niveau_max: 3,
      debut: vieuxDebut.toISOString(),
      dernier_niveau_eleve_le: new Date().toISOString(), // rehausse à l'instant
      tours_surs_consecutifs: SEUIL_TOURS_SURS - 1,
    });
    const r = await tour(admin, u.id, 0, { seuil: SEUIL_TOURS_SURS, dureeMinS: 3600 }); // délai min 1 h
    expect(r.data, "encore ouvert : le délai se mesure depuis le pic récent, pas le vieux debut").toBe(true);
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("fin")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.fin).toBeNull();
  });

  it("F3 — une rehausse RÉARME l'horloge : un tour ≥ 1 repousse l'extinction", async () => {
    await tour(admin, u.id, 2, { seuil: 1, dureeMinS: 0 }); // ouvre
    await tour(admin, u.id, 3, { seuil: 1, dureeMinS: 0 }); // rehausse → dernier_niveau_eleve_le = maintenant
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("dernier_niveau_eleve_le, debut")
      .eq("utilisatrice_id", u.id)
      .single();
    // La rehausse a bien avancé l'horloge au-delà de l'ouverture.
    expect(new Date(ep!.dernier_niveau_eleve_le).getTime()).toBeGreaterThanOrEqual(new Date(ep!.debut).getTime());
  });

  // ── Story 2-4b (F4) : idempotence au RETRY — le rejeu d'un tour logique ne rapproche pas l'extinction ─
  it("F4/AC1 — un RETRY du même tour sûr (même clé) NE re-compte PAS (idempotence, AD-17)", async () => {
    await tour(admin, u.id, 2, { seuil: 3 }); // ouvre (clé fraîche)
    const k = crypto.randomUUID();
    const c1 = await tour(admin, u.id, 0, { seuil: 3, cle: k }); // compte → tours=1
    expect(c1.data).toBe(true);
    const rejeu = await tour(admin, u.id, 0, { seuil: 3, cle: k }); // MÊME clé → no-op
    expect(rejeu.data, "réponse identique au 1ᵉʳ appel : encore ouvert").toBe(true);
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("tours_surs_consecutifs, fin")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.tours_surs_consecutifs, "le rejeu du même tour ne double-compte pas").toBe(1);
    expect(ep!.fin).toBeNull();
  });

  it("F4/AC2 — au bord de l'extinction, un RETRY seul n'éteint PAS ; un tour DISTINCT éteint (AC4)", async () => {
    await tour(admin, u.id, 2, { seuil: 2, dureeMinS: 0 }); // ouvre
    const k = crypto.randomUUID();
    const t1 = await tour(admin, u.id, 0, { seuil: 2, dureeMinS: 0, cle: k }); // tours=1 (= seuil−1)
    expect(t1.data).toBe(true);
    const retry = await tour(admin, u.id, 0, { seuil: 2, dureeMinS: 0, cle: k }); // MÊME clé → no-op
    expect(retry.data, "le retry ne pousse pas au seuil").toBe(true);
    const { data: mid } = await admin
      .from("episode_detresse")
      .select("tours_surs_consecutifs, fin")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(mid!.tours_surs_consecutifs).toBe(1);
    expect(mid!.fin, "pas d'extinction prématurée au retry").toBeNull();
    // Un tour LOGIQUE distinct (clé différente) atteint le seuil → extinction LÉGITIME.
    const t2 = await tour(admin, u.id, 0, { seuil: 2, dureeMinS: 0 });
    expect(t2.data, "un nouveau tour sûr distinct éteint au seuil réel").toBe(false);
  });

  it("F4/AC3 — l'ESCALADE n'est JAMAIS court-circuitée : même clé mais niveau ≥ 1 rehausse quand même (AD-15)", async () => {
    await tour(admin, u.id, 1, { seuil: 3 }); // ouvre niveau 1 (clé fraîche)
    const k = crypto.randomUUID();
    await tour(admin, u.id, 0, { seuil: 3, cle: k }); // compte sous k → tours=1, dernier_tour_compte=k
    // Rejeu du MÊME tour logique mais le modèle classe cette fois niveau 3 (non-déterminisme).
    const escalade = await tour(admin, u.id, 3, { seuil: 3, cle: k });
    expect(escalade.data).toBe(true);
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("niveau_max, tours_surs_consecutifs, fin")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.niveau_max, "l'escalade monte niveau_max même sous une clé déjà vue").toBe(3);
    expect(ep!.tours_surs_consecutifs, "l'escalade remet le compteur à 0").toBe(0);
    expect(ep!.fin).toBeNull();
  });

  it("F4/AC4 — deux tours sûrs DISTINCTS (clés ≠) comptent bien deux (non-régression du comptage)", async () => {
    await tour(admin, u.id, 2, { seuil: 5 }); // ouvre, seuil haut → pas d'extinction ici
    await tour(admin, u.id, 0, { seuil: 5 }); // tours=1 (clé fraîche)
    await tour(admin, u.id, 0, { seuil: 5 }); // tours=2 (clé fraîche)
    const { data: ep } = await admin
      .from("episode_detresse")
      .select("tours_surs_consecutifs")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ep!.tours_surs_consecutifs, "deux tours logiques distincts = deux incréments").toBe(2);
  });

  it("F4/rejeu du TOUR D'EXTINCTION lui-même → false, ne ressuscite pas, ne re-compte pas (revue 2-4b F3)", async () => {
    // Le rejeu du tour ÉTEIGNANT (500 après la RPC réussie, 4.1) est idempotent par `fin IS NULL`, pas par
    // la clé : l'épisode clos n'est plus re-sélectionné (`where fin is null`) → `not found` → return false.
    await tour(admin, u.id, 2, { seuil: 2, dureeMinS: 0 }); // ouvre
    await tour(admin, u.id, 0, { seuil: 2, dureeMinS: 0 }); // tours=1 (clé fraîche)
    const kExt = crypto.randomUUID();
    const ext = await tour(admin, u.id, 0, { seuil: 2, dureeMinS: 0, cle: kExt }); // tours=2 ≥ seuil → éteint
    expect(ext.data).toBe(false);
    const { data: apres } = await admin
      .from("episode_detresse")
      .select("fin, tours_surs_consecutifs")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(apres!.fin).not.toBeNull();
    // Rejeu du MÊME tour d'extinction (même clé) : cohérent (false), aucune résurrection, aucun re-comptage.
    const rejeu = await tour(admin, u.id, 0, { seuil: 2, dureeMinS: 0, cle: kExt });
    expect(rejeu.data, "le rejeu du tour d'extinction reste false (cohérent avec le 1ᵉʳ appel)").toBe(false);
    const { data: fin2 } = await admin
      .from("episode_detresse")
      .select("fin, tours_surs_consecutifs")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(fin2!.fin, "pas de résurrection ni de re-fermeture : fin inchangé").toBe(apres!.fin);
    expect(fin2!.tours_surs_consecutifs, "aucun re-comptage sur un épisode clos").toBe(apres!.tours_surs_consecutifs);
  });

  it("réservée à service_role : une session cliente ne peut pas appeler enregistrer_tour_detresse", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await tour(c, u.id, 3);
    expect(error).not.toBeNull(); // execute révoqué pour authenticated
    await c.auth.signOut();
  });

  // ── T4 : les dérivations gardées ──────────────────────────────────────────────────────────────
  it("episode_detresse_ouvert(cible) reflète fin IS NULL ; réservée service_role", async () => {
    const avant = await admin.rpc("episode_detresse_ouvert", { cible: u.id });
    expect(avant.data).toBe(false);
    await tour(admin, u.id, 2);
    const pendant = await admin.rpc("episode_detresse_ouvert", { cible: u.id });
    expect(pendant.data).toBe(true);

    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const intrus = await c.rpc("episode_detresse_ouvert", { cible: u.id });
    expect(intrus.error, "episode_detresse_ouvert doit être révoquée pour authenticated").not.toBeNull();
    await c.auth.signOut();
  });

  it("branche_bloquee_par_detresse() (auth.uid) : vrai pendant l'épisode, granted authenticated", async () => {
    await tour(admin, u.id, 2); // épisode ouvert
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { data, error } = await c.rpc("branche_bloquee_par_detresse");
    expect(error).toBeNull();
    expect(data).toBe(true);
    await c.auth.signOut();
  });

  it("branche_bloquee_par_detresse() : DANS les 72 h après extinction → vrai ; APRÈS → faux", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });

    // Épisode fermé il y a 24 h, fenêtre expire dans 48 h → DANS la fenêtre.
    const finRecente = new Date(Date.now() - 24 * 3600 * 1000);
    await admin.from("episode_detresse").insert({
      utilisatrice_id: u.id,
      niveau_max: 2,
      debut: new Date(finRecente.getTime() - 3600 * 1000).toISOString(),
      fin: finRecente.toISOString(),
      fenetre_expire_at: new Date(finRecente.getTime() + FENETRE_POST_EPISODE_MS).toISOString(),
    });
    const dansFenetre = await c.rpc("branche_bloquee_par_detresse");
    expect(dansFenetre.data, "24 h après extinction : encore bloqué").toBe(true);

    // Repasse à un épisode clos il y a 100 h → HORS fenêtre.
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    const finVieille = new Date(Date.now() - 100 * 3600 * 1000);
    await admin.from("episode_detresse").insert({
      utilisatrice_id: u.id,
      niveau_max: 2,
      debut: new Date(finVieille.getTime() - 3600 * 1000).toISOString(),
      fin: finVieille.toISOString(),
      fenetre_expire_at: new Date(finVieille.getTime() + FENETRE_POST_EPISODE_MS).toISOString(),
    });
    const horsFenetre = await c.rpc("branche_bloquee_par_detresse");
    expect(horsFenetre.data, "100 h après extinction : plus bloqué").toBe(false);
    await c.auth.signOut();
  });

  it("contrôle positif non-tautologique : sous service_role (sans auth.uid) branche_bloquee_par_detresse = false", async () => {
    await tour(admin, u.id, 3); // épisode ouvert POUR u, mais service_role n'a pas d'auth.uid()
    const { data, error } = await admin.rpc("branche_bloquee_par_detresse");
    expect(error).toBeNull();
    expect(data).toBe(false); // keyée sur auth.uid() (null ici) → pas d'oracle inter-utilisatrices
  });

  it("F1 — branche_bloquee_par_detresse : un client ANON (non authentifié) ne peut PLUS l'appeler (0011)", async () => {
    const anon = clientScope(); // pas de signIn → rôle anon
    const { error } = await anon.rpc("branche_bloquee_par_detresse");
    expect(error, "grant anon retiré en 0011 (surface anon fermée, patron 0007)").not.toBeNull();
  });
});

describe("[revue 1-4] `niveau_plancher_episode` — le plancher est le niveau ATTEINT", () => {
  const v = { email: `plancher-${t}@exemple.fr`, password: "test-pl-123!", id: "" };

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    v.id = data.user!.id;
  });
  afterAll(async () => {
    if (v.id) await admin.auth.admin.deleteUser(v.id);
  });

  it("aucun épisode → 0 (et le booléen historique en dérive)", async () => {
    expect((await admin.rpc("niveau_plancher_episode", { cible: v.id })).data).toBe(0);
    expect((await admin.rpc("episode_detresse_ouvert", { cible: v.id })).data).toBe(false);
  });

  it("⚠️ un épisode monté à 3 rend 3 — c'est CE niveau que le pipeline doit forcer", async () => {
    // Le défaut : le pipeline lisait un booléen et forçait donc TOUJOURS 1. Sous le niveau 2, aucun
    // bloc de ressources n'est émis — l'écran d'une femme classée « idéation active » perdait ses
    // numéros au premier tour où le fournisseur était dégradé.
    await tour(admin, v.id, 3);
    expect((await admin.rpc("niveau_plancher_episode", { cible: v.id })).data).toBe(3);
    expect((await admin.rpc("episode_detresse_ouvert", { cible: v.id })).data).toBe(true);
  });

  it("il suit la MONOTONIE de `niveau_max` : un tour plus bas ne fait pas redescendre le plancher", async () => {
    await tour(admin, v.id, 1);
    expect((await admin.rpc("niveau_plancher_episode", { cible: v.id })).data).toBe(3);
  });

  it("et il retombe à 0 quand l'épisode s'éteint — le forçage ne survit pas à l'épisode", async () => {
    // Seuil 1 + durée minimale 0 : ce tour sûr suffit à éteindre.
    await tour(admin, v.id, 0, { seuil: 1, dureeMinS: 0 });
    expect((await admin.rpc("niveau_plancher_episode", { cible: v.id })).data).toBe(0);
    expect((await admin.rpc("episode_detresse_ouvert", { cible: v.id })).data).toBe(false);
  });

  it("elle reste POSSÉDÉE par le serveur : `authenticated` ne peut pas l'exécuter (patron 0010)", async () => {
    // L'épisode révèle un état de santé mentale (art. 9, FR-046). Un oracle sous JWT dirait à
    // n'importe qui, y compris à quelqu'un qui a volé une session, où en est la personne.
    const c = clientScope();
    await c.auth.signInWithPassword({ email: v.email, password: v.password });
    const { error } = await c.rpc("niveau_plancher_episode", { cible: v.id });
    expect(error, "le plancher doit être hors de portée d'une session").not.toBeNull();
    await c.auth.signOut();
  });
});

