import { describe, it, expect } from "vitest";
import {
  REGIONS,
  REGION_ENTREE,
  estRegion,
  etatInitial,
  reducteurVue,
  projectionInitiale,
  type EtatVue,
  type IdRegion,
} from "@/lib/scene";

/**
 * Story 1.7 — le MODÈLE de scène pur (AD-7). On teste la LOGIQUE sans DOM (env node),
 * comme age.ts / etat-onboarding.ts. Si ce fichier importe quoi que ce soit de `render/`,
 * la garde d'architecture (scene-architecture.test.ts) le refuse.
 */

describe("Régions — catalogue et ordre de lecture (AC1/AC3)", () => {
  it("expose exactement 3 destinations directes, dans l'ordre (Accueil, Anam, L'arbre)", () => {
    expect(REGIONS.map((r) => r.id)).toEqual(["accueil", "anam", "arbre"]);
    expect(REGIONS.every((r) => r.destinationDirecte)).toBe(true);
  });

  it("chaque destination porte un libellé nommé non vide (doublage non-spatial)", () => {
    for (const r of REGIONS) expect(r.nom.trim().length).toBeGreaterThan(0);
  });

  it("le seuil est l'entrée, jamais une destination de la barre", () => {
    expect(REGION_ENTREE).toBe("seuil");
    expect(REGIONS.some((r) => r.id === "seuil")).toBe(false);
  });

  it("estRegion valide les ids connus et rejette le reste", () => {
    for (const id of ["seuil", "accueil", "anam", "arbre"]) expect(estRegion(id)).toBe(true);
    expect(estRegion("bibliotheque")).toBe(false);
    expect(estRegion("")).toBe(false);
  });
});

describe("reducteurVue — transition pure, propriétaire unique (AC1/AC2)", () => {
  it("l'état initial part du seuil", () => {
    expect(etatInitial.regionCourante).toBe("seuil");
  });

  it("« aller » mène vers chacune des destinations", () => {
    const cibles: IdRegion[] = ["accueil", "anam", "arbre"];
    for (const cible of cibles) {
      expect(reducteurVue(etatInitial, { type: "aller", cible }).regionCourante).toBe(cible);
    }
  });

  it("aller vers la région courante est idempotent (MÊME référence — aucun rerender/fondu inutile)", () => {
    const etat: EtatVue = { regionCourante: "accueil" };
    expect(reducteurVue(etat, { type: "aller", cible: "accueil" })).toBe(etat);
  });

  it("ne mute jamais l'état d'entrée (pureté)", () => {
    const avant = { ...etatInitial };
    reducteurVue(etatInitial, { type: "aller", cible: "arbre" });
    expect(etatInitial).toEqual(avant);
  });
});

describe("projectionInitiale — projection serveur en lecture seule, STUB (AC2)", () => {
  it("le tronc est présent", () => {
    expect(projectionInitiale.tronc.present).toBe(true);
  });

  it("aucune branche en 1.7, et la liste est gelée (lecture seule réelle, pas seulement au type)", () => {
    expect(Array.isArray(projectionInitiale.branches)).toBe(true);
    expect(projectionInitiale.branches).toHaveLength(0);
    expect(Object.isFrozen(projectionInitiale.branches)).toBe(true);
  });

  it("l'éveil est un scalaire borné 0→100 (pilote l'arbre, jamais affiché en chiffre)", () => {
    expect(typeof projectionInitiale.eveil).toBe("number");
    expect(projectionInitiale.eveil).toBeGreaterThanOrEqual(0);
    expect(projectionInitiale.eveil).toBeLessThanOrEqual(100);
  });
});
