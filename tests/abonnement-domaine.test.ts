import { describe, it, expect } from "vitest";
import { etatDepuisStatutStripe, estPremium } from "@/lib/domain/abonnement";

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
