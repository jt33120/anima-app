import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lireThemeNatal } from "@/lib/data/depot-theme-natal";
import { calculerThemeNatal } from "@/lib/astro/theme-natal";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import type { EphemerisPort, LectureCorps } from "@/lib/astro/port";

/**
 * Story 5.1 (T6) — LES GARDES DE BASE DU THÈME NATAL (migration 0039).
 *
 * Ce fichier frappe un Supabase LOCAL réel. Il prouve ce qu'aucun test de domaine ne peut prouver :
 * que la BASE refuse ce qu'elle doit refuser, même quand l'appelant est de bonne foi et authentifié
 * sous sa propre identité.
 *
 *   AC2 — sans consentement art. 9 (jamais donné, révoqué) ou sous barrière de minorité : REFUS.
 *   AC3 — RLS activée ET forcée, aucun grant `anon`.
 *   AC4 — un thème déjà stocké est RELU : l'éphéméride n'est plus appelée du tout.
 *   AC8 — immuable SAUF recalcul déclaré (version + 1 ET empreinte différente).
 *   AC9 — les entrées astronomiques sont write-once ; `date_naissance` reste immuable.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

/**
 * Un thème de la BONNE forme — PRODUIT PAR LE DOMAINE, jamais recopié à la main.
 *
 * ⚠️ Il l'était, et c'était un piège à retardement : le littéral disait `schema: 1` et un commentaire
 * affirmait « ce que `themeExploitable` accepte ». Le jour où la forme a changé (Story 5.3, D4), le
 * littéral est devenu faux ET le commentaire est devenu un mensonge — sans qu'un seul test rougisse,
 * puisque les assertions de ce bloc portent sur la BASE (RLS, triggers) et se moquent du contenu.
 * Le prochain test qui aurait relu ce contenu par `lireThemeNatal` aurait déclenché un recalcul
 * silencieux et mesuré autre chose que ce qu'il croyait.
 *
 * Le faire produire par `calculerThemeNatal` supprime la classe entière : la forme suit le code.
 */
const contenuValide = JSON.parse(
  JSON.stringify(
    calculerThemeNatal(
      { date: "1990-06-15" },
      {
        identifiant: "test",
        longitudeEcliptique: (): LectureCorps => ({ statut: "calcule", longitude: 12.5 }),
        tempsSideralGreenwich: () => 6,
        obliquiteVraie: () => 23.44,
      },
    ),
  ),
) as Record<string, unknown>;

/**
 * Port doublé qui COMPTE ses appels. C'est l'instrument de l'AC4 : « coût marginal nul » n'est pas
 * une intention qu'on relit dans le code, c'est un nombre qu'on mesure.
 */
function ephemerideCompteuse(): EphemerisPort & { appels: () => number } {
  let appels = 0;
  return {
    identifiant: "double-compteur@1",
    appels: () => appels,
    longitudeEcliptique(): LectureCorps {
      appels += 1;
      return { statut: "calcule", longitude: 12.5 };
    },
    tempsSideralGreenwich(): number {
      appels += 1;
      return 6;
    },
    obliquiteVraie(): number {
      appels += 1;
      return 23.44;
    },
  };
}

/**
 * Compte les appels d'un port RÉEL sans changer ce qu'il rend — ni son identifiant, sauf demande
 * explicite. Story 5.3 : l'identifiant entre dans l'empreinte, donc un port doublé provoque un
 * recalcul légitime. Pour mesurer « on ne recalcule plus », il faut envelopper, pas remplacer.
 */
function compteurAutour(
  port: EphemerisPort,
  identifiant = port.identifiant,
): EphemerisPort & { appels: () => number } {
  let appels = 0;
  return {
    identifiant,
    appels: () => appels,
    longitudeEcliptique: (corps, t) => {
      appels += 1;
      return port.longitudeEcliptique(corps, t);
    },
    tempsSideralGreenwich: (t) => {
      appels += 1;
      return port.tempsSideralGreenwich(t);
    },
    obliquiteVraie: (t) => {
      appels += 1;
      return port.obliquiteVraie(t);
    },
  };
}

/** Crée une utilisatrice majeure, connectée, et rend son client sous JWT. */
async function creerUtilisatrice(
  suffixe: string,
): Promise<{ id: string; email: string; motDePasse: string; client: SupabaseClient }> {
  const email = `tn-${suffixe}-${t}@exemple.fr`;
  const motDePasse = "test-tn-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const { error: e2 } = await admin
    .from("utilisatrice")
    .update({ date_naissance: "1990-06-15" })
    .eq("id", id);
  if (e2) throw new Error(`date_naissance: ${e2.message}`);

  const client = clientScope();
  const { error: e3 } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (e3) throw new Error(`signIn: ${e3.message}`);
  return { id, email, motDePasse, client };
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC2 — le write-gate art. 9 mord sur `theme_natal`
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC2/DUR] theme_natal : aucune écriture sans consentement art. 9 valide", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("gate");
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("sans consentement : l'insert direct sous SON PROPRE JWT est refusé, et AUCUNE ligne n'existe", async () => {
    // L'API REST est ouverte à `authenticated` : si la garde vivait dans le dépôt TypeScript, cet
    // appel-ci la contournerait entièrement. C'est la leçon R1 — la garde est dans le WITH CHECK.
    const { error } = await u.client
      .from("theme_natal")
      .insert({ utilisatrice_id: u.id, empreinte_entrees: "x", contenu: contenuValide });
    expect(error, "la base a accepté un thème art. 9 sans consentement").not.toBeNull();

    const { count } = await admin
      .from("theme_natal")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", u.id);
    expect(count).toBe(0);
  });

  it("avec consentement valide : l'écriture est acceptée", async () => {
    await consentir(u.id);
    const { error } = await u.client
      .from("theme_natal")
      .insert({ utilisatrice_id: u.id, empreinte_entrees: "empreinte-1", contenu: contenuValide });
    expect(error).toBeNull();
  });

  it("un SECOND insert entre en conflit — la clé primaire fait « une seule fois » (AD-6)", async () => {
    const { error } = await u.client
      .from("theme_natal")
      .insert({ utilisatrice_id: u.id, empreinte_entrees: "empreinte-2", contenu: contenuValide });
    expect(error, "deux thèmes pour une même personne").not.toBeNull();

    const { count } = await admin
      .from("theme_natal")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", u.id);
    expect(count).toBe(1);
  });

  it("après RÉVOCATION : l'écriture est de nouveau refusée, la LECTURE reste ouverte (export RGPD)", async () => {
    const { error: eRevoc } = await admin
      .from("consentement")
      .update({ revoked_at: new Date().toISOString() })
      .eq("utilisatrice_id", u.id);
    expect(eRevoc).toBeNull();

    const { error } = await u.client
      .from("theme_natal")
      .update({ version: 2, empreinte_entrees: "apres-revocation", contenu: contenuValide })
      .eq("utilisatrice_id", u.id);
    expect(error, "écriture art. 9 acceptée après révocation").not.toBeNull();

    // AD-4/AD-14 : l'export et l'effacement doivent rester possibles APRÈS la révocation.
    const { data, error: eLecture } = await u.client.from("theme_natal").select("version");
    expect(eLecture).toBeNull();
    expect(data?.length).toBe(1);
  });
});

describe("[AC2/DUR] theme_natal : la barrière de minorité ferme l'écriture (FR-071)", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("barre");
    await consentir(u.id);
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("consentement VALIDE mais compte barré : l'écriture est refusée quand même", async () => {
    const { error: eBarre } = await admin
      .from("utilisatrice")
      .update({ barriere_minorite_le: new Date().toISOString() })
      .eq("id", u.id);
    expect(eBarre).toBeNull();

    const { error } = await u.client
      .from("theme_natal")
      .insert({ utilisatrice_id: u.id, empreinte_entrees: "x", contenu: contenuValide });
    expect(error, "un compte barré-minorité a pu écrire du contenu art. 9").not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC8 — immuable SAUF recalcul déclaré
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC8/DUR] theme_natal : immuable sauf recalcul déclaré (version + 1 ET empreinte différente)", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("version");
    await consentir(u.id);
    const { error } = await u.client
      .from("theme_natal")
      .insert({ utilisatrice_id: u.id, empreinte_entrees: "entrees-A", contenu: contenuValide });
    if (error) throw new Error(`insert initial: ${error.message}`);
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("l'insert force version = 1, quoi qu'ait demandé l'appelant", async () => {
    const { data } = await admin
      .from("theme_natal")
      .select("version")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(data?.version).toBe(1);
  });

  it("un update NU (sans toucher la version) est refusé", async () => {
    const { error } = await u.client
      .from("theme_natal")
      .update({ contenu: { ...contenuValide, adaptateur: "autre" } })
      .eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
  });

  it("[LE MUTANT QUI COMPTE] version + 1 SANS changer l'empreinte est refusé", async () => {
    // Sans cette moitié de la garde, « recalculer » voudrait dire « réécrire le même thème
    // autrement » : le socle bougerait sans raison, ce que FR-051 interdit explicitement.
    const { error } = await u.client
      .from("theme_natal")
      .update({ version: 2, empreinte_entrees: "entrees-A", contenu: contenuValide })
      .eq("utilisatrice_id", u.id);
    expect(error, "un recalcul sans changement d'entrées a été accepté").not.toBeNull();
  });

  it("empreinte différente MAIS version inchangée est refusé", async () => {
    const { error } = await u.client
      .from("theme_natal")
      .update({ empreinte_entrees: "entrees-B", contenu: contenuValide })
      .eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
  });

  it("un SAUT de version (+2) est refusé — l'historique des recalculs reste lisible", async () => {
    const { error } = await u.client
      .from("theme_natal")
      .update({ version: 3, empreinte_entrees: "entrees-C", contenu: contenuValide })
      .eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
  });

  it("version + 1 ET empreinte différente : ACCEPTÉ — c'est le levier de la Story 5.3", async () => {
    const { error } = await u.client
      .from("theme_natal")
      .update({ version: 2, empreinte_entrees: "entrees-B", contenu: contenuValide })
      .eq("utilisatrice_id", u.id);
    expect(error).toBeNull();

    const { data } = await admin
      .from("theme_natal")
      .select("version, empreinte_entrees")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(data?.version).toBe(2);
    expect(data?.empreinte_entrees).toBe("entrees-B");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC9 — write-once sur les entrées astronomiques
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC9] utilisatrice : les entrées astronomiques sont write-once, pas immuables", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("writeonce");
    await consentir(u.id);
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("null → valeur : ACCEPTÉ (c'est exactement ce que promet la Story 5.3)", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({
        heure_naissance: "07:15:00",
        lieu_naissance: "Paris",
        lieu_latitude: 48.8566,
        lieu_longitude: 2.3522,
        lieu_fuseau: "Europe/Paris",
      })
      .eq("id", u.id);
    expect(error, "impossible d'ajouter son heure — la Story 5.3 serait morte-née").toBeNull();
  });

  /**
   * ⚠️ CETTE ASSERTION A ÉTÉ RETOURNÉE PAR LA STORY 6.5b, ET C'EST DÉLIBÉRÉ.
   *
   * Elle exigeait un REFUS : « valeur → autre valeur : refusé (le socle ne bouge pas, FR-051) ».
   * Le tour de QA (T17) a montré ce que ce refus coûtait : quelqu'un qui tape 14:30 au lieu de
   * 04:30 a un ascendant faux POUR TOUJOURS — et l'art. 16 du RGPD donne un droit inconditionnel
   * à la rectification d'une donnée inexacte. La migration 0060 ouvre donc la porte, en la
   * gardant : consentement art. 9 exigé, effacement toujours refusé, correction comptée et datée
   * par le serveur.
   *
   * Ce qui protège FR-051 n'est plus le refus, c'est l'aperçu : `/memoire` montre l'ascendant
   * gagné et l'ascendant perdu AVANT d'écrire. Voir `tests/correction-naissance-sql.test.ts`.
   */
  it("valeur → AUTRE valeur : ACCEPTÉ depuis la 6.5b (art. 16), et compté", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ heure_naissance: "08:00:00" })
      .eq("id", u.id);
    expect(error, "la correction de la 6.5b est refermée").toBeNull();
    const { data } = await admin
      .from("utilisatrice")
      .select("heure_naissance, naissance_corrections")
      .eq("id", u.id)
      .single<{ heure_naissance: string; naissance_corrections: number }>();
    expect(data!.heure_naissance).toBe("08:00:00");
    expect(data!.naissance_corrections).toBe(1);
  });

  it("valeur → null : refusé aussi — sinon l'aller-retour rouvrirait la réécriture", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ lieu_fuseau: null })
      .eq("id", u.id);
    expect(error).not.toBeNull();
  });

  it("réécrire la MÊME valeur reste permis (une mise à jour idempotente n'est pas un changement)", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ heure_naissance: "07:15:00" })
      .eq("id", u.id);
    expect(error).toBeNull();
  });

  it("[NON-RÉGRESSION 0003] `date_naissance` reste IMMUABLE — le contrôle de majorité est intact", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ date_naissance: "1970-01-01" })
      .eq("id", u.id);
    expect(error, "la date de naissance est redevenue modifiable (FR-070)").not.toBeNull();
  });

  it("`prenom` et `nom_complet` restent CORRIGEABLES — ce ne sont pas des entrées de calcul", async () => {
    // Les figer graverait une faute de frappe pour toujours ; la correction par l'utilisatrice
    // prime (FR-064). Ils n'entrent pas dans l'empreinte du thème natal.
    const { error: e1 } = await u.client
      .from("utilisatrice")
      .update({ prenom: "Sanella", nom_complet: "Sanella Dupont" })
      .eq("id", u.id);
    expect(e1).toBeNull();
    const { error: e2 } = await u.client
      .from("utilisatrice")
      .update({ prenom: "Sanela" })
      .eq("id", u.id);
    expect(e2, "une faute de frappe dans le prénom serait gravée à vie").toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC4 — coût marginal nul, mesuré
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4] lireThemeNatal : calculé une fois, relu ensuite — l'éphéméride n'est plus appelée", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("cout");
    await consentir(u.id);
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("premier appel : calcule et grave ; second appel : ZÉRO appel à l'éphéméride", async () => {
    const premier = ephemerideCompteuse();
    const r1 = await lireThemeNatal(u.client, u.id, premier);
    expect(r1.statut).toBe("calcule");
    expect(premier.appels(), "le premier appel n'a rien calculé").toBeGreaterThan(0);

    const second = ephemerideCompteuse();
    const r2 = await lireThemeNatal(u.client, u.id, second);
    expect(r2.statut).toBe("calcule");
    expect(second.appels(), "le thème a été RECALCULÉ à l'affichage — coût marginal non nul").toBe(
      0,
    );
    if (r1.statut === "calcule" && r2.statut === "calcule") {
      expect(r2.version).toBe(r1.version);
      expect(r2.theme).toEqual(r1.theme);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 5.3 (T4) — LE RECALCUL PARESSEUX, CONTRE LE VRAI SQL
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / AC4] lireThemeNatal : ajouter son heure RECALCULE le thème", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("recalcul");
    await consentir(u.id);
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("[LE CŒUR] heure + lieu ajoutés → version 2, empreinte différente, ascendant calculé", async () => {
    // 1. Premier passage : pas d'heure. Le thème existe, sans angles.
    const avant = await lireThemeNatal(u.client, u.id, ephemerideAstronomyEngine());
    expect(avant.statut).toBe("calcule");
    if (avant.statut !== "calcule") return;
    expect(avant.version).toBe(1);
    expect(avant.theme.angles.statut).toBe("non_calcule");

    const { data: ligneAvant } = await admin
      .from("theme_natal")
      .select("empreinte_entrees")
      .eq("utilisatrice_id", u.id)
      .single();

    // 2. Elle ajoute son heure ET son lieu — un seul `update`, comme le fait la Server Action.
    const { error: eEcriture } = await u.client
      .from("utilisatrice")
      .update({
        heure_naissance: "07:15:00",
        lieu_naissance: "Paris",
        lieu_latitude: 48.8566,
        lieu_longitude: 2.3522,
        lieu_fuseau: "Europe/Paris",
      })
      .eq("id", u.id);
    expect(eEcriture).toBeNull();

    // 3. Lecture suivante : le recalcul se déclenche TOUT SEUL. Personne ne l'a demandé.
    const apres = await lireThemeNatal(u.client, u.id, ephemerideAstronomyEngine());
    expect(apres.statut).toBe("calcule");
    if (apres.statut !== "calcule") return;
    expect(apres.version, "la version n'a pas été incrémentée — AD-6").toBe(2);
    expect(apres.theme.angles.statut, "l'ascendant manque encore après l'ajout de l'heure").toBe(
      "calcule",
    );

    const { data: ligneApres } = await admin
      .from("theme_natal")
      .select("empreinte_entrees")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(ligneApres?.empreinte_entrees).not.toBe(ligneAvant?.empreinte_entrees);
  });

  it("[DUR] et il ne se rejoue PAS : la lecture suivante n'appelle plus l'éphéméride", async () => {
    // Sans cette garde, chaque affichage recalculerait et tenterait un `version + 1` — le socle
    // « bougerait » à chaque page, ce que FR-051 interdit, et la version partirait à l'infini.
    //
    // ⚠️ Le compteur enveloppe le VRAI adaptateur, il ne le remplace pas. Un port doublé porterait
    // un autre `identifiant`, donc une autre empreinte, donc un recalcul légitime — et ce test
    // mesurerait le recalcul qu'il croit interdire. (Écrit d'abord de travers, corrigé par la
    // base : elle a rendu version 3.)
    const compteur = compteurAutour(ephemerideAstronomyEngine());
    const r = await lireThemeNatal(u.client, u.id, compteur);
    expect(r.statut).toBe("calcule");
    if (r.statut === "calcule") expect(r.version).toBe(2);
    expect(compteur.appels(), "le thème est recalculé à chaque affichage").toBe(0);
  });

  it("[AD-6] changer d'ADAPTATEUR, lui, déclenche bien un recalcul", async () => {
    // C'est le contrat écrit dans le commentaire de colonne de 0039 : l'identifiant d'adaptateur
    // entre dans l'empreinte EXPRÈS, pour que l'arrivée d'une source de Chiron puisse recalculer
    // alors que les entrées de naissance n'auront pas bougé.
    const autre = compteurAutour(ephemerideAstronomyEngine(), "source-fictive@2");
    const r = await lireThemeNatal(u.client, u.id, autre);
    expect(autre.appels(), "l'adaptateur a changé et rien n'a été recalculé").toBeGreaterThan(0);
    expect(r.statut).toBe("calcule");
    if (r.statut === "calcule") expect(r.version).toBe(3);
  });
});

describe("[5.3 / P1 / AC6] une forme de thème PÉRIMÉE se répare toute seule", () => {
  it("[LE MUTANT QUI COMPTE] un contenu d'ancienne forme est recalculé, pas déclaré illisible", async () => {
    // C'est LE piège de la story. `themeExploitable` refuse l'ancienne forme ; sans le recalcul par
    // empreinte, la lecture rendrait `lecture_impossible` À VIE pour tous les comptes déjà calculés,
    // et sans une seule erreur nulle part. On simule exactement ça : une ligne gravée avec un
    // contenu d'ancien schéma et l'empreinte qui allait avec.
    const u = await creerUtilisatrice("vieilleforme");
    try {
      await consentir(u.id);
      const { error } = await u.client.from("theme_natal").insert({
        utilisatrice_id: u.id,
        empreinte_entrees: "v1|1990-06-15|||||signes_entiers|astronomy-engine@2.1.19",
        contenu: { schema: 1, adaptateur: "vieux", positions: [], absents: [] },
      });
      expect(error).toBeNull();

      const r = await lireThemeNatal(u.client, u.id, ephemerideAstronomyEngine());
      expect(r.statut, "le socle est mort pour tous les comptes existants").toBe("calcule");
      if (r.statut !== "calcule") return;
      expect(r.theme.schema).toBe(2);
      expect(r.version, "un recalcul incrémente la version").toBe(2);
      expect(r.theme.positions.length, "le thème recalculé est vide").toBeGreaterThan(5);
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});

describe("[5.3 / P2 / DUR] un recalcul REFUSÉ ne détruit pas le socle déjà gravé", () => {
  it("consentement révoqué : le thème d'origine reste servi, tel quel", async () => {
    // Le write-gate art. 9 refuse l'`update`. Rendre `indisponible` reviendrait à faire disparaître
    // un socle PARFAITEMENT VALIDE pour améliorer un détail. Le nouveau thème serait meilleur ;
    // l'ancien reste vrai.
    const u = await creerUtilisatrice("revoque-recalcul");
    try {
      await consentir(u.id);
      const initial = await lireThemeNatal(u.client, u.id, ephemerideAstronomyEngine());
      expect(initial.statut).toBe("calcule");

      // Elle ajoute son heure — puis révoque son consentement avant la lecture suivante.
      await u.client
        .from("utilisatrice")
        .update({
          heure_naissance: "07:15:00",
          lieu_naissance: "Paris",
          lieu_latitude: 48.8566,
          lieu_longitude: 2.3522,
          lieu_fuseau: "Europe/Paris",
        })
        .eq("id", u.id);
      await admin
        .from("consentement")
        .update({ revoked_at: new Date().toISOString() })
        .eq("utilisatrice_id", u.id);

      const apres = await lireThemeNatal(u.client, u.id, ephemerideAstronomyEngine());
      expect(apres.statut, "un socle valide a disparu à cause d'un recalcul refusé").toBe("calcule");
      if (apres.statut !== "calcule") return;
      expect(apres.version, "le recalcul a été accepté malgré la révocation").toBe(1);
      expect(apres.theme.angles.statut).toBe("non_calcule");
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});

describe("[AC4] lireThemeNatal : les refus sont nommés, jamais silencieux", () => {
  it("sans date de naissance → `naissance_absente`, et rien n'est écrit", async () => {
    const email = `tn-sansdate-${t}@exemple.fr`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "test-tn-123!",
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    const id = data.user!.id;
    try {
      await consentir(id);
      const client = clientScope();
      await client.auth.signInWithPassword({ email, password: "test-tn-123!" });
      const r = await lireThemeNatal(client, id, ephemerideCompteuse());
      expect(r).toEqual({ statut: "indisponible", raison: "naissance_absente" });
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("sans consentement → `ecriture_refusee` (la garde de base remonte jusqu'au dépôt)", async () => {
    const u = await creerUtilisatrice("refus");
    try {
      const r = await lireThemeNatal(u.client, u.id, ephemerideCompteuse());
      expect(r).toEqual({ statut: "indisponible", raison: "ecriture_refusee" });
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC3 — la table naît fermée
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3] theme_natal : RLS activée ET forcée, aucun grant `anon`", () => {
  // `force row level security` (la RLS s'applique AUSSI au propriétaire de la table) n'a pas de
  // manifestation observable via PostgREST : aucun rôle joignable depuis un client n'est
  // propriétaire. On l'atteste donc au NIVEAU DU TEXTE de la migration — avec le contrôle du
  // contrôle qui va avec, sans quoi une migration renommée rendrait ce test vert pour toujours
  // (discipline (c) de `tests/tronc-absence.test.ts` : le balayage n'est jamais vide).
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/0039_theme_natal.sql"),
    "utf-8",
  );

  it("[CONTRÔLE DU CONTRÔLE] la migration 0039 est bien lue et parle bien de `theme_natal`", () => {
    expect(migration.length).toBeGreaterThan(2000);
    expect(migration).toContain("create table public.theme_natal");
  });

  it("la migration active ET force la RLS sur `theme_natal`", () => {
    expect(migration).toMatch(/alter table public\.theme_natal enable row level security/);
    expect(
      migration,
      "sans `force`, le propriétaire de la table échapperait à la RLS (AD-12)",
    ).toMatch(/alter table public\.theme_natal force\s+row level security/);
  });

  it("le WITH CHECK porte les DEUX gardes : consentement art. 9 ET barrière de minorité", () => {
    const policy = migration.slice(migration.indexOf("create policy theme_natal_ecriture"));
    expect(policy).toContain("public.a_consenti_art9()");
    expect(policy).toContain("not public.est_barre_minorite()");
  });

  it("les fonctions-trigger ne sont exécutables par AUCUN rôle client (patron 0007)", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.naissance_ecrite_une_fois\(\) from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.theme_natal_recalcul_declare\(\) from public, anon, authenticated/,
    );
  });

  it("une clé publishable NON authentifiée ne lit ni n'écrit `theme_natal`", async () => {
    const anonClient = clientScope();
    const { data, error: eLecture } = await anonClient.from("theme_natal").select("*");
    // ⚠️ CE TEST DISAIT L'INVERSE DE SON TITRE JUSQU'AU 2026-08-11 (revue, trouvaille E7).
    // Il assertait `eLecture === null` — c'est-à-dire que la requête ABOUTISSAIT, donc qu'`anon`
    // AVAIT bien le privilège SELECT et que seule la RLS le ramenait à zéro ligne. Le describe
    // promettait « aucun grant `anon` » et personne ne vérifiait aucun grant.
    // 0041 a révoqué les privilèges : le refus tombe maintenant au niveau du PRIVILÈGE (42501),
    // AVANT que la policy n'ait son mot à dire. Deux serrures au lieu d'une — c'est ce qui compte
    // le jour où une policy est écrite `using (true)` par recopie d'un gabarit.
    expect(
      eLecture?.code,
      "anon doit être refusé au privilège, pas seulement filtré par la RLS",
    ).toBe("42501");
    expect(data, "une table art. 9 a laissé fuir des lignes à un client anonyme").toBeNull();

    const { error: eEcriture } = await anonClient.from("theme_natal").insert({
      utilisatrice_id: "00000000-0000-0000-0000-000000000000",
      empreinte_entrees: "intrus",
      contenu: contenuValide,
    });
    expect(eEcriture).not.toBeNull();
  });

  it("une utilisatrice ne voit JAMAIS le thème d'une autre (isolation RLS, AD-12)", async () => {
    const a = await creerUtilisatrice("iso-a");
    const b = await creerUtilisatrice("iso-b");
    try {
      await consentir(a.id);
      const { error } = await a.client
        .from("theme_natal")
        .insert({ utilisatrice_id: a.id, empreinte_entrees: "e", contenu: contenuValide });
      expect(error).toBeNull();

      const { data } = await b.client.from("theme_natal").select("*").eq("utilisatrice_id", a.id);
      expect(data, "fuite inter-locataires sur une table art. 9").toEqual([]);
    } finally {
      await admin.auth.admin.deleteUser(a.id);
      await admin.auth.admin.deleteUser(b.id);
    }
  });
});
