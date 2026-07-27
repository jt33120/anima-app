import { describe, it, expect } from "vitest";
import { tierPour, modelePour } from "@/lib/ai/politique-tier";

/**
 * Story 2.2 — la politique de tier UNIQUE `(capacité, niveau_sécurité) → tier` (AD-5, AC4).
 *
 * Invariant dur : dès `niveau_sécurité ≥ 1`, le modèle FORT est forcé pour TOUTE capacité
 * (détection ET réponse de détresse — jamais le léger, en aucune circonstance). Contrôle
 * positif + négatif (non tautologique). La garde `>= 1` est mutation-testée (Task A7).
 */
describe("Politique de tier — (capacité, niveau_sécurité) → tier (AD-5)", () => {
  it("niveau 0 : échange → léger", () => {
    expect(tierPour("echange", 0)).toBe("leger");
  });

  it("niveau 0 : reconceptualisation → fort", () => {
    expect(tierPour("reconceptualisation", 0)).toBe("fort");
  });

  it("niveau 0 : synthèse → fort", () => {
    expect(tierPour("synthese", 0)).toBe("fort");
  });

  it("niveau par défaut (absent) = 0 : échange → léger", () => {
    expect(tierPour("echange")).toBe("leger");
  });

  it("DÉTRESSE : niveau ≥ 1 force le FORT pour TOUTE capacité (jamais le léger)", () => {
    for (const niveau of [1, 2, 3] as const) {
      expect(tierPour("echange", niveau), `echange@${niveau}`).toBe("fort");
      expect(tierPour("reconceptualisation", niveau), `reconc@${niveau}`).toBe("fort");
      expect(tierPour("synthese", niveau), `synth@${niveau}`).toBe("fort");
    }
  });

  it("DÉTECTION (§5) : la capacité `detection` force le FORT pour TOUT niveau, y compris 0 (AD-5, NFR-012)", () => {
    // La détection ne peut PAS dépendre du niveau qu'elle est justement en train de calculer :
    // elle doit résoudre le FORT inconditionnellement, jamais le léger, en aucune circonstance.
    for (const niveau of [0, 1, 2, 3] as const) {
      expect(tierPour("detection", niveau), `detection@${niveau}`).toBe("fort");
    }
    expect(tierPour("detection")).toBe("fort"); // niveau par défaut absent
    expect(tierPour("detection", 0)).not.toBe("leger"); // contrôle négatif explicite
  });

  it("mappe chaque tier vers un id de modèle DATÉ (jamais -latest)", () => {
    expect(modelePour("leger")).toBe("mistral-small-2603");
    expect(modelePour("fort")).toBe("mistral-large-2512");
    expect(modelePour("leger")).not.toMatch(/-latest/);
    expect(modelePour("fort")).not.toMatch(/-latest/);
  });
});
