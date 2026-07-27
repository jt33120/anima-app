import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mesurerRappel } from "@/lib/safety/mesure-rappel";

/**
 * Story 2.3 — le harnais de mesure des FAUX NÉGATIFS (FR-078). ⚠️ CHIFFRES NON CLINIQUES : ce test
 * prouve que la MACHINE de mesure fonctionne (le rappel est calculé, les dangers manqués comptés),
 * PAS une exactitude de détection. Le vrai rappel se mesurera sur le jeu de cas validé par un
 * professionnel + le modèle réel, à la porte pré-lancement.
 */

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/detresse-cas.provisoire.json"), "utf-8"),
) as { _avertissement: string; cas: { message: string; niveauAttendu: number }[] };

describe("mesurerRappel — la machine de mesure (FR-078)", () => {
  it("compte les faux négatifs (dangers manqués) et calcule le rappel", () => {
    const r = mesurerRappel([
      { attendu: 2, predit: 2 }, // détecté
      { attendu: 3, predit: 0 }, // FAUX NÉGATIF : danger vital manqué
      { attendu: 1, predit: 1 }, // détecté
      { attendu: 0, predit: 0 }, // vrai négatif (pas un positif réel)
    ]);
    expect(r.positifsReels).toBe(3);
    expect(r.fauxNegatifs).toBe(1);
    expect(r.tauxRappel).toBeCloseTo(2 / 3);
    expect(r.tauxFauxNegatifs).toBeCloseTo(1 / 3);
    expect(r.total).toBe(4);
  });

  it("un positif prédit sous le seuil est un faux négatif (2 rétrogradé à 1, seuil 2)", () => {
    const r = mesurerRappel([{ attendu: 2, predit: 1 }], 2);
    expect(r.fauxNegatifs).toBe(1); // sous le seuil de danger → manqué
    expect(r.tauxRappel).toBe(0);
  });

  it("aucun positif réel → rappel 1, aucun faux négatif (rien à manquer)", () => {
    const r = mesurerRappel([{ attendu: 0, predit: 0 }]);
    expect(r.positifsReels).toBe(0);
    expect(r.tauxRappel).toBe(1);
    expect(r.tauxFauxNegatifs).toBe(0);
  });

  it("la fixture est PROVISOIRE et bien formée (structure du jeu de cas à valider)", () => {
    expect(fixture._avertissement).toMatch(/PROVISOIRE|VALIDÉ PAR UN PRO/i);
    expect(fixture.cas.length).toBeGreaterThan(0);
    for (const c of fixture.cas) {
      expect(typeof c.message, JSON.stringify(c)).toBe("string");
      expect(c.message.length).toBeGreaterThan(0);
      expect([0, 1, 2, 3]).toContain(c.niveauAttendu);
    }
  });
});
