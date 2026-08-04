import { describe, it, expect } from "vitest";
import {
  reducteurVue,
  etatInitial,
  cameraInitiale,
  ZOOM_MIN,
  ZOOM_MAX,
  type EtatVue,
} from "@/lib/scene/vue";

/**
 * Story 4.6 (T2) — le VIEW-STATE de l'arbre (caméra pan/zoom propre à l'arbre, fiche ouverte, et le
 * contexte de retour de « Voir dans la conversation »). Réducteur PUR, propriétaire unique du cadrage
 * (AD-7/AD-10 : le rendu consomme, ne décide pas). Le zoom est borné DANS le modèle (AC9).
 */

describe("reducteurVue — caméra de l'arbre (pan/zoom), bornée dans le modèle", () => {
  it("cadrer pose pan+zoom ; le zoom est clampé dans [ZOOM_MIN, ZOOM_MAX]", () => {
    const trop = reducteurVue(etatInitial, { type: "cadrer", camera: { pan: { x: 10, y: -5 }, zoom: 99 } });
    expect(trop.camera.zoom).toBe(ZOOM_MAX);
    expect(trop.camera.pan).toEqual({ x: 10, y: -5 });
    const troppetit = reducteurVue(etatInitial, { type: "cadrer", camera: { pan: { x: 0, y: 0 }, zoom: 0.01 } });
    expect(troppetit.camera.zoom).toBe(ZOOM_MIN);
  });

  it("cadrer vers la MÊME caméra est idempotent (même référence)", () => {
    const memeCamera = reducteurVue(etatInitial, { type: "cadrer", camera: cameraInitiale });
    expect(memeCamera).toBe(etatInitial);
  });
});

describe("reducteurVue — fiche de branche (étiquette, jamais modale)", () => {
  it("ouvrirFiche/fermerFiche pose puis retire la branche sélectionnée", () => {
    const ouverte = reducteurVue(etatInitial, { type: "ouvrirFiche", brancheId: "b-1" });
    expect(ouverte.brancheSelectionnee).toBe("b-1");
    const fermee = reducteurVue(ouverte, { type: "fermerFiche" });
    expect(fermee.brancheSelectionnee).toBeNull();
  });

  it("fermer une fiche déjà fermée est idempotent", () => {
    expect(reducteurVue(etatInitial, { type: "fermerFiche" })).toBe(etatInitial);
  });
});

describe("reducteurVue — « Voir dans la conversation » puis retour au même cadrage (AC4)", () => {
  const arbreCadré: EtatVue = {
    regionCourante: "arbre",
    camera: { pan: { x: 42, y: -17 }, zoom: 2.25 },
    brancheSelectionnee: "b-7",
    retour: null,
  };

  it("voirDansConversation va à la conversation ET mémorise le cadrage exact + la fiche", () => {
    const enConv = reducteurVue(arbreCadré, { type: "voirDansConversation" });
    expect(enConv.regionCourante).toBe("anam");
    expect(enConv.retour).toEqual({
      region: "arbre",
      camera: { pan: { x: 42, y: -17 }, zoom: 2.25 },
      brancheSelectionnee: "b-7",
    });
  });

  it("revenir restaure EXACTEMENT la région, la caméra et la fiche (retour au même cadrage/zoom)", () => {
    const enConv = reducteurVue(arbreCadré, { type: "voirDansConversation" });
    const revenu = reducteurVue(enConv, { type: "revenir" });
    expect(revenu.regionCourante).toBe("arbre");
    expect(revenu.camera).toEqual({ pan: { x: 42, y: -17 }, zoom: 2.25 });
    expect(revenu.brancheSelectionnee).toBe("b-7");
    expect(revenu.retour).toBeNull();
  });

  it("revenir sans contexte mémorisé est idempotent", () => {
    expect(reducteurVue(etatInitial, { type: "revenir" })).toBe(etatInitial);
  });
});
