import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 3.1 (revue) — la garde AD-9 de la route Checkout EXERCÉE (effet réel, pas ordre textuel).
 * On invoque réellement le handler POST en mockant ses dépendances (patron `garde-commerciale.test.ts`),
 * et on prouve : limites levées → 409 ET `checkout.sessions.create` JAMAIS appelé ; sinon → session créée.
 */

const getUser = vi.fn();
const limites = vi.fn();
const sessionsCreate = vi.fn();

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/safety/limites-commerciales", () => ({
  limitesCommercialesLevees: (id: string) => limites(id),
}));
vi.mock("@/lib/stripe/client", () => ({
  clientStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
}));
vi.mock("@/lib/stripe/config", () => ({
  PRIX_ABONNEMENT_ANNUEL_CENTIMES: 6900,
  DEVISE_ABONNEMENT: "eur",
  libelleReleveBancaire: () => undefined,
}));

import { POST } from "@/app/api/stripe/checkout/route";
import { NextRequest } from "next/server";

const req = () => new NextRequest("https://anima.test/api/stripe/checkout", { method: "POST" });

beforeEach(() => {
  getUser.mockReset();
  limites.mockReset();
  sessionsCreate.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "u@a.test" } } });
});

describe("Story 3.1 — garde AD-9 EXERCÉE sur la route Checkout (effet réel)", () => {
  it("session absente → 401 (auth d'abord)", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(limites).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("limites LEVÉES → 409 ET checkout.sessions.create JAMAIS appelé (tue résultat-jeté ET inversion)", async () => {
    limites.mockResolvedValueOnce(true);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(limites).toHaveBeenCalledWith("u1");
  });

  it("limites NON levées → la session se crée et redirige en 303 (contrôle positif)", async () => {
    limites.mockResolvedValueOnce(false);
    sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    const res = await POST(req());
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.mode).toBe("subscription");
    expect(args.line_items[0].price_data.unit_amount).toBe(6900);
    expect(args.subscription_data.metadata.utilisatriceId).toBe("u1");
    expect(res.status).toBe(303);
  });

  it("session.url absente → 502 (jamais de redirection vide)", async () => {
    limites.mockResolvedValueOnce(false);
    sessionsCreate.mockResolvedValueOnce({ url: null });
    const res = await POST(req());
    expect(res.status).toBe(502);
  });
});
