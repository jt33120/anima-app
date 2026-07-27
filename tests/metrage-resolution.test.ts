import { describe, it, expect } from "vitest";
import { resoudreMetrage, estimerTokens, type EtatFlux } from "@/lib/ai/metrage";

/**
 * Story 2.2 (revue) — la DÉCISION de métrage, pure et testable (couvre le comportement que la route
 * ne peut pas exercer sous vitest). Trois invariants durs :
 *  - métrage HONNÊTE : le `fin` de l'adaptateur est la source autoritaire du tier/modele (factice →
 *    "factice", jamais un id Mistral sans appel Mistral) ;
 *  - garde faux-zéro : un `fin` à 0 token (fournisseur qui l'omet) retombe sur l'estimation ;
 *  - avortement (pas de `fin`) → repli homogène en TOKENS + tier/modele serveur ; rien produit → null.
 */

const base: EtatFlux = {
  finRecu: null,
  aProduit: false,
  charsSortie: 0,
  charsEntree: 0,
  tierServeur: "leger",
  modeleServeur: "mistral-small-2603",
};

describe("resoudreMetrage — métrage honnête et robuste (revue 2.2)", () => {
  it("rien produit (échec d'ouverture) → null (aucune ligne fantôme)", () => {
    expect(resoudreMetrage({ ...base, aProduit: false })).toBeNull();
  });

  it("`fin` reçu = source AUTORITAIRE : tier/modele du `fin`, PAS ceux du serveur", () => {
    // Le serveur avait précalculé leger/mistral-small ; le fin (factice) dit "factice" → on croit le fin.
    const r = resoudreMetrage({
      ...base,
      aProduit: true,
      finRecu: { tier: "leger", modele: "factice", usage: { tokensEntree: 7, tokensSortie: 42 } },
    });
    expect(r).toEqual({ tier: "leger", modele: "factice", tokensEntree: 7, tokensSortie: 42 });
    expect(r!.modele).not.toBe("mistral-small-2603"); // jamais un id Mistral sans appel Mistral
  });

  it("garde faux-zéro : `fin` avec usage 0 → estimation à partir des caractères", () => {
    const r = resoudreMetrage({
      ...base,
      aProduit: true,
      charsEntree: 40,
      charsSortie: 80,
      finRecu: { tier: "fort", modele: "mistral-large-2512", usage: { tokensEntree: 0, tokensSortie: 0 } },
    });
    expect(r!.tokensSortie).toBe(estimerTokens(80)); // 20, pas 0 : une réponse complète n'est pas métrée 0
    expect(r!.tokensEntree).toBe(estimerTokens(40)); // 10
    expect(r!.modele).toBe("mistral-large-2512"); // le modele du fin reste autoritaire
  });

  it("avortement (pas de `fin`, mais des deltas) → repli en TOKENS + tier/modele serveur", () => {
    const r = resoudreMetrage({ ...base, aProduit: true, charsEntree: 12, charsSortie: 20 });
    expect(r).toEqual({
      tier: "leger",
      modele: "mistral-small-2603",
      tokensEntree: estimerTokens(12), // 3
      tokensSortie: estimerTokens(20), // 5
    });
    // jamais des caractères bruts dans une colonne « tokens » (unité homogène)
    expect(r!.tokensSortie).not.toBe(20);
  });

  it("estimerTokens : ≈ 4 caractères/token, jamais négatif", () => {
    expect(estimerTokens(0)).toBe(0);
    expect(estimerTokens(4)).toBe(1);
    expect(estimerTokens(5)).toBe(2);
    expect(estimerTokens(-10)).toBe(0);
  });
});
