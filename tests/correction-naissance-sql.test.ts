import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apercuDeCorrection } from "@/lib/data/corriger-naissance";
import type { EphemerisPort, LectureCorps } from "@/lib/astro/port";

/**
 * Story 6.5b (migration 0060) — LA PORTE DE LA CORRECTION, ÉPROUVÉE EN BASE.
 *
 * Ce fichier frappe un Supabase LOCAL réel, parce que la garde de cette story vit ENTIÈREMENT dans
 * un trigger : `authenticated` détient le grant `update (heure_naissance)` depuis 0041, donc une
 * garde écrite en TypeScript ne garderait rien du tout.
 *
 *   AC1 — `valeur → autre valeur` est PERMIS (c'est la story : 0039 le refusait, QA T17).
 *   AC2 — chaque correction est comptée et datée PAR LE SERVEUR.
 *   AC3 — `valeur → null` reste refusé (un effacement n'est pas une rectification).
 *   AC4 — sans consentement art. 9 valide : REFUS (corriger fait regraver une donnée art. 9).
 *   AC5 — la trace est inforgeable par `authenticated` (aucun grant) ET par `service_role` (le
 *         trigger la réécrit). ⚠️ DEUX serrures, DEUX tests : voir l'encadré plus bas.
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

interface Compte {
  id: string;
  client: SupabaseClient;
}

/**
 * Une utilisatrice majeure, consentante, avec une heure de naissance DÉJÀ GRAVÉE — c'est-à-dire
 * l'état dans lequel la correction a un sens. L'heure est posée sous `service_role` : à ce
 * moment-là c'est `null → valeur`, donc le trigger n'y voit pas une correction, et le test qui
 * suit part bien d'un compteur à zéro.
 */
async function creerCompte(
  suffixe: string,
  options: { consent?: boolean; heure?: string | null } = {},
): Promise<Compte> {
  const { consent = true, heure = "14:30:00" } = options;
  const email = `cn-${suffixe}-${t}@exemple.fr`;
  const motDePasse = "test-cn-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;

  // ⚠️ LE LIEU EST POSÉ DÈS LA CRÉATION, et ce n'est pas de la décoration : sans coordonnées ni
  // fuseau, `calculerThemeNatal` déclare les angles `non_calcule` et l'ascendant vaut `null` des
  // deux côtés de l'aperçu. Le premier jet de ce fichier mesurait donc « rien ne change » sur un
  // thème qui n'avait simplement pas d'angles — un test vert sur un instrument débranché.
  const entrees: Record<string, string | number> = {
    date_naissance: "1990-06-15",
    lieu_naissance: "Bordeaux",
    lieu_latitude: 44.84,
    lieu_longitude: -0.58,
    lieu_fuseau: "Europe/Paris",
  };
  if (heure !== null) entrees.heure_naissance = heure;
  const { error: e2 } = await admin.from("utilisatrice").update(entrees).eq("id", id);
  if (e2) throw new Error(`entrées: ${e2.message}`);

  if (consent) {
    const { error: e3 } = await admin.from("consentement").upsert(
      { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
    if (e3) throw new Error(`consentement: ${e3.message}`);
  }

  const client = clientScope();
  const { error: e4 } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (e4) throw new Error(`signIn: ${e4.message}`);
  return { id, client };
}

async function etatDe(id: string) {
  const { data } = await admin
    .from("utilisatrice")
    .select("heure_naissance, naissance_corrections, naissance_corrigee_le")
    .eq("id", id)
    .single<{
      heure_naissance: string | null;
      naissance_corrections: number;
      naissance_corrigee_le: string | null;
    }>();
  return data!;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC1 + AC2 — la porte s'ouvre, et elle laisse une trace
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b/AC1] Corriger son heure de naissance est PERMIS", () => {
  let u: Compte;
  beforeAll(async () => {
    u = await creerCompte("ac1");
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("[LE CŒUR] `valeur → autre valeur` passe sous son propre JWT — 0039 le refusait", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ heure_naissance: "04:30:00" })
      .eq("id", u.id);
    expect(error, "la base refuse encore la correction que la story existe pour ouvrir").toBeNull();
    expect((await etatDe(u.id)).heure_naissance).toBe("04:30:00");
  });

  it("[AC2] la correction est comptée ET datée, par le SERVEUR", async () => {
    const apres = await etatDe(u.id);
    expect(apres.naissance_corrections).toBe(1);
    expect(apres.naissance_corrigee_le).not.toBeNull();
  });

  it("elle n'est PAS plafonnée : une seconde correction passe aussi (art. 16 ne s'épuise pas)", async () => {
    // ⚠️ C'EST LA DÉCISION LA PLUS CONTESTABLE DE LA STORY, donc celle qu'un test doit tenir. Un
    // plafond à une correction condamnerait quelqu'un qui se trompe DANS sa correction — strictement
    // pire qu'avant la story. Qui ajoutera un plafond fera rougir cette ligne, et devra répondre.
    const { error } = await u.client
      .from("utilisatrice")
      .update({ heure_naissance: "04:03:00" })
      .eq("id", u.id);
    expect(error).toBeNull();
    expect((await etatDe(u.id)).naissance_corrections).toBe(2);
  });

  it("réécrire LA MÊME heure n'est pas une correction : le compteur ne bouge pas", async () => {
    const avant = await etatDe(u.id);
    const { error } = await u.client
      .from("utilisatrice")
      .update({ heure_naissance: avant.heure_naissance })
      .eq("id", u.id);
    expect(error).toBeNull();
    const apres = await etatDe(u.id);
    expect(apres.naissance_corrections).toBe(avant.naissance_corrections);
    expect(apres.naissance_corrigee_le).toBe(avant.naissance_corrigee_le);
  });

  it("[CONTRÔLE] une écriture qui ne touche PAS les entrées laisse la trace intacte", async () => {
    // Sans ce contrôle, un trigger qui incrémenterait à CHAQUE update passerait les tests ci-dessus.
    const avant = await etatDe(u.id);
    const { error } = await u.client
      .from("utilisatrice")
      .update({ prenom: `p-${t}` })
      .eq("id", u.id);
    expect(error).toBeNull();
    expect((await etatDe(u.id)).naissance_corrections).toBe(avant.naissance_corrections);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC3 — ce qui reste refusé
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b/AC3] Une entrée se corrige, elle ne s'efface pas", () => {
  let u: Compte;
  beforeAll(async () => {
    u = await creerCompte("ac3");
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("[LE CŒUR] `valeur → null` est refusé, et par le MOTIF de l'effacement", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ heure_naissance: null })
      .eq("id", u.id);
    expect(error).not.toBeNull();
    // ⚠️ ON EXIGE LE MOTIF, pas seulement un refus. Sans ça, un mutant qui supprimerait la garde
    // d'effacement serait couvert par la garde de consentement ou par n'importe quelle autre erreur :
    // le test resterait vert en mesurant une garde qu'il ne visait pas. C'est le piège des défenses
    // redondantes, rencontré en 6.7 et en 6.8.
    expect(`${error!.message}`).toMatch(/naissance_effacement_refuse/);
    expect((await etatDe(u.id)).heure_naissance).toBe("14:30:00");
  });

  it("le refus d'effacement ne compte PAS une correction", async () => {
    expect((await etatDe(u.id)).naissance_corrections).toBe(0);
  });

  it("[LE CŒUR] le LIEU reste write-once, et par son PROPRE motif", async () => {
    // ⚠️ CE N'EST PAS UN OUBLI DE PÉRIMÈTRE. L'art. 16 vaut pour le lieu aussi ; la raison du refus
    // est technique et décisive : le lieu est QUATRE colonnes solidaires (nom, lat, lon, fuseau)
    // re-résolues depuis un code INSEE côté serveur. Un trigger ne peut pas vérifier qu'elles
    // viennent de la même commune — ouvrir la porte permettrait de corriger la seule latitude et
    // d'obtenir un nom de commune d'un côté, des coordonnées d'une autre. Plausible, faux.
    const { error } = await u.client
      .from("utilisatrice")
      .update({ lieu_latitude: 48.85 })
      .eq("id", u.id);
    expect(error).not.toBeNull();
    // Le motif PROPRE, pas celui de l'effacement ni celui du consentement : sans cette exigence, un
    // mutant qui supprimerait cette garde serait couvert par une autre, et le test resterait vert.
    expect(`${error!.message}`).toMatch(/lieu_naissance_write_once/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC4 — corriger fait regraver une donnée art. 9
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b/AC4] Sans consentement art. 9 valide, la correction est refusée", () => {
  let u: Compte;
  /** Le MÊME compte, sans consentement, mais dont l'heure n'a jamais été posée. */
  let vierge: Compte;
  beforeAll(async () => {
    u = await creerCompte("ac4", { consent: false });
    vierge = await creerCompte("ac4b", { consent: false, heure: null });
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
    if (vierge?.id) await admin.auth.admin.deleteUser(vierge.id);
  });

  it("[LE CŒUR] refus, et par le motif du CONSENTEMENT", async () => {
    // La raison n'est pas une précaution formelle : la correction n'a qu'un effet, faire regraver le
    // thème natal. Sans consentement, la regravure serait refusée par le WITH CHECK de 0039 — et
    // l'entrée corrigée pointerait sur un thème périmé, sans une erreur nulle part.
    const { error } = await u.client
      .from("utilisatrice")
      .update({ heure_naissance: "04:30:00" })
      .eq("id", u.id);
    expect(error).not.toBeNull();
    expect(`${error!.message}`).toMatch(/correction_sans_consentement/);
  });

  it("[LE CONTRE-TEST] le PREMIER remplissage (`null → valeur`) reste permis SANS consentement", async () => {
    // ⚠️ SANS CETTE LIGNE, LA GARDE CI-DESSUS SERAIT INDISTINGUABLE D'UNE GARDE POSÉE TROP HAUT.
    // Un trigger qui exigerait le consentement pour TOUTE écriture d'entrée passerait le test
    // précédent et casserait le parcours de complétion de la 5.3 — qui a lieu, par construction,
    // avant que le thème n'existe. C'est le remplacement qui exige le consentement, pas l'ajout.
    const { error } = await vierge.client
      .from("utilisatrice")
      .update({ heure_naissance: "09:00:00" })
      .eq("id", vierge.id);
    expect(error, "le premier remplissage a été refusé — la 5.3 est cassée").toBeNull();
    const etat = await etatDe(vierge.id);
    expect(etat.heure_naissance).toBe("09:00:00");
    expect(etat.naissance_corrections, "un ajout n'est pas une correction").toBe(0);
  });
});

describe("[6.5b/AC4 bis] Sous barrière de minorité, la correction est refusée", () => {
  let u: Compte;
  beforeAll(async () => {
    u = await creerCompte("minorite");
    // La barrière posée comme la pose `appliquer_barriere_minorite` (0042) : par en haut, et
    // `barriere_minorite_le` n'est pas accordée à `authenticated` (0041).
    const { error } = await admin
      .from("utilisatrice")
      .update({ barriere_minorite_le: new Date().toISOString() })
      .eq("id", u.id);
    if (error) throw new Error(`barrière: ${error.message}`);
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("[LE CŒUR] refus, et par le motif de la BARRIÈRE — pas par celui du consentement", async () => {
    // ⚠️ NÉ D'UN SURVIVANT (M7) : rien n'exerçait ce chemin. Le compte a un consentement VALIDE,
    // donc c'est bien la barrière qui doit mordre — et l'exiger par son motif propre est ce qui
    // empêche la garde de consentement de couvrir le mutant de celle-ci.
    const { error } = await u.client
      .from("utilisatrice")
      .update({ heure_naissance: "04:30:00" })
      .eq("id", u.id);
    expect(error, "une mineure barrée a pu corriger son heure de naissance").not.toBeNull();
    expect(`${error!.message}`).toMatch(/correction_sous_barriere/);
    expect((await etatDe(u.id)).heure_naissance).toBe("14:30:00");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC5 — la trace est inforgeable, et par DEUX serrures distinctes
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ CES DEUX TESTS NE SONT PAS UN DOUBLON, ET C'EST LA LEÇON DE 6.7/M4.
//
// Le grant absent arrête `authenticated`, à qui `service_role` n'est pas soumis. Le trigger arrête
// `service_role`, à qui aucun grant ne s'oppose. Un seul test les couvrirait tous les deux et
// laisserait un mutant survivre en silence : retirer l'un des deux ne ferait rougir personne.

describe("[6.5b/AC5] La trace ne se forge pas — deux serrures, deux attaquants", () => {
  let u: Compte;
  beforeAll(async () => {
    u = await creerCompte("ac5");
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("[SERRURE 1 — le grant] `authenticated` ne peut pas nommer la colonne", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ naissance_corrections: 99 })
      .eq("id", u.id);
    expect(error, "authenticated a obtenu l'UPDATE sur une colonne de trace").not.toBeNull();
    expect((await etatDe(u.id)).naissance_corrections).toBe(0);
  });

  it("[SERRURE 2 — le trigger] `service_role`, à qui aucun grant ne s'oppose, est normalisé", async () => {
    // `service_role` peut nommer la colonne. Ce qui l'arrête est la branche `else` du trigger, qui
    // repose l'ancienne valeur. Sans elle, une écriture système remettrait la trace à zéro et
    // effacerait l'historique de toutes les corrections passées.
    const { error } = await admin
      .from("utilisatrice")
      .update({ naissance_corrections: 99, naissance_corrigee_le: "2000-01-01T00:00:00Z" })
      .eq("id", u.id);
    expect(error).toBeNull();
    const apres = await etatDe(u.id);
    expect(apres.naissance_corrections, "le trigger a laissé passer une trace forgée").toBe(0);
    expect(apres.naissance_corrigee_le).toBeNull();
  });

  it("[PROPRIÉTÉ NON PRÉVUE, MESURÉE, CONSERVÉE] aucun chemin SYSTÈME ne peut corriger une entrée", async () => {
    // ⚠️ CE TEST EST NÉ D'UN ROUGE. Il attendait d'abord qu'une correction sous `service_role` passe
    // en se faisant simplement normaliser son compteur. Elle ne passe pas — et la raison est bonne :
    // `a_consenti_art9()` s'appuie sur `auth.uid()`, qui est NULL sans JWT. Le rôle système n'a pas
    // d'identité, donc il n'a jamais de consentement, donc il ne corrige jamais.
    //
    // La conséquence mérite d'être dite, parce qu'elle est plus forte que ce que la story visait :
    // **une correction d'entrée de naissance est toujours SON geste à elle, jamais un geste fait sur
    // elle.** Aucun support, aucun job, aucun script ne peut réécrire l'heure de naissance de
    // quelqu'un. Un correctif d'urgence exigerait de désactiver le trigger à la main — c'est-à-dire
    // un geste visible et délibéré, pas une requête de plus.
    const { error } = await admin
      .from("utilisatrice")
      .update({ heure_naissance: "06:15:00", naissance_corrections: 42 })
      .eq("id", u.id);
    expect(error, "un chemin système a pu corriger une entrée de naissance").not.toBeNull();
    expect(`${error!.message}`).toMatch(/correction_sans_consentement/);
    const apres = await etatDe(u.id);
    expect(apres.heure_naissance).toBe("14:30:00");
    expect(apres.naissance_corrections).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'APERÇU — exercé pour de vrai, contre la base
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE BLOC EST NÉ D'UN SURVIVANT (M30), ET C'EST LE MÊME PATRON QU'EN 6.8 (M25-M28) : la couche
// `lib/data` était doublée des deux côtés — le test de rendu la remplaçait par un `vi.fn`, le test
// de domaine ne la voyait pas. Un aperçu qui aurait comparé le thème d'AVANT avec lui-même aurait
// donc affiché « rien ne change » quelle que soit l'heure saisie, sans qu'un seul test rougisse.
//
// Or c'est exactement l'aperçu qui remplace le plafond de corrections qu'on n'a pas mis. S'il ment,
// la story n'a plus de justification.

describe("[6.5b] `apercuDeCorrection` — il compare bien DEUX heures", () => {
  let u: Compte;
  beforeAll(async () => {
    u = await creerCompte("apercu");
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  /** Un ciel qui tourne : à dix heures d'écart, l'ascendant n'est pas le même signe. */
  const portTournant: EphemerisPort = {
    identifiant: "double-apercu@1",
    longitudeEcliptique: (): LectureCorps => ({ statut: "calcule", longitude: 12.5 }),
    tempsSideralGreenwich: (t) => (t.getUTCHours() + t.getUTCMinutes() / 60) % 24,
    obliquiteVraie: () => 23.44,
  };

  it("[LE CŒUR] une heure DIFFÉRENTE produit un aperçu qui n'est pas « rien ne change »", async () => {
    const a = await apercuDeCorrection(u.client, u.id, "02:00:00", portTournant);
    expect(a, "aucun aperçu rendu alors que l'heure et la date sont en base").not.toBeNull();
    expect(a!.ascendantAvant, "l'ascendant d'avant n'a pas été calculé").not.toBeNull();
    expect(
      a!.sansChangementVisible,
      "l'aperçu compare le thème d'avant avec lui-même : il dirait toujours « rien ne change »",
    ).toBe(false);
    expect(a!.ascendantAvant).not.toBe(a!.ascendantApres);
  });

  it("[CONTRÔLE POSITIF] la MÊME heure produit bien « rien ne change »", async () => {
    // Sans ce contrôle, l'assertion ci-dessus passerait aussi sur un aperçu qui rendrait n'importe
    // quoi de différent à chaque appel.
    const a = await apercuDeCorrection(u.client, u.id, "14:30:00", portTournant);
    expect(a!.sansChangementVisible).toBe(true);
  });

  it("il n'ÉCRIT rien — aucune version de thème n'a bougé", async () => {
    // La propriété qui rend l'aperçu possible : `calculerThemeNatal` est pur. Un aperçu qui
    // graverait au passage ferait de chaque coup d'œil une correction.
    const avant = await admin
      .from("theme_natal")
      .select("version")
      .eq("utilisatrice_id", u.id)
      .maybeSingle<{ version: number }>();
    await apercuDeCorrection(u.client, u.id, "03:00:00", portTournant);
    const apres = await admin
      .from("theme_natal")
      .select("version")
      .eq("utilisatrice_id", u.id)
      .maybeSingle<{ version: number }>();
    expect(apres.data?.version ?? null).toBe(avant.data?.version ?? null);
  });

  it("sans heure gravée : aucun aperçu — il n'y a rien à corriger, il y a à ajouter", async () => {
    const vierge = await creerCompte("apercu-vide", { heure: null });
    const a = await apercuDeCorrection(vierge.client, vierge.id, "03:00:00", portTournant);
    await admin.auth.admin.deleteUser(vierge.id);
    expect(a).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES GARDES STRUCTURELLES — ce qu'aucun comportement ne peut prouver
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b] Gardes structurelles sur le corpus de migrations", () => {
  const racine = resolve(__dirname, "..");
  const lire = (f: string) => readFileSync(resolve(racine, f), "utf-8");

  it("[LA TROISIÈME SERRURE, GARDÉE PAR SA FORME] les deux CHECK de cohérence sont déclarés", () => {
    // ⚠️ NÉ D'UN SURVIVANT (M11), ET LE DIAGNOSTIC EST CELUI DES DÉFENSES REDONDANTES.
    //
    // AUCUN COMPORTEMENT NE PEUT LES FAIRE MORDRE, et c'est démontrable : le trigger est un BEFORE
    // UPDATE qui REPOSE lui-même les deux colonnes dans ses deux branches. Une écriture qui tenterait
    // `naissance_corrections = -1` sous `service_role` serait normalisée à l'ancienne valeur AVANT
    // que la contrainte ne soit évaluée. Elles ne servent donc que le jour où le trigger sera
    // désactivé (correctif d'urgence, nommé dans 0060) ou contourné par une migration future —
    // c'est-à-dire exactement les moments où plus personne ne regarde.
    //
    // On garde donc leur DÉCLARATION, comme la 6.1a garde les 60 h de l'homme mort en lisant la
    // définition SQL. C'est plus faible qu'une mesure, et c'est dit.
    const m = lire("supabase/migrations/0060_naissance_corrigible.sql");
    expect(m).toMatch(/check\s*\(naissance_corrections >= 0\)/);
    expect(m).toMatch(
      /check\s*\(\(naissance_corrections = 0\) = \(naissance_corrigee_le is null\)\)/,
    );
  });

  it("le write-once de 0039 est REMPLACÉ, pas doublé : sa fonction et son trigger sont drop", () => {
    // Sans ce contrôle, les deux triggers cohabiteraient : celui de 0039 refuserait la correction
    // AVANT que celui de 0060 ne l'autorise, et la story serait inerte — avec des tests verts
    // partout ailleurs, puisque tout le reste continuerait de marcher.
    const m = lire("supabase/migrations/0060_naissance_corrigible.sql");
    expect(m).toMatch(/drop trigger\s+if exists utilisatrice_naissance_ecrite_une_fois/);
    expect(m).toMatch(/drop function\s+if exists public\.naissance_ecrite_une_fois\(\)/);
  });

  it("les deux colonnes de trace ne sont accordées à `authenticated` NULLE PART", () => {
    // Le test de comportement ci-dessus mesure l'état ACTUEL de la base. Celui-ci garde le corpus :
    // un futur `grant update (…, naissance_corrections)` ferait rougir ici avant d'atteindre le cloud.
    const grants = lire("supabase/migrations/0041_gardes_dans_la_policy.sql");
    for (const f of ["0041_gardes_dans_la_policy.sql", "0060_naissance_corrigible.sql"]) {
      const src = lire(`supabase/migrations/${f}`);
      const accords = src.match(/grant update\s*\([^)]*\)\s*on public\.utilisatrice/gis) ?? [];
      for (const a of accords) {
        expect(a, `${f} accorde une colonne de trace`).not.toMatch(/naissance_correction/);
      }
    }
    // Anti-vacuité : le fichier de grants contient bien un `grant update (...)` à examiner.
    expect(grants).toMatch(/grant update\s*\(/i);
  });

  it("aucun recalculateur n'est écrit en SQL : la regravure reste paresseuse (D5 de la 5.3)", () => {
    const m = lire("supabase/migrations/0060_naissance_corrigible.sql");
    expect(m, "0060 touche theme_natal — la regravure doit rester à `lireThemeNatal`").not.toMatch(
      /(insert|update)\s+(into\s+)?public\.theme_natal/i,
    );
  });
});
