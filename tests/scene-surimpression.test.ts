import { describe, it, expect } from "vitest";
import {
  CATALOGUE_REGIONS,
  REGION_CONVERSATION,
  estRegion,
  REGIONS,
  surimpressionPour,
  URL_AIDE,
  type IdRegion,
} from "@/lib/scene";

/**
 * Story 1.8 — le MODÈLE de la surimpression persistante (AD-7). *Quels* éléments la
 * surimpression porte selon la région est une décision de MODÈLE (règle légale art. 50 +
 * invariant de sécurité AD-9/AD-15), pas de rendu. On la teste sans DOM (env node), comme
 * le reste de lib/scene. Si ce fichier importait quoi que ce soit de `render/`, la garde
 * d'architecture (scene-architecture.test.ts) le refuserait.
 */

describe("surimpressionPour — la porte de secours est INCONDITIONNELLE (FR-077, AD-9/AD-15)", () => {
  it("porte de secours présente sur CHAQUE région (seuil inclus), sans exception", () => {
    for (const r of CATALOGUE_REGIONS) {
      expect(surimpressionPour(r.id).porteSecours, `porte de secours absente sur ${r.id}`).toBe(
        true,
      );
    }
  });

  it("la porte de secours pointe vers /aide (source unique URL_AIDE)", () => {
    expect(URL_AIDE).toBe("/aide");
  });
});

describe("surimpressionPour — signe d'Anam + mention IA seulement en conversation (FR-013, art. 50)", () => {
  it("sur la région de conversation : signe ET mention présents", () => {
    const s = surimpressionPour(REGION_CONVERSATION);
    expect(s.signeAnam).toBe(true);
    expect(s.mentionIA).toBe(true);
  });

  it("hors conversation : ni signe, ni mention (uniquement la porte de secours)", () => {
    const horsConversation = CATALOGUE_REGIONS.filter((r) => r.id !== REGION_CONVERSATION);
    for (const r of horsConversation) {
      const s = surimpressionPour(r.id);
      expect(s.signeAnam, `signe d'Anam fuité sur ${r.id}`).toBe(false);
      expect(s.mentionIA, `mention IA fuitée sur ${r.id}`).toBe(false);
    }
  });
});

describe("REGION_CONVERSATION — source unique, région réelle et atteignable", () => {
  it("est un identifiant de région connu", () => {
    expect(estRegion(REGION_CONVERSATION)).toBe(true);
  });

  it("est la région « anam » et une destination directe (atteignable au clavier)", () => {
    expect(REGION_CONVERSATION).toBe("anam");
    expect(REGIONS.some((r) => r.id === REGION_CONVERSATION)).toBe(true);
  });
});

describe("surimpressionPour — pureté", () => {
  it("deux appels sur la même région donnent le même résultat, sans effet de bord", () => {
    const region: IdRegion = "arbre";
    const a = surimpressionPour(region);
    const b = surimpressionPour(region);
    expect(a).toEqual(b);
    // Aucune mutation : porteSecours reste true après lecture.
    expect(a.porteSecours).toBe(true);
  });
});
