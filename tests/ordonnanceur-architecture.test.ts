import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { REGISTRE } from "@/lib/ordonnanceur/registre";
import { RESERVE_PERSONNE_MS } from "@/lib/domain/synthese";

/**
 * Story 4.8 (T8) — LES GARDES D'ARCHITECTURE. C'est ici que « aucun mécanisme périodique hors de
 * l'ordonnanceur » (AC1) cesse d'être une intention et devient une propriété du dépôt, vérifiée à chaque
 * push (AC4).
 *
 * Le raisonnement — le même qu'en 4.7, et il vaut d'être répété : on ne prouve pas une NON-EXISTENCE par
 * des exemples. Ce qu'on peut faire, c'est fermer les portes une à une et vérifier qu'il n'en reste qu'une.
 * D'où des gardes de SOURCE : elles prouvent le câblage, pas le comportement. Leur pendant comportemental
 * vit dans `ordonnanceur-endpoint` et `ordonnanceur-sql`.
 */

const RACINE = process.cwd();

function fichiersSous(dossier: string, extensions = [".ts", ".tsx"]): string[] {
  const base = resolve(RACINE, dossier);
  const trouves: string[] = [];
  const parcourir = (d: string) => {
    for (const entree of readdirSync(d)) {
      const chemin = join(d, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (extensions.some((e) => chemin.endsWith(e))) trouves.push(chemin);
    }
  };
  parcourir(base);
  return trouves;
}

/** Retire les commentaires : une MENTION en commentaire n'est pas un mécanisme (piège payé en 4.6 et 4.7). */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Les fichiers TypeScript de la RACINE. Ils manquaient (revue 4.8, défaut n°6) : `proxy.ts` — le middleware
 * de Next 16, exécuté sur CHAQUE requête — n'était couvert par aucune garde, pas plus que `next.config.ts`
 * ou un futur `instrumentation.ts`, qui est précisément l'endroit prévu par Next pour démarrer quelque chose
 * au boot du serveur. Trois endroits où poser un rythme parallèle, aucun surveillé.
 */
function fichiersRacine(): string[] {
  return readdirSync(RACINE)
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts"))
    .map((f) => join(RACINE, f))
    .filter((f) => statSync(f).isFile());
}

const SOURCES = [
  ...fichiersSous("lib"),
  ...fichiersSous("app"),
  ...fichiersSous("render"),
  ...fichiersRacine(),
];

/**
 * Un déclencheur périodique dans un workflow GitHub Actions. La menace était NOMMÉE par le commentaire de
 * la garde des routes (« un service externe, GitHub Actions… ») et n'était vérifiée nulle part : rien
 * n'empêchait d'ajouter à `ci.yml` un `on: schedule:` qui appelle une route avec un `curl`. Ce serait un
 * second ordonnanceur complet — hors registre, hors `vercel.json`, et hors de toute idempotence.
 */
function declencheurPeriodique(yaml: string): boolean {
  return /^\s*schedule:\s*$/m.test(yaml) || /^\s*-?\s*cron:\s*\S/m.test(yaml);
}

describe("[MÉTA] la garde de commentaires fonctionne dans les DEUX sens", () => {
  it("elle efface une mention en commentaire et conserve le code réel", () => {
    // Sans ce test, la garde ci-dessous pourrait être aveugle (tout effacer → jamais rouge) ou bavarde
    // (ne rien effacer → rouge sur une phrase d'explication) sans que rien ne le dise. La leçon de 4.6 :
    // une garde textuelle qu'on ne teste pas est une garde dont on ignore le sens.
    const source = ["// on n'utilise pas setInterval ici", "/* setInterval non plus */", "setInterval(f, 1);"].join(
      "\n",
    );
    const nettoye = sansCommentaires(source);
    expect((nettoye.match(/setInterval/g) ?? []).length, "exactement l'occurrence de CODE").toBe(1);
  });
});

describe("[AC1/AC4] il n'existe qu'UN mécanisme périodique dans ce dépôt", () => {
  it("`vercel.json` déclare EXACTEMENT un cron, et il pointe sur la porte unique", () => {
    // Mutation-cible : ajouter une seconde entrée `crons` pour un job « juste celui-là, il est petit ».
    // C'est toujours comme ça qu'un ordonnanceur unique cesse de l'être.
    const vercel = JSON.parse(readFileSync(resolve(RACINE, "vercel.json"), "utf-8")) as {
      crons?: { path: string; schedule: string }[];
    };
    expect(vercel.crons, "vercel.json doit déclarer les crons").toBeDefined();
    expect(vercel.crons).toHaveLength(1);
    expect(vercel.crons![0].path).toBe("/api/ordonnanceur");
    expect(vercel.crons![0].schedule, "une expression cron valide à 5 champs").toMatch(/^\S+( \S+){4}$/);
  });

  it("AUCUN `setInterval` nulle part — ni serveur, ni client", () => {
    // Le cas client compte autant que le serveur : une tâche périodique déclenchée par le navigateur est
    // un second rythme, non possédé, non idempotent, et invisible du côté serveur. L'AC1 le nomme
    // explicitement (« ni tâche déclenchée côté client »).
    const fautifs = SOURCES.filter((f) => /\bsetInterval\s*\(/.test(sansCommentaires(readFileSync(f, "utf-8")))).map(
      (f) => f.slice(RACINE.length + 1),
    );
    expect(fautifs).toEqual([]);
  });

  it("[MÉTA] le détecteur de cron GitHub Actions rougit sur un vrai cas et se tait sur le reste", () => {
    // Sans ce contrôle positif, la garde ci-dessous serait peut-être simplement aveugle — et un test
    // aveugle est vert pour toujours. La leçon de 4.6, appliquée à un troisième détecteur textuel.
    expect(declencheurPeriodique("on:\n  schedule:\n    - cron: '0 6 * * *'\n"), "un vrai cron").toBe(true);
    expect(declencheurPeriodique("on:\n  push:\n    branches: [main]\n"), "un push, non").toBe(false);
    expect(declencheurPeriodique("# schedule: rien ici\njobs:\n  schedule-doc:\n"), "un nom, non").toBe(false);
  });

  it("AUCUN workflow GitHub Actions ne déclare de déclencheur périodique", () => {
    const dossier = resolve(RACINE, ".github", "workflows");
    const fichiers = existsSync(dossier) ? readdirSync(dossier).filter((f) => /\.ya?ml$/.test(f)) : [];
    // Anti-vacuité : une garde qui ne lit aucun fichier passe toujours. Si les workflows déménagent, ce
    // test doit rougir plutôt que devenir silencieusement décoratif.
    expect(fichiers.length, "il doit y avoir au moins un workflow à inspecter").toBeGreaterThan(0);
    const fautifs = fichiers.filter((f) => declencheurPeriodique(readFileSync(join(dossier, f), "utf-8")));
    expect(fautifs, "un `on: schedule:` est un second ordonnanceur, invisible du registre").toEqual([]);
  });

  it("AUCUN cron dans les migrations — l'ordonnanceur n'est pas dans Postgres", () => {
    // `pg_cron` est la tentation évidente pour un job de base de données. Elle créerait un SECOND
    // ordonnanceur, invisible depuis le code, hors du registre, et incapable d'atteindre le port IA dont
    // dépendra la synthèse (4.9).
    const fautifs = fichiersSous("supabase/migrations", [".sql"])
      .filter((f) => /pg_cron|cron\.schedule/i.test(readFileSync(f, "utf-8")))
      .map((f) => f.slice(RACINE.length + 1));
    expect(fautifs).toEqual([]);
  });

  it("le répartiteur n'a qu'UN SEUL appelant applicatif : la porte", () => {
    // Mutation-cible : appeler `executerOrdonnanceur` depuis une autre route (« pour déclencher à la
    // main »). Chaque appelant supplémentaire est une porte de plus à authentifier — et celle qu'on
    // oubliera.
    const appelants = SOURCES.filter((f) => !f.endsWith(join("lib", "ordonnanceur", "executer.ts")))
      .filter((f) => /\bexecuterOrdonnanceur\s*\(/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(appelants).toEqual([join("app", "api", "ordonnanceur", "route.ts")]);
  });

  it("`CRON_SECRET` n'est lu que par la porte", () => {
    const lecteurs = SOURCES.filter((f) => /CRON_SECRET/.test(sansCommentaires(readFileSync(f, "utf-8")))).map((f) =>
      f.slice(RACINE.length + 1),
    );
    expect(lecteurs).toEqual([join("app", "api", "ordonnanceur", "route.ts")]);
  });

  it("aucune AUTRE route ne se présente comme un point d'entrée périodique", () => {
    // Mutation-cible : créer `app/api/cron/synthese/route.ts`. La garde `vercel.json` ne suffirait pas —
    // une route peut être déclenchée par un service externe (GitHub Actions, un ping tiers) sans jamais
    // apparaître dans `vercel.json`. Ici on ferme aussi cette porte-là.
    const suspectes = fichiersSous(join("app", "api"))
      .map((f) => f.slice(RACINE.length + 1))
      .filter((f) => /cron|scheduler|planificateur|tache|job/i.test(f));
    expect(suspectes).toEqual([]);
  });

  it("le registre est la SEULE liste de jobs, et le seul importateur des jobs", () => {
    const importateurs = SOURCES.filter((f) => !f.endsWith(join("lib", "ordonnanceur", "registre.ts")))
      .filter((f) => /from "@\/lib\/ordonnanceur\/jobs\//.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(importateurs, "un job importé hors du registre est un job qui tourne hors du registre").toEqual([]);
  });
});

describe("[AD-1] le domaine de l'ordonnanceur reste pur", () => {
  it("`lib/domain/ordonnanceur.ts` n'importe ni framework, ni infra, ni couche supérieure", () => {
    // La règle ESLint couvre déjà `lib/domain/**`. Ce test la double au niveau du dépôt : une règle de
    // lint se désactive par un commentaire sur une ligne, un test non.
    const source = readFileSync(resolve(RACINE, "lib/domain/ordonnanceur.ts"), "utf-8");
    expect(source).not.toMatch(/from "(next|@supabase|@\/lib\/data|@\/app|@\/render)/);
    expect(source, "et surtout : aucune I/O").not.toMatch(/\bfetch\s*\(|server-only/);
  });

  it("il n'existe qu'UNE implémentation de `avecDelai` dans le dépôt", () => {
    // Extraite en 4.8 : elle vivait à l'identique dans trois pipelines de sécurité, et l'ordonnanceur en
    // aurait fait une quatrième copie. Une garantie recopiée est une garantie qui finit par diverger d'un
    // seul côté — et ici, le côté qui diverge est celui qui décide d'un repli sûr (AD-15).
    const definitions = SOURCES.filter((f) =>
      /function avecDelai</.test(sansCommentaires(readFileSync(f, "utf-8"))),
    ).map((f) => f.slice(RACINE.length + 1));
    expect(definitions).toEqual([join("lib", "domain", "delai.ts")]);
  });
});

describe("[AC3] la configuration d'environnement est déclarée, pas devinée", () => {
  it("`.env.example` documente `CRON_SECRET` et `ANIMA_ENV`", () => {
    // Un secret non documenté est un secret qu'on oubliera de régler au déploiement — et la porte
    // répondrait alors 503 en silence, ce qui est sûr mais indéchiffrable.
    expect(existsSync(resolve(RACINE, ".env.example"))).toBe(true);
    const exemple = readFileSync(resolve(RACINE, ".env.example"), "utf-8");
    expect(exemple).toMatch(/^CRON_SECRET=/m);
    expect(exemple).toMatch(/^ANIMA_ENV=/m);
  });
});

describe("[AC5] le job de santé est le point fixe du signal public", () => {
  it("le registre déclare bien `sante-ordonnanceur`, QUOTIDIEN — le nom que la SQL code en dur", () => {
    // La clause d'homme mort de `sante_ordonnanceur_publique` (migration 0028) nomme ce job en dur et
    // suppose sa cadence QUOTIDIENNE : c'est ce qui garantit qu'une réussite doit apparaître toutes les
    // 24 h. Le renommer, ou le passer hebdomadaire, rendrait ce prédicat faux EN SILENCE — le signal
    // public dirait `degrade` pour toujours, et personne ne saurait pourquoi. La SQL ne peut pas importer
    // le registre ; ce test est la couture entre les deux.
    const sante = REGISTRE.find((j) => j.nom === "sante-ordonnanceur");
    expect(sante, "le job de santé doit rester au registre").toBeDefined();
    expect(sante!.cadence, "la clause d'homme mort suppose une réussite toutes les 24 h").toBe("quotidien");

    const migration = readFileSync(resolve(RACINE, "supabase", "migrations", "0028_sante_homme_mort.sql"), "utf-8");
    expect(migration, "le nom en dur dans la SQL et celui du registre sont le même").toContain(
      `job = '${sante!.nom}'`,
    );
  });

  it("la tolérance de chaque job dépasse STRICTEMENT un multiple de sa cadence", () => {
    // Revue 4.8, défaut n°9. Une tolérance posée pile sur un multiple de la cadence (48 h pour un job
    // quotidien) fait dépendre l'alerte de la dérive de planification de Vercel Cron, qui se compte en
    // minutes : la même panne alerte ou non selon le hasard de l'horaire. On exige donc que la tolérance
    // tombe au MILIEU d'un intervalle, jamais sur un de ses bords.
    for (const j of REGISTRE) {
      const pas = j.cadence === "quotidien" ? 24 : 168;
      const reste = j.toleranceHeures % pas;
      expect(reste, `${j.nom} : ${j.toleranceHeures} h est pile sur un multiple de ${pas} h`).not.toBe(0);
    }
  });

  it("chaque job du registre déclare sa date de mise en service", () => {
    // Sans elle, un job ajouté au registre est signalé « en retard » au tick même où il tourne pour la
    // première fois (défaut n°4). Le type l'impose déjà ; ce test empêche la valeur bidon (`new Date(0)`,
    // qui rendrait le repli équivalent à l'ancien).
    for (const j of REGISTRE) {
      expect(j.enServiceDepuis.getTime(), `${j.nom}`).toBeGreaterThan(new Date("2026-01-01").getTime());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// REVUE 4.9 / T3-3 — le budget du registre doit tenir dans celui de la plateforme
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[T3-3] Σ delaiMs + marge ≤ maxDuration", () => {
  it("[LE CŒUR] le registre ne peut pas promettre plus de temps que la lambda n'en a", () => {
    // Le défaut, invisible à la lecture parce qu'il vit dans une ADDITION répartie sur deux fichiers :
    // 15 000 (santé) + 50 000 (synthèse) = 65 s, contre `maxDuration = 60`. Le contrat écrit dans
    // `lib/domain/ordonnanceur.ts` — « un job qui dépasse est clos en échec, il ne mange pas le budget des
    // suivants » — ne tenait donc plus pour le dernier job du registre : la plateforme le tuait AVANT que
    // son propre `avecDelai` ne s'arme. Rien de clos, aucun incident levé, la ligne laissée `en_cours`
    // sous son bail. Un échec totalement muet — pas même le faux `job_echoue` du dépassement ordinaire.
    //
    // Aucun test ne l'attrapait : ce fichier vérifiait le nombre de crons, les tolérances et
    // `enServiceDepuis`, jamais le budget. Une garde qui vérifie tout sauf l'addition.
    //
    // Mutation-cible : remonter n'importe quel `delaiMs` du registre au-delà de la marge.
    const route = readFileSync(resolve(RACINE, "app/api/ordonnanceur/route.ts"), "utf-8");
    const trouve = route.match(/export const maxDuration\s*=\s*(\d+)/);
    expect(trouve, "`maxDuration` doit être déclaré sur la route").not.toBeNull();

    const maxDurationMs = Number(trouve![1]) * 1000;
    const somme = REGISTRE.reduce((total, job) => total + job.delaiMs, 0);

    // La marge couvre ce qui vit HORS des `avecDelai` : la vérification d'environnement, les
    // `reclamer`/`clore` de chaque job, la sérialisation de la réponse. Un aller-retour Supabase depuis
    // une lambda se compte en dizaines de millisecondes, mais il y en a deux par job et ils peuvent
    // traîner sur une base chargée.
    const MARGE_MS = 8_000;
    expect(
      somme + MARGE_MS,
      `Σ delaiMs = ${somme} ms + marge ${MARGE_MS} ms doit tenir dans maxDuration = ${maxDurationMs} ms`,
    ).toBeLessThanOrEqual(maxDurationMs);
  });

  it("chaque job garde de quoi faire au moins une unité de travail", () => {
    // Le pendant de la garde ci-dessus : rétrécir les budgets pour satisfaire l'addition n'est une
    // solution que tant que chaque job peut encore faire quelque chose. Le fan-out de synthèse doit
    // pouvoir servir AU MOINS une personne, sinon il rend la main à chaque tick et personne n'est jamais
    // servi — un système qui ne fait rien, et qui le fait sans se plaindre.
    const synthese = REGISTRE.find((j) => j.nom === "synthese-hebdomadaire");
    expect(synthese, "le job de synthèse est au registre").toBeDefined();
    expect(
      synthese!.delaiMs,
      "il faut de quoi tenter une personne : l'appel modèle plus ses allers-retours",
    ).toBeGreaterThanOrEqual(RESERVE_PERSONNE_MS);
  });
});
