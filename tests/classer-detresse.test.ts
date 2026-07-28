import { describe, it, expect } from "vitest";
import { classerDetresse, repliSur, NIVEAU_REPLI } from "@/lib/safety/classer-detresse";

/**
 * Story 2.3 — le classifieur PUR de détresse (AC1/AC3). Aucune I/O : une valeur de niveau (issue
 * du modèle fort, déjà extraite) → un `VerdictSecurite`. Le contenu CLINIQUE (le prompt, les seuils)
 * est ailleurs et provisoire ; ici on teste seulement la MACHINE de décision.
 *
 * Invariant dur : le DOUTE penche vers la sécurité. Une entrée illisible / hors 0-3 ne retombe
 * JAMAIS sur niveau 0 — elle produit un repli sûr (schéma suspendu, limites levées).
 */
describe("Classifieur de détresse — niveau → verdict (pur)", () => {
  it("niveau 0 : poursuivre, aucun schéma suspendu", () => {
    expect(classerDetresse(0)).toEqual({ niveau: 0, decision: "poursuivre", supprimerTravailSchema: false });
  });

  it("niveau 1 : adoucir, schéma suspendu (bascule non annoncée)", () => {
    expect(classerDetresse(1)).toEqual({ niveau: 1, decision: "adoucir", supprimerTravailSchema: true });
  });

  it("niveau 2 : intervenir, schéma suspendu", () => {
    expect(classerDetresse(2)).toEqual({ niveau: 2, decision: "intervenir", supprimerTravailSchema: true });
  });

  it("niveau 3 : urgence, schéma suspendu", () => {
    expect(classerDetresse(3)).toEqual({ niveau: 3, decision: "urgence", supprimerTravailSchema: true });
  });

  it("niveau ≥ 1 ⇒ TOUJOURS supprimerTravailSchema (FR-037)", () => {
    for (const n of [1, 2, 3] as const) {
      expect(classerDetresse(n).supprimerTravailSchema, `niveau ${n}`).toBe(true);
    }
    expect(classerDetresse(0).supprimerTravailSchema).toBe(false);
  });

  it("entrée ILLISIBLE / hors 0-3 → repli sûr, JAMAIS niveau 0 (le doute penche vers la sécurité)", () => {
    for (const mauvais of [undefined, null, "2", 2.5, -1, 4, 42, NaN, {}, [], "détresse"]) {
      const v = classerDetresse(mauvais);
      expect(v.decision, `entrée ${String(mauvais)}`).toBe("repli_sur");
      expect(v.niveau, `entrée ${String(mauvais)}`).toBeGreaterThanOrEqual(1);
      expect(v.supprimerTravailSchema).toBe(true);
    }
  });

  it("repliSur() : niveau plancher ≥ 1 qui engage les haltes, décision `repli_sur`", () => {
    expect(repliSur()).toEqual({ niveau: NIVEAU_REPLI, decision: "repli_sur", supprimerTravailSchema: true });
    expect(NIVEAU_REPLI).toBeGreaterThanOrEqual(1); // limites_levees dérive de niveau ≥ 1 (AD-17)
  });

  it("porte la FAMILLE de danger quand fournie (Story 2.6), sinon absente", () => {
    // FR-074 : les ressources correspondantes exigent un signal de famille. Optionnel : le repli ne
    // fabrique pas de danger précis ; le défaut protecteur vit dans le sélecteur de bloc (T3).
    expect(classerDetresse(2, "violences_femmes").famille).toBe("violences_femmes");
    expect(classerDetresse(3, "urgence_vitale").famille).toBe("urgence_vitale");
    expect(classerDetresse(2).famille).toBeUndefined();
    expect(repliSur().famille).toBeUndefined();
  });
});
