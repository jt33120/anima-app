import { describe, it, expect } from "vitest";
import { avancerArc, etatArcInitial, type EtatArc, type SignauxTour } from "@/lib/domain/arc-seance";
import {
  SEUIL_REFORMULATIONS,
  SEUIL_RESTITUTIONS,
  SEUIL_SUJETS,
} from "@/lib/domain/seuils-arc";
import { MESSAGE_SANS_HEURE } from "@/lib/domain/message-sans-heure";

/**
 * Story 2.7 — la MACHINE d'arc `construire → observer → nommer → clore` (cœur PUR, zéro I/O, AD-1).
 * On prouve les conditions de sortie (FR-004), l'invariant DUR FR-005 (jamais nommer avant la
 * clôture d'observer), la conjonction FR-007 (`peutNommer`, un seul manque → diffère), le comptage
 * FR-003 (≥ 3 restitutions avant clore), l'absence de minuteur (FR-002) et le timing du beat (AC5).
 */

const AUCUN_SIGNAL: SignauxTour = {
  elementPersonnelNonSollicite: false,
  sujetDeVieNouveau: false,
  reponseLongue: false,
  reformulationEmise: false,
  reformulationConfirmee: false,
  rejetProposition: false,
  restitution: false,
};
const sig = (p: Partial<SignauxTour>): SignauxTour => ({ ...AUCUN_SIGNAL, ...p });
const etat = (p: Partial<EtatArc>): EtatArc => ({ ...etatArcInitial(), ...p });

describe("avancerArc — construire → observer (FR-004 : ≥ 3 sujets ET ≥ 1 réponse longue)", () => {
  it("passe à observer au tour qui réunit 3 sujets ET une réponse longue", () => {
    let e = etatArcInitial();
    ({ etat: e } = avancerArc(e, sig({ sujetDeVieNouveau: true }), 0, 1000));
    ({ etat: e } = avancerArc(e, sig({ sujetDeVieNouveau: true }), 0, 2000));
    expect(e.phase).toBe("construire"); // 2 sujets, pas de réponse longue
    const r = avancerArc(e, sig({ sujetDeVieNouveau: true, reponseLongue: true }), 0, 3000);
    expect(r.etat.sujetsAbordes).toBe(SEUIL_SUJETS);
    expect(r.etat.phase).toBe("observer");
    expect(r.transition).toEqual({ de: "construire", vers: "observer" });
    expect(r.beat, "le beat « nommer » ne naît PAS ici").toBeNull();
  });

  it("3 sujets mais AUCUNE réponse longue → reste construire (les deux sont requis)", () => {
    let e = etatArcInitial();
    for (let i = 0; i < 5; i++) ({ etat: e } = avancerArc(e, sig({ sujetDeVieNouveau: true }), 0, i * 1000));
    expect(e.sujetsAbordes).toBe(5);
    expect(e.aReponseLongue).toBe(false);
    expect(e.phase).toBe("construire");
  });

  it("réponse longue mais < 3 sujets → reste construire", () => {
    const r = avancerArc(etat({ sujetsAbordes: 2 }), sig({ reponseLongue: true }), 0, 0);
    expect(r.etat.aReponseLongue).toBe(true);
    expect(r.etat.phase).toBe("construire");
  });
});

describe("avancerArc — observer → nommer (FR-004 sortie observer + FR-007 + beat AC5)", () => {
  it("le tour qui complète la conjonction émet le beat « nommer » — AVANT toute livraison", () => {
    // Presque prêt : reformulations OK, élément personnel OK, MAIS pas encore de confirmation.
    const presque = etat({ phase: "observer", reformulationsEmises: 2, elementsPersonnels: 1 });
    const avant = avancerArc(presque, sig({}), 0, 1000);
    expect(avant.etat.phase, "manque la confirmation").toBe("observer");
    expect(avant.beat).toBeNull();

    const r = avancerArc(presque, sig({ reformulationConfirmee: true }), 0, 2000);
    expect(r.etat.phase).toBe("nommer");
    expect(r.transition).toEqual({ de: "observer", vers: "nommer" });
    expect(r.beat).toBe("nommer");
    // Le beat est DÉCOUPLÉ de observationDelivree : encore false le tour où Anam commence à nommer.
    expect(r.etat.observationDelivree).toBe(false);
  });

  it("sortie observer exige ≥ 2 reformulations : une seule ne suffit pas", () => {
    const base = etat({ phase: "observer", confirmations: 1, elementsPersonnels: 1 });
    const r = avancerArc(base, sig({ reformulationEmise: true }), 0, 0);
    expect(r.etat.reformulationsEmises).toBe(1);
    expect(r.etat.reformulationsEmises).toBeLessThan(SEUIL_REFORMULATIONS);
    expect(r.etat.phase).toBe("observer");
    expect(r.beat).toBeNull();
  });
});

describe("FR-007 — peutNommer : un seul manque → false → Anam diffère (reste observer)", () => {
  const base = (): EtatArc =>
    etat({ phase: "observer", reformulationsEmises: 2, confirmations: 1, elementsPersonnels: 1 });

  it("tous réunis → peutNommer + sort vers nommer", () => {
    const r = avancerArc(base(), sig({}), 0, 0);
    expect(r.peutNommer).toBe(true);
    expect(r.etat.phase).toBe("nommer");
  });

  it("aucun élément personnel non sollicité → peutNommer false, reste observer", () => {
    const r = avancerArc({ ...base(), elementsPersonnels: 0 }, sig({}), 0, 0);
    expect(r.peutNommer).toBe(false);
    expect(r.etat.phase).toBe("observer");
    expect(r.beat).toBeNull();
  });

  it("aucune confirmation → peutNommer false, reste observer", () => {
    const r = avancerArc({ ...base(), confirmations: 0 }, sig({}), 0, 0);
    expect(r.peutNommer).toBe(false);
    expect(r.etat.phase).toBe("observer");
  });

  it("détresse niveau ≥ 1 → peutNommer false MÊME si tout le reste est réuni (gate lu du verdict)", () => {
    const r = avancerArc(base(), sig({}), 1, 0);
    expect(r.peutNommer).toBe(false);
    expect(r.etat.phase).toBe("observer");
  });

  it("les DEUX derniers tours avec rejet → peutNommer false", () => {
    const r = avancerArc({ ...base(), deuxDernieresPropositions: [false, true] }, sig({ rejetProposition: true }), 0, 0);
    expect(r.etat.deuxDernieresPropositions).toEqual([true, true]);
    expect(r.peutNommer).toBe(false);
    expect(r.etat.phase).toBe("observer");
  });

  it("un rejet ISOLÉ (le tour précédent n'était pas un rejet) n'empêche pas de nommer", () => {
    const r = avancerArc({ ...base(), deuxDernieresPropositions: [false, false] }, sig({ rejetProposition: true }), 0, 0);
    expect(r.etat.deuxDernieresPropositions).toEqual([false, true]);
    expect(r.peutNommer).toBe(true);
  });
});

describe("AC4 / T7 — gate détresse : niveau ≥ 1 → jamais nommer (lu du verdict, jamais re-détecté)", () => {
  const pret = (): EtatArc =>
    etat({ phase: "observer", reformulationsEmises: 2, confirmations: 1, elementsPersonnels: 1 });

  it("niveau 0, tous signaux réunis → nommer (contrôle positif)", () => {
    const r = avancerArc(pret(), sig({}), 0, 0);
    expect(r.peutNommer).toBe(true);
    expect(r.etat.phase).toBe("nommer");
  });

  for (const niveau of [1, 2, 3] as const) {
    it(`niveau ${niveau} → peutNommer false, reste observer (diffère) MÊME avec tous les autres signaux`, () => {
      const r = avancerArc(pret(), sig({}), niveau, 0);
      expect(r.peutNommer).toBe(false);
      expect(r.etat.phase).toBe("observer");
      expect(r.beat).toBeNull();
    });
  }
});

describe("FR-005 (invariant DUR) — observationDelivree ne passe jamais vrai avant la clôture d'observer", () => {
  it("tentative de poser observationDelivree en observer → REFUSÉE (forcée false)", () => {
    const r = avancerArc(etat({ phase: "observer", observationDelivree: true }), sig({}), 0, 0);
    expect(r.etat.phase).toBe("observer");
    expect(r.etat.observationDelivree).toBe(false);
  });

  it("en construire aussi : observationDelivree forcée false", () => {
    const r = avancerArc(etat({ observationDelivree: true }), sig({}), 0, 0);
    expect(r.etat.observationDelivree).toBe(false);
  });

  it("en nommer : observationDelivree posée par le serveur est CONSERVÉE (livraison légitime)", () => {
    const r = avancerArc(etat({ phase: "nommer", observationDelivree: true }), sig({}), 0, 0);
    expect(r.etat.observationDelivree).toBe(true);
  });
});

describe("FR-003 / FR-004 — nommer → clore : observation délivrée ET ≥ 3 restitutions", () => {
  const enNommer = (): EtatArc => etat({ phase: "nommer", observationDelivree: true });

  it("observation délivrée mais < 3 restitutions → reste nommer", () => {
    const r = avancerArc({ ...enNommer(), restitutions: 2 }, sig({}), 0, 0);
    expect(r.etat.phase).toBe("nommer");
  });

  it("observation délivrée + 3e restitution ce tour → passe à clore", () => {
    const r = avancerArc({ ...enNommer(), restitutions: 2 }, sig({ restitution: true }), 0, 0);
    expect(r.etat.restitutions).toBe(SEUIL_RESTITUTIONS);
    expect(r.etat.phase).toBe("clore");
    expect(r.transition).toEqual({ de: "nommer", vers: "clore" });
    expect(r.beat, "le beat « nommer » ne se rejoue pas à la clôture").toBeNull();
  });

  it("3 restitutions mais observation PAS délivrée → reste nommer (FR-004)", () => {
    const r = avancerArc(etat({ phase: "nommer", observationDelivree: false, restitutions: 3 }), sig({}), 0, 0);
    expect(r.etat.phase).toBe("nommer");
  });
});

describe("FR-002 — aucune coupure sur le temps (cible 12-20 min = repère, jamais minuteur)", () => {
  it("mêmes signaux à 5 min et à 25 min → résultat IDENTIQUE (transition, beat, peutNommer, état)", () => {
    const base = etat({
      phase: "observer",
      reformulationsEmises: 2,
      confirmations: 1,
      elementsPersonnels: 1,
      debutMs: 1000,
    });
    const a = avancerArc(base, sig({}), 0, 1000 + 5 * 60 * 1000);
    const b = avancerArc(base, sig({}), 0, 1000 + 25 * 60 * 1000);
    expect(a).toEqual(b);
  });
});

describe("mapping signal → compteur (T1 GREEN)", () => {
  it("reformulationConfirmee → confirmations (JAMAIS reformulationEmise)", () => {
    const emise = avancerArc(etatArcInitial(), sig({ reformulationEmise: true }), 0, 0);
    expect(emise.etat.reformulationsEmises).toBe(1);
    expect(emise.etat.confirmations, "emise n'incrémente PAS confirmations").toBe(0);
    const confirmee = avancerArc(etatArcInitial(), sig({ reformulationConfirmee: true }), 0, 0);
    expect(confirmee.etat.confirmations).toBe(1);
    expect(confirmee.etat.reformulationsEmises).toBe(0);
  });

  it("chaque signal alimente son compteur", () => {
    const r = avancerArc(
      etatArcInitial(),
      sig({ sujetDeVieNouveau: true, reponseLongue: true, elementPersonnelNonSollicite: true, restitution: true }),
      0,
      0,
    );
    expect(r.etat.sujetsAbordes).toBe(1);
    expect(r.etat.aReponseLongue).toBe(true);
    expect(r.etat.elementsPersonnels).toBe(1);
    expect(r.etat.restitutions).toBe(1);
  });
});

describe("avancerArc — pureté", () => {
  it("ne MUTE jamais l'état d'entrée", () => {
    const e = etatArcInitial();
    const copie = structuredClone(e);
    avancerArc(e, sig({ sujetDeVieNouveau: true, restitution: true }), 3, 9999);
    expect(e).toEqual(copie);
  });
});

describe("AC1 — démarrage au strict minimum, jamais bloquant (FR-010/FR-011)", () => {
  it("la machine n'a AUCUNE précondition de profil : l'arc atteint clore sans prénom ni heure", () => {
    // EtatArc ne porte aucune donnée de profil ; on drive l'arc de bout en bout sans jamais en fournir.
    let e = etatArcInitial();
    const av = (s: Partial<SignauxTour>) => {
      const r = avancerArc(e, sig(s), 0, 0);
      e = r.etat;
      return r;
    };
    av({ sujetDeVieNouveau: true });
    av({ sujetDeVieNouveau: true });
    av({ sujetDeVieNouveau: true, reponseLongue: true });
    av({ reformulationEmise: true, elementPersonnelNonSollicite: true });
    av({ reformulationEmise: true });
    av({ reformulationConfirmee: true });
    e = { ...e, observationDelivree: true };
    av({ restitution: true });
    av({ restitution: true });
    av({ restitution: true });
    expect(e.phase, "aucune donnée optionnelle n'a jamais gardé une phase").toBe("clore");
  });

  it("le message « sans heure » (PROVISOIRE, couture INERTE) explique ce qui reste ET où l'ajouter (FR-011)", () => {
    expect(MESSAGE_SANS_HEURE).toMatch(/heure/i);
    expect(MESSAGE_SANS_HEURE).toMatch(/profil|ajouter|plus tard/i); // où la trouver (non-bloquant)
    expect(MESSAGE_SANS_HEURE).toMatch(/bloque/i); // dit explicitement que rien ne se bloque
  });
});

describe("arc complet construire → observer → nommer → clore (pur, multi-tours)", () => {
  it("progresse phase par phase sur une suite de tours", () => {
    let e = etatArcInitial();
    const av = (s: Partial<SignauxTour>) => {
      const r = avancerArc(e, sig(s), 0, 0);
      e = r.etat;
      return r;
    };
    // construire : 3 sujets + réponse longue
    av({ sujetDeVieNouveau: true });
    av({ sujetDeVieNouveau: true });
    av({ sujetDeVieNouveau: true, reponseLongue: true });
    expect(e.phase).toBe("observer");
    // observer : 2 reformulations, 1 confirmation, 1 élément personnel
    av({ reformulationEmise: true, elementPersonnelNonSollicite: true });
    av({ reformulationEmise: true });
    const versNommer = av({ reformulationConfirmee: true });
    expect(e.phase).toBe("nommer");
    expect(versNommer.beat).toBe("nommer");
    expect(e.observationDelivree, "pas encore délivré au tour de transition").toBe(false);
    // nommer → clore : la machine DÉRIVE observationDelivree de l'entrée en nommer — AUCUN set manuel.
    av({ restitution: true }); // 1er tour EN nommer → observationDelivree devient true
    expect(e.observationDelivree).toBe(true);
    av({ restitution: true });
    const versClore = av({ restitution: true });
    expect(e.phase).toBe("clore");
    expect(versClore.transition).toEqual({ de: "nommer", vers: "clore" });
  });
});

describe("Régression (revue 2.7) — observationDelivree dérivé : l'arc n'est jamais bloqué en nommer", () => {
  it("atteint clore SANS qu'aucun code ne pose observationDelivree à la main", () => {
    // Bug trouvé en revue : aucun code serveur ne posait observationDelivree=true → sortie nommer→clore
    // toujours fausse → arc bloqué en nommer à vie. La machine le DÉRIVE de l'entrée en nommer.
    let e: EtatArc = etat({ phase: "nommer" }); // fraîchement en nommer, observationDelivree false
    expect(e.observationDelivree).toBe(false);
    const av = (s: Partial<SignauxTour>) => {
      const r = avancerArc(e, sig(s), 0, 0);
      e = r.etat;
      return r;
    };
    av({ restitution: true });
    expect(e.observationDelivree, "dérivé true dès le 1er tour EN nommer").toBe(true);
    av({ restitution: true });
    av({ restitution: true });
    expect(e.phase).toBe("clore");
  });

  it("le tour de transition observer→nommer garde observationDelivree false (livraison en cours)", () => {
    const presque = etat({ phase: "observer", reformulationsEmises: 2, elementsPersonnels: 1 });
    const r = avancerArc(presque, sig({ reformulationConfirmee: true }), 0, 0);
    expect(r.etat.phase).toBe("nommer");
    expect(r.etat.observationDelivree, "false au tour de transition — délivré au tour SUIVANT").toBe(false);
  });
});
