import { describe, it, expect, vi, beforeEach } from "vitest";
import { situationAbonnement } from "@/lib/domain/abonnement";

/**
 * apres-la-resiliation.test.ts — UNE RÉSILIATION ABOUTIE N'EST PAS UN CUL-DE-SAC
 * (revue adversariale du 2026-08-18, R2 · FR-060 · loi du 16 août 2022).
 *
 * ══ CE QUI SE PASSAIT, ET POURQUOI PERSONNE NE L'A VU ═════════════════════════════════════════
 *
 * Le produit n'offre qu'un seul chemin de résiliation : `cancel_at_period_end`. À l'échéance, Stripe
 * émet `customer.subscription.deleted` avec `status = 'canceled'` — et `cancel_at` TOUJOURS
 * renseigné, puisque c'est ainsi qu'elle a résilié. La projection écrit donc les deux à la fois :
 *
 *     etat = 'resilie'   ET   resiliation_demandee_le = <la date, désormais passée>
 *
 * `resiliation_demandee_le` est en écrasement FRANC (0044) et c'est juste : une résiliation ANNULÉE
 * doit effacer la date. Mais l'écran lisait ce champ comme s'il signifiait « résiliation EN COURS ».
 * Trois conséquences dans le même document, sur la page qui parle d'argent :
 *
 *   1. « Ton abonnement est résilié. Tu y as accès jusqu'au 4 mars 2027 » — une date RÉVOLUE, donc
 *      la promesse d'un accès qui n'existe plus ;
 *   2. le seul geste offert est « Reprendre », qui POSTe `subscriptions.update` sur une souscription
 *      `canceled`. Stripe refuse toujours (« a canceled subscription can only update its
 *      metadata ») → `?etat=echec` → « Je n'ai pas pu enregistrer ça. Tu peux réessayer. » Elle
 *      peut recliquer indéfiniment ;
 *   3. l'offre ne se monte pas — et depuis la 3.6, cette page est le SEUL chemin d'abonnement d'un
 *      compte sans branche. Toute personne ayant résilié une fois était définitivement inencaissable.
 *
 * La route Checkout, elle, l'aurait acceptée : `contratStripeVivant('canceled')` est faux. Il
 * n'existait simplement plus aucun bouton pour l'appeler.
 *
 * ══ POURQUOI UNE SITUATION, ET PAS UNE GARDE DE PLUS ══════════════════════════════════════════
 *
 * La page combinait TROIS booléens indépendants (`actif`, `resiliationDemandee`, `contratOuvert`) en
 * quatre endroits. Huit combinaisons, cinq écrites, et celle-ci — « résiliée ET morte » — n'était
 * traitée nulle part. Ajouter un quatrième booléen aurait produit seize combinaisons et le même
 * défaut un cran plus loin. `situationAbonnement` rend une UNION : il n'existe plus de combinaison
 * sans nom, et le compilateur exige que chaque cas soit rendu.
 */

describe("[R2] `situationAbonnement` — la projection dit ce qu'elle sait, et rien de plus", () => {
  it("aucune ligne : jamais abonnée — jamais « ton abonnement n'est plus actif »", () => {
    expect(situationAbonnement(null)).toBe("jamais_abonnee");
    expect(situationAbonnement(undefined)).toBe("jamais_abonnee");
  });

  it("actif sans date de résiliation : actif", () => {
    expect(
      situationAbonnement({ etat: "actif", resiliationDemandeeLe: null, subscriptionId: "sub_1", offertLe: null }),
    ).toBe("actif");
  });

  it("actif AVEC date : la résiliation court — l'accès va jusqu'à la date", () => {
    expect(
      situationAbonnement({
        etat: "actif",
        resiliationDemandeeLe: "2027-03-04T00:00:00Z",
        subscriptionId: "sub_1", offertLe: null,
      }),
    ).toBe("resiliation_en_cours");
  });

  it("[LE CŒUR] `resilie` AVEC date : TERMINÉ — pas « en cours », quoi que dise la date", () => {
    // ⚠️ C'EST EXACTEMENT LA COMBINAISON QUE STRIPE ENVOIE À L'ÉCHÉANCE. `status = 'canceled'` et
    // `cancel_at` renseigné arrivent ENSEMBLE, toujours, parce que c'est le seul chemin du produit.
    // L'ordre des tests ci-dessous compte : l'état MORT est examiné AVANT la date.
    expect(
      situationAbonnement({
        etat: "resilie",
        resiliationDemandeeLe: "2027-03-04T00:00:00Z",
        subscriptionId: "sub_1", offertLe: null,
      }),
    ).toBe("termine");
  });

  it("`resilie` sans date (résiliation immédiate côté Stripe) : terminé aussi", () => {
    expect(
      situationAbonnement({ etat: "resilie", resiliationDemandeeLe: null, subscriptionId: "sub_1", offertLe: null }),
    ).toBe("termine");
  });

  it("[LE BORD QUI COÛTE] `expire` avec un identifiant : le contrat COURT encore (M12)", () => {
    // `past_due`, `unpaid`, `incomplete`, `paused` tombent tous dans `expire` : l'accès est éteint,
    // Stripe relance et finira par encaisser. Confondre ce cas avec « terminé » retirerait le bouton
    // de résiliation à la personne la plus coincée du produit — le défaut M12, repayé.
    expect(
      situationAbonnement({ etat: "expire", resiliationDemandeeLe: null, subscriptionId: "sub_1", offertLe: null }),
    ).toBe("sans_acces_contrat_ouvert");
  });

  it("`expire` SANS identifiant : il n'y a plus rien à résilier", () => {
    expect(
      situationAbonnement({ etat: "expire", resiliationDemandeeLe: null, subscriptionId: null, offertLe: null }),
    ).toBe("termine");
  });

  it("`expire` avec une date de résiliation : la résiliation court toujours", () => {
    // Une carte refusée pendant le préavis. Le contrat vit, `cancel_at` tient : « Reprendre » marche.
    expect(
      situationAbonnement({
        etat: "expire",
        resiliationDemandeeLe: "2027-03-04T00:00:00Z",
        subscriptionId: "sub_1", offertLe: null,
      }),
    ).toBe("resiliation_en_cours");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA ROUTE — elle ne parle plus à Stripe d'un contrat mort, et elle ne rend plus de JSON
// ══════════════════════════════════════════════════════════════════════════════════════════════

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

const { POST } = await import("@/app/api/abonnement/resilier/route");

const req = (q = "") =>
  new Request(`https://anima.test/api/abonnement/resilier${q}`, { method: "POST" });

beforeEach(() => {
  getUser.mockReset();
  lireAbonnement.mockReset();
  resilier.mockReset();
  annuler.mockReset();
  traiterEvenement.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  lireAbonnement.mockResolvedValue({ subscriptionId: "sub_1", offertLe: null, etat: "actif", resiliationDemandeeLe: null });
  resilier.mockResolvedValue("2027-01-01T10:00:00.000Z");
  annuler.mockResolvedValue(undefined);
  traiterEvenement.mockResolvedValue("traite");
});

describe("[R2] la route refuse un contrat MORT au lieu de le faire refuser par Stripe", () => {
  const mort = { subscriptionId: "sub_1", offertLe: null, etat: "resilie", resiliationDemandeeLe: "2027-03-04T00:00:00Z" };

  it("[LE CŒUR] « Reprendre » sur un contrat clos n'appelle PAS Stripe", async () => {
    lireAbonnement.mockResolvedValue(mort);
    const res = await POST(req("?reprendre=1"));
    expect(annuler, "on a demandé à Stripe de ranimer un contrat mort").not.toHaveBeenCalled();
    expect(res.status).toBe(303);
  });

  it("[LE CŒUR] et elle ne dit pas « réessaie » — le mur serait le même à chaque fois", async () => {
    lireAbonnement.mockResolvedValue(mort);
    const res = await POST(req("?reprendre=1"));
    expect(res.headers.get("location")).toContain("etat=contrat_clos");
    expect(res.headers.get("location")).not.toContain("etat=echec");
  });

  it("résilier un contrat déjà clos : même refus, aucun appel", async () => {
    lireAbonnement.mockResolvedValue(mort);
    const res = await POST(req());
    expect(resilier).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("etat=contrat_clos");
  });

  it("[CONTRÔLE POSITIF] un contrat vivant passe toujours — la garde ne ferme pas la sortie", async () => {
    const res = await POST(req());
    expect(resilier).toHaveBeenCalledWith("sub_1");
    expect(res.headers.get("location")).toContain("etat=resilie");
  });

  it("[CONTRÔLE POSITIF] et « Reprendre » sur une résiliation EN COURS marche encore", async () => {
    lireAbonnement.mockResolvedValue({
      subscriptionId: "sub_1", offertLe: null,
      etat: "actif",
      resiliationDemandeeLe: "2027-03-04T00:00:00Z",
    });
    const res = await POST(req("?reprendre=1"));
    expect(annuler).toHaveBeenCalledWith("sub_1");
    expect(res.headers.get("location")).toContain("etat=reprise");
  });
});

describe("[R2 · revue 1-4 #16] aucune sortie de cette route ne rend un corps machine", () => {
  /**
   * ⚠️ LE MÊME DÉFAUT QUE #16, SUR LA ROUTE JUMELLE. Ce POST vient d'un `<form>` HTML sans
   * JavaScript — c'est l'exigence même de la porte de sortie. Un `NextResponse.json(...)` n'est
   * donc pas « une réponse d'API » : le navigateur REMPLACE la page par le texte du corps, plein
   * écran, sans mise en forme :
   *
   *     {"code":"aucun_abonnement"}
   *
   * Les deux cas sont atteignables sans rien forger : une page ouverte dans un second onglet
   * pendant qu'on résilie dans le premier, ou une session expirée entre l'affichage et le clic.
   */
  it("session absente : la porte, pas un 401 nu", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/entrer");
  });

  it("aucun abonnement : une phrase, pas un 404 JSON", async () => {
    lireAbonnement.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/abonnement");
  });

  it("[LA GARDE GÉNÉRALE] `NextResponse.json` n'a plus le droit d'apparaître ici", async () => {
    // Énumérer les cas laisserait passer celui qu'on écrira demain — la leçon exacte de #16.
    const { readFileSync } = await import("node:fs");
    const { sansCommentaires } = await import("./_absence");
    const src = sansCommentaires(
      readFileSync(new URL("../app/api/abonnement/resilier/route.ts", import.meta.url), "utf-8"),
    );
    expect(src, "un corps JSON remplacerait la page plein écran").not.toMatch(/NextResponse\.json/);
  });
});
