import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.3 — la garde d'architecture du pipeline sécurité-d'abord (AD-16), prouvée par lecture de
 * fichiers (patron `frontiere-serveur`). On grep le NOM BRUT des modules (import, `await import`,
 * require, chaîne) après retrait des commentaires. Elle vérifie les invariants STRUCTURELS que les
 * tests unitaires ne peuvent pas voir :
 *   - le DÉTECTEUR n'est appelé QUE par le pipeline (aucun détecteur hors du pipeline) ;
 *   - la route exécute la SÉCURITÉ AVANT la génération, et n'a plus de niveau codé en dur ;
 *   - le classifieur reste PUR (aucun import infra) ;
 *   - la capacité `detection` force le FORT dans la politique (pas incident).
 */

const racine = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function fichiersTs(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => resolve(racine, dir, f));
}

const DETECTEUR = resolve(racine, "lib/safety/detecteur-detresse.ts");
const PIPELINE = resolve(racine, "lib/safety/pipeline.ts");
const ROUTE = resolve(racine, "app/api/anam/message/route.ts");
const CLASSIFIEUR = resolve(racine, "lib/safety/classer-detresse.ts");
const POLITIQUE = resolve(racine, "lib/ai/politique-tier.ts");

const tousSource = [...fichiersTs("app"), ...fichiersTs("lib"), ...fichiersTs("render")];

describe("Pipeline sécurité-d'abord — invariants d'architecture (AD-16)", () => {
  it("a bien scanné du code applicatif", () => {
    expect(tousSource.length).toBeGreaterThan(10);
  });

  it("le DÉTECTEUR n'est référencé QUE par le pipeline (aucun détecteur hors du pipeline)", () => {
    const autres = tousSource.filter((f) => f !== DETECTEUR && f !== PIPELINE);
    for (const f of autres) {
      expect(lire(f), `réf détecteur hors pipeline : ${f}`).not.toMatch(/detecteur-detresse/);
    }
    // Contrôle positif : le pipeline, lui, l'importe bien → la garde n'est pas vide.
    expect(lire(PIPELINE)).toMatch(/detecteur-detresse/);
  });

  it("la route exécute la SÉCURITÉ AVANT la génération (pipeline appelé avant le flux)", () => {
    const src = lire(ROUTE);
    // On cible les APPELS (`nom(`), pas les symboles nus (sinon l'`import` en tête fausse l'ordre).
    const iSecurite = src.indexOf("evaluerSecuriteDuTour(");
    const iFlux = src.indexOf("diffuserSousEgressArt9(");
    expect(iSecurite, "la route doit APPELER evaluerSecuriteDuTour").toBeGreaterThanOrEqual(0);
    expect(iFlux, "la route doit ouvrir le flux de réponse").toBeGreaterThanOrEqual(0);
    expect(iSecurite, "sécurité d'abord : la détection AVANT la génération (AD-16)").toBeLessThan(iFlux);
  });

  it("la route ne code plus le niveau de sécurité en dur (plus de `niveauSecurite = 0`)", () => {
    const src = lire(ROUTE);
    expect(src, "le niveau doit venir du verdict, jamais d'un littéral").not.toMatch(
      /niveauSecurite\s*(:\s*NiveauSecurite\s*)?=\s*[0-3]\b/,
    );
    expect(src).toMatch(/securite\.verdict\.niveau/); // il DÉRIVE du verdict
  });

  it("le classifieur (`classer-detresse`) reste PUR : aucun import infra, pas de server-only", () => {
    const src = lire(CLASSIFIEUR);
    expect(src, "aucun runtime import (seul `import type` est permis)").not.toMatch(/^\s*import\s+(?!type\b)/m);
    expect(src).not.toMatch(/server-only/);
    expect(src).not.toMatch(/@supabase|next\/|@\/lib\/data/);
  });

  it("la politique force le FORT pour la capacité `detection` (explicite, pas incident)", () => {
    expect(lire(POLITIQUE)).toMatch(/capacite\s*===\s*"detection"/);
  });
});

const MODELE_EPISODE = resolve(racine, "lib/safety/episode-detresse.ts");
const DEPOT_EPISODE = resolve(racine, "lib/safety/depot-episode.ts");
const MIGRATION_0010 = resolve(racine, "supabase/migrations/0010_episode_detresse.sql");
const MIGRATION_0011 = resolve(racine, "supabase/migrations/0011_episode_detresse_corrections.sql");

describe("Story 2.4 — épisode de détresse : invariants d'architecture (AD-17, AD-12, AD-14)", () => {
  it("le modèle d'épisode (`episode-detresse`) reste PUR : aucun import runtime, pas de server-only, pas d'infra", () => {
    const src = lire(MODELE_EPISODE);
    expect(src, "aucun runtime import (seul `import type` est permis)").not.toMatch(/^\s*import\s+(?!type\b)/m);
    expect(src).not.toMatch(/server-only/);
    expect(src).not.toMatch(/@supabase|next\/|@\/lib\/data/);
  });

  it("la transition `enregistrer_tour_detresse` n'est appelée QUE par le dépôt (jamais ailleurs)", () => {
    const autres = tousSource.filter((f) => f !== DEPOT_EPISODE);
    for (const f of autres) {
      expect(lire(f), `réf transition hors dépôt : ${f}`).not.toMatch(/enregistrer_tour_detresse/);
    }
    expect(lire(DEPOT_EPISODE)).toMatch(/enregistrer_tour_detresse/); // contrôle positif
  });

  it("la table `episode_detresse` naît deny-by-default (RLS + FORCE, AUCUNE policy) — art. 9 (AC3)", () => {
    const sql = readFileSync(MIGRATION_0010, "utf-8");
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/force\s+row level security/i);
    expect(sql, "server-authoritative : aucune policy cliente (comme usage_ia/audit_securite)").not.toMatch(
      /create policy/i,
    );
  });

  it("les SEUILS d'extinction ne sont PAS figés dans le SQL : durées reçues en arguments (AD-14)", () => {
    // La transition autoritaire vit dans 0010 puis 0011 (correctif) : ni l'une ni l'autre ne code de
    // durée en dur ; les deux passent par des paramètres (`episode-detresse` en est la source unique).
    for (const [f, sql] of [
      [MIGRATION_0010, readFileSync(MIGRATION_0010, "utf-8")],
      [MIGRATION_0011, readFileSync(MIGRATION_0011, "utf-8")],
    ] as const) {
      expect(sql, `aucun littéral d'intervalle dans ${f}`).not.toMatch(/interval\s+'/i);
    }
    // La version FAISANT AUTORITÉ est celle de 0011 (CREATE OR REPLACE) : elle reçoit les durées en args.
    const sql11 = readFileSync(MIGRATION_0011, "utf-8");
    expect(sql11).toMatch(/make_interval\(secs => p_duree_min_s\)/);
    expect(sql11).toMatch(/make_interval\(secs => p_fenetre_s\)/);
  });
});

const MODELE_RESSOURCES = resolve(racine, "lib/safety/ressources-aide.ts");
const AIDE_PAGE = resolve(racine, "app/aide/page.tsx");
const GARDE_COMMERCIALE = resolve(racine, "app/_commerce/GardeCommerciale.tsx");
const LIMITES = resolve(racine, "lib/safety/limites-commerciales.ts");
const LECTURE = resolve(racine, "lib/safety/episode-lecture.ts");

describe("Story 2.5 — filet hors-IA + garde de montage : invariants d'architecture (AD-9, AD-15, AD-7)", () => {
  it("le modèle `ressources-aide` reste PUR : aucun import runtime, pas de server-only, pas d'infra", () => {
    const src = lire(MODELE_RESSOURCES);
    expect(src, "aucun runtime import (seul `import type` est permis)").not.toMatch(/^\s*import\s+(?!type\b)/m);
    expect(src).not.toMatch(/server-only/);
    expect(src).not.toMatch(/@supabase|next\/|@\/lib\/data|@\/lib\/ai/);
  });

  it("le FILET `/aide` ne dépend d'AUCUN fournisseur IA (statique, AD-15)", () => {
    expect(lire(AIDE_PAGE)).not.toMatch(/@\/lib\/ai/);
  });

  it("la DÉCISION `limites_levees` vit dans `lib/safety` ; `render/` la consomme sans la dériver (AD-7)", () => {
    // La dérivation `fin IS NULL` (via episode_detresse_ouvert) est une SOURCE UNIQUE dans lib/safety…
    expect(lire(LECTURE)).toMatch(/episode_detresse_ouvert/);
    // …que la garde de montage consomme sans la réimplémenter (jamais deux horloges, AD-17)…
    expect(lire(LIMITES)).toMatch(/episodeDetresseOuvert/);
    expect(lire(LIMITES)).not.toMatch(/episode_detresse_ouvert/); // délègue, ne recopie pas la RPC
    // …et la garde de rendu NE parle jamais à la base ni ne dérive l'état elle-même (render muet).
    expect(lire(GARDE_COMMERCIALE)).not.toMatch(/episode_detresse_ouvert|@\/lib\/data\/supabase/);
    expect(lire(GARDE_COMMERCIALE)).toMatch(/limitesCommercialesLevees/);
  });
});
