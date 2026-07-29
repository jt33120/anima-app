import { describe, it, expect } from "vitest";
import { consigneBilan } from "@/lib/domain/consigne-bilan";
import { consignePhaseArc } from "@/lib/domain/consigne-phase";

/**
 * Story 2.9 (T2) — la CONSIGNE DE GÉNÉRATION DU BILAN, cœur PUR (AD-1), patron de `consigneVoixAnam`.
 * Le bilan est un REGISTRE DIFFÉRENT de la conversation : bloc document, titres/listes AUTORISÉS. Le
 * test verrouille le CONTRAT (message système non vide) et les invariants LOAD-BEARING (registre
 * document, reprend les mots sans inventer, pas de médical/soin, jamais signé d'un affect, corpus
 * Anima). Il ne fige pas la formulation PROVISOIRE au mot près.
 *
 * On verrouille aussi la consigne de phase `clore` affinée en 2.9 (Anam clôt elle-même, FR-008).
 */

describe("Story 2.9 — consigne de bilan : contrat + invariants du registre document", () => {
  const c = consigneBilan();

  it("est un message système non vide, injectable serveur (jamais reçu du client)", () => {
    expect(c.role).toBe("system");
    expect(c.content.length).toBeGreaterThan(80);
  });

  it("REGISTRE DOCUMENT : titres et listes explicitement AUTORISÉS (l'inverse de la voix)", () => {
    expect(c.content).toMatch(/titre/i);
    expect(c.content).toMatch(/liste/i);
    expect(c.content, "le bilan est un document, pas un tour de conversation").toMatch(/document/i);
  });

  it("REPREND LES MOTS de l'utilisatrice, sans inventer ni ajouter (jamais un verdict)", () => {
    expect(c.content).toMatch(/mot/i);
    // Revue : « invent »/« ajout » portent l'interdit de fabrication → verrou strict (pas « jamais »).
    expect(c.content, "l'interdit d'inventer/ajouter au-delà de ce qui a été dit").toMatch(/invent|ajout/i);
  });

  it("interdit le lexique médical / « soin » et la conclusion enveloppante (registre non clinique)", () => {
    expect(c.content).toMatch(/m[ée]dical|clinique/i);
    expect(c.content).toMatch(/soin|soign/i);
    expect(c.content).toMatch(/enveloppante|r[ée]capitulatif/i);
  });

  it("jamais signé d'un affect (FR-087) et corpus Anima (FR-086)", () => {
    expect(c.content).toMatch(/affect|touch|ressens/i);
    expect(c.content).toMatch(/Anima/);
  });
});

describe("Story 2.9 — consigne de phase « clore » : Anam clôt elle-même (FR-008)", () => {
  const clore = consignePhaseArc("clore");

  it("existe et est un message système non vide", () => {
    expect(clore).not.toBeNull();
    expect(clore?.role).toBe("system");
    expect((clore?.content.length ?? 0)).toBeGreaterThan(40);
  });

  it("dit que c'est ANAM qui clôt, sans récapitulatif ni conclusion enveloppante", () => {
    // C'est elle qui clôt (l'utilisatrice n'a jamais à s'extraire), sans récapituler ni envelopper.
    expect(clore?.content).toMatch(/clos|referme|fin/i);
    expect(clore?.content, "pas de récapitulatif / pas de conclusion enveloppante").toMatch(
      /r[ée]capitulatif|enveloppante/i,
    );
  });
});
