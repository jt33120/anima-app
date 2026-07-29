import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * Story 3.1 (revue) — les BOOT-GUARDS de secret Stripe (échec DUR, jamais fail-open). Contrôle
 * positif+négatif (patron `privileges-fonctions`) : sans secret → lève ; avec secret → construit /
 * n'échoue pas sur la garde. `vi.resetModules` remet le singleton mémoïsé à zéro entre les cas.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("clientStripe — boot-guard de la clé secrète", () => {
  it("lève si STRIPE_SECRET_KEY absente (échec dur)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { clientStripe } = await import("@/lib/stripe/client");
    expect(() => clientStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("se construit avec une clé présente (singleton mémoïsé)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx");
    const { clientStripe } = await import("@/lib/stripe/client");
    const c = clientStripe();
    expect(c).toBeDefined();
    expect(clientStripe()).toBe(c); // même instance
  });
});

describe("verifierEvenementStripe — boot-guard du secret de webhook et de la signature", () => {
  it("lève si STRIPE_WEBHOOK_SECRET absent", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx");
    const { verifierEvenementStripe } = await import("@/lib/stripe/webhook");
    expect(() => verifierEvenementStripe("{}", "sig")).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it("lève si l'en-tête de signature est absent", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_xxx");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx");
    const { verifierEvenementStripe } = await import("@/lib/stripe/webhook");
    expect(() => verifierEvenementStripe("{}", null)).toThrow(/signature/i);
  });
});
