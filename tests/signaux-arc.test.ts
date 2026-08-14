import { describe, it, expect } from "vitest";
import {
  estReponseLongue,
  extraireSignauxArc,
  extraireDemandeLecture,
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 5.8 — LA DEMANDE DE LECTURE, PASSAGÈRE DE LA MÊME PASSE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.8/AC1] `extraireDemandeLecture` — le rituel se demande, il ne se déclenche pas", () => {
  it("lit `DEMANDE_LECTURE: oui`", () => {
    expect(extraireDemandeLecture("ELEMENT_PERSONNEL: non\nDEMANDE_LECTURE: oui")).toBe(true);
  });

  it("lit `DEMANDE_LECTURE: non`", () => {
    expect(extraireDemandeLecture("DEMANDE_LECTURE: non")).toBe(false);
  });

  it("⚠️ ABSENTE ou ILLISIBLE ⇒ FAUX — on n'ouvre jamais le rituel sur un doute", () => {
    // Une carte tirée ne se retire jamais : ouvrir sur un doute, c'est déposer une carte que
    // personne n'a demandée, et il n'existe aucun moyen de revenir en arrière.
    expect(extraireDemandeLecture("")).toBe(false);
    expect(extraireDemandeLecture("ELEMENT_PERSONNEL: oui")).toBe(false);
    expect(extraireDemandeLecture("DEMANDE_LECTURE: peut-être")).toBe(false);
  });

  it("retient la DERNIÈRE ligne conforme (patron `extraireFamille`)", () => {
    expect(extraireDemandeLecture("DEMANDE_LECTURE: oui\nDEMANDE_LECTURE: non")).toBe(false);
  });

  it("ne se confond pas avec les signaux d'arc voisins", () => {
    // Une clé qui matcherait trop large ferait ouvrir un rituel sur un signal d'arc.
    expect(extraireDemandeLecture("ELEMENT_PERSONNEL: oui\nRESTITUTION: oui\nSUJET_NOUVEAU: oui")).toBe(false);
  });

  it("⚠️ NE REJOINT PAS `SignauxTour` — la machine d'arc ne s'élargit pas", () => {
    // Y glisser un signal que la machine ne consomme pas inviterait un futur `if` à s'en servir, et
    // la machine d'état de la séance est une pièce dont chaque entrée a été pesée.
    const signaux = extraireSignauxArc("DEMANDE_LECTURE: oui", "je voudrais une lecture");
    expect(Object.keys(signaux)).not.toContain("demandeLecture");
  });

  it("l'instruction ÉCARTE explicitement « lire » au sens ordinaire", () => {
    // Sans cette précision, « j'ai fini ma lecture du soir » ouvrirait le rituel — c'est exactement
    // le défaut qu'un `includes("lecture")` côté serveur produirait, et qu'on refuse.
    expect(INSTRUCTION_EXTRACTION_ARC).toContain("DEMANDE_LECTURE");
    expect(INSTRUCTION_EXTRACTION_ARC).toContain("relire");
  });
});
