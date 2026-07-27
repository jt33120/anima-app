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
