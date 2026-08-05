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
const { GET } = await import("@/app/api/ordonnanceur/route");

function req(entete?: string): Request {
  return new Request("http://local/api/ordonnanceur", {
    method: "GET",
    headers: entete ? { authorization: entete } : {},
  });
}

async function purger() {
  await admin.from("execution_job").delete().eq("job", "sante-ordonnanceur");
  await admin.from("incident_systeme").delete().eq("job", "sante-ordonnanceur");
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
    .eq("job", "sante-ordonnanceur");
  return count ?? -1;
}
async function incidentsDuRegistre(): Promise<number> {
  const { count } = await admin
    .from("incident_systeme")
    .select("*", { count: "exact", head: true })
    .eq("job", "sante-ordonnanceur");
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

  it("avec le bon secret → 200, et le job de santé a RÉELLEMENT tourné (ligne en base)", async () => {
    const r = await GET(req(`Bearer ${SECRET}`));
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { execute: boolean; jobs: { nom: string; issue: string }[] };
    expect(corps.execute).toBe(true);
    expect(corps.jobs).toEqual([{ nom: "sante-ordonnanceur", issue: "execute" }]);

    const { data } = await admin.from("execution_job").select("statut, tentatives").eq("job", "sante-ordonnanceur");
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
    expect(corps.jobs[0].issue).toBe("deja_fait");

    const { data } = await admin.from("execution_job").select("tentatives").eq("job", "sante-ordonnanceur");
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

  it("[NFR-022] la réponse ne porte que des identifiants techniques", async () => {
    const corps = await (await GET(req(`Bearer ${SECRET}`))).text();
    expect(corps).toBe(JSON.stringify({ execute: true, jobs: [{ nom: "sante-ordonnanceur", issue: "execute" }] }));
  });
});
