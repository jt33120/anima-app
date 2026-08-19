import { describe, it, expect } from "vitest";
import { consigneBilan } from "@/lib/domain/consigne-bilan";
import { consignePhaseArc, consignePhaseDuTour } from "@/lib/domain/consigne-phase";

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

  it("REGISTRE DOCUMENT : titres et listes explicitement AUTORISÉS (l’inverse de la voix)", () => {
    expect(c.content).toMatch(/titre/i);
    expect(c.content).toMatch(/liste/i);
    expect(c.content, "le bilan est un document, pas un tour de conversation").toMatch(/document/i);
  });

  it("REPREND LES MOTS de l’utilisatrice, sans inventer ni ajouter (jamais un verdict)", () => {
    expect(c.content).toMatch(/mot/i);
    // Revue : « invent »/« ajout » portent l'interdit de fabrication → verrou strict (pas « jamais »).
    expect(c.content, "l’interdit d’inventer/ajouter au-delà de ce qui a été dit").toMatch(/invent|ajout/i);
  });

  it("interdit le lexique médical / « soin » et la conclusion enveloppante (registre non clinique)", () => {
    expect(c.content).toMatch(/m[ée]dical|clinique/i);
    expect(c.content).toMatch(/soin|soign/i);
    expect(c.content).toMatch(/enveloppante|r[ée]capitulatif/i);
  });

  it("jamais signé d’un affect (FR-087) et corpus Anima (FR-086)", () => {
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

  it("dit que c’est ANAM qui clôt, sans récapitulatif ni conclusion enveloppante", () => {
    // C'est elle qui clôt (l'utilisatrice n'a jamais à s'extraire), sans récapituler ni envelopper.
    expect(clore?.content).toMatch(/clos|referme|fin/i);
    expect(clore?.content, "pas de récapitulatif / pas de conclusion enveloppante").toMatch(
      /r[ée]capitulatif|enveloppante/i,
    );
  });
});

describe("[revue 1-4] la consigne de clôture vaut pour LE tour qui clôt, pas pour tous ceux d’après", () => {
  /**
   * ══ LE DÉFAUT ═════════════════════════════════════════════════════════════════════════════════
   *
   * `clore` est TERMINAL (« l'arc ne rouvre jamais », AC1) : la phase vaut `clore` pour toujours. La
   * route dérivait la consigne de la seule PHASE — donc, une fois la première séance close, Anam
   * recevait l'ordre de clore la séance à CHAQUE tour suivant. Un mois plus tard, au premier message
   * de la journée, elle répondait « on en a assez fait pour ce soir ».
   *
   * Les tours d'après existent pourtant : c'est l'allocation résiduelle (3.4). Ce ne sont pas des
   * séances, et rien ne doit y ordonner de clore.
   */

  const enClore = (beat: "nommer" | "cloture" | null) => ({ etat: { phase: "clore" as const }, beat });

  it("⚠️ un tour APRÈS la clôture ne reçoit plus aucune consigne de phase", () => {
    // LE MUTANT QUI COMPTE : revenir à `consignePhaseArc(arc.etat.phase)`. Il meurt ici, et ici seul.
    expect(consignePhaseDuTour(enClore(null), true)).toBeNull();
  });

  it("mais LE tour qui clôt la reçoit — c’est lui qui porte le beat `cloture`", () => {
    const c = consignePhaseDuTour(enClore("cloture"), true);
    expect(c?.role).toBe("system");
    expect(c?.content).toContain("C’est TOI qui clos la séance");
  });

  it("et en détresse, même ce tour-là ne l’a pas : la séance cesse d’être une séance (AD-9, AC5)", () => {
    expect(consignePhaseDuTour(enClore("cloture"), false)).toBeNull();
  });

  it("les phases non terminales gardent leur consigne, clôture autorisée ou non", () => {
    // `observer` porte le gate FR-005 (« ne délivre pas encore d'observation nommée »). Le suspendre
    // en détresse ferait exactement le contraire de ce qu'il faut.
    for (const autorisee of [true, false]) {
      const c = consignePhaseDuTour({ etat: { phase: "observer" }, beat: null }, autorisee);
      expect(c?.content, "le gate d’observation prématurée a disparu").toContain("NE DÉLIVRE PAS");
    }
    expect(consignePhaseDuTour({ etat: { phase: "nommer" }, beat: "nommer" }, true)?.content).toContain(
      "NOMMER",
    );
  });

  it("`construire` n’a rien à contraindre, et l’absence d’arc non plus", () => {
    expect(consignePhaseDuTour({ etat: { phase: "construire" }, beat: null }, true)).toBeNull();
    expect(consignePhaseDuTour(null, true)).toBeNull();
  });
});
