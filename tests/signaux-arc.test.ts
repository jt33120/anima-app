import { describe, it, expect } from "vitest";
import {
  estReponseLongue,
  extraireSignauxArc,
  requeteExtractionArc,
  INSTRUCTION_EXTRACTION_ARC,
} from "@/lib/domain/signaux-arc";
import { tierPour } from "@/lib/ai/politique-tier";
import type { MessageIa } from "@/lib/ai/port";

/**
 * Story 2.7 (T2) — l'extraction de signaux d'arc, sur le patron EXACT de `detecteur-detresse` :
 * une INSTRUCTION structurée + un parser PUR (scan tolérant, dernière ligne conforme, le doute ne
 * franchit aucun seuil). `reponseLongue` est déterministe (calculée du texte, sans le modèle). La
 * requête est une passe FORT séparée (capacité `reconceptualisation`, sous egress art. 9).
 */

describe("estReponseLongue — déterministe, sans le modèle (FR-004)", () => {
  it("> 2 ponctuations finales ⇒ réponse longue (plus de 2 phrases)", () => {
    expect(estReponseLongue("Je vais bien. Enfin, je crois. Mais c'est dur.")).toBe(true);
  });
  it("≤ 2 phrases ⇒ pas longue", () => {
    expect(estReponseLongue("Ça va. Merci.")).toBe(false);
    expect(estReponseLongue("Oui")).toBe(false);
  });
  it("les points de suspension groupés ne sur-comptent pas", () => {
    expect(estReponseLongue("Je ne sais pas… vraiment pas…")).toBe(false); // 2 groupes finaux
  });
});

describe("extraireSignauxArc — sortie structurée du modèle → SignauxTour", () => {
  it("mappe chaque ligne structurée sur son signal", () => {
    const sortie = [
      "ELEMENT_PERSONNEL: oui",
      "SUJET_NOUVEAU: non",
      "REFORMULATION: oui",
      "CONFIRMATION: oui",
      "REJET: non",
      "RESTITUTION: oui",
    ].join("\n");
    expect(extraireSignauxArc(sortie, "")).toEqual({
      elementPersonnelNonSollicite: true,
      sujetDeVieNouveau: false,
      reponseLongue: false,
      reformulationEmise: true,
      reformulationConfirmee: true,
      rejetProposition: false,
      restitution: true,
    });
  });

  it("insensible à la casse", () => {
    expect(extraireSignauxArc("element_personnel: OUI", "").elementPersonnelNonSollicite).toBe(true);
  });

  it("retient la DERNIÈRE ligne conforme (la conclusion du modèle, jamais une mention en amont)", () => {
    const sortie = "CONFIRMATION: non\n…hésitation…\nCONFIRMATION: oui";
    expect(extraireSignauxArc(sortie, "").reformulationConfirmee).toBe(true);
  });

  it("le doute laisse TOUT à false → jamais un faux « prêt à nommer »", () => {
    expect(extraireSignauxArc("réponse illisible sans structure", "")).toEqual({
      elementPersonnelNonSollicite: false,
      sujetDeVieNouveau: false,
      reponseLongue: false,
      reformulationEmise: false,
      reformulationConfirmee: false,
      rejetProposition: false,
      restitution: false,
    });
  });

  it("`reponseLongue` vient du TEXTE utilisateur (déterministe), pas du modèle", () => {
    const s = extraireSignauxArc("RESTITUTION: non", "Un. Deux. Trois. Quatre.");
    expect(s.reponseLongue).toBe(true);
  });

  it("confirmee ≠ emise : CONFIRMATION n'active pas reformulationEmise (mapping T1)", () => {
    const s = extraireSignauxArc("CONFIRMATION: oui\nREFORMULATION: non", "");
    expect(s.reformulationConfirmee).toBe(true);
    expect(s.reformulationEmise).toBe(false);
  });
});

describe("requeteExtractionArc — passe FORT séparée, sous egress art. 9 (D1, AD-5)", () => {
  const messages: MessageIa[] = [
    { role: "user", content: "je me sens perdue ces temps-ci" },
    { role: "assistant", content: "tu te sens perdue, c'est ça ?" },
  ];

  it("capacité reconceptualisation ⇒ tier FORT résolu par la politique (jamais léger)", () => {
    const r = requeteExtractionArc(messages);
    expect(r.capacite).toBe("reconceptualisation");
    expect(tierPour(r.capacite)).toBe("fort");
  });

  it("marque contientArt9 (passe par l'egress) et préfixe l'INSTRUCTION en system", () => {
    const r = requeteExtractionArc(messages);
    expect(r.contientArt9).toBe(true);
    expect(r.messages[0]).toEqual({ role: "system", content: INSTRUCTION_EXTRACTION_ARC });
  });

  it("conserve les tours ASSISTANT (l'arc a besoin des reformulations d'Anam — piège 13, ≠ détresse)", () => {
    const r = requeteExtractionArc(messages);
    expect(r.messages.slice(1)).toEqual(messages); // user ET assistant transmis, pas de filtre user-only
  });
});
