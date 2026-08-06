import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { creerDepotSynthese } from "@/lib/data/depot-synthese";
import { PLAFOND_NOTIFICATION_HEURES } from "@/lib/domain/synthese";

/**
 * REVUE 4.9 (T4-2) — LE DÉPÔT, contre le VRAI Postgres.
 *
 * Ce module était livré sans aucun test, et l'absence était plus coûteuse qu'il n'y paraît : il est la
 * seule couture entre le TypeScript et le SQL. Les tests de job travaillent sur doublures — ils prouvent
 * l'ordre des effets, jamais que `p_plafond_octets` s'appelle bien `p_plafond_octets`. Une faute de
 * frappe dans un nom d'argument ne se voit ni au typage, ni à la lecture, ni dans un test à doublures :
 * elle se voit en production, sous la forme d'un `PGRST202` à six heures du matin.
 *
 * Deux mutants survivants de la campagne d'origine vivaient précisément ici :
 *   • `return data === true` → `return true` (le plafond de notification en fail-OPEN) ;
 *   • le plafond d'entrées remplacé par une constante (la valeur du domaine n'était jamais transmise).
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const t = Date.now();
const JOB = "synthese-hebdomadaire";

const depot = creerDepotSynthese();
const elle = { email: `depot-syn-${t}@exemple.fr`, id: "" };

beforeAll(async () => {
  if (!url || !secret) throw new Error("Supabase local requis.");
  const { data, error } = await admin.auth.admin.createUser({
    email: elle.email,
    password: "depot-syn-123!",
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  elle.id = data.user!.id;

  // Chaque écriture est VÉRIFIÉE. Une fixture qui échoue en silence produit des tests qui passent en
  // mesurant le vide — et c'est exactement ce qui vient de m'arriver : `abonnement.source_maj_le` est
  // NOT NULL sans défaut, l'insertion était refusée, et « aucune candidate » se lisait comme un verdict.
  async function ecrire(table: string, ligne: Record<string, unknown>) {
    const { error } = await admin.from(table).insert(ligne);
    if (error) throw new Error(`fixture ${table}: ${error.message}`);
  }

  await ecrire("consentement", {
    utilisatrice_id: elle.id,
    art9_accorde: true,
    ia_reconnue: true,
    cgu_acceptees: true,
  });
  await ecrire("abonnement", {
    utilisatrice_id: elle.id,
    etat: "actif",
    source_maj_le: new Date().toISOString(),
  });
  for (let i = 0; i < 4; i += 1) {
    await ecrire("entree_journal", {
      utilisatrice_id: elle.id,
      cle_tour: `${t}-dep-${i}`,
      role: "utilisatrice",
      contenu: `entrée numéro ${i}`,
      cree_le: `2026-02-0${i + 1}T10:00:00Z`,
    });
  }
});

afterAll(async () => {
  await admin.from("execution_job").delete().eq("cible_id", elle.id);
  if (elle.id) await admin.auth.admin.deleteUser(elle.id); // la cascade emporte le reste (FR-067)
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("les noms d'arguments correspondent — c'est TOUT ce que ce fichier prouve, et c'est beaucoup", () => {
  it("`candidates` atteint la fonction et rend une liste", async () => {
    // Mutation-cible : renommer `p_job` en `p_nom_job`. Aucun test à doublures ne rougirait ; ici, la
    // base répond `PGRST202` et la méthode lève.
    const liste = await depot.candidates(JOB, 5_000);
    expect(Array.isArray(liste)).toBe(true);
    expect(liste, "notre fixture est éligible et n'a jamais été servie").toContain(elle.id);
  });

  it("`personnesEnEchecRepete` atteint la fonction", async () => {
    expect(await depot.personnesEnEchecRepete(JOB)).toBeTypeOf("number");
  });

  it("[T5-2] `jetonDesabonnement` et `purgerNotifications` atteignent les leurs", async () => {
    // Ces deux méthodes sont arrivées avec le lot T5 et n'étaient couvertes par rien ici — c'est-à-dire
    // exactement le trou que ce fichier existe pour fermer. `p_utilisatrice` mal orthographié, ou
    // `jeton_courriel` renommé sans son appelant : aucun typage, aucune doublure, aucune relecture ne le
    // voient. La base, elle, répond `PGRST202`.
    const jeton = await depot.jetonDesabonnement(elle.id);
    expect(jeton, "un uuid, pas `null`").toMatch(/^[0-9a-f-]{36}$/);
    expect(await depot.jetonDesabonnement(elle.id), "stable d'un appel à l'autre").toBe(jeton);

    expect(await depot.purgerNotifications(30), "un nombre, pas `null`").toBeTypeOf("number");
  });

  it("[LE CŒUR] `materiau` transmet RÉELLEMENT les deux plafonds", async () => {
    // Mutant survivant de la campagne d'origine : le plafond du domaine remplacé par une constante en
    // dur dans le dépôt. Personne ne le voyait — les tests de domaine vérifiaient la VALEUR de la
    // constante, les tests de job vérifiaient qu'elle était PASSÉE à une doublure, et aucun ne vérifiait
    // qu'elle arrivait à la base. Ici, deux plafonds différents doivent donner deux résultats différents.
    const large = await depot.materiau(elle.id, 200, 200_000);
    expect(large.entrees).toHaveLength(4);
    expect(large.tronquee).toBe(false);

    const serre = await depot.materiau(elle.id, 2, 200_000);
    expect(serre.entrees, "le plafond d'ENTRÉES mord").toHaveLength(2);
    expect(serre.tronquee).toBe(true);

    const minuscule = await depot.materiau(elle.id, 200, 20);
    expect(minuscule.entrees.length, "le plafond d'OCTETS mord aussi").toBeLessThan(4);
    expect(minuscule.tronquee).toBe(true);
  });

  it("le matériau est chronologique, et son filigrane est utilisable tel quel", async () => {
    const m = await depot.materiau(elle.id, 200, 200_000);
    expect(m.entrees.map((e) => e.contenu)).toEqual([
      "entrée numéro 0",
      "entrée numéro 1",
      "entrée numéro 2",
      "entrée numéro 3",
    ]);
    expect(new Date(m.jusqu_a).getTime(), "une date, pas une chaîne quelconque").not.toBeNaN();
    expect(m.depuis, "aucune synthèse encore").toBeNull();
  });
});

describe("`enregistrer` rend l'identifiant, ou `null` — jamais un booléen déguisé", () => {
  it("[LE CŒUR] première écriture → un identifiant ; seconde sur la même période → `null`", async () => {
    // Le piège Postgres derrière : `on conflict do nothing returning id into v` laisse `v` à NULL, pas à
    // une valeur fausse. Un dépôt qui ferait `return data !== null ? data : "quelquechose"` ou qui
    // avalerait le type rendrait le rejeu indistinguable d'une écriture — donc un second courriel.
    const id = await depot.enregistrer(
      elle.id,
      "2026-02-01T10:00:00Z",
      "2026-02-04T10:00:00Z",
      "le récit de ces quatre jours",
      false,
    );
    expect(id, "un uuid").toMatch(/^[0-9a-f-]{36}$/);

    const rejeu = await depot.enregistrer(
      elle.id,
      "2026-02-01T10:00:00Z",
      "2026-02-04T10:00:00Z",
      "un second récit",
      false,
    );
    expect(rejeu, "la même période ne s'écrit pas deux fois").toBeNull();

    const { data } = await admin.from("synthese").select("contenu").eq("utilisatrice_id", elle.id);
    expect(data, "une seule ligne").toHaveLength(1);
    expect(data![0].contenu, "et c'est la PREMIÈRE — aucun écrasement silencieux").toBe(
      "le récit de ces quatre jours",
    );
  });

  it("une écriture pour une INÉLIGIBLE rend `null` sans lever — la garde est en base", async () => {
    // La garde `eligible_a_synthese` vit dans la fonction SQL (T2-2). Le dépôt doit la traduire
    // fidèlement : `null`, pas une exception, parce que « on n'avait pas le droit » et « la base est
    // tombée » ne se traitent pas pareil côté job.
    const inconnue = "00000000-0000-0000-0000-000000000000";
    expect(
      await depot.enregistrer(inconnue, "2026-02-01T00:00:00Z", "2026-02-02T00:00:00Z", "forgé", false),
    ).toBeNull();
  });
});

describe("`reserverNotification` — dans le doute, on n'envoie pas", () => {
  it("[LE CŒUR] la première réserve ; la même clé, non", async () => {
    const { data: syn } = await admin.from("synthese").select("id").eq("utilisatrice_id", elle.id).single();
    const cle = (syn as { id: string }).id;

    expect(await depot.reserverNotification(elle.id, "synthese_prete", cle, PLAFOND_NOTIFICATION_HEURES)).toBe(
      true,
    );
    expect(
      await depot.reserverNotification(elle.id, "synthese_prete", cle, PLAFOND_NOTIFICATION_HEURES),
      "idempotence",
    ).toBe(false);
  });

  it("[LE CŒUR — fail-CLOSED] un plafond refusé par la base ne devient JAMAIS une autorisation", async () => {
    // Mutant survivant de la campagne d'origine : `return data === true` → `return true`. Le dépôt
    // devenait fail-OPEN — toute réponse inattendue de la base autorisait l'envoi. Un courriel de trop
    // est irrattrapable ; un courriel de moins se rattrape à la prochaine ouverture de l'app, où la
    // synthèse attend de toute façon.
    //
    // `p_plafond_heures = 0` fait lever la fonction (garde T6-4), ce qui est exactement le cas « réponse
    // inattendue » qu'on veut éprouver de bout en bout.
    await expect(
      depot.reserverNotification(elle.id, "synthese_prete", "clé-absurde", 0),
    ).rejects.toThrow(/reserver_notification/);
  });
});

describe("l'adresse, et ce que les erreurs ont le droit de dire", () => {
  it("`adresse` rend celle d'`auth.users` — jamais recopiée dans une table `public`", async () => {
    expect(await depot.adresse(elle.id)).toBe(elle.email);
  });

  it("[LE CŒUR] un identifiant inconnu rend `null`, il ne lève pas", async () => {
    // Mutation-cible : laisser l'erreur remonter. `notifier` la rattraperait, mais le job compterait un
    // échec pour une personne dont la synthèse est parfaitement écrite — et elle reviendrait demain.
    expect(await depot.adresse("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("[NFR-022] les erreurs ne portent QUE le code Postgres, jamais un verbatim", async () => {
    // Le chemin d'erreur est celui qui journalise. S'il recopiait le message de PostgREST, celui-ci peut
    // contenir la valeur fautive — c'est-à-dire, sur ces tables-là, un morceau de journal intime.
    const erreur = await depot
      .materiau("pas-un-uuid", 10, 100)
      .then(() => null)
      .catch((e: Error) => e);

    expect(erreur, "la lecture échoue bien").toBeInstanceOf(Error);
    expect((erreur as Error).message).toMatch(/^materiau_synthese: [A-Z0-9]+$/);
    expect((erreur as Error).message, "aucun verbatim, aucune valeur").not.toMatch(/pas-un-uuid|entrée/);
  });
});
