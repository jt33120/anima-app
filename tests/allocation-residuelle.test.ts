import { describe, it, expect } from "vitest";
import { doitCouperConversation } from "@/lib/domain/allocation-residuelle";

/**
 * Story 3.4 (T3) — le cœur PUR de la coupure d'allocation résiduelle (AC2/AC5/AC6). La dérivation
 * UNIQUE (AD-17) : un seul endroit décide si la conversation gratuite se coupe. Chaque court-circuit
 * protège l'accès ; le premier vrai gagne. Table exhaustive.
 */

// Base : un compte gratuit, hors détresse, séance close, 5 tours consommés, limite 5 → CAS DE COUPURE.
//
// ⚠️ `niveauSecurite` EST OBLIGATOIRE DEPUIS LA REVUE ADVERSARIALE (R8), et c'est délibéré : le
// champ n'a pas de valeur par défaut, donc aucun appelant ne peut l'oublier — le compilateur a
// d'ailleurs rougi sur ce fichier même. Le cas où il compte (niveau > 0 pendant que `limitesLevees`
// est déjà retombé) vit dans `tests/le-filet-ne-tombe-jamais.test.ts`.
const COUPE = {
  premium: false,
  limitesLevees: false,
  niveauSecurite: 0,
  seanceClose: true,
  toursConsommes: 5,
  limite: 5,
};

describe("doitCouperConversation — la dérivation unique (AD-17)", () => {
  it("gratuit, hors détresse, post-séance, allocation atteinte → COUPE", () => {
    expect(doitCouperConversation(COUPE)).toBe(true);
  });
  it("allocation NON atteinte (consommés < limite) → ne coupe pas", () => {
    expect(doitCouperConversation({ ...COUPE, toursConsommes: 4 })).toBe(false);
  });
  it("consommés STRICTEMENT au-dessus de la limite → coupe (>=)", () => {
    expect(doitCouperConversation({ ...COUPE, toursConsommes: 6 })).toBe(true);
  });

  it("PREMIUM → jamais de coupure (conversation illimitée, AC5) — même allocation atteinte", () => {
    expect(doitCouperConversation({ ...COUPE, premium: true })).toBe(false);
  });
  it("DÉTRESSE (limitesLevees) → jamais de coupure (AC6) — même allocation atteinte", () => {
    expect(doitCouperConversation({ ...COUPE, limitesLevees: true })).toBe(false);
  });
  it("PENDANT la 1ʳᵉ séance (!seanceClose) → jamais de coupure (AC2) — la séance est gratuite", () => {
    expect(doitCouperConversation({ ...COUPE, seanceClose: false })).toBe(false);
  });
  it("limite NON configurée (null) → jamais de coupure (AC3, FR-058)", () => {
    expect(doitCouperConversation({ ...COUPE, limite: null })).toBe(false);
  });

  it("limite = 0 (choix produit) → coupe dès le 1er tour post-séance (0 >= 0)", () => {
    expect(doitCouperConversation({ ...COUPE, toursConsommes: 0, limite: 0 })).toBe(true);
  });

  it("n'importe quel court-circuit gagne : premium ET détresse ET épuisé → ne coupe pas", () => {
    expect(
      doitCouperConversation({ premium: true, limitesLevees: true, niveauSecurite: 0, seanceClose: true, toursConsommes: 99, limite: 1 }),
    ).toBe(false);
  });
  it("l'ORDRE protège : premium prime même si tout le reste pousserait à couper", () => {
    expect(doitCouperConversation({ ...COUPE, premium: true, toursConsommes: 1000 })).toBe(false);
  });
});
