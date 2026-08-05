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

/** Les jobs du registre — la purge et les compteurs suivent le registre, pas un nom en dur. */
const JOBS = ["sante-ordonnanceur", "synthese-hebdomadaire"];

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

  it("avec le bon secret → 200, et le job de santé a RÉELLEMENT tourné (ligne en base)", async () => {
    const r = await GET(req(`Bearer ${SECRET}`));
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { execute: boolean; jobs: { nom: string; issue: string }[] };
    expect(corps.execute).toBe(true);
    // Les DEUX jobs du registre tournent, dans l'ordre du registre. `synthese-hebdomadaire` ne trouve
    // aucune candidate dans cette base (aucun abonnement actif) et se clôt donc en réussite sans rien
    // produire — ce qui est exactement le comportement attendu d'un fan-out sans personne à servir.
    expect(corps.jobs).toEqual([
      { nom: "sante-ordonnanceur", issue: "execute" },
      { nom: "synthese-hebdomadaire", issue: "execute" },
    ]);

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
    expect(corps.jobs.map((j) => j.issue), "les DEUX fenêtres sont déjà prises").toEqual([
      "deja_fait",
      "deja_fait",
    ]);

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

  it("[AC5 — L'HOMME MORT] sans réussite récente du job de santé, le signal public dit `degrade`", async () => {
    // LE DÉFAUT N°1 DE LA REVUE, et le plus retors : `sante_ordonnanceur_publique` ne regardait QUE les
    // incidents. Or les incidents sont écrits PAR l'ordonnanceur. Un ordonnanceur qui ne tourne plus n'écrit
    // plus rien — donc plus aucun incident, donc `/api/health` répondait « ok ». Et comme la fenêtre des
    // incidents ne fait que deux jours, le signal s'AMÉLIORAIT à mesure que la panne durait. La sonde disait
    // le contraire de la vérité précisément dans le cas où elle sert.
    //
    // La correction (migration 0028) : on ne déclare la santé que si l'on peut MONTRER une réussite récente.
    // Une absence ne peut pas s'auto-signaler ; il faut donc lire l'absence, pas attendre un signal.
    await purger();

    // Précondition explicite : la clause d'homme mort est bien FAUSSE ici. Sans elle, l'assertion suivante
    // pourrait être satisfaite par un incident laissé par un autre test et ne rien prouver.
    const { count } = await admin
      .from("execution_job")
      .select("*", { count: "exact", head: true })
      .eq("job", "sante-ordonnanceur")
      .eq("statut", "reussi")
      .gt("termine_le", new Date(Date.now() - 48 * 3_600_000).toISOString());
    expect(count, "aucune réussite du job de santé dans les 48 h").toBe(0);

    const { data } = await admin.rpc("sante_ordonnanceur_publique");
    expect(data, "un ordonnanceur qui ne tourne pas ne se déclare pas sain").toBe("degrade");
  });

  it("[AC5] … et un vrai tick inscrit bien la réussite qui rouvre le droit de se dire sain", async () => {
    // Le contrôle positif de l'homme mort : sans lui, la garde ci-dessus serait satisfaite par une fonction
    // qui répond `degrade` en toutes circonstances — c'est-à-dire par un signal tout aussi inutile, à
    // l'envers. On n'assère pas ici la valeur GLOBALE du mot (elle dépend des incidents que d'autres
    // fichiers écrivent en parallèle), mais la seule chose que ce tick contrôle : sa propre réussite.
    await GET(req(`Bearer ${SECRET}`));
    const { count } = await admin
      .from("execution_job")
      .select("*", { count: "exact", head: true })
      .eq("job", "sante-ordonnanceur")
      .eq("statut", "reussi")
      .gt("termine_le", new Date(Date.now() - 48 * 3_600_000).toISOString());
    expect(count, "la réussite du tick est datée et visible de la clause d'homme mort").toBe(1);
  });

  it("[NFR-022] la réponse ne porte que des identifiants techniques", async () => {
    const corps = await (await GET(req(`Bearer ${SECRET}`))).text();
    expect(corps).toBe(
      JSON.stringify({
        execute: true,
        jobs: [
          { nom: "sante-ordonnanceur", issue: "execute" },
          { nom: "synthese-hebdomadaire", issue: "execute" },
        ],
      }),
    );
  });
});
