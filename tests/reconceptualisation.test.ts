import { describe, it, expect } from "vitest";
import {
  detecterReconceptualisation,
  requeteReconceptualisation,
  INSTRUCTION_RECONCEPTUALISATION,
} from "@/lib/domain/reconceptualisation";
import { tierPour } from "@/lib/ai/politique-tier";

/**
 * Story 4.4 (T3) — le détecteur PUR `detecterReconceptualisation` + la requête `requeteReconceptualisation`.
 * Prouve les gardes de forme (aucune base, aucun modèle) :
 *  - parse `RECONCEPTUALISATION: oui` → détecté ; `non`/absent/illisible → NON (le doute ne retient rien) ;
 *  - dernière ligne conforme = conclusion (patron `lireBooleen`) ; insensible à la casse ;
 *  - AC2 : la requête déclare `capacite:"reconceptualisation"` (⇒ fort) et `contientArt9:true` ;
 *  - AC5 : le module ne référence AUCUN vocabulaire de détresse dans son instruction produit.
 */

describe("detecterReconceptualisation — parser structuré, le doute ne retient rien (AC4)", () => {
  it("`RECONCEPTUALISATION: oui` → détecté", () => {
    expect(detecterReconceptualisation("RECONCEPTUALISATION: oui").detecte).toBe(true);
  });

  it("`RECONCEPTUALISATION: non` → non détecté", () => {
    expect(detecterReconceptualisation("RECONCEPTUALISATION: non").detecte).toBe(false);
  });

  it("absent / illisible → non détecté (doute, jamais un faux marqueur)", () => {
    expect(detecterReconceptualisation("").detecte).toBe(false);
    expect(detecterReconceptualisation("je ne sais pas trop").detecte).toBe(false);
    expect(detecterReconceptualisation("RECONCEPTUALISATION: peut-être").detecte).toBe(false);
  });

  it("insensible à la casse + variantes de valeur (yes/true/1/vrai)", () => {
    expect(detecterReconceptualisation("reconceptualisation = OUI").detecte).toBe(true);
    expect(detecterReconceptualisation("Reconceptualisation: true").detecte).toBe(true);
    expect(detecterReconceptualisation("RECONCEPTUALISATION:1").detecte).toBe(true);
    expect(detecterReconceptualisation("RECONCEPTUALISATION: no").detecte).toBe(false);
  });

  it("la DERNIÈRE ligne conforme est la conclusion (bavardage puis verdict)", () => {
    const sortie = "RECONCEPTUALISATION: oui\n(en fait je révise)\nRECONCEPTUALISATION: non";
    expect(detecterReconceptualisation(sortie).detecte).toBe(false);
  });
});

describe("requeteReconceptualisation — modèle FORT sous egress art. 9 (AC2)", () => {
  it("déclare capacite:reconceptualisation (⇒ fort) et contientArt9:true", () => {
    const r = requeteReconceptualisation([{ role: "user", content: "avant je pensais que c'était ma faute" }]);
    expect(r.capacite).toBe("reconceptualisation");
    expect(r.contientArt9).toBe(true);
    // La politique unique résout le tier au FORT (jamais léger, AD-5).
    expect(tierPour(r.capacite, 0)).toBe("fort");
  });

  it("préfixe l'instruction système et conserve les messages du tour", () => {
    const msgs = [{ role: "user" as const, content: "maintenant je vois ça autrement" }];
    const r = requeteReconceptualisation(msgs);
    expect(r.messages[0].role).toBe("system");
    expect(r.messages[0].content).toBe(INSTRUCTION_RECONCEPTUALISATION);
    expect(r.messages[r.messages.length - 1]).toEqual(msgs[0]);
  });
});

describe("AC5 — reconceptualisation ≠ détresse (séparation dès le vocabulaire produit)", () => {
  it("l'instruction ne confond pas les deux évaluations (elle exclut explicitement la détresse)", () => {
    // Contrat de forme : l'instruction distingue les deux évaluations (« ce N'EST PAS ... ni une détresse »).
    expect(INSTRUCTION_RECONCEPTUALISATION.toLowerCase()).toContain("reconceptualisation");
    expect(INSTRUCTION_RECONCEPTUALISATION.toLowerCase()).toContain("détresse");
  });
});
