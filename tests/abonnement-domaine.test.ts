import { describe, it, expect } from "vitest";
import {
  etatDepuisStatutStripe,
  estPremium,
  fenetreInformationReconduction,
  joursAvantEcheance,
  L215_JOURS_MIN,
  L215_JOURS_MAX,
} from "@/lib/domain/abonnement";

/**
 * Story 3.1 — le cœur PUR de projection d'état (AD-1). Contrôle positif ET négatif de chaque
 * transition `subscription.status` → `EtatAbonnement`, et de l'entitlement `estPremium`.
 */

describe("etatDepuisStatutStripe — projection status Stripe → état (autorité canonique)", () => {
  it("active / trialing → actif (premium)", () => {
    expect(etatDepuisStatutStripe("active")).toBe("actif");
    expect(etatDepuisStatutStripe("trialing")).toBe("actif");
  });

  it("canceled → resilie (résiliation aboutie)", () => {
    expect(etatDepuisStatutStripe("canceled")).toBe("resilie");
  });

  it("past_due / unpaid / incomplete / incomplete_expired / paused → expire (accès éteint)", () => {
    for (const s of ["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(etatDepuisStatutStripe(s)).toBe("expire");
    }
  });

  it("statut inconnu → expire (fail-safe : jamais actif par défaut)", () => {
    expect(etatDepuisStatutStripe("nimportequoi")).toBe("expire");
    expect(etatDepuisStatutStripe("")).toBe("expire");
  });
});

describe("estPremium — entitlement dérivé (source de vérité unique, AC4)", () => {
  it("premium ⟺ état actif", () => {
    expect(estPremium({ etat: "actif" })).toBe(true);
    expect(estPremium({ etat: "resilie" })).toBe(false);
    expect(estPremium({ etat: "expire" })).toBe(false);
  });

  it("aucun abonnement (null/undefined) → jamais premium", () => {
    expect(estPremium(null)).toBe(false);
    expect(estPremium(undefined)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LA FENÊTRE DE L'ARTICLE L215-1 (revue du 2026-08-12, M10)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * L'obligation : informer de la reconduction AU PLUS TÔT trois mois et AU PLUS TARD un mois avant le
 * terme. Ce que le produit peut tenir, c'est de SAVOIR quand il est hors délai — la date d'émission
 * d'`invoice.upcoming` est un réglage Stripe, pas une ligne de code.
 *
 * Les quatre bornes sont éprouvées des DEUX CÔTÉS. Une borne testée d'un seul côté ne prouve rien :
 * remplacer `30` par `0` passerait tous les tests qui n'exercent que le cas conforme.
 */
const LE_TERME = "2027-01-01T00:00:00.000Z";
/** `j` jours AVANT le terme — l'instant où l'information partirait. */
const aJoursDuTerme = (j: number) => new Date(new Date(LE_TERME).getTime() - j * 86_400_000);

describe("fenetreInformationReconduction — la fenêtre légale, et ses quatre bords", () => {
  it("[CONTRÔLE POSITIF] au milieu de la fenêtre (60 jours) → conforme", () => {
    expect(fenetreInformationReconduction(LE_TERME, aJoursDuTerme(60))).toBe("dans_la_fenetre");
  });

  it("EXACTEMENT 30 jours avant : encore dans la fenêtre (la borne est INCLUSE)", () => {
    expect(fenetreInformationReconduction(LE_TERME, aJoursDuTerme(L215_JOURS_MIN))).toBe("dans_la_fenetre");
  });

  it("29 jours avant : TROP TARD — l'obligation est manquée", () => {
    expect(fenetreInformationReconduction(LE_TERME, aJoursDuTerme(29))).toBe("trop_tard");
  });

  it("EXACTEMENT 92 jours avant : encore dans la fenêtre (la borne est INCLUSE)", () => {
    expect(fenetreInformationReconduction(LE_TERME, aJoursDuTerme(L215_JOURS_MAX))).toBe("dans_la_fenetre");
  });

  it("93 jours avant : TROP TÔT — informer quatre mois à l'avance ne vaut pas information", () => {
    expect(fenetreInformationReconduction(LE_TERME, aJoursDuTerme(93))).toBe("trop_tot");
  });

  it("le défaut Stripe documenté (~15 jours) est HORS FENÊTRE — c'est le cas qui a motivé la garde", () => {
    // « Upcoming renewal events » émet de l'ordre de quinze jours avant le terme si personne ne
    // règle rien. Le produit serait donc en défaut par DÉFAUT, sans un seul signal.
    expect(fenetreInformationReconduction(LE_TERME, aJoursDuTerme(15))).toBe("trop_tard");
  });

  it("une échéance DÉJÀ PASSÉE est trop tard, pas « conforme »", () => {
    expect(fenetreInformationReconduction(LE_TERME, aJoursDuTerme(-5))).toBe("trop_tard");
  });

  it("[LE TROU TROUVÉ EN DÉPLAÇANT LE CODE] une échéance ILLISIBLE est signalée, jamais tue", () => {
    // Écrit en ligne dans la route, le contrôle était `joursAvant < 30 || joursAvant > 92`. Sur une
    // date illisible, `joursAvant` vaut NaN — et TOUTE comparaison avec NaN est fausse. La garde se
    // taisait exactement là où l'on ne sait rien. Un `dans_la_fenetre` ici serait le pire retour
    // possible : une approbation fabriquée à partir d'une ignorance.
    expect(fenetreInformationReconduction("pas une date", aJoursDuTerme(60))).toBe("echeance_illisible");
    expect(fenetreInformationReconduction("", aJoursDuTerme(60))).toBe("echeance_illisible");
  });

  it("les bornes sont bien 30 et 92 — un mois et trois mois pleins", () => {
    // Garde de RÉÉCRITURE : si quelqu'un « arrondit » 92 à 90, la fenêtre se referme sur trois mois
    // moins deux jours et l'alerte crie sur des envois parfaitement légaux.
    expect(L215_JOURS_MIN).toBe(30);
    expect(L215_JOURS_MAX).toBe(92);
  });
});

describe("joursAvantEcheance — un nombre, ou l'aveu qu'on ne sait pas", () => {
  it("compte les jours restants, fractions comprises", () => {
    expect(joursAvantEcheance(LE_TERME, aJoursDuTerme(45))).toBeCloseTo(45, 6);
    expect(joursAvantEcheance(LE_TERME, aJoursDuTerme(0.5))).toBeCloseTo(0.5, 6);
  });

  it("rend `null` sur une date illisible — JAMAIS NaN, qui contamine toute comparaison", () => {
    expect(joursAvantEcheance("2027-13-45", new Date())).toBeNull();
    expect(joursAvantEcheance("hier", new Date())).toBeNull();
  });

  it("un terme passé rend un nombre NÉGATIF (pas zéro, pas null)", () => {
    expect(joursAvantEcheance(LE_TERME, aJoursDuTerme(-10))).toBeCloseTo(-10, 6);
  });
});
