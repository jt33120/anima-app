import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.5 (T6) — gardes d'architecture par LECTURE de fichiers (commentaires retirés → la garde ne matche
 * pas sa propre prose). Miroir des gardes 4.4 :
 *   (a) AUCUN accès table DIRECT `.from("branche")` côté applicatif — l'écriture/lecture passe par les
 *       fonctions possédées (RPC), jamais `.from(table)` (leçon R6 de 4.4) ;
 *   (b) les RPC possédées n'apparaissent QUE dans leur dépôt (creer → depot-branche ; ecarter/charger →
 *       depot-reconceptualisation) ;
 *   (c) AD-2 — le rendu de la proposition ne lit AUCUN secret (`process.env`).
 *
 * PÉRIMÈTRE : `app`+`lib`+`render`+`scripts` (récursif) + points d'entrée racine. Les `tests/` (qui écrivent
 * `.from("branche")` via service_role pour prouver la RLS) sont hors périmètre par construction.
 */

const racine = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function fichiersSource(dir: string): string[] {
  const abs = resolve(racine, dir);
  if (!existsSync(abs)) return [];
  return (readdirSync(abs, { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => /\.(ts|tsx|mjs|js|jsx)$/.test(f))
    .map((f) => resolve(abs, f));
}
const racineEntrees = ["proxy.ts", "instrumentation.ts"].map((f) => resolve(racine, f)).filter((p) => existsSync(p));
const tousSource = [
  ...fichiersSource("app"),
  ...fichiersSource("lib"),
  ...fichiersSource("render"),
  ...fichiersSource("scripts"),
  ...racineEntrees,
];

const DEPOT_BRANCHE = resolve(racine, "lib/data/depot-branche.ts");
const DEPOT_RECONCEPT = resolve(racine, "lib/data/depot-reconceptualisation.ts");

describe("branche — accès confiné aux fonctions possédées (T6a/R6)", () => {
  it("a bien scanné du code applicatif", () => {
    expect(tousSource.length).toBeGreaterThan(10);
  });

  it("aucun ACCÈS TABLE DIRECT `.from(\"branche\")` côté applicatif — tout passe par les RPC possédées (R6)", () => {
    const ACCES_TABLE = /\bfrom\s*\(\s*[`'"]branche\b/;
    for (const f of tousSource) {
      expect(lire(f), `accès table DIRECT à branche (interdit) : ${f}`).not.toMatch(ACCES_TABLE);
    }
    // Contrôles positifs/négatifs : attrape l'accès table, PAS la RPC ni le namespace d'erreur.
    expect('supabase.from("branche")').toMatch(ACCES_TABLE);
    expect("supabase.from(`branche`)").toMatch(ACCES_TABLE);
    expect('supabase.rpc("creer_branche_depuis_signal", …)').not.toMatch(ACCES_TABLE);
    expect("throw new Error(`branche.creerDepuisSignal: ${code}`)").not.toMatch(ACCES_TABLE);
  });

  it("la RPC `creer_branche_depuis_signal` n'apparaît QUE dans lib/data/depot-branche.ts", () => {
    const RPC = /\bcreer_branche_depuis_signal\b/;
    for (const f of tousSource) {
      if (f === DEPOT_BRANCHE) continue;
      expect(lire(f), `RPC de création hors du dépôt possédé : ${f}`).not.toMatch(RPC);
    }
    expect(lire(DEPOT_BRANCHE), "le dépôt appelle bien la RPC (garde non vide)").toMatch(RPC);
  });

  it("les RPC 4.6 `charger_branches_arbre` / `charger_echange_source` / `renommer_branche` n'apparaissent QUE dans depot-branche.ts", () => {
    const RPCS = /\b(charger_branches_arbre|charger_echange_source|renommer_branche)\b/;
    for (const f of tousSource) {
      if (f === DEPOT_BRANCHE) continue;
      expect(lire(f), `RPC arbre/renommage hors du dépôt possédé : ${f}`).not.toMatch(RPCS);
    }
    expect(lire(DEPOT_BRANCHE), "le dépôt appelle bien les RPC 4.6 (garde non vide)").toMatch(RPCS);
  });

  it("les RPC `ecarter_signal_reconceptualisation` / `charger_proposition_branche` n'apparaissent QUE dans depot-reconceptualisation.ts", () => {
    const RPCS = /\b(ecarter_signal_reconceptualisation|charger_proposition_branche)\b/;
    for (const f of tousSource) {
      if (f === DEPOT_RECONCEPT) continue;
      expect(lire(f), `RPC de proposition/refus hors du dépôt possédé : ${f}`).not.toMatch(RPCS);
    }
    expect(lire(DEPOT_RECONCEPT), "le dépôt appelle bien les RPC (garde non vide)").toMatch(RPCS);
  });
});

describe("AD-2 — le rendu de la proposition ne lit aucun secret (T6c)", () => {
  it("PropositionBranche.tsx (client) ne référence AUCUN process.env", () => {
    const src = lire(resolve(racine, "render/conversation/PropositionBranche.tsx"));
    expect(src).not.toMatch(/process\.env/);
  });
});
