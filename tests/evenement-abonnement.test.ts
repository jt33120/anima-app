import { describe, it, expect } from "vitest";
import { interpreterEvenementAbonnement, estTypeEtatAbonnement } from "@/lib/stripe/evenement-abonnement";
import type Stripe from "stripe";

/**
 * Story 3.1 (revue) — l'interprétation d'un événement Stripe brut → événement normalisé. Cœur
 * d'extraction (metadata.utilisatriceId, periodeFin sur l'ITEM = piège dahlia, filtre des types).
 * Fonction pure/déterministe → testée en isolation (aucune route, aucune DB).
 */

const sub = (over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  metadata: { utilisatriceId: "u-123" },
  items: { data: [{ current_period_end: 1893456000 }] },
  ...over,
});
const evt = (type: string, obj: unknown): Stripe.Event =>
  ({ id: "evt_1", type, created: 1893450000, data: { object: obj } }) as unknown as Stripe.Event;

describe("interpreterEvenementAbonnement — extraction depuis un Stripe.Event", () => {
  it("customer.subscription.created → normalise (utilisatriceId + periodeFin depuis l'ITEM, pas le top-level)", () => {
    const r = interpreterEvenementAbonnement(evt("customer.subscription.created", sub()));
    expect(r).not.toBeNull();
    expect(r!.utilisatriceId).toBe("u-123"); // tue une faute de frappe sur metadata
    expect(r!.etat).toBe("actif");
    expect(r!.customerId).toBe("cus_1");
    expect(r!.subscriptionId).toBe("sub_1");
    expect(r!.periodeFin).toBe(new Date(1893456000 * 1000).toISOString()); // tue le mauvais champ/units
    expect(r!.sourceMajLe).toBe(new Date(1893450000 * 1000).toISOString());
  });

  it("customer.subscription.deleted (status canceled) → resilie", () => {
    const r = interpreterEvenementAbonnement(evt("customer.subscription.deleted", sub({ status: "canceled" })));
    expect(r!.etat).toBe("resilie");
  });

  it("checkout.session.completed / invoice.payment_succeeded / charge.refunded → NO-OP (null)", () => {
    for (const t of ["checkout.session.completed", "invoice.payment_succeeded", "charge.refunded"]) {
      expect(interpreterEvenementAbonnement(evt(t, sub()))).toBeNull();
    }
  });

  it("type d'état géré mais metadata.utilisatriceId absent → null (mapping absent, pas une erreur)", () => {
    expect(interpreterEvenementAbonnement(evt("customer.subscription.updated", sub({ metadata: {} })))).toBeNull();
  });

  it("periodeFin = null quand l'item n'a pas current_period_end", () => {
    const r = interpreterEvenementAbonnement(evt("customer.subscription.updated", sub({ items: { data: [{}] } })));
    expect(r!.periodeFin).toBeNull();
  });

  it("customer objet (non-string) → customerId = customer.id", () => {
    const r = interpreterEvenementAbonnement(evt("customer.subscription.updated", sub({ customer: { id: "cus_obj" } })));
    expect(r!.customerId).toBe("cus_obj");
  });

  it("estTypeEtatAbonnement distingue les types d'état des NO-OP", () => {
    expect(estTypeEtatAbonnement("customer.subscription.updated")).toBe(true);
    expect(estTypeEtatAbonnement("checkout.session.completed")).toBe(false);
  });
});
