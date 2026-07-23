import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { echelleTypo, reglesTypo, type CleRole } from "@/app/styles/tokens";

/**
 * RÈGLES TYPOGRAPHIQUES DURES (AC3 / DESIGN.md §Typography) : graisse ≤ 500,
 * interligne ≥ 1.6 sur le texte de lecture, jamais < 13px, aucune capitale forcée,
 * WONK toujours à 0 sur Fraunces.
 */

const css = readFileSync(resolve(process.cwd(), "app/styles/globals.css"), "utf-8");

describe("Bornes typographiques (depuis tokens.ts)", () => {
  for (const [role, def] of Object.entries(echelleTypo)) {
    it(`${role} : graisse ${def.graisse} ≤ ${reglesTypo.graisseMax}`, () => {
      expect(def.graisse).toBeLessThanOrEqual(reglesTypo.graisseMax);
    });
    it(`${role} : taille ${def.tailleRem}rem ≥ plancher`, () => {
      const plancher = reglesTypo.rolesTailleReduite.includes(role as CleRole)
        ? reglesTypo.tailleMinExceptionRem
        : reglesTypo.tailleMinRem;
      expect(def.tailleRem).toBeGreaterThanOrEqual(plancher);
    });
  }

  for (const role of reglesTypo.rolesLecture) {
    it(`${role} : interligne ${echelleTypo[role].interligne} ≥ ${reglesTypo.interligneLectureMin}`, () => {
      expect(echelleTypo[role].interligne).toBeGreaterThanOrEqual(
        reglesTypo.interligneLectureMin,
      );
    });
  }

  it("WONK = 0 sur tous les rôles Fraunces", () => {
    for (const def of Object.values(echelleTypo)) {
      if (def.famille === "anam") expect(def.wonk).toBe(0);
    }
  });
});

describe("Règles dures dans globals.css", () => {
  it("aucune capitale forcée (text-transform: uppercase)", () => {
    expect(css).not.toMatch(/text-transform:\s*uppercase/i);
  });
});
