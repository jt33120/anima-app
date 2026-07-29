import { describe, it, expect } from "vitest";
import { consigneVoixAnam } from "@/lib/domain/consigne-voix";

/**
 * Story 2.8 (T3) — la CONSIGNE DE VOIX, cœur PUR (AD-1), patron de `consignePhaseArc`. Le test verrouille
 * le CONTRAT (message système non vide) et la présence des invariants LOAD-BEARING qui ne doivent jamais
 * être supprimés par une réécriture de la prose PROVISOIRE : hypothèse réfutable, corpus Anima, interdit
 * d'affect, anti-flatterie. Il ne fige pas la formulation au mot près.
 */

describe("Story 2.8 — consigne de voix : contrat + invariants non négociables", () => {
  const c = consigneVoixAnam();

  it("est un message système non vide, injectable serveur (jamais reçu du client)", () => {
    expect(c.role).toBe("system");
    expect(c.content.length).toBeGreaterThan(80);
  });

  it("porte la forme HYPOTHÈSE RÉFUTABLE (FR-006 — jamais un verdict)", () => {
    expect(c.content).toMatch(/je me trompe|hypoth[èe]se|je me trompe \?/i);
  });

  it("porte la règle CORPUS ANIMA : ne jamais fabriquer une parole d'Anima (FR-086)", () => {
    expect(c.content).toMatch(/Anima/);
    // Revue 2.8 : « invent »/« fabriqu » ne vivent QUE dans la clause corpus-Anima → verrou strict.
    // (« jamais », ubiquitaire dans la voix, rendait l'assertion quasi-tautologique.)
    expect(c.content, "l'interdit de fabriquer/inventer une parole d'Anima").toMatch(/invent|fabriqu/i);
  });

  it("interdit la REVENDICATION D'AFFECT et autorise l'ATTENTION (FR-087)", () => {
    expect(c.content).toMatch(/je ressens|affect|ressentir/i); // mentionne l'interdit d'affect
    expect(c.content).toMatch(/je suis l[àa]|j'?e? ?lis|attenti/i); // l'attention reste permise
  });

  it("porte l'anti-flatterie / recule sans flatter (FR-009) et le débit ≤ 3 phrases (FR-084)", () => {
    expect(c.content).toMatch(/flatt|excuse|rends la main|comment tu le vois/i);
    expect(c.content).toMatch(/trois phrases|3 phrases/i);
  });
});
