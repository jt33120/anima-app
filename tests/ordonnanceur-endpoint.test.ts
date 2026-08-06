import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Story 4.8 (T6) — LA PORTE, de bout en bout : la route → le répartiteur → la RPC → la base. Vrai Postgres,
 * vraie route, vrais en-têtes.
 *
 * Ce qui se joue ici et nulle part ailleurs : la porte est le SEUL point d'entrée d'un mécanisme périodique
 * dans ce produit, et l'Epic 6 lui confiera la rétention — c'est-à-dire la suppression de données. Une garde
 * d'authentification non testée sur ce chemin est un bouton « effacer » sans couvercle.
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const SECRET = "secret-ordonnanceur-de-test";

/**
 * ── LE REGISTRE EST DOUBLÉ, ET C'EST UN CORRECTIF, PAS UNE FACILITÉ (revue 4.9, T4-3) ──────────────────
 *
 * Ce fichier appelle la VRAIE route, donc le vrai répartiteur, donc — jusqu'ici — le vrai registre. En 4.8
 * c'était sans danger : le seul job n'avait d'effet que sur `execution_job` et `incident_systeme`, deux
 * tables que ce fichier borne. La 4.9 y a ajouté un job à effets sur les tables UTILISATRICES, sans que
 * personne ne remarque ce que ça changeait.
 *
 * Ce que ça changeait, prouvé pendant la revue : `synthese-sql.test.ts` crée en `beforeAll` des premium
 * consentantes avec du journal, et Vitest exécute les fichiers EN PARALLÈLE contre la même base. La porte
 * produisait donc de vraies synthèses pour de vraies lignes — ce qui (a) faisait virer au rouge, selon
 * l'entrelacement, les assertions du fichier voisin, et (b) appelait `creerPortCourriel()`, c'est-à-dire
 * l'adaptateur RESEND RÉEL dès qu'une clé traîne dans `.env.local`. Une suite de tests qui envoie du
 * courrier est un défaut, pas un détail.
 *
 * Le doublage porte des noms de jobs PRÉFIXÉS, ce qui referme aussi le second piège du même fichier : sa
 * purge visait les noms de PRODUCTION (`delete().in("job", JOBS)`) et détruisait donc les lignes des
 * autres fichiers. `ordonnanceur-sql.test.ts` faisait l'inverse depuis toujours (`like('essai-%')`).
 *
 * Ce que ce fichier prouve reste intact : l'authentification, le refus d'environnement, les codes de
 * retour, l'idempotence de la fenêtre. Que le registre RÉEL contienne les bons jobs est prouvé ailleurs,
 * par `ordonnanceur-architecture.test.ts` — et c'est sa place.
 */
// `vi.hoisted` : les noms doivent exister AVANT la fabrique de `vi.mock`, qui est remontée en tête de
// module. Un `const` ordinaire serait encore en zone morte au moment où la fabrique s'exécute.
const { JOB_A, JOB_B } = vi.hoisted(() => {
  const p = `porte-${Date.now()}`;
  return { JOB_A: `${p}-alpha`, JOB_B: `${p}-beta` };
});

vi.mock("@/lib/ordonnanceur/registre", () => ({
  REGISTRE: [
    {
      nom: JOB_A,
      cadence: "quotidien",
      toleranceHeures: 60,
      delaiMs: 5_000,
      enServiceDepuis: new Date("2026-08-05T00:00:00Z"),
      executer: async () => {},
    },
    {
      nom: JOB_B,
      cadence: "quotidien",
      toleranceHeures: 60,
      delaiMs: 5_000,
      enServiceDepuis: new Date("2026-08-05T00:00:00Z"),
      executer: async () => {},
    },
  ],
}));

const { GET } = await import("@/app/api/ordonnanceur/route");

function req(entete?: string): Request {
  return new Request("http://local/api/ordonnanceur", {
    method: "GET",
    headers: entete ? { authorization: entete } : {},
  });
}

/** Les jobs du registre — la purge et les compteurs suivent le registre, pas un nom en dur. */
const JOBS = [JOB_A, JOB_B];

async function purger() {
  await admin.from("execution_job").delete().in("job", JOBS);
  await admin.from("incident_systeme").delete().in("job", JOBS);
}

/**
 * Les compteurs sont BORNÉS AU REGISTRE, pas globaux. La suite s'exécute fichier par fichier en parallèle
 * et `ordonnanceur-sql` écrit ses propres lignes dans les mêmes tables : un `count(*)` global mesurerait
 * le voisin. On compte donc ce que CETTE route peut écrire — les jobs du registre — ce qui reste exactement
 * ce que les assertions veulent dire (« la porte n'a rien produit »).
 */
async function executionsDuRegistre(): Promise<number> {
  const { count } = await admin
    .from("execution_job")
    .select("*", { count: "exact", head: true })
    .in("job", JOBS);
  return count ?? -1;
}
async function incidentsDuRegistre(): Promise<number> {
  const { count } = await admin
    .from("incident_systeme")
    .select("*", { count: "exact", head: true })
    .in("job", JOBS);
  return count ?? -1;
}

describe("GET /api/ordonnanceur — la porte unique", () => {
  const envInitial = { cron: process.env.CRON_SECRET, anima: process.env.ANIMA_ENV };

  beforeAll(async () => {
    if (!url || !secret) throw new Error("Supabase local requis.");
  });
  beforeEach(async () => {
    process.env.CRON_SECRET = SECRET;
    delete process.env.ANIMA_ENV; // repli sur `local`, qui s'accorde avec la base locale
    await purger();
  });
  afterAll(async () => {
    if (envInitial.cron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = envInitial.cron;
    if (envInitial.anima === undefined) delete process.env.ANIMA_ENV;
    else process.env.ANIMA_ENV = envInitial.anima;
    await purger();
  });

  it("SANS secret configuré → 503, et RIEN n'est exécuté", async () => {
    // Mutation-cible : exécuter quand même quand `CRON_SECRET` est absent. Un ordonnanceur non authentifié
    // est déclenchable par n'importe qui, en boucle. On refuse de servir plutôt que de servir n'importe qui.
    delete process.env.CRON_SECRET;
    const r = await GET(req(`Bearer ${SECRET}`));
    expect(r.status).toBe(503);
    expect(await executionsDuRegistre(), "rien n'a été réclamé").toBe(0);
  });

  it("SANS en-tête, avec un mauvais secret, ou hors schéma Bearer → 401, et RIEN n'est exécuté", async () => {
    // Un cas volontairement ABSENT de cette liste : `Bearer <secret> ` avec un espace final. Il renvoie 200
    // — non parce que la porte l'accepte, mais parce que la spécification Fetch fait supprimer les espaces
    // de fin par `Headers` avant que la route ne voie l'en-tête. Le tester ici documenterait une propriété
    // de la couche HTTP en la faisant passer pour une propriété de notre garde.
    for (const entete of [
      undefined,
      "",
      "Bearer",
      "Bearer ",
      "Bearer mauvais-secret",
      `Basic ${SECRET}`,
      SECRET, // le secret nu, sans schéma
      `bearer ${SECRET}`, // schéma en minuscules : non
      `Bearer ${SECRET}x`,
      `Bearer ${SECRET.slice(0, -1)}`, // un caractère de moins : la comparaison n'est pas un préfixe
    ]) {
      const r = await GET(req(entete));
      expect(r.status, `en-tête « ${entete} »`).toBe(401);
    }
    expect(await executionsDuRegistre(), "aucune exécution n'a été réclamée").toBe(0);
  });

  it("avec le bon secret → 200, et le premier job a RÉELLEMENT tourné (ligne en base)", async () => {
    const r = await GET(req(`Bearer ${SECRET}`));
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { execute: boolean; jobs: { nom: string; issue: string }[] };
    expect(corps.execute).toBe(true);
    // Les DEUX jobs du registre (doublé) tournent, dans l'ordre du registre.
    expect(corps.jobs).toEqual([
      { nom: JOB_A, issue: "execute" },
      { nom: JOB_B, issue: "execute" },
    ]);

    const { data } = await admin.from("execution_job").select("statut, tentatives").eq("job", JOB_A);
    expect(data).toHaveLength(1);
    expect(data![0].statut).toBe("reussi");
  });

  it("[AC2] un SECOND appel dans la même fenêtre ne produit aucun second effet", async () => {
    // C'est le rejeu que Vercel Cron peut produire de lui-même (reprise après échec réseau). Il doit être
    // sans conséquence — et le rapport doit le DIRE (`deja_fait`), pas mentir en annonçant une exécution.
    await GET(req(`Bearer ${SECRET}`));
    const r = await GET(req(`Bearer ${SECRET}`));
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { jobs: { issue: string }[] };
    expect(corps.jobs.map((j) => j.issue), "les DEUX fenêtres sont déjà prises").toEqual([
      "deja_fait",
      "deja_fait",
    ]);

    const { data } = await admin.from("execution_job").select("tentatives").eq("job", JOB_A);
    expect(data, "toujours UNE seule ligne").toHaveLength(1);
    expect(data![0].tentatives, "et une seule tentative").toBe(1);
  });

  it("[AC3 — LE VERROU] un environnement en désaccord → 409, et AUCUNE écriture, pas même une plainte", async () => {
    // Le scénario réel : une préversion Vercel pointée par erreur sur la base de PROD. Ici on l'imite en
    // déclarant un déploiement `preview` face à une base qui dit `local`.
    //
    // Le détail qui fait la différence entre une garde et une garde honnête : on ne journalise même pas
    // l'incident EN BASE. On vient de conclure qu'on n'est peut-être pas dans la bonne base ; y écrire quoi
    // que ce soit contredirait la promesse (« n'opère que sur le projet de son propre environnement »).
    process.env.ANIMA_ENV = "preview";
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    const espionW = vi.spyOn(console, "warn").mockImplementation(() => {});

    const r = await GET(req(`Bearer ${SECRET}`));
    expect(r.status, "ni succès (rien n'a tourné) ni panne (tout a marché comme prévu)").toBe(409);
    expect((await r.json()).refus).toBe("desaccord");

    expect(await executionsDuRegistre(), "aucune exécution").toBe(0);
    expect(await incidentsDuRegistre(), "aucun incident écrit dans une base dont on doute").toBe(0);

    espion.mockRestore();
    espionW.mockRestore();
  });

  it("[AC3] un environnement RECONNU mais différent est refusé — la comparaison n'est pas cosmétique", async () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const env of ["preview", "production"]) {
      process.env.ANIMA_ENV = env;
      const r = await GET(req(`Bearer ${SECRET}`));
      expect(r.status, env).toBe(409);
    }
    // … et une valeur inventée retombe sur `local`, donc s'accorde : c'est le repli SÛR (un oubli de
    // configuration ne donne jamais le droit d'écrire dans la vraie base, il ne donne que le droit local).
    process.env.ANIMA_ENV = "recette";
    expect((await GET(req(`Bearer ${SECRET}`))).status).toBe(200);
    espion.mockRestore();
  });

  // Les deux tests de L'HOMME MORT (AC5) ont été DÉPLACÉS vers `ordonnanceur-sql.test.ts` par la revue
  // 4.9. Ils vérifiaient une clause SQL qui code `sante-ordonnanceur` EN DUR ; ce fichier double désormais
  // le registre pour ne plus produire d'effets sur les tables utilisatrices (T4-3), si bien que leur
  // précondition portait sur un nom de job doublé et ne prouvait plus rien. Un test qui reste vert après
  // avoir cessé de mesurer son objet est pire qu'un test absent.

  it("[NFR-022] la réponse ne porte que des identifiants techniques", async () => {
    const corps = await (await GET(req(`Bearer ${SECRET}`))).text();
    expect(corps).toBe(
      JSON.stringify({
        execute: true,
        jobs: [
          { nom: JOB_A, issue: "execute" },
          { nom: JOB_B, issue: "execute" },
        ],
      }),
    );
  });
});
