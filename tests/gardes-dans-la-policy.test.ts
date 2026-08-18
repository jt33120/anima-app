import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { declarerMajorite } from "./_semis";

/**
 * REVUE DE CODE DU 2026-08-11, lot 1 — LES GARDES DU SEUIL, CONTRE LE VRAI SQL (migration 0041).
 *
 * ══ CE FICHIER REJOUE DES EXPLOITS QUI MARCHAIENT ═══════════════════════════════════════════════
 *
 * Chaque test négatif ci-dessous est une requête qui répondait `200` le 2026-08-10. Ce ne sont pas
 * des hypothèses : la revue les a passées contre l'API PostgREST locale, avec un vrai jeton, avant
 * d'écrire la migration. Les garder ici est la seule façon d'empêcher qu'un `grant` recopié d'un
 * gabarit, ou une colonne ajoutée à `utilisatrice` sans réflexion, ne les rouvre en silence.
 *
 * ══ LA LEÇON, ÉCRITE UNE FOIS POUR TOUTES ═══════════════════════════════════════════════════════
 *
 * Supabase accorde les sept privilèges DML à `anon` et `authenticated` sur chaque table de
 * `public`. Le modèle tient tant que CHAQUE garde vit dans une policy ou un trigger. Il tombe dès
 * qu'une garde vit dans une Server Action, une RPC ou une fonction TypeScript — parce qu'alors
 * rien n'oblige la cliente à emprunter ce chemin.
 *
 * Trois gardes du seuil vivaient hors des policies : la barrière de minorité (0006), le drapeau
 * `mineur_detecte` (1.4), et l'irréversibilité de la révocation art. 9 (1.6). Toutes les trois se
 * contournaient par un `PATCH` direct sur sa PROPRE ligne — la RLS était satisfaite, il n'y avait
 * plus rien d'autre.
 *
 * ══ POURQUOI CHAQUE NÉGATIF EST APPARIÉ À UN POSITIF ════════════════════════════════════════════
 *
 * Un `expect(error).not.toBeNull()` isolé est la plus fragile des assertions : une session non
 * authentifiée, un id qui ne matche rien, une faute de frappe dans le nom de table produisent tous
 * une erreur, et le test reste vert en ne prouvant RIEN. Chaque bloc prouve donc d'abord qu'une
 * écriture LÉGITIME passe par le même client, sur la même ligne — puis que l'écriture interdite ne
 * passe pas. Le refus vient alors du privilège ou du trigger, pas d'un montage cassé.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientAnonyme = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-gardes-123!";
const comptes: string[] = [];

/**
 * Crée un compte connecté. `majeure` pose la `date_naissance` que `/naissance` aurait posée : depuis
 * 0066 la majorité doit être POSITIVEMENT établie pour écrire de l'art. 9, donc un compte de banc qui
 * n'a jamais répondu est barré partout — comme en production. Les deux seuls appels à `false` sont
 * les tests qui écrivent EUX-MÊMES la date (elle est immuable : la poser deux fois lève).
 */
async function creerCompte(
  suffixe: string,
  majeure = true,
): Promise<{ id: string; client: SupabaseClient }> {
  const email = `gardes-${suffixe}-${t}@exemple.fr`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  if (majeure) await declarerMajorite(admin, id);
  comptes.push(id);

  const client = clientAnonyme();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: MDP });
  if (e2) throw new Error(`signIn: ${e2.message}`);
  return { id, client };
}

async function consentir(id: string): Promise<void> {
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  const { error } = await admin.from("consentement").insert({
    utilisatrice_id: id,
    art9_accorde: true,
    ia_reconnue: true,
    cgu_acceptees: true,
    revoked_at: null,
  });
  if (error) throw new Error(`consentir: ${error.message}`);
}

afterAll(async () => {
  for (const id of comptes) await admin.auth.admin.deleteUser(id);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// S1 — la barrière de minorité ne se lève pas soi-même
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[S1] la barrière de minorité (FR-071) est système-only", () => {
  let u: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    u = await creerCompte("s1");
    await consentir(u.id);
  });

  it("[CONTRÔLE POSITIF] la cliente écrit bien sur SA ligne — le montage n'est pas cassé", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ prenom: "Camille" })
      .eq("id", u.id);
    expect(error, "une colonne légitime doit rester écrivable sous JWT").toBeNull();
  });

  it("le système pose la barrière (service_role) — donc la colonne EST écrivable par quelqu'un", async () => {
    const { error } = await admin.rpc("appliquer_barriere_minorite", {
      cible: u.id,
      echeance: "2099-01-01",
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("utilisatrice")
      .select("barriere_minorite_le, echeance_suppression")
      .eq("id", u.id)
      .single();
    expect(data!.barriere_minorite_le).not.toBeNull();
  });

  it("EXPLOIT S1 : la cliente NE PEUT PLUS lever sa propre barrière", async () => {
    // Cette requête répondait 200 avant 0041. Elle levait la suspension d'un compte mineur — et
    // la rendait DÉFINITIVEMENT irré-applicable, `appliquer_barriere_minorite` violant ensuite
    // `audit_securite_minorite_unique` et roulant en arrière.
    const { error } = await u.client
      .from("utilisatrice")
      .update({ barriere_minorite_le: null })
      .eq("id", u.id);
    expect(error, "PATCH barriere_minorite_le=null doit être refusé").not.toBeNull();
    expect(error!.code, "refus au niveau du PRIVILÈGE, pas de la RLS").toBe("42501");

    const { data } = await admin
      .from("utilisatrice")
      .select("barriere_minorite_le")
      .eq("id", u.id)
      .single();
    expect(data!.barriere_minorite_le, "la barrière tient").not.toBeNull();
  });

  it("EXPLOIT S1 (suite) : l'échéance de suppression n'est pas effaçable non plus", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ echeance_suppression: null })
      .eq("id", u.id);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("la mention `socle_complete_annonce_le` (0040) est hors de portée : pas de mention re-déclenchable", async () => {
    // Sans ce revoke, une remise à `null` re-déclencherait à volonté une phrase que 0040 promet
    // unique à vie. Ce n'est pas une faille de sécurité — c'est une promesse produit rendue tenable.
    const { error } = await u.client
      .from("utilisatrice")
      .update({ socle_complete_annonce_le: null })
      .eq("id", u.id);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// S1bis — `mineur_detecte` est monotone
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[S1bis] `mineur_detecte` se pose, ne se retire pas (FR-070)", () => {
  let u: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    u = await creerCompte("s1bis");
    await consentir(u.id);
  });

  it("[CONTRÔLE POSITIF] false → true passe sous JWT : c'est le chemin de la déclaration d'âge (1.4)", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ mineur_detecte: true })
      .eq("id", u.id);
    expect(error, "app/(auth)/naissance/actions.ts pose ce drapeau sous JWT").toBeNull();
  });

  it("EXPLOIT S1bis : true → false est refusé par le trigger", async () => {
    // Un compte marqué mineur a `date_naissance = null` : se dé-marquer le renvoyait vers
    // /naissance, où il pouvait déclarer une date d'adulte. La barrière « refusée à CHAQUE
    // connexion » durait le temps d'une requête.
    const { error } = await u.client
      .from("utilisatrice")
      .update({ mineur_detecte: false })
      .eq("id", u.id);
    expect(error, "le retrait du drapeau doit lever").not.toBeNull();
    expect(error!.message).toContain("une barrière de minorité se pose");
  });

  it("le trigger ne fait AUCUNE exception — `service_role` non plus ne le retire", async () => {
    const { error } = await admin
      .from("utilisatrice")
      .update({ mineur_detecte: false })
      .eq("id", u.id);
    expect(error, "une protection sans exception de rôle est une protection").not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// S2 — la révocation art. 9 est terminale, et la preuve est une preuve
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[S2] le consentement art. 9 : révocation terminale, preuve inaltérable (AD-13, 1.6 AC4)", () => {
  let u: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    u = await creerCompte("s2");
    await consentir(u.id);
  });

  it("[CONTRÔLE POSITIF] la révocation par la cliente PASSE — c'est son droit (FR-066)", async () => {
    const { error } = await u.client
      .from("consentement")
      .update({ revoked_at: new Date().toISOString() })
      .eq("utilisatrice_id", u.id)
      .is("revoked_at", null);
    expect(error, "révoquer est un droit, il doit rester exerçable").toBeNull();
    expect((await u.client.rpc("a_consenti_art9")).data).toBe(false);
  });

  it("EXPLOIT S2 : `revoked_at → null` est refusé — pas de reconquête", async () => {
    // Cette requête répondait 200 avant 0041 : elle rouvrait le write-gate art. 9 ET la scène,
    // exactement ce que `consentement/actions.ts:43` interdit en commentaire depuis la 1.6.
    const { error } = await u.client
      .from("consentement")
      .update({ revoked_at: null })
      .eq("utilisatrice_id", u.id);
    expect(error, "dé-révoquer doit lever").not.toBeNull();
    expect(error!.message).toContain("la révocation est définitive");
    expect(
      (await u.client.rpc("a_consenti_art9")).data,
      "le write-gate reste fermé",
    ).toBe(false);
  });

  it("`service_role` non plus ne dé-révoque : aucun chemin système n'existe", async () => {
    const { error } = await admin
      .from("consentement")
      .update({ revoked_at: null })
      .eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
  });

  it("EXPLOIT S2 (suite) : `cree_le` n'est pas antidatable — la preuve de licéité tient", async () => {
    // `cree_le` protège le RESPONSABLE DE TRAITEMENT, pas le sujet. Qu'elle soit réécrivable par
    // le sujet la vide de toute valeur probante (RGPD art. 7-1).
    const { error } = await u.client
      .from("consentement")
      .update({ cree_le: "1999-01-01T00:00:00Z" })
      .eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("preuve horodatée");
  });

  it("EXPLOIT S2 (suite) : la cliente ne DÉTRUIT pas sa preuve de consentement", async () => {
    const { error } = await u.client
      .from("consentement")
      .delete()
      .eq("utilisatrice_id", u.id);
    expect(error, "supprimer la preuve doit être refusé").not.toBeNull();
    expect(error!.code).toBe("42501");

    const { data } = await admin
      .from("consentement")
      .select("utilisatrice_id")
      .eq("utilisatrice_id", u.id)
      .maybeSingle();
    expect(data, "la ligne de preuve est toujours là").not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// S3 — le thème natal ne se ré-écrit pas par un aller-retour delete/insert
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[S3] `theme_natal` : « calculé une fois et gravé » (AD-6) tient aussi contre un DELETE", () => {
  let u: { id: string; client: SupabaseClient };
  const contenu = {
    schema: 2,
    adaptateur: "test",
    positions: [],
    absents: [],
    angles: {},
    precision: "heure_connue",
  };

  beforeAll(async () => {
    u = await creerCompte("s3");
    await consentir(u.id);
    await admin.from("utilisatrice").update({ date_naissance: "1990-06-15" }).eq("id", u.id);
  });

  it("[CONTRÔLE POSITIF] la cliente grave bien son thème (le write-gate la laisse passer)", async () => {
    const { error } = await u.client
      .from("theme_natal")
      .insert({ utilisatrice_id: u.id, empreinte_entrees: "v2|origine", contenu });
    expect(error, "premier calcul : l'écriture est légitime").toBeNull();
  });

  it("EXPLOIT S3 : le DELETE est refusé — le trigger d'immuabilité n'est plus contournable", async () => {
    // Avant 0041 : `delete` puis `insert` remettait `version := 1` et acceptait n'importe quel
    // contenu. Pire, en recopiant d'abord son `empreinte_entrees`, le faux thème n'était ensuite
    // JAMAIS recalculé — `lireThemeNatal` rend `dejaLa` quand l'empreinte correspond.
    const { error } = await u.client.from("theme_natal").delete().eq("utilisatrice_id", u.id);
    expect(error, "supprimer son thème doit être refusé").not.toBeNull();
    expect(error!.code).toBe("42501");

    const { data } = await admin
      .from("theme_natal")
      .select("version, empreinte_entrees")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(data!.version).toBe(1);
    expect(data!.empreinte_entrees).toBe("v2|origine");
  });

  it("l'UPDATE nu reste refusé par le trigger de 0039 (la garde d'origine n'a pas bougé)", async () => {
    const { error } = await u.client
      .from("theme_natal")
      .update({ contenu: { ...contenu, adaptateur: "forge" } })
      .eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
  });

  it("FR-067 intact : `service_role` supprime toujours, donc l'effacement du compte propage", async () => {
    const v = await creerCompte("s3-eff");
    await consentir(v.id);
    await admin
      .from("theme_natal")
      .insert({ utilisatrice_id: v.id, empreinte_entrees: "eff", contenu });
    const { error } = await admin.from("theme_natal").delete().eq("utilisatrice_id", v.id);
    expect(error, "le revoke ne doit pas casser le droit à l'effacement").toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// E7 — « aucun grant anon » devient enfin une affirmation vérifiée
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[E7] `anon` n'a plus AUCUN privilège sur les trois tables du seuil", () => {
  /**
   * La revue a trouvé un describe intitulé « aucun grant `anon` » dont le seul test anonyme
   * établissait le CONTRAIRE : l'erreur était `null`, donc la requête aboutissait, donc `anon`
   * avait bien le privilège SELECT et seule la RLS la ramenait à zéro ligne.
   *
   * Le refus au niveau du privilège est la DEUXIÈME serrure : elle tient le jour où une policy
   * est écrite `using (true)` par recopie d'un gabarit — c'est-à-dire le jour où la première casse.
   */
  for (const table of ["utilisatrice", "consentement", "theme_natal"]) {
    it(`\`${table}\` : une clé publishable non authentifiée est refusée au privilège (42501)`, async () => {
      const anon = clientAnonyme();
      const { data, error } = await anon.from(table).select("*");
      expect(error?.code, `${table} doit refuser anon avant la RLS`).toBe("42501");
      expect(data).toBeNull();
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// NON-RÉGRESSION — tout ce que l'application écrit vraiment sous JWT continue de passer
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[NON-RÉGRESSION] les neuf colonnes re-grantées couvrent exactement les besoins réels", () => {
  /**
   * Le correctif retire l'UPDATE de TABLE et rend nommément neuf colonnes. Si l'inventaire est
   * incomplet, un parcours casse en production sans qu'aucun autre test ne s'en aperçoive — les
   * Server Actions rendent toutes « Enregistrement impossible. Réessaie. » sur erreur, donc la
   * panne serait muette. Ce bloc écrit les neuf, une par une, par le même chemin que l'application.
   */
  it("naissance (1.4) : date_naissance + prenom + nom_complet", async () => {
    const u = await creerCompte("nr-naissance", false);
    const { error } = await u.client
      .from("utilisatrice")
      .update({ date_naissance: "1990-06-15", prenom: "Alix", nom_complet: "Alix Martin" })
      .eq("id", u.id);
    expect(error).toBeNull();
  });

  it("heure de naissance (5.3) : heure + lieu + latitude + longitude + fuseau", async () => {
    const u = await creerCompte("nr-heure");
    await consentir(u.id);
    const { error } = await u.client
      .from("utilisatrice")
      .update({
        heure_naissance: "07:15:00",
        lieu_naissance: "Bordeaux",
        lieu_latitude: 44.84,
        lieu_longitude: -0.58,
        lieu_fuseau: "Europe/Paris",
      })
      .eq("id", u.id);
    expect(error).toBeNull();
  });

  it("consentement initial (1.5) : l'upsert idempotent passe toujours", async () => {
    const u = await creerCompte("nr-consent");
    const payload = {
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
      revoked_at: null,
    };
    const p = await u.client.from("consentement").upsert(payload, { onConflict: "utilisatrice_id" });
    expect(p.error, "premier consentement").toBeNull();
    const q = await u.client.from("consentement").upsert(payload, { onConflict: "utilisatrice_id" });
    expect(q.error, "re-consentir est idempotent, pas une reconquête").toBeNull();
  });

  it("la RPC de 0040 pose toujours la mention, alors que la colonne est hors du grant", async () => {
    // La preuve que « retirer le grant » n'a pas cassé le chemin légitime : la fonction est
    // `security definer`, elle écrit avec les droits de son propriétaire, pas ceux de l'appelante.
    const u = await creerCompte("nr-mention", false);
    await consentir(u.id);
    await admin
      .from("utilisatrice")
      .update({ date_naissance: "1990-06-15", heure_naissance: "07:15:00" })
      .eq("id", u.id);
    const contenu = { schema: 2, adaptateur: "test", positions: [], absents: [], angles: {}, precision: "heure_connue" };
    await admin
      .from("theme_natal")
      .insert({ utilisatrice_id: u.id, empreinte_entrees: "a", contenu });
    await admin
      .from("theme_natal")
      .update({ version: 2, empreinte_entrees: "b", contenu })
      .eq("utilisatrice_id", u.id);

    // Deux temps depuis 0045 (revue B3) : la lecture ne dépense rien, l'écriture la consomme.
    const { data: due, error } = await u.client.rpc("annonce_socle_due");
    expect(error).toBeNull();
    expect(due, "la mention est encore due").toBe(true);
    expect((await u.client.rpc("marquer_annonce_socle_dite")).data, "elle se pose").toBe(true);
    expect((await u.client.rpc("annonce_socle_due")).data, "et reste unique à vie").toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La migration elle-même — le patron « révoquer la TABLE, puis re-granter les colonnes »
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[0041] la migration porte le bon patron de privilèges", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/0041_gardes_dans_la_policy.sql"),
    "utf8",
  );

  it("révoque l'UPDATE de TABLE avant de re-granter des colonnes", () => {
    // ⚠️ LE PIÈGE, DÉCOUVERT EN TESTANT LE CORRECTIF : `revoke update (colonne) … from
    // authenticated` NE FERME RIEN tant que le grant de TABLE subsiste — l'exploit passait encore.
    // L'ordre des deux instructions est donc porteur de sens, pas cosmétique.
    const iRevoke = migration.indexOf("revoke update on public.utilisatrice from authenticated");
    const iGrant = migration.indexOf("grant update (");
    expect(iRevoke, "le revoke de TABLE doit exister").toBeGreaterThan(-1);
    expect(iGrant, "le re-grant de colonnes doit exister").toBeGreaterThan(-1);
    expect(iGrant, "le re-grant vient APRÈS le revoke, sinon il est annulé").toBeGreaterThan(iRevoke);
  });

  it("ne re-grante AUCUNE des colonnes système", () => {
    const grant = migration.slice(
      migration.indexOf("grant update ("),
      migration.indexOf(") on public.utilisatrice to authenticated"),
    );
    for (const colonne of [
      "barriere_minorite_le",
      "echeance_suppression",
      "socle_complete_annonce_le",
      "cree_le",
    ]) {
      expect(grant, `${colonne} doit rester hors du grant`).not.toContain(colonne);
    }
  });

  it("les fonctions-trigger ne sont exécutables par aucun rôle client (patron 0007)", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.mineur_detecte_monotone\(\) from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.consentement_revocation_terminale\(\) from public, anon, authenticated/,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// S6 — LA TROUVAILLE CRITIQUE : une mineure DÉCLARÉE écrivait dans le journal art. 9
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[S6] une mineure déclarée au seuil n'écrit rien (FR-070, migration 0042)", () => {
  /**
   * Séquence reproduite contre l'API HTTP réelle le 2026-08-11, AVANT correctif :
   *   1. elle déclare 14 ans → `mineur_detecte = true`, `date_naissance` reste null, `signOut()` ;
   *   2. le compte n'est PAS désactivé — elle se reconnecte ;
   *   3. `est_barre_minorite()` rendait `false` (elle ne lisait que `barriere_minorite_le`) ;
   *   4. `POST /consentement` ACCEPTÉ → `a_consenti_art9()` à `true` ;
   *   5. `POST /entree_journal` ACCEPTÉ. Une enfant de quatorze ans dans une base art. 9.
   *
   * Les quatorze policies qui appellent `est_barre_minorite()` héritent du correctif d'un coup.
   * C'est la raison d'être d'une garde en fonction plutôt que recopiée quatorze fois — et la
   * raison pour laquelle ce bloc teste `entree_journal` ET `theme_natal` : deux tables, deux
   * epics, une seule serrure.
   */
  let u: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    u = await creerCompte("s6");
    // Le chemin RÉEL de app/(auth)/naissance/actions.ts pour un âge < 18.
    const { error } = await u.client
      .from("utilisatrice")
      .update({ mineur_detecte: true })
      .eq("id", u.id);
    if (error) throw new Error(`pose du drapeau mineur: ${error.message}`);
  });

  it("[CONTRÔLE] le compte d'une mineure reste connectable — le `signOut()` ne ferme rien", async () => {
    // Si ce contrôle tombait, tous les tests du bloc passeraient pour la mauvaise raison.
    const { data } = await u.client.auth.getUser();
    expect(data.user?.id, "la session vit toujours").toBe(u.id);
    const { data: etat } = await admin
      .from("utilisatrice")
      .select("date_naissance, mineur_detecte, barriere_minorite_le")
      .eq("id", u.id)
      .single();
    expect(etat!.mineur_detecte).toBe(true);
    expect(etat!.barriere_minorite_le, "AUCUNE barrière 1.9 posée — c'est tout le sujet").toBeNull();
  });

  it("`est_barre_minorite()` la voit barrée (elle rendait `false`)", async () => {
    expect((await u.client.rpc("est_barre_minorite")).data).toBe(true);
  });

  it("EXPLOIT S6 : elle ne peut pas s'auto-consentir à l'art. 9", async () => {
    const { error } = await u.client.from("consentement").insert({
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    });
    expect(error, "POST /consentement doit être refusé").not.toBeNull();
    expect((await u.client.rpc("a_consenti_art9")).data).toBe(false);
  });

  it("EXPLOIT S6 (suite) : le journal art. 9 lui est fermé", async () => {
    const { error } = await u.client.from("entree_journal").insert({
      utilisatrice_id: u.id,
      role: "utilisatrice",
      contenu: "un contenu qui ne devrait jamais entrer",
      cle_tour: `s6-${t}`,
    });
    expect(error).not.toBeNull();
  });

  it("EXPLOIT S6 (suite) : le thème natal aussi — la serrure est unique pour les 14 policies", async () => {
    const { error } = await u.client.from("theme_natal").insert({
      utilisatrice_id: u.id,
      empreinte_entrees: "mineure",
      contenu: { schema: 2, adaptateur: "test", positions: [], absents: [], angles: {} },
    });
    expect(error).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// S7 — le gap laissé par 0041 : le CONTENU de la preuve art. 9
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[S7] les drapeaux de consentement sont monotones (gap de 0041, migration 0042)", () => {
  let u: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    u = await creerCompte("s7");
    await consentir(u.id);
  });

  it("[CONTRÔLE POSITIF] le consentement idempotent passe toujours (true → true est un no-op)", async () => {
    const { error } = await u.client.from("consentement").upsert(
      {
        utilisatrice_id: u.id,
        art9_accorde: true,
        ia_reconnue: true,
        cgu_acceptees: true,
        revoked_at: null,
      },
      { onConflict: "utilisatrice_id" },
    );
    expect(error, "c'est le chemin de app/(auth)/consentement/actions.ts").toBeNull();
  });

  for (const drapeau of ["art9_accorde", "ia_reconnue", "cgu_acceptees"] as const) {
    it(`\`${drapeau}\` ne se retire pas par écriture directe`, async () => {
      // 0041 avait figé la DATE de la preuve et laissé son CONTENU réécrivable. La sortie prévue
      // est `revoked_at` — horodatée, et irréversible depuis 0041 — pas un PATCH silencieux.
      const { error } = await u.client
        .from("consentement")
        .update({ [drapeau]: false })
        .eq("utilisatrice_id", u.id);
      expect(error).not.toBeNull();
      expect(error!.message).toContain("ne se retire pas par écriture");
    });
  }

  it("false → true reste permis : un consentement PARTIEL doit pouvoir se compléter", async () => {
    const v = await creerCompte("s7-partiel");
    const { error: ePartiel } = await v.client.from("consentement").insert({
      utilisatrice_id: v.id,
      art9_accorde: false,
      ia_reconnue: false,
      cgu_acceptees: false,
    });
    expect(ePartiel).toBeNull();
    const { error } = await v.client
      .from("consentement")
      .update({ art9_accorde: true, ia_reconnue: true, cgu_acceptees: true })
      .eq("utilisatrice_id", v.id);
    expect(error, "etapeOnboarding renvoie vers /consentement tant qu'ils ne sont pas tous vrais").toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// NON-RÉGRESSION 0042 — ce que le gate de minorité ne doit SURTOUT PAS fermer
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[NON-RÉGRESSION 0042] la révocation reste un droit, même sous barrière", () => {
  it("un compte SOUS BARRIÈRE de minorité peut toujours révoquer son consentement (FR-066)", async () => {
    // Le gate `est_barre_minorite()` ne porte QUE sur l'INSERT. Retirer son consentement est un
    // droit qui ne se suspend pas avec le compte — et c'est exactement ce dont a besoin une
    // mineure détectée pendant ses 30 jours (FR-071).
    const u = await creerCompte("nr42-revoc");
    await consentir(u.id);
    await admin.rpc("appliquer_barriere_minorite", { cible: u.id, echeance: "2099-01-01" });
    expect((await u.client.rpc("est_barre_minorite")).data).toBe(true);

    const { error } = await u.client
      .from("consentement")
      .update({ revoked_at: new Date().toISOString() })
      .eq("utilisatrice_id", u.id)
      .is("revoked_at", null);
    expect(error, "révoquer doit rester possible sous barrière").toBeNull();
  });

  it("un compte SOUS BARRIÈRE lit toujours ses données (export avant suppression, 1.9 AC3)", async () => {
    const u = await creerCompte("nr42-export");
    await consentir(u.id);
    await u.client.from("entree_journal").insert({
      utilisatrice_id: u.id,
      role: "utilisatrice",
      contenu: "avant la barrière",
      cle_tour: `nr42-${t}`,
    });
    await admin.rpc("appliquer_barriere_minorite", { cible: u.id, echeance: "2099-01-01" });

    const { data, error } = await u.client.from("entree_journal").select("contenu").eq("utilisatrice_id", u.id);
    expect(error, "la LECTURE survit à la barrière — sinon l'export promis est impossible").toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
