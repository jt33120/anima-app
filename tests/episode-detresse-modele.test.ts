import { describe, it, expect } from "vitest";
import {
  deciderTransition,
  limitesLevees,
  ecritureBrancheBloquee,
  SEUIL_TOURS_SURS,
  DUREE_MIN_EPISODE_MS,
  FENETRE_POST_EPISODE_MS,
  PARAMS_EXTINCTION_DEFAUT,
  type EtatEpisode,
} from "@/lib/safety/episode-detresse";

/**
 * Story 2.4 — la MACHINE D'ÉTAT PURE de l'épisode de détresse (AC1/AC2). Zéro I/O, zéro infra
 * (AD-1/AD-10). Prouve la RÈGLE (ouvre/rehausse/compte/éteint + les deux dérivations) ; la fonction
 * SQL `enregistrer_tour_detresse` l'applique de façon autoritaire et race-safe (cf. episode-detresse.test).
 *
 * Rappel du piège central (Dev Notes) : l'extinction lit le niveau DÉTECTÉ BRUT (0), jamais l'effectif
 * forcé — sinon un épisode ouvert ne s'éteint jamais (paywall levé à vie).
 */

const MAINTENANT = new Date("2026-07-28T12:00:00.000Z");
const ilYA = (ms: number) => new Date(MAINTENANT.getTime() - ms);

/** Épisode OUVERT (fin null) commode pour les tests. */
function ouvert(over: Partial<EtatEpisode> = {}): EtatEpisode {
  return {
    debut: ilYA(60 * 60 * 1000), // ouvert depuis 1 h par défaut (au-delà du délai min)
    niveauMax: 2,
    fin: null,
    fenetreExpireAt: null,
    toursSursConsecutifs: 0,
    ...over,
  };
}

describe("deciderTransition — ouverture / rehausse (niveau détecté ≥ 1)", () => {
  it("aucun épisode + niveau ≥ 1 → OUVRE au niveau détecté", () => {
    expect(deciderTransition(null, 2, MAINTENANT)).toEqual({ type: "ouvrir", niveau: 2 });
    expect(deciderTransition(null, 3, MAINTENANT)).toEqual({ type: "ouvrir", niveau: 3 });
  });

  it("épisode ouvert + niveau supérieur → REHAUSSE niveau_max", () => {
    expect(deciderTransition(ouvert({ niveauMax: 1 }), 3, MAINTENANT)).toEqual({
      type: "rehausser",
      niveauMax: 3,
    });
  });

  it("épisode ouvert + niveau inférieur → REHAUSSE mais niveau_max NE RÉGRESSE PAS (remet le compteur à 0)", () => {
    // niveauMax reste 3 ; l'action rehausser implique tours_surs = 0 (un tour ≥ 1 casse la série sûre).
    expect(deciderTransition(ouvert({ niveauMax: 3, toursSursConsecutifs: 2 }), 1, MAINTENANT)).toEqual({
      type: "rehausser",
      niveauMax: 3,
    });
  });
});

describe("deciderTransition — comptage / extinction (niveau détecté = 0)", () => {
  it("aucun épisode + niveau 0 → AUCUNE action", () => {
    expect(deciderTransition(null, 0, MAINTENANT)).toEqual({ type: "aucune" });
  });

  it("épisode ouvert + niveau 0, seuil PAS atteint → COMPTE (incrémente)", () => {
    expect(deciderTransition(ouvert({ toursSursConsecutifs: 0 }), 0, MAINTENANT)).toEqual({
      type: "compter",
      toursSurs: 1,
    });
  });

  it("épisode ouvert + niveau 0, seuil ET délai atteints → ÉTEINT (fin = maintenant, fenêtre = +72 h)", () => {
    const ep = ouvert({ toursSursConsecutifs: SEUIL_TOURS_SURS - 1 }); // +1 ce tour = SEUIL
    expect(deciderTransition(ep, 0, MAINTENANT)).toEqual({
      type: "eteindre",
      fin: MAINTENANT,
      fenetreExpireAt: new Date(MAINTENANT.getTime() + FENETRE_POST_EPISODE_MS),
    });
  });

  it("seuil de tours atteint MAIS délai minimal PAS écoulé → COMPTE, n'éteint pas (jamais trop tôt)", () => {
    const ep = ouvert({
      toursSursConsecutifs: SEUIL_TOURS_SURS - 1,
      debut: ilYA(DUREE_MIN_EPISODE_MS - 1000), // épisode trop récent
    });
    expect(deciderTransition(ep, 0, MAINTENANT)).toEqual({ type: "compter", toursSurs: SEUIL_TOURS_SURS });
  });

  it("délai écoulé MAIS pas assez de tours sûrs → COMPTE, n'éteint pas", () => {
    const ep = ouvert({ toursSursConsecutifs: 0, debut: ilYA(10 * 60 * 60 * 1000) });
    expect(deciderTransition(ep, 0, MAINTENANT)).toEqual({ type: "compter", toursSurs: 1 });
  });

  it("les seuils sont PARAMÉTRABLES (pas figés)", () => {
    const ep = ouvert({ toursSursConsecutifs: 0 });
    // seuil 1 → un seul tour sûr suffit (délai 0)
    expect(deciderTransition(ep, 0, MAINTENANT, { seuilToursSurs: 1, dureeMinMs: 0 }).type).toBe("eteindre");
  });
});

describe("limitesLevees — dérive de fin IS NULL (AC1)", () => {
  it("aucun épisode → false", () => {
    expect(limitesLevees(null)).toBe(false);
  });
  it("épisode ouvert (fin null) → true", () => {
    expect(limitesLevees(ouvert())).toBe(true);
  });
  it("épisode fermé (fin posée) → false — MÊME dans les 72 h suivantes (les limites ≠ la fenêtre branche)", () => {
    const ferme = ouvert({ fin: MAINTENANT, fenetreExpireAt: new Date(MAINTENANT.getTime() + FENETRE_POST_EPISODE_MS) });
    expect(limitesLevees(ferme)).toBe(false);
  });
});

describe("ecritureBrancheBloquee — ouvert OU dans les 72 h après (AC2, plus large que limitesLevees)", () => {
  it("aucun épisode → non bloqué", () => {
    expect(ecritureBrancheBloquee(null, MAINTENANT)).toBe(false);
  });
  it("épisode ouvert → bloqué", () => {
    expect(ecritureBrancheBloquee(ouvert(), MAINTENANT)).toBe(true);
  });
  it("épisode fermé, DANS les 72 h → bloqué (aucune branche née d'un épisode, FR-042)", () => {
    const ferme = ouvert({
      fin: ilYA(24 * 60 * 60 * 1000),
      fenetreExpireAt: new Date(ilYA(24 * 60 * 60 * 1000).getTime() + FENETRE_POST_EPISODE_MS),
    });
    expect(ecritureBrancheBloquee(ferme, MAINTENANT)).toBe(true);
  });
  it("épisode fermé, APRÈS les 72 h → non bloqué", () => {
    const ferme = ouvert({
      fin: ilYA(100 * 60 * 60 * 1000),
      fenetreExpireAt: new Date(ilYA(100 * 60 * 60 * 1000).getTime() + FENETRE_POST_EPISODE_MS),
    });
    expect(ecritureBrancheBloquee(ferme, MAINTENANT)).toBe(false);
  });
});

describe("constantes — la fenêtre est bien 72 h et les params par défaut sont cohérents", () => {
  it("FENETRE_POST_EPISODE_MS = 72 h", () => {
    expect(FENETRE_POST_EPISODE_MS).toBe(72 * 60 * 60 * 1000);
  });
  it("PARAMS_EXTINCTION_DEFAUT reprend les constantes provisoires", () => {
    expect(PARAMS_EXTINCTION_DEFAUT).toEqual({ seuilToursSurs: SEUIL_TOURS_SURS, dureeMinMs: DUREE_MIN_EPISODE_MS });
  });
});
