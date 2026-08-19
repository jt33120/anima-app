import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * resiliation-sans-contradiction.test.ts — L'ÉCRAN NE SE DÉMENT PLUS DANS LE MÊME DOCUMENT
 * (revue des Epics 1 à 4, trouvaille #15).
 *
 * ══ CE QUI SE PASSAIT, MOT POUR MOT ═══════════════════════════════════════════════════════════
 *
 * Elle clique « Résilier ». La route pose `cancel_at_period_end` chez Stripe — le geste EST fait —
 * puis redirige vers `/abonnement?etat=resilie`. La page se rend AVANT que le webhook
 * `customer.subscription.updated` ne soit arrivé, donc la projection locale porte encore
 * `resiliation_demandee_le = null` et `etat = 'actif'`. Elle lit alors, de haut en bas :
 *
 *     « C'est fait. Tu gardes ton accès jusqu'à la fin de la période payée. »
 *     « Ton abonnement est actif. »
 *     « Il se renouvellera le 1 janvier 2027. »
 *     [ Résilier mon abonnement ]
 *
 * Une confirmation, un démenti, une date de renouvellement qui n'aura pas lieu, et le bouton qu'elle
 * vient d'actionner — sur la page que la loi du 16 août 2022 gouverne. Le doute qu'elle produit a
 * une issue évidente et fausse : recliquer.
 *
 * ══ CE QUI MANQUAIT ÉTAIT DÉJÀ ÉCRIT ══════════════════════════════════════════════════════════
 *
 * `resilierEnFinDePeriode` RENDAIT la date d'effet, et son en-tête disait pourquoi : « pour que
 * l'écran puisse dire "actif jusqu'au …" SANS ATTENDRE LE WEBHOOK ». La route jetait la valeur de
 * retour. Le correctif ne pose donc pas de mécanisme neuf : il branche celui qui existait.
 *
 * ⚠️ LA DATE NE TRANSITE PAS PAR L'URL, et c'est le point de conception. `?jusqu=2099-01-01` serait
 * une date à portée juridique dont la source est la barre d'adresse. On PROJETTE — par la même RPC
 * écrivain-unique que le webhook, avec la même clé de dédup et la même horloge d'ordre.
 */

const getUser = vi.fn();
const lireAbonnement = vi.fn();
const resilier = vi.fn();
const annuler = vi.fn();
const traiterEvenement = vi.fn();

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/data/depot-resiliation", () => ({
  lireAbonnement: () => lireAbonnement(),
}));
vi.mock("@/lib/stripe/resiliation", () => ({
  resilierEnFinDePeriode: (id: string) => resilier(id),
  annulerResiliation: (id: string) => annuler(id),
}));
vi.mock("@/lib/data/depot-abonnement", () => ({
  creerDepotAbonnement: () => ({ traiterEvenement }),
}));

import { POST } from "@/app/api/abonnement/resilier/route";

const req = (q = "") => new Request(`https://anima.test/api/abonnement/resilier${q}`, { method: "POST" });

beforeEach(() => {
  getUser.mockReset();
  lireAbonnement.mockReset();
  resilier.mockReset();
  annuler.mockReset();
  traiterEvenement.mockReset();

  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  lireAbonnement.mockResolvedValue({ subscriptionId: "sub_1", offertLe: null, etat: "actif" });
  resilier.mockResolvedValue("2027-01-01T10:00:00.000Z");
  annuler.mockResolvedValue(undefined);
  traiterEvenement.mockResolvedValue("traite");
});

describe("[revue 1-4, #15] résilier projette la date SANS attendre le webhook", () => {
  it("[LE CŒUR] la date rendue par Stripe est projetée, pas jetée", async () => {
    await POST(req());
    expect(resilier).toHaveBeenCalledWith("sub_1");
    expect(traiterEvenement).toHaveBeenCalledTimes(1);
    const e = traiterEvenement.mock.calls[0][0];
    expect(e.resiliationDemandeeLe, "la date d'effet doit atteindre la projection").toBe(
      "2027-01-01T10:00:00.000Z",
    );
    expect(e.utilisatriceId).toBe("u1");
    expect(e.subscriptionId).toBe("sub_1");
  });

  it("[LE CŒUR] reprendre EFFACE la date — sinon l'écran dirait « résilié » à quelqu'un revenu", async () => {
    lireAbonnement.mockResolvedValueOnce({ subscriptionId: "sub_1", offertLe: null, etat: "actif" });
    await POST(req("?reprendre=1"));
    expect(annuler).toHaveBeenCalledWith("sub_1");
    const e = traiterEvenement.mock.calls[0][0];
    expect(e.resiliationDemandeeLe, "`null` est une VALEUR ici, pas une absence").toBeNull();
  });

  it("l'ÉTAT n'est jamais inventé — on reprojette celui qu'on a lu", async () => {
    // ⚠️ LE PIÈGE QU'ON ÉVITE. Écrire `etat: "actif"` en dur serait juste dans le cas nominal et FAUX
    // pour un abonnement `past_due` (projeté `expire`) : résilier un contrat en échec de paiement
    // aurait alors RÉTABLI son accès à l'écran. Une résiliation ne change pas l'état d'accès — Stripe
    // garde `status = active` jusqu'à l'échéance — elle ne change que la DATE.
    lireAbonnement.mockResolvedValueOnce({ subscriptionId: "sub_1", offertLe: null, etat: "expire" });
    await POST(req());
    expect(traiterEvenement.mock.calls[0][0].etat).toBe("expire");
  });

  it("les champs que l'événement ne porte pas sont `null` — la RPC les CONSERVE (coalesce)", async () => {
    await POST(req());
    const e = traiterEvenement.mock.calls[0][0];
    // Les poser à une valeur inventée écraserait `debut_le`, donc remettrait à zéro le compteur des
    // trois mois de la garantie FR-089. `null` traverse le coalesce sans rien détruire.
    expect(e.periodeFin).toBeNull();
    expect(e.debutLe).toBeNull();
    expect(e.customerId).toBeNull();
  });

  it("la clé de dédup est LOCALE et distincte d'un id d'événement Stripe", async () => {
    await POST(req());
    const id = traiterEvenement.mock.calls[0][0].providerEventId;
    expect(typeof id).toBe("string");
    // Sans préfixe, une collision avec un vrai `evt_…` ferait taire le webhook correspondant.
    expect(id.startsWith("local:"), `clé « ${id} » : il faut un espace de noms local`).toBe(true);
    // Elle porte la souscription ET l'effet : deux gestes successifs ne se dédupliquent pas l'un l'autre.
    expect(id).toContain("sub_1");
  });

  it("l'horloge d'ordre est fournie — sinon l'anti-régression n'a rien à comparer", async () => {
    const avant = Date.now();
    await POST(req());
    const t = Date.parse(traiterEvenement.mock.calls[0][0].sourceMajLe);
    expect(Number.isNaN(t)).toBe(false);
    expect(t).toBeGreaterThanOrEqual(avant - 1000);
  });
});

describe("[revue 1-4, #15] la projection est un CONFORT, jamais l'engagement", () => {
  it("[LE TEST QUI COMPTE] une panne de projection ne fait PAS échouer une résiliation déjà acquise", async () => {
    // ⚠️ LE GESTE EST DÉJÀ FAIT CHEZ STRIPE quand cette écriture a lieu. Rendre `?etat=echec` ici
    // dirait « je n'ai pas pu enregistrer ça » à quelqu'un dont le contrat EST résilié — et
    // l'inviterait à recommencer un geste accompli. Le webhook réparera la projection ; l'écran, lui,
    // ne doit pas mentir dans l'autre sens.
    traiterEvenement.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("etat=resilie");
  });

  it("un échec CHEZ STRIPE, lui, reste un échec — et ne projette rien", async () => {
    resilier.mockRejectedValueOnce(new Error("stripe down"));
    const res = await POST(req());
    expect(res.headers.get("location")).toContain("etat=echec");
    expect(traiterEvenement, "rien ne s'est passé : rien à projeter").not.toHaveBeenCalled();
  });

  it("aucun abonnement : ni Stripe ni projection ne sont touchés", async () => {
    lireAbonnement.mockResolvedValueOnce(null);
    const res = await POST(req());
    // ⚠️ 303 ET PLUS 404 (revue adversariale, R2). Le refus rendait un corps JSON, que le navigateur
    // affichait PLEIN ÉCRAN à la place de la page : ce POST vient d'un `<form>` sans JavaScript.
    // Ce que ce test-ci mesure est inchangé — rien n'est appelé, rien n'est projeté.
    expect(res.status).toBe(303);
    expect(resilier).not.toHaveBeenCalled();
    expect(traiterEvenement).not.toHaveBeenCalled();
  });
});
