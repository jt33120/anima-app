import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

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

const SOURCES = [...fichiersSous("lib"), ...fichiersSous("app"), ...fichiersSous("render")];

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
