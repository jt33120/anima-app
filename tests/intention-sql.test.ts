import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 4.10 (T1) — LA GARANTIE D'ÉCRITURE du plan d'étapes et de l'arbitrage, prouvée contre un vrai
 * Supabase local.
 *
 * ⚠️ LE PIÈGE DE LA DÉFENSE EN PROFONDEUR (mémoire `gardes-doivent-tuer-leur-mutant`) : quand deux gardes
 * couvrent le même invariant, un test qui passe par le chemin où les DEUX s'appliquent ne peut isoler ni
 * l'une ni l'autre. Deux chemins sont donc utilisés délibérément :
 *   • `service_role` — la RLS ne s'y applique pas : SEULS les CHECK de table peuvent refuser. C'est là
 *     qu'on éprouve la FORME (« si X, alors Y » non vides) et le RATTACHEMENT (FK composite).
 *   • une SESSION JWT avec `.from("intention").insert()` DIRECT, jamais la RPC : c'est le chemin qu'un
 *     appelant malveillant emprunterait, et le seul où le WITH CHECK de la policy joue seul. Tester le
 *     premium via la RPC ne prouverait rien — `authenticated` a le grant INSERT table-level (leçon R1).
 *
 * CONTRÔLES POSITIFS PARTOUT : sans eux, une fonction qui refuse TOUJOURS satisferait la moitié de ce
 * fichier. Un canal muet est tout aussi cassé qu'un canal ouvert, et bien plus discret.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-intention-123!";

// ── Fabriques ────────────────────────────────────────────────────────────────────────────────────────

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

/**
 * Pose l'état de consentement voulu. DÉTRUIT puis RÉ-INSÈRE, jamais un `upsert`.
 *
 * Depuis 0041 (revue du 2026-08-11, trouvaille S2), la révocation art. 9 est TERMINALE en base —
 * `service_role` compris. Ce helper faisait auparavant l'aller-retour révoqué → valide, ce qui ne
 * marchait que parce que N'IMPORTE QUELLE utilisatrice pouvait le faire par un `PATCH` direct.
 */
async function consentir(id: string, options: { revoque?: boolean } = {}) {
  const { error: eSuppression } = await admin.from("consentement").delete().eq("utilisatrice_id", id);
  if (eSuppression) throw new Error(`consentir (suppression) : ${eSuppression.message}`);
  const { error } = await admin.from("consentement").insert({
    utilisatrice_id: id,
    art9_accorde: true,
    ia_reconnue: true,
    cgu_acceptees: true,
    revoked_at: options.revoque ? new Date().toISOString() : null,
  });
  if (error) throw new Error(`consentir: ${error.message}`);
}

async function abonner(id: string, etat = "actif") {
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

async function creerBranche(id: string, marqueur: string, dateNaissance?: string): Promise<string> {
  const e = await graverEntree(id, `int-${marqueur}-${t}-${Math.random()}`);
  const ligne: Record<string, unknown> = { utilisatrice_id: id, extrait_source_id: e, nom: `branche ${marqueur}` };
  if (dateNaissance) ligne.date_naissance = dateNaissance;
  const { data, error } = await admin.from("branche").insert(ligne).select("id").single();
  if (error) throw new Error(`creerBranche: ${error.message}`);
  return data!.id as string;
}

async function ouvrirEpisode(id: string) {
  const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: 2 });
  if (error) throw new Error(`ouvrirEpisode: ${error.message}`);
}

async function fermerEpisodes(id: string) {
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
}

/** Le jour civil Europe/Paris, comme la base le calcule — jamais `new Date().toISOString().slice(0,10)`. */
function jourParis(decalageJours = 0): string {
  const d = new Date(Date.now() + decalageJours * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

async function purger(id: string) {
  if (!id) return;
  await admin.from("intention").delete().eq("utilisatrice_id", id);
  await admin.from("invitation_integration").delete().eq("utilisatrice_id", id);
  await admin.from("notification_envoyee").delete().eq("utilisatrice_id", id);
  await admin.from("synthese").delete().eq("utilisatrice_id", id);
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.from("abonnement").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [AC1 DUR] LA FORME EST STRUCTURELLE — deux colonnes non vides, et ça mord aussi `service_role`
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC1 DUR] « si X, alors Y » est garanti par la FORME DES DONNÉES, pas par un prompt", () => {
  const u = { email: `int-forme-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "forme");
  });
  afterAll(async () => purger(u.id));

  it("[LE CŒUR] un `si` vide ou fait d'invisibles est REFUSÉ, même en service_role", async () => {
    // Mutation-cible : retirer `intention_declencheur_donne`. C'est la moitié de la forme : sans elle,
    // une « intention » réduite à un « alors » est stockable — et « alors, fais X » sans déclencheur
    // n'est plus une intention d'implémentation, c'est une consigne. La décision D1 (elle écrit, pas
    // Anam) ne tient que si la base refuse la moitié manquante.
    for (const vide of ["", "   ", " ​", "\t\n"]) {
      const { error } = await admin.from("intention").insert({
        utilisatrice_id: u.id,
        branche_id: u.branche,
        declencheur: vide,
        action: "je respire trois fois",
      });
      expect(error, `déclencheur ${JSON.stringify(vide)} doit être refusé`).not.toBeNull();
    }
  });

  it("un `alors` vide ou fait d'invisibles est REFUSÉ aussi", async () => {
    // Mutation-cible : retirer `intention_action_donnee`. L'autre moitié — un « si » sans « alors »
    // est une observation, pas une étape.
    for (const vide of ["", "   ", " ", "﻿"]) {
      const { error } = await admin.from("intention").insert({
        utilisatrice_id: u.id,
        branche_id: u.branche,
        declencheur: "si je sens la boule au ventre",
        action: vide,
      });
      expect(error, `action ${JSON.stringify(vide)} doit être refusée`).not.toBeNull();
    }
  });

  it("[CONTRÔLE POSITIF] une intention complète PASSE — sans quoi les deux tests ci-dessus seraient satisfaits par « tout est refusé »", async () => {
    const { error } = await admin.from("intention").insert({
      utilisatrice_id: u.id,
      branche_id: u.branche,
      declencheur: "si je sens la boule au ventre",
      action: "je respire trois fois avant de répondre",
    });
    expect(error).toBeNull();
  });

  it("les deux moitiés sont BORNÉES en longueur (un collage de 2 Mo n'entre pas en base)", async () => {
    // Mutation-cible : retirer l'une des deux bornes `<= 300`.
    for (const champ of ["declencheur", "action"] as const) {
      const ligne = {
        utilisatrice_id: u.id,
        branche_id: u.branche,
        declencheur: "si",
        action: "alors",
        [champ]: "x".repeat(301),
      };
      const { error } = await admin.from("intention").insert(ligne);
      expect(error, `${champ} au-delà de 300 doit être refusé`).not.toBeNull();
    }
  });

  it("`texte_significatif` et `branche_nom_significatif` sont LA MÊME règle (une seule regex dans le dépôt)", async () => {
    // La duplication d'un invariant est le piège des défenses redondantes : deux regex divergeraient un
    // jour, et l'app validerait ce que la base refuse (ou l'inverse). 0036 extrait la règle ; l'ancien
    // nom la délègue. Mutation-cible : réécrire le corps de `branche_nom_significatif` avec sa propre
    // copie de la classe — ce test ne rougirait pas, mais le suivant si.
    const { data, error } = await admin.rpc("texte_significatif", { p_texte: " ​" });
    expect(error).toBeNull();
    expect(data, "un texte fait uniquement d'invisibles n'est pas significatif").toBe(false);
    const { data: nom } = await admin.rpc("branche_nom_significatif", { p_nom: " ​" });
    expect(nom, "et le nom de branche dit exactement la même chose").toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [AC1] LE RATTACHEMENT — jamais une étape flottante, jamais la branche d'autrui
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC1] une étape est rattachée à UNE branche, et à une branche à elle", () => {
  const u = { email: `int-lien-${t}@exemple.fr`, id: "", branche: "" };
  const autre = { email: `int-lien-autre-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    autre.id = await creerUtilisatrice(autre.email);
    u.branche = await creerBranche(u.id, "lien");
    autre.branche = await creerBranche(autre.id, "lien-autre");
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(autre.id);
  });

  it("une étape SANS branche n'existe pas (`branche_id` NOT NULL)", async () => {
    const { error } = await admin
      .from("intention")
      .insert({ utilisatrice_id: u.id, branche_id: null, declencheur: "si", action: "alors" });
    expect(error, "une étape flottante n'a aucun sens : elle ne se rattache à aucune prise de conscience").not.toBeNull();
  });

  it("[LE CŒUR] rattacher son étape à la branche d'AUTRUI est refusé, même en service_role", async () => {
    // Mutation-cible : remplacer la FK COMPOSITE par une FK simple sur `branche(id)`. La RLS ne joue
    // pas ici (service_role), donc c'est la seule chose qui refuse — et c'est ce qui rend l'invariant
    // vrai contre le futur écrivain de l'Epic 6, pas seulement contre une session.
    const { error } = await admin.from("intention").insert({
      utilisatrice_id: u.id,
      branche_id: autre.branche,
      declencheur: "si",
      action: "alors",
    });
    expect(error).not.toBeNull();
  });

  it("effacer la branche efface son plan (cascade) — un plan orphelin n'a aucun sens", async () => {
    const b = await creerBranche(u.id, "cascade");
    await admin.from("intention").insert({ utilisatrice_id: u.id, branche_id: b, declencheur: "si", action: "alors" });
    await admin.from("branche").delete().eq("id", b);
    const { data } = await admin.from("intention").select("id").eq("branche_id", b);
    expect(data ?? [], "le plan part avec la branche").toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [AC6 / FR-081] LE WRITE-GATE PREMIUM — dans le WITH CHECK, jamais dans la seule RPC
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC6 / FR-081] les plans d'étapes sont premium, et la garde vit au POINT D'ÉCRITURE", () => {
  const u = { email: `int-prem-${t}@exemple.fr`, id: "", branche: "" };
  let s: SupabaseClient;

  /** L'écriture DIRECTE — jamais la RPC. C'est le chemin qui saute toute garde applicative. */
  async function insererDirect(): Promise<string | null> {
    const { error } = await s.from("intention").insert({
      utilisatrice_id: u.id,
      branche_id: u.branche,
      declencheur: "si je remets à demain",
      action: "je pose la première minute tout de suite",
    });
    return error?.message ?? null;
  }

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "prem");
    await consentir(u.id);
    s = await session(u.email);
  });
  afterAll(async () => purger(u.id));

  it("[LE CŒUR] un compte GRATUIT ne peut pas écrire une intention, même en visant la table en direct", async () => {
    // Mutation-cible : retirer `public.est_premium_courante()` du WITH CHECK d'`intention_insertion`.
    // Un gate d'interface seul est décoratif : `authenticated` a le grant INSERT table-level, donc la
    // requête ci-dessus part telle quelle depuis une console.
    expect(await insererDirect(), "aucun abonnement actif → refusé").not.toBeNull();
  });

  it("[CONTRÔLE POSITIF] premium + consentante + hors détresse → l'écriture PASSE", async () => {
    await abonner(u.id);
    expect(await insererDirect()).toBeNull();
  });

  it("le consentement art. 9 RÉVOQUÉ referme l'écriture (le contenu décrit sa vie intérieure)", async () => {
    // Mutation-cible : retirer `a_consenti_art9()`. Le test est isolé du premium (actif ici) et de la
    // détresse (aucune) : seule cette clause peut refuser.
    await consentir(u.id, { revoque: true });
    expect(await insererDirect()).not.toBeNull();
    await consentir(u.id);
    expect(await insererDirect(), "et rouvre quand le consentement revient").toBeNull();
  });

  it("[AD-17] pendant un épisode de détresse, rien ne s'écrit", async () => {
    // Mutation-cible : retirer `not branche_bloquee_par_detresse()`. Premium actif et consentement
    // vivant : seule cette clause peut refuser.
    await ouvrirEpisode(u.id);
    expect(await insererDirect()).not.toBeNull();
    await fermerEpisodes(u.id);
    expect(await insererDirect(), "et rouvre quand la fenêtre est passée").toBeNull();
  });

  it("la LECTURE survit à l'extinction de l'abonnement (on n'enferme personne dans ses données)", async () => {
    // Un paywall qui séquestre ce qui est déjà écrit n'est pas un paywall. `branche_lecture` fait déjà
    // ce choix (« SURVIT à la révocation ») ; le plan le fait aussi. Mutation-cible : ajouter
    // `est_premium_courante()` à la policy de LECTURE.
    await admin.from("abonnement").update({ etat: "expire" }).eq("utilisatrice_id", u.id);
    const { data, error } = await s.from("intention").select("id").eq("utilisatrice_id", u.id);
    expect(error).toBeNull();
    expect((data ?? []).length, "son plan lui reste lisible").toBeGreaterThan(0);
    await abonner(u.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [AC2] RÉVISABLE — et le retrait est un DELETE FRANC, pas un tombstone
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC2] le plan est une suite VIVANTE : ajouter, modifier, retirer", () => {
  const u = { email: `int-rev-${t}@exemple.fr`, id: "", branche: "" };
  let s: SupabaseClient;

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "rev");
    await consentir(u.id);
    await abonner(u.id);
    s = await session(u.email);
  });
  afterAll(async () => purger(u.id));

  async function ajouter(declencheur: string, action: string, echeance: string | null = null): Promise<string> {
    const { data, error } = await s.rpc("ajouter_intention", {
      p_branche: u.branche,
      p_declencheur: declencheur,
      p_action: action,
      p_echeance: echeance,
    });
    if (error) throw new Error(`ajouter_intention: ${error.message}`);
    return data as string;
  }

  it("ajouter, puis réviser, puis retirer — et la ligne DISPARAÎT vraiment", async () => {
    // AD-18 NE S'APPLIQUE PAS ICI, et ce test le cloue. L'arbre ne régresse jamais (FR-029) et ses
    // suppressions sont des tombstones ; une intention est explicitement « une suite vivante, pas
    // figée ». Mutation-cible : remplacer le `delete` de `retirer_intention` par un marquage — ce
    // test rougit, et c'est exactement l'erreur qu'un réflexe AD-18 produirait.
    const id = await ajouter("si je remets à demain", "je pose une minute maintenant");

    const { data: revise } = await s.rpc("reviser_intention", {
      p_intention: id,
      p_declencheur: "si je remets au week-end",
      p_action: "je pose cinq minutes maintenant",
      p_echeance: null,
    });
    expect(revise, "la révision a bien touché une ligne").toBe(true);

    const { data: retire } = await s.rpc("retirer_intention", { p_intention: id });
    expect(retire).toBe(true);

    const { data: reste } = await admin.from("intention").select("id").eq("id", id);
    expect(reste ?? [], "aucune trace, aucun tombstone : le plan est révisable").toHaveLength(0);
  });

  it("[LE CŒUR — le zéro-ligne silencieux] réviser l'intention d'autrui rend `false`, jamais une erreur", async () => {
    // ⚠️ Une UPDATE bloquée par la RLS NE LÈVE RIEN : elle renvoie zéro ligne. Une RPC `returns void`
    // aurait donc rapporté un SUCCÈS sur un refus, et le test qui assère `error === null` aurait été
    // vert en prouvant l'inverse de ce qu'il croyait (leçon 4.9/T5).
    // Mutation-cible : faire rendre `true` inconditionnellement à `reviser_intention`.
    const etranger = { email: `int-rev-autre-${t}@exemple.fr`, id: "" };
    etranger.id = await creerUtilisatrice(etranger.email);
    try {
      await consentir(etranger.id);
      await abonner(etranger.id);
      const brancheAutre = await creerBranche(etranger.id, "rev-autre");
      const { data: idAutre } = await admin
        .from("intention")
        .insert({ utilisatrice_id: etranger.id, branche_id: brancheAutre, declencheur: "si", action: "alors" })
        .select("id")
        .single();

      const { data, error } = await s.rpc("reviser_intention", {
        p_intention: (idAutre as { id: string }).id,
        p_declencheur: "détourné",
        p_action: "détourné",
        p_echeance: null,
      });
      expect(error, "ce n'est pas une panne, c'est un refus").toBeNull();
      expect(data, "et le refus se DIT").toBe(false);

      const { data: intacte } = await admin
        .from("intention")
        .select("declencheur")
        .eq("id", (idAutre as { id: string }).id)
        .single();
      expect((intacte as { declencheur: string }).declencheur, "rien n'a bougé chez elle").toBe("si");
    } finally {
      await purger(etranger.id);
    }
  });

  it("retirer reste possible quand l'abonnement s'éteint — alléger n'est pas écrire", async () => {
    // Mutation-cible : ajouter `est_premium_courante()` à `intention_retrait`. Refuser le retrait à
    // quelqu'un qui n'est plus premium l'enfermerait dans des données qu'elle ne peut plus ni réviser
    // ni effacer — et pendant un épisode, retirer une intention devenue pesante est justement le geste
    // à ne pas bloquer.
    const id = await ajouter("si je m'oublie", "je m'arrête");
    await admin.from("abonnement").update({ etat: "expire" }).eq("utilisatrice_id", u.id);
    const { data } = await s.rpc("retirer_intention", { p_intention: id });
    expect(data).toBe(true);
    await abonner(u.id);
  });

  it("[ordre total] deux intentions au MÊME rang gardent le même ordre d'un chargement à l'autre", async () => {
    // Mutation-cible : retirer `, i.id asc` de `charger_plan`. Sans départage, deux lignes de rang égal
    // se réordonnent au gré du plan d'exécution — le plan « bougeait tout seul » entre deux ouvertures.
    // Même défaut que celui corrigé en 0033, appliqué au plan d'étapes.
    //
    // ⚠️ FRONTIÈRE HONNÊTE — CE MUTANT SURVIT AUJOURD'HUI, et il faut le dire plutôt que de le cacher.
    // L'index `intention_plan (utilisatrice_id, branche_id, rang, id)` fournit déjà cet ordre-là au
    // planificateur : à la taille où tournent ces tests, retirer `, i.id asc` ne change RIEN au plan
    // d'exécution, donc rien au résultat. Le départage n'est pas pour autant décoratif — il fait la
    // différence entre un ordre SPÉCIFIÉ et un ordre INCIDENT, et l'ordre incident tombe le jour où le
    // planificateur change d'avis (index abandonné, table qui grossit, `enable_indexscan` off, réécriture
    // de la requête). Ce test verrouille donc la PROPRIÉTÉ OBSERVABLE (stable, et dans l'ordre des id) ;
    // c'est tout ce qu'un test peut prouver ici, et prétendre le contraire serait pire que rien.
    await admin.from("intention").delete().eq("utilisatrice_id", u.id);
    for (const n of [1, 2, 3, 4, 5]) {
      await admin
        .from("intention")
        .insert({ utilisatrice_id: u.id, branche_id: u.branche, declencheur: `si ${n}`, action: `alors ${n}`, rang: 0 });
    }
    const lire = async () => {
      const { data, error } = await s.rpc("charger_plan", { p_branche: u.branche });
      if (error) throw new Error(`charger_plan: ${error.message}`);
      return (data as { id: string }[]).map((i) => i.id);
    };
    const premier = await lire();
    expect(premier, "cinq intentions, toutes de rang 0").toHaveLength(5);
    expect(await lire(), "le même ordre, à chaque fois").toEqual(premier);
    expect([...premier].sort(), "et c'est l'ordre des id, pas le hasard").toEqual([...premier]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [D4] LE PLAFOND EST PAR FAMILLE — « une notification d'Anam par 72 heures »
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[D4] deux motifs d'Anam ne font pas deux courriels d'Anam en 72 h", () => {
  const u = { email: `int-fam-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  async function reserver(motif: string, cle: string, plafond = 72): Promise<{ ok: boolean; erreur: string | null }> {
    const { data, error } = await admin.rpc("reserver_notification", {
      p_utilisatrice: u.id,
      p_motif: motif,
      p_cle: cle,
      p_plafond_heures: plafond,
    });
    return { ok: data === true, erreur: error?.message ?? null };
  }

  it("[LE CŒUR] `synthese_prete` puis `echeance_intention` dans les 72 h : le second est REFUSÉ", async () => {
    // C'est le test que la 4.9 ne POUVAIT pas écrire : avec un seul motif, per-motif et per-famille sont
    // indistinguables, et le test d'alors le disait honnêtement (il assérait sur le texte de 0030, faute
    // de comportement observable). La 4.10 ajoute le second motif d'Anam ; l'écart devient visible, et
    // ce test le cloue pour de bon.
    // Mutation-cible : remettre `and n.motif = p_motif` à la place de `famille_motif(n.motif) = v_famille`.
    expect((await reserver("synthese_prete", "s-1")).ok, "la première notification d'Anam").toBe(true);
    expect((await reserver("echeance_intention", jourParis())).ok, "la seconde, autre motif MAIS même famille").toBe(
      false,
    );
  });

  it("[CONTRÔLE POSITIF] plafond écoulé → la famille rouvre", async () => {
    // Sans lui, le test ci-dessus serait satisfait par un plafond qui refuse TOUT dès la première ligne.
    await admin
      .from("notification_envoyee")
      .update({ envoye_le: "2026-01-01T00:00:00Z" })
      .eq("utilisatrice_id", u.id);
    expect((await reserver("echeance_intention", jourParis(1))).ok).toBe(true);
  });

  it("un motif SANS famille ne part pas — il LÈVE, il n'échappe pas au plafond en silence", async () => {
    // Mutation-cible : remplacer le `raise` par un `else 'socle'` dans `famille_motif`. Le jour où
    // quelqu'un ajoutera une valeur au CHECK sans la classer, l'envoi doit casser bruyamment plutôt
    // que de sortir du plafond d'Anam sans que personne ne s'en aperçoive.
    const { data, error } = await admin.rpc("famille_motif", { p_motif: "promo_black_friday" });
    expect(error).toBeNull();
    expect(data, "aucune famille pour un motif inconnu").toBeNull();
    expect((await reserver("promo_black_friday", "x")).erreur, "et la réservation refuse").not.toBeNull();
  });

  it("les deux motifs d'Anam sont bien classés `anam` (et rien d'autre ne l'est encore)", async () => {
    for (const motif of ["synthese_prete", "echeance_intention"]) {
      const { data } = await admin.rpc("famille_motif", { p_motif: motif });
      expect(data, `${motif} est signé d'Anam`).toBe("anam");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [D4] L'ANNONCE EST RETENTABLE INDÉPENDAMMENT DE LA PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[D4] une synthèse écrite mais non annoncée redevient annonçable", () => {
  const u = { email: `int-annonce-${t}@exemple.fr`, id: "" };
  let syntheseId = "";

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    const { data, error } = await admin
      .from("synthese")
      .insert({
        utilisatrice_id: u.id,
        periode_debut: "2026-07-01T00:00:00Z",
        periode_fin: "2026-07-08T00:00:00Z",
        contenu: "un récit",
        tronquee: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(`synthese: ${error.message}`);
    syntheseId = (data as { id: string }).id;
  });
  afterAll(async () => purger(u.id));

  async function nonAnnoncees(): Promise<string[]> {
    const { data, error } = await admin.rpc("syntheses_non_annoncees", { p_limite: 20, p_jours: 7 });
    if (error) throw new Error(`syntheses_non_annoncees: ${error.message}`);
    return (data as { synthese_id: string }[]).map((l) => l.synthese_id);
  }

  it("[LE CŒUR] elle est listée tant qu'aucune notification ne porte sa clé", async () => {
    // C'est LA réparation du défaut que 0030 décrivait sans le corriger : l'annonce était accrochée à la
    // production (elle n'était tentée que dans le tour où la synthèse venait d'être écrite), donc un
    // refus du plafond la perdait définitivement. Mutation-cible : retirer le `not exists` — la synthèse
    // resterait listée après annonce, et le job réannoncerait chaque jour.
    expect(await nonAnnoncees()).toContain(syntheseId);
  });

  it("annoncée, elle sort de la liste", async () => {
    await admin.rpc("reserver_notification", {
      p_utilisatrice: u.id,
      p_motif: "synthese_prete",
      p_cle: syntheseId,
      p_plafond_heures: 72,
    });
    expect(await nonAnnoncees()).not.toContain(syntheseId);
  });

  it("une personne devenue inéligible n'est plus annonçable (la garde suit la synthèse)", async () => {
    // Mutation-cible : retirer `eligible_au_periodique` de `syntheses_non_annoncees`. Sans elle, une
    // femme qui a révoqué son consentement — ou qui traverse un épisode — recevrait le rattrapage.
    await admin.from("notification_envoyee").delete().eq("utilisatrice_id", u.id);
    expect(await nonAnnoncees(), "éligible : elle est là").toContain(syntheseId);
    await ouvrirEpisode(u.id);
    expect(await nonAnnoncees(), "épisode ouvert : plus rien ne lui est poussé").not.toContain(syntheseId);
    await fermerEpisodes(u.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [AC3] LES ÉCHÉANCES DUES — la clause détresse vit dans le SQL, et rien n'est rattrapé
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3] le rappel porte sur SON objectif, aujourd'hui, et jamais en retard", () => {
  const u = { email: `int-ech-${t}@exemple.fr`, id: "", branche: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "ech");
    await consentir(u.id);
    await abonner(u.id);
  });
  afterAll(async () => purger(u.id));

  async function poser(echeance: string | null) {
    await admin.from("intention").delete().eq("utilisatrice_id", u.id);
    await admin.from("intention").insert({
      utilisatrice_id: u.id,
      branche_id: u.branche,
      declencheur: "si vendredi arrive",
      action: "j'écris la lettre",
      echeance,
    });
  }

  async function dus(): Promise<string[]> {
    const { data, error } = await admin.rpc("rappels_echeance_dus", { p_limite: 50 });
    if (error) throw new Error(`rappels_echeance_dus: ${error.message}`);
    return (data as { utilisatrice_id: string }[]).map((l) => l.utilisatrice_id);
  }

  it("[LE CŒUR] une échéance qui tombe AUJOURD'HUI est due", async () => {
    await poser(jourParis());
    expect(await dus()).toContain(u.id);
  });

  it("[LE CŒUR] une échéance d'HIER n'est PAS rattrapée — un rappel en retard est un reproche daté", async () => {
    // Mutation-cible : remplacer `i.echeance = aujourd'hui` par `<=`. Le rattrapage paraît généreux ;
    // il ne l'est pas. Une échéance manquée pendant un épisode de détresse reviendrait trois jours plus
    // tard, avec la date, comme un reproche. On la laisse tomber, en silence — et c'est STRUCTUREL :
    // il n'existe aucune file où le retard s'accumule.
    await poser(jourParis(-1));
    expect(await dus()).not.toContain(u.id);
  });

  it("une échéance de DEMAIN n'est pas due non plus (contrôle de la borne haute)", async () => {
    await poser(jourParis(1));
    expect(await dus()).not.toContain(u.id);
  });

  it("une intention SANS échéance ne déclenche rien", async () => {
    await poser(null);
    expect(await dus()).not.toContain(u.id);
  });

  it("[AD-17] pendant un épisode de détresse, aucun rappel n'est dû", async () => {
    // Mutation-cible : retirer `eligible_au_periodique(i.utilisatrice_id)`. L'AC3 exige que la garde
    // vive dans la REQUÊTE SQL et pas dans un filtre TypeScript, et c'est ce test qui le prouve : le
    // job n'a pas d'autre chemin de lecture.
    await poser(jourParis());
    expect(await dus(), "contrôle : elle est due hors détresse").toContain(u.id);
    await ouvrirEpisode(u.id);
    expect(await dus()).not.toContain(u.id);
    await fermerEpisodes(u.id);
  });

  it("un compte sans abonnement actif n'est pas rappelé", async () => {
    await poser(jourParis());
    await admin.from("abonnement").update({ etat: "expire" }).eq("utilisatrice_id", u.id);
    expect(await dus()).not.toContain(u.id);
    await abonner(u.id);
  });

  it("DEUX échéances le même jour ne font qu'UNE ligne — donc un seul courriel", async () => {
    // Le courriel ne dit rien du contenu (« une échéance que tu as fixée arrive aujourd'hui ») : deux
    // intentions dues ne justifient pas deux courriels. Et envoyer par intention ferait mordre le
    // plafond de famille sur la seconde, qui serait alors perdue. Mutation-cible : retirer le
    // `group by` — la même personne apparaîtrait deux fois.
    await poser(jourParis());
    await admin.from("intention").insert({
      utilisatrice_id: u.id,
      branche_id: u.branche,
      declencheur: "si samedi arrive",
      action: "j'appelle ma sœur",
      echeance: jourParis(),
    });
    expect((await dus()).filter((id) => id === u.id), "une seule ligne pour elle").toHaveLength(1);
  });

  it("la clé rendue est le JOUR CIVIL PARIS — l'idempotence du rappel porte sur le jour, pas sur l'intention", async () => {
    await poser(jourParis());
    const { data } = await admin.rpc("rappels_echeance_dus", { p_limite: 50 });
    const ligne = (data as { utilisatrice_id: string; jour: string }[]).find((l) => l.utilisatrice_id === u.id);
    expect(ligne!.jour).toBe(jourParis());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [AC4/AC5] L'ARBITRAGE — les faits, et le droit de parole
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4] les faits de l'arbitrage : combien de branches ouvertes, et laquelle viser", () => {
  const u = { email: `int-arb-${t}@exemple.fr`, id: "" };
  let s: SupabaseClient;
  let plusAncienne = "";

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    s = await session(u.email);
    plusAncienne = await creerBranche(u.id, "arb-1", "2026-01-01T10:00:00Z");
    await creerBranche(u.id, "arb-2", "2026-02-01T10:00:00Z");
    await creerBranche(u.id, "arb-3", "2026-03-01T10:00:00Z");
  });
  afterAll(async () => purger(u.id));

  async function faits(): Promise<{ branches_en_naissance: number; branche_cible: string | null }> {
    const { data, error } = await s.rpc("faits_arbitrage_ouverture");
    if (error) throw new Error(`faits_arbitrage_ouverture: ${error.message}`);
    return (data as { branches_en_naissance: number; branche_cible: string | null }[])[0];
  }

  it("compte les branches encore en `naissance` (décision D2), et vise LA PLUS ANCIENNE", async () => {
    // « ouverte sans intégration » = jamais feuillée, jamais déclarée. C'est la définition littérale, et
    // elle ne dépend d'aucune fenêtre glissante (contrairement au « plus de 3 par mois » du PRD).
    // La cible est UNE branche, jamais une liste — une liste redeviendrait un compte.
    const f = await faits();
    expect(f.branches_en_naissance).toBe(3);
    expect(f.branche_cible, "la plus ancienne, ordre total par date puis id").toBe(plusAncienne);
  });

  it("une branche qui FEUILLE sort du compte (elle n'est plus « ouverte sans intégration »)", async () => {
    // Mutation-cible : retirer `and b.etat = 'naissance'`. Le compte deviendrait « toutes ses branches »,
    // et Anam inviterait à intégrer des branches déjà intégrées.
    await admin
      .from("branche")
      .update({ etat: "feuillaison", intensite: 0.3, date_feuillaison: new Date().toISOString() })
      .eq("id", plusAncienne);
    const f = await faits();
    expect(f.branches_en_naissance).toBe(2);
    expect(f.branche_cible, "la cible glisse vers la suivante").not.toBe(plusAncienne);
  });

  it("les branches d'AUTRUI ne comptent pas (RLS, `security invoker`)", async () => {
    const etrangere = { email: `int-arb-autre-${t}@exemple.fr`, id: "" };
    etrangere.id = await creerUtilisatrice(etrangere.email);
    try {
      await creerBranche(etrangere.id, "arb-etrangere");
      expect((await faits()).branches_en_naissance, "toujours les siennes seules").toBe(2);
    } finally {
      await purger(etrangere.id);
    }
  });
});

describe("[D3 / FR-034] Anam le dit, puis elle se tait", () => {
  const u = { email: `int-inv-${t}@exemple.fr`, id: "", branche: "" };
  let s: SupabaseClient;

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    s = await session(u.email);
    u.branche = await creerBranche(u.id, "inv");
  });
  afterAll(async () => purger(u.id));

  async function reserver(fenetre = 168): Promise<boolean> {
    const { data, error } = await s.rpc("reserver_invitation_integration", { p_fenetre_heures: fenetre });
    if (error) throw new Error(`reserver_invitation_integration: ${error.message}`);
    return data === true;
  }

  /**
   * Recule la dernière prise de parole. Dix jours par défaut : AU-DELÀ de la fenêtre ordinaire (7 j) mais
   * EN DEÇÀ du long silence qui rouvre la parole tout seul (28 j) — sans quoi les tests « il faut un
   * mouvement » passeraient par le repli et ne prouveraient plus la clause de mouvement.
   */
  async function vieillirLaParole(joursEnArriere = 10) {
    const passe = new Date(Date.now() - joursEnArriere * 86_400_000).toISOString();
    await admin.from("invitation_integration").update({ dite_le: passe }).eq("utilisatrice_id", u.id);
  }

  it("[LE CŒUR] elle le dit UNE fois, puis se tait — sinon FR-030 fabrique la violation de FR-034", async () => {
    // Sans cette garde, le signal étant toujours en attente et le seuil toujours franchi, l'invitation
    // repartirait à CHAQUE ouverture de l'app. Et c'est la plus agaçante des répétitions : elle se
    // répète parce qu'elle n'a pas obéi. Mutation-cible : faire rendre `true` inconditionnellement.
    expect(await reserver(), "la première fois").toBe(true);
    expect(await reserver(), "la seconde, dans la fenêtre").toBe(false);
    expect(await reserver(), "et la troisième aussi").toBe(false);
  });

  it("la fenêtre écoulée NE SUFFIT PAS : il faut un mouvement réel", async () => {
    // Mutation-cible : retirer la clause `exists (… date_feuillaison > dite_le …)`. Sans elle,
    // l'invitation redevient un message générique récurrent — à cadence hebdomadaire au lieu de
    // quotidienne, ce qui ne change rien à ce que FR-034 interdit.
    await vieillirLaParole();
    expect(await reserver(), "rien n'a bougé de son côté : Anam se tait").toBe(false);
  });

  it("[CONTRÔLE POSITIF] une branche qui FEUILLE rend la parole à Anam", async () => {
    await vieillirLaParole();
    await admin
      .from("branche")
      .update({ etat: "feuillaison", intensite: 0.3, date_feuillaison: new Date().toISOString() })
      .eq("id", u.branche);
    expect(await reserver(), "un mouvement réel réarme l'invitation").toBe(true);
  });

  it("[LE CŒUR] un MOUVEMENT ne suffit pas non plus tant que la fenêtre n'est pas écoulée", async () => {
    // ⚠️ CE TEST EXISTE PARCE QUE LA CAMPAGNE DE MUTATION A TROUVÉ LE TROU, et c'est exactement le piège
    // des défenses redondantes (mémoire `gardes-doivent-tuer-leur-mutant`). Deux clauses refusent la
    // parole — la fenêtre de silence et l'absence de mouvement — et tous les tests d'alors passaient par
    // un cas où les DEUX s'appliquaient. Retirer la fenêtre laissait le mouvement refuser à sa place :
    // le mutant survivait, et la garde de FR-034 n'était prouvée par personne.
    //
    // Le cas qui les sépare est celui-ci, et il est le plus important du produit : elle OBÉIT. Anam lui
    // dit « fais-en vivre une », elle fait feuiller une branche dans la foulée — et Anam ne doit
    // SURTOUT pas la relancer dans la seconde. Sans la fenêtre, obéir déclencherait l'invitation
    // suivante : le message se répéterait d'autant plus qu'elle fait ce qu'on lui demande.
    // Mutation-cible : retirer le `if v_dite_le > now() - make_interval(...) then return false`.
    const b = await creerBranche(u.id, "inv-obeit");
    await admin
      .from("branche")
      .update({ etat: "feuillaison", intensite: 0.3, date_feuillaison: new Date().toISOString() })
      .eq("id", b);
    expect(await reserver(), "elle vient d'obéir : Anam se tait quand même").toBe(false);
  });

  it("une branche qui RAYONNE réarme aussi (les deux mouvements comptent)", async () => {
    await vieillirLaParole();
    const b = await creerBranche(u.id, "inv-rayon");
    await admin
      .from("branche")
      .update({ etat: "rayonnement", date_rayonnement: new Date().toISOString() })
      .eq("id", b);
    expect(await reserver()).toBe(true);
  });

  it("une fenêtre absente ou négative est REFUSÉE, jamais interprétée comme « pas de fenêtre »", async () => {
    // Même piège que `reserver_notification` : `make_interval(hours => null)` rend NULL, la comparaison
    // rend NULL, et la garde s'évapore en silence. Mutation-cible : retirer le `raise`.
    for (const fenetre of [null, 0, -168]) {
      const { error } = await s.rpc("reserver_invitation_integration", { p_fenetre_heures: fenetre });
      expect(error, `fenêtre ${fenetre} doit être refusée`).not.toBeNull();
    }
  });

  it("la trace de parole est deny-by-default : une session ne la lit ni ne l'écrit", async () => {
    const { data } = await s.from("invitation_integration").select("dite_le");
    expect(data ?? [], "aucune policy : la table est muette pour une session").toHaveLength(0);
    const { error } = await s
      .from("invitation_integration")
      .upsert({ utilisatrice_id: u.id, dite_le: "2026-01-01T00:00:00Z" });
    expect(error, "et on ne peut pas se rendre la parole soi-même").not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [REVUE 4.10] LES CORRECTIFS DE BASE
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[REVUE 4.10] une réservation qui n'a rien envoyé se REND", () => {
  const u = { email: `int-lib-${t}@exemple.fr`, id: "" };
  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("[LE CŒUR] `liberer_notification` rouvre la clé exacte, et rien d'autre", async () => {
    // ⚠️ Sans elle, un envoi qui échoue APRÈS réservation occupait la clé du jour à vie. Pour la synthèse
    // c'est un retard (la clé se régénère la période suivante) ; pour le RAPPEL c'est une PERTE — la clé
    // est le jour civil et l'échéance ne repasse jamais. Mutation-cible : faire rendre `false` sans rien
    // supprimer, ou élargir le `delete` (il n'a le droit de toucher QUE la clé qu'on vient de poser).
    const jour = jourParis();
    const reserver = async () =>
      (await admin.rpc("reserver_notification", {
        p_utilisatrice: u.id,
        p_motif: "echeance_intention",
        p_cle: jour,
        p_plafond_heures: 72,
      })).data === true;

    expect(await reserver(), "la première réservation passe").toBe(true);
    expect(await reserver(), "la seconde est refusée (idempotence)").toBe(false);

    const { data: libere } = await admin.rpc("liberer_notification", {
      p_utilisatrice: u.id,
      p_motif: "echeance_intention",
      p_cle: jour,
    });
    expect(libere, "la clé est rendue").toBe(true);
    expect(await reserver(), "et le rappel du jour redevient envoyable").toBe(true);
  });

  it("libérer une clé qui n'existe pas ne fait rien et le DIT", async () => {
    const { data } = await admin.rpc("liberer_notification", {
      p_utilisatrice: u.id,
      p_motif: "echeance_intention",
      p_cle: "jamais-posee",
    });
    expect(data).toBe(false);
  });
});

describe("[REVUE 4.10] les désabonnées n'occupent plus les places", () => {
  const u = { email: `int-desab-${t}@exemple.fr`, id: "", branche: "" };
  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.branche = await creerBranche(u.id, "desab");
    await consentir(u.id);
    await abonner(u.id);
    await admin.from("intention").insert({
      utilisatrice_id: u.id,
      branche_id: u.branche,
      declencheur: "si vendredi",
      action: "j'écris",
      echeance: jourParis(),
    });
  });
  afterAll(async () => purger(u.id));

  it("[LE CŒUR] une désabonnée sort de la sélection des rappels", async () => {
    // ⚠️ `eligible_au_periodique` ne regarde pas `preference_courriel` : la désabonnée restait
    // sélectionnée, occupait une des dix places, et `reserver_notification` refusait ensuite. Comme rien
    // n'est jamais rattrapé ici, la place perdue l'était pour de bon — au détriment de quelqu'un d'autre.
    // Mutation-cible : retirer la clause `preference_courriel` de `rappels_echeance_dus`.
    const dus = async () =>
      ((await admin.rpc("rappels_echeance_dus", { p_limite: 500 })).data as { utilisatrice_id: string }[]).map(
        (l) => l.utilisatrice_id,
      );
    expect(await dus(), "contrôle : elle est due tant qu'elle est abonnée").toContain(u.id);

    await admin.rpc("jeton_courriel", { p_utilisatrice: u.id });
    await admin.from("preference_courriel").update({ refuse_le: new Date().toISOString() }).eq("utilisatrice_id", u.id);
    expect(await dus(), "désabonnée : elle ne prend plus de place").not.toContain(u.id);
  });
});

describe("[REVUE 4.10] `est_premium_courante` n'est plus exécutable par `anon`", () => {
  it("[LE CŒUR] elle a exactement les mêmes grantees que ses deux sœurs de 0007", async () => {
    // ⚠️ `revoke ... from public` NE SUFFIT PAS — 0007 le documente déjà et avait durci `a_consenti_art9`
    // et `est_barre_minorite` pour cette raison exacte. La 4.10 avait reperdu la leçon.
    // Mutation-cible : retirer `, anon` du `revoke` de 0036.
    const { data } = await admin.rpc("grantees_execute" as never, {} as never).then(
      () => ({ data: null }),
      () => ({ data: null }),
    );
    void data;
    // Pas de RPC utilitaire : on interroge le catalogue par une session `anon` réelle, ce qui est plus
    // probant qu'une lecture de `pg_proc` — c'est le chemin qu'un client emprunterait.
    const anon = clientScope();
    const premium = await anon.rpc("est_premium_courante");
    const consenti = await anon.rpc("a_consenti_art9");
    expect(consenti.error, "témoin : la sœur durcie en 0007 refuse `anon`").not.toBeNull();
    expect(premium.error, "et celle de la 4.10 doit refuser pareil").not.toBeNull();
  });
});

describe("[REVUE 4.10 / D3-bis] Anam n'est plus muette pour toujours", () => {
  const u = { email: `int-muette-${t}@exemple.fr`, id: "" };
  let s: SupabaseClient;
  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    s = await session(u.email);
    await creerBranche(u.id, "muette");
  });
  afterAll(async () => purger(u.id));

  it("[LE CŒUR] un LONG silence rouvre la parole, même sans aucun mouvement", async () => {
    // ⚠️ La composition des trois règles (germe jamais consommé, seuil toujours franchi, réarmement par
    // mouvement seul) rendait Anam DÉFINITIVEMENT muette : ni invitation, ni proposition, et le seul
    // déverrouillage était précisément ce que la personne ne faisait pas. Décision PO du 2026-08-06 :
    // « rouvrir la parole, sans trop insister ». Mutation-cible : retirer la clause de long silence.
    const reserver = async () =>
      (await s.rpc("reserver_invitation_integration", { p_fenetre_heures: 168 })).data === true;
    expect(await reserver(), "la première fois").toBe(true);
    expect(await reserver(), "puis elle se tait").toBe(false);

    // Dix jours : la fenêtre est passée, mais le long silence pas encore. Aucun mouvement.
    await admin
      .from("invitation_integration")
      .update({ dite_le: new Date(Date.now() - 10 * 86_400_000).toISOString() })
      .eq("utilisatrice_id", u.id);
    expect(await reserver(), "elle se tait toujours").toBe(false);

    // Au-delà de quatre fenêtres (28 jours), la parole se rouvre d'elle-même.
    await admin
      .from("invitation_integration")
      .update({ dite_le: new Date(Date.now() - 40 * 86_400_000).toISOString() })
      .eq("utilisatrice_id", u.id);
    expect(await reserver(), "après un long silence, elle redit — une fois").toBe(true);
    expect(await reserver(), "et se retait aussitôt").toBe(false);
  });
});
