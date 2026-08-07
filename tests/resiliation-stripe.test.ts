import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 3.5 (T3) — L'EXÉCUTION STRIPE : ce qu'on appelle, avec quoi, et dans quel ordre.
 *
 * Le SDK est doublé. Ce n'est pas un test d'intégration Stripe (il faudrait un compte de test et une
 * facture réglée) : c'est la preuve des trois propriétés que le code seul ne montre pas à la lecture —
 * le remboursement ENTRAÎNE la résiliation, il est INTÉGRAL, et sa clé d'idempotence vient de la BASE.
 */

const update = vi.fn(async () => ({ cancel_at: 1_800_000_000 }));
const retrieve = vi.fn();
// Typé avec ses paramètres : sans ça, `mock.calls[0]` est `[]` et les lectures ci-dessous ne compilent pas.
const refundsCreate = vi.fn(
  async (params: Record<string, unknown>, options?: Record<string, unknown>) => ({ id: "re_1", params, options }),
);

vi.mock("@/lib/stripe/client", () => ({
  clientStripe: () => ({
    subscriptions: { update, retrieve },
    refunds: { create: refundsCreate },
  }),
}));

const { resilierEnFinDePeriode, annulerResiliation, rembourserIntegralement } = await import(
  "@/lib/stripe/resiliation"
);

/** Une souscription dont la dernière facture porte un paiement RÉGLÉ. */
const avecPaiement = (statut = "paid", pi: unknown = "pi_123") => ({
  latest_invoice: { payments: { data: [{ status: statut, payment: { payment_intent: pi } }] } },
});

beforeEach(() => {
  update.mockClear();
  retrieve.mockClear();
  refundsCreate.mockClear();
});

describe("[AC1/AC8] résilier", () => {
  it("pose `cancel_at_period_end`, jamais une annulation immédiate", async () => {
    const fin = await resilierEnFinDePeriode("sub_1");
    expect(update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    expect(fin).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });

  it("[DUR] n'appelle JAMAIS `subscriptions.cancel` — elle a payé l'année, elle la garde", async () => {
    // Une résiliation immédiate lui retirerait un service déjà réglé. Ni la loi ni la charte ne le
    // demandent, et personne ne le réclame en cliquant « résilier ».
    const client = (await import("@/lib/stripe/client")).clientStripe() as unknown as Record<string, unknown>;
    expect((client.subscriptions as Record<string, unknown>).cancel).toBeUndefined();
  });

  it("est naturellement idempotent : poser deux fois le même drapeau laisse le même état", async () => {
    await resilierEnFinDePeriode("sub_1");
    await resilierEnFinDePeriode("sub_1");
    expect(update).toHaveBeenNthCalledWith(1, "sub_1", { cancel_at_period_end: true });
    expect(update).toHaveBeenNthCalledWith(2, "sub_1", { cancel_at_period_end: true });
  });

  it("reprendre remet le drapeau à `false` — le geste est réversible", async () => {
    await annulerResiliation("sub_1");
    expect(update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: false });
  });
});

describe("[AC5/AC7/P10] rembourser", () => {
  it("[LE TEST QUI COMPTE] rembourser ENTRAÎNE la résiliation", async () => {
    // Rembourser sans résilier rend l'argent ET laisse la souscription courir : elle serait re-facturée
    // à l'échéance suivante, après avoir été remboursée. Le genre de moitié de geste qui transforme une
    // garantie en incident de facturation.
    retrieve.mockResolvedValueOnce(avecPaiement());
    const issue = await rembourserIntegralement("sub_1", "u1", "cle-abc");
    expect(issue).toBe("rembourse");
    expect(refundsCreate, "aucun remboursement émis").toHaveBeenCalledTimes(1);
    expect(update, "remboursée mais toujours abonnée — elle sera re-facturée").toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: true,
    });
  });

  it("[DUR] INTÉGRAL : aucun `amount` n'est transmis (l'omettre rembourse la totalité)", async () => {
    retrieve.mockResolvedValueOnce(avecPaiement());
    await rembourserIntegralement("sub_1", "u1", "cle-abc");
    const [params] = refundsCreate.mock.calls[0];
    expect(params, "un prorata sur « le produit n'a rien produit » est une contradiction").not.toHaveProperty(
      "amount",
    );
  });

  it("[DUR] la clé d'idempotence transmise est CELLE REÇUE — jamais fabriquée localement", async () => {
    // Une clé dérivée d'un horodatage ou d'un aléa rendrait chaque tentative unique, c'est-à-dire
    // rembourserait autant de fois qu'il y a de retries. Le bogue ne se verrait qu'en relevé bancaire.
    retrieve.mockResolvedValueOnce(avecPaiement());
    await rembourserIntegralement("sub_1", "u1", "cle-venue-de-la-base");
    const [, options] = refundsCreate.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: "cle-venue-de-la-base" });
  });

  it("pose `metadata.utilisatriceId` — c'est ce qui permet à `refund.created` de dire de qui il s'agit", async () => {
    retrieve.mockResolvedValueOnce(avecPaiement());
    await rembourserIntegralement("sub_1", "u-42", "cle-abc");
    const [params] = refundsCreate.mock.calls[0];
    expect(params.metadata).toEqual({ utilisatriceId: "u-42" });
    expect(params.payment_intent).toBe("pi_123");
  });

  it("accepte un PaymentIntent EXPANSÉ (objet) autant qu'une chaîne", async () => {
    retrieve.mockResolvedValueOnce(avecPaiement("paid", { id: "pi_objet" }));
    await rembourserIntegralement("sub_1", "u1", "cle");
    const [params] = refundsCreate.mock.calls[0];
    expect(params.payment_intent).toBe("pi_objet");
  });

  it("[DUR] un paiement NON réglé ne se rembourse pas — mais la résiliation a lieu quand même", async () => {
    retrieve.mockResolvedValueOnce(avecPaiement("open"));
    const issue = await rembourserIntegralement("sub_1", "u1", "cle");
    expect(issue).toBe("rien_a_rembourser");
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(update, "la sortie doit aboutir même sans encaissement").toHaveBeenCalled();
  });

  it("[AD-9] aucun encaissement du tout (barrière de minorité sur un compte jamais payant) → on résilie, on ne lève pas", async () => {
    // FR-071 s'applique à TOUT compte détecté mineur, abonné ou non. Lever ici ferait échouer une
    // mesure de sécurité à cause de l'absence d'un paiement : la sécurité ne dépend jamais du commerce.
    retrieve.mockResolvedValueOnce({ latest_invoice: null });
    await expect(rembourserIntegralement("sub_1", "u1", "cle")).resolves.toBe("rien_a_rembourser");
    expect(update).toHaveBeenCalled();
  });

  it("`latest_invoice` non expansée (chaîne) ne fait pas planter — elle ne rembourse simplement pas", async () => {
    retrieve.mockResolvedValueOnce({ latest_invoice: "in_123" });
    await expect(rembourserIntegralement("sub_1", "u1", "cle")).resolves.toBe("rien_a_rembourser");
  });
});
