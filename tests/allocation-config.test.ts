import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { limiteAllocationResiduelle } from "@/lib/ai/allocation-config";

/**
 * Story 3.4 (T2) — le VOLUME d'allocation résiduelle lu de la CONFIG à l'exécution (AC3, FR-079, SPINE
 * L.151 « paramètres produit lus à l'exécution, jamais codés en dur »). `null` = non configuré →
 * AUCUNE coupure (jamais de limite numérique en dur, jamais coupé à zéro — FR-058). Lu à CHAQUE appel
 * (jamais figé au chargement du module) → ops ajuste sans redéploiement de code.
 */

const CLE = "ALLOCATION_RESIDUELLE_TOURS";
const initial = process.env[CLE];
afterEach(() => {
  if (initial === undefined) delete process.env[CLE];
  else process.env[CLE] = initial;
});

describe("limiteAllocationResiduelle — lue à l'exécution, jamais codée en dur (AC3)", () => {
  it("env NON posé → null (aucune coupure : le mécanisme est inerte tant qu'ops ne configure pas)", () => {
    delete process.env[CLE];
    expect(limiteAllocationResiduelle()).toBeNull();
  });
  it("env = « 20 » → 20 (tours post-séance autorisés dans le mois)", () => {
    process.env[CLE] = "20";
    expect(limiteAllocationResiduelle()).toBe(20);
  });
  it("env = « 0 » → 0 (coupe juste après le bilan — choix produit VALIDE, distinct de non-configuré)", () => {
    process.env[CLE] = "0";
    expect(limiteAllocationResiduelle()).toBe(0);
  });
  it("lue à CHAQUE appel (pas figée au chargement) : un changement d'env est vu immédiatement", () => {
    process.env[CLE] = "5";
    expect(limiteAllocationResiduelle()).toBe(5);
    process.env[CLE] = "12";
    expect(limiteAllocationResiduelle()).toBe(12);
  });
  it("valeur INVALIDE → null (repli sûr : jamais une coupure sur une config douteuse)", () => {
    for (const mauvais of ["abc", "-5", "3.5", "  ", "12x", "1e3", "", "NaN"]) {
      process.env[CLE] = mauvais;
      expect(limiteAllocationResiduelle(), `« ${mauvais} » doit donner null`).toBeNull();
    }
  });
});

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const src = sansCommentaires(readFileSync(resolve(racine, "lib/ai/allocation-config.ts"), "utf-8"));

describe("Story 3.4 (T2) — la config lit l'ENV, ne code aucune limite en dur", () => {
  it("lit `process.env.ALLOCATION_RESIDUELLE_TOURS` (source unique, ajustable ops)", () => {
    expect(src).toMatch(/process\.env\.ALLOCATION_RESIDUELLE_TOURS/);
  });
  it("aucun nombre-limite en dur : le module ne contient AUCUN littéral numérique (FR-079)", () => {
    // Un défaut « = 20 » codé en dur violerait FR-079. Le seul module d'où sort la limite ne doit
    // porter aucun entier de repli (le repli est `null`, pas un nombre).
    expect(src, "aucun littéral numérique dans la source de la limite").not.toMatch(/\b\d+\b/);
  });
});
