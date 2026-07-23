import { describe, it, expect } from "vitest";
import { couleursNuit, couleursClair, type CleCouleur } from "@/app/styles/tokens";
import { ratioContraste, luminanceRelative } from "@/app/styles/contraste";

/**
 * LE GATE (AC2 / UX-DR-39 / NFR-016) — équivalent design de la preuve RLS de 1.1.
 * Chaque paire des tableaux DESIGN.md (§Contrastes vérifiés) est recalculée ici et
 * doit tenir son seuil : 4,5:1 texte courant, 3:1 grand texte / objets graphiques /
 * bordure-forte-focus. Un token modifié qui fait chuter une paire → test rouge → CI rouge.
 * `bordure/fond` est EXCLUE (séparateur décoratif, exempté WCAG 1.4.11).
 */

type Paire = { fg: CleCouleur; bg: CleCouleur; seuil: number };

// Mode nuit — DESIGN.md §Contrastes vérifiés — mode nuit
const pairesNuit: Paire[] = [
  { fg: "texte", bg: "fond", seuil: 4.5 },
  { fg: "texte", bg: "surface", seuil: 4.5 },
  { fg: "texte", bg: "surface-elevee", seuil: 4.5 },
  { fg: "texte-doux", bg: "fond", seuil: 4.5 },
  { fg: "texte-doux", bg: "surface", seuil: 4.5 },
  { fg: "texte-doux", bg: "surface-elevee", seuil: 4.5 },
  { fg: "accent", bg: "fond", seuil: 4.5 },
  { fg: "accent", bg: "surface", seuil: 4.5 },
  { fg: "sur-accent", bg: "accent", seuil: 4.5 },
  { fg: "texte", bg: "accent-doux", seuil: 4.5 },
  { fg: "texte-doux", bg: "accent-doux", seuil: 4.5 },
  { fg: "succes", bg: "surface", seuil: 4.5 },
  { fg: "alerte", bg: "surface", seuil: 4.5 },
  // Objets graphiques / focus (seuil 3:1) — inclut les marges les plus serrées
  { fg: "bordure-forte", bg: "fond", seuil: 3 }, // focus sur fond
  { fg: "bordure-forte", bg: "surface-elevee", seuil: 3 }, // champ (marge serrée 3,54)
  { fg: "arbre-tronc", bg: "fond", seuil: 3 }, // marge la plus serrée du mode nuit (3,63)
  { fg: "arbre-branche", bg: "fond", seuil: 3 },
  { fg: "arbre-feuillage", bg: "fond", seuil: 3 },
];

// Mode accessibilité (-clair) — vérifié au MÊME niveau que la nuit (AC5)
const pairesClair: Paire[] = [
  { fg: "texte", bg: "fond", seuil: 4.5 },
  { fg: "texte-doux", bg: "fond", seuil: 4.5 },
  { fg: "accent", bg: "fond", seuil: 4.5 },
  { fg: "sur-accent", bg: "accent", seuil: 4.5 },
  { fg: "texte", bg: "accent-doux", seuil: 4.5 },
  { fg: "succes", bg: "fond", seuil: 4.5 },
  { fg: "alerte", bg: "fond", seuil: 4.5 },
  { fg: "bordure-forte", bg: "fond", seuil: 3 },
  { fg: "arbre-feuillage", bg: "fond", seuil: 3 }, // marge serrée (5,00)
];

function verifier(palette: Record<CleCouleur, string>, paires: Paire[]) {
  for (const p of paires) {
    it(`${p.fg} / ${p.bg} ≥ ${p.seuil}:1`, () => {
      const r = ratioContraste(palette[p.fg], palette[p.bg]);
      expect(
        r,
        `${p.fg} sur ${p.bg} = ${r.toFixed(2)}:1, en dessous du seuil ${p.seuil}:1`,
      ).toBeGreaterThanOrEqual(p.seuil);
    });
  }
}

describe("Gate de contraste WCAG AA — mode nuit (natif)", () => {
  verifier(couleursNuit, pairesNuit);
});

describe("Gate de contraste WCAG AA — mode accessibilité (-clair)", () => {
  verifier(couleursClair, pairesClair);
});

// Garde-fou du helper lui-même : sans ça, un calcul trivial « passerait » tout.
describe("Sanité du calcul WCAG", () => {
  it("noir sur blanc = 21:1", () => {
    expect(ratioContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });
  it("une couleur avec elle-même = 1:1", () => {
    expect(ratioContraste("#8FC1EF", "#8FC1EF")).toBeCloseTo(1, 5);
  });
  it("luminance bornée [0,1]", () => {
    expect(luminanceRelative("#000000")).toBeCloseTo(0, 5);
    expect(luminanceRelative("#FFFFFF")).toBeCloseTo(1, 5);
  });
});
