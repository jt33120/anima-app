import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { sansCommentaires } from "./_absence";

/**
 * Story 3.1 (revue) — la garde AD-9 de la route Checkout EXERCÉE (effet réel, pas ordre textuel).
 * On invoque réellement le handler POST en mockant ses dépendances (patron `garde-commerciale.test.ts`),
 * et on prouve : limites levées → 409 ET `checkout.sessions.create` JAMAIS appelé ; sinon → session créée.
 */

const getUser = vi.fn();
const limites = vi.fn();
const sessionsCreate = vi.fn();
/** Le statut RÉEL de la souscription déjà en base — la seule autorité (revue 3.6, R1). */
const subRetrieve = vi.fn();
/** L'abonnement déjà en base, lu par la garde « déjà abonnée » (revue du 2026-08-11, M9). */
const abonnementLu = vi.fn();
/** L'étape d'onboarding — la garde « on ne vend pas à un compte suspendu » (revue du 2026-08-13). */
const etape = vi.fn();

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ maybeSingle: abonnementLu }) }),
  }),
}));
vi.mock("@/lib/safety/limites-commerciales", () => ({
  limitesCommercialesLevees: (id: string) => limites(id),
}));
vi.mock("@/app/(auth)/etat-onboarding", () => ({
  etapeOnboardingPour: () => etape(),
}));
vi.mock("@/lib/stripe/client", () => ({
  clientStripe: () => ({
    checkout: { sessions: { create: sessionsCreate } },
    subscriptions: { retrieve: subRetrieve },
  }),
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
  subRetrieve.mockReset();
  abonnementLu.mockReset();
  etape.mockReset();
  etape.mockResolvedValue("suite"); // compte éligible : le cas nominal
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "u@a.test" } } });
  abonnementLu.mockResolvedValue({ data: null }); // compte gratuit : le cas nominal
  // Origine configurée : le cas nominal. VOLONTAIREMENT DIFFÉRENTE de l'hôte de la requête
  // (`anima.test`) — c'est ce qui rend visible, dans chaque test positif, laquelle des deux sert.
  vi.stubEnv("ANIMA_SITE_URL", "https://anima.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Story 3.1 — garde AD-9 EXERCÉE sur la route Checkout (effet réel)", () => {
  it("session absente → la PORTE, jamais un 401 nu (auth d'abord)", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(req());
    // Le code a changé de valeur, pas d'intention (revue des Epics 1 à 4, #16) : ce POST vient d'un
    // formulaire sans JavaScript, donc un corps JSON remplaçait la page par du texte machine.
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/entrer");
    expect(limites).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("limites LEVÉES → refus lisible ET checkout.sessions.create JAMAIS appelé (tue résultat-jeté ET inversion)", async () => {
    limites.mockResolvedValueOnce(true);
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/abonnement?etat=vente_fermee");
    // ⚠️ ET LE MOTIF N'EST PAS DANS L'URL. Un `?etat=commerce_suspendu` écrirait l'épisode de
    // détresse dans la barre d'adresse, puis dans l'historique du navigateur.
    expect(res.headers.get("location")).not.toMatch(/detresse|suspendu|crise|episode/i);
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

  it("[DUR] la PÉRIODE facturée est annuelle — pas seulement le montant", async () => {
    // Revue du 2026-08-11 (M6) : muter `interval: "year"` en `"month"` laissait la suite ENTIÈREMENT
    // verte. Le prix, lui, était bien couplé au 69 € affiché (`offre-abonnement.test.ts`). Facturer
    // 69 € tous les mois au lieu de tous les ans, c'est 828 €/an contre des CGU qui disent 69 —
    // le pire incident de confiance possible sur ce produit, et rien ne l'aurait vu.
    limites.mockResolvedValueOnce(false);
    sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    await POST(req());
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.line_items[0].price_data.recurring).toEqual({ interval: "year", interval_count: 1 });
  });

  it("session.url absente → une phrase, jamais une redirection vide", async () => {
    limites.mockResolvedValueOnce(false);
    sessionsCreate.mockResolvedValueOnce({ url: null });
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/abonnement?etat=paiement_injoignable");
  });

  it("[revue 1-4, #16] Stripe qui LÈVE ne rend plus la page d'erreur de Next", async () => {
    // ⚠️ C'ÉTAIT LA SIXIÈME SORTIE MACHINE, ET LA SEULE QU'AUCUN `code` NE NOMMAIT. L'appel n'était
    // pas enveloppé : une panne réseau remontait en exception, et Next rendait sa propre page
    // d'erreur — en anglais, non stylée, sur l'écran qui parle d'argent.
    limites.mockResolvedValueOnce(false);
    sessionsCreate.mockRejectedValueOnce(new Error("network"));
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/abonnement?etat=paiement_injoignable");
  });

  it("[M9] DÉJÀ ABONNÉE → refus ET aucune seconde session Stripe", async () => {
    // La projection est UNE LIGNE par utilisatrice : deux souscriptions vivantes chez Stripe et la
    // ligne bascule de l'une à l'autre. Elle est débitée deux fois pendant que le bouton « résilier »
    // ne sait viser qu'un seul abonnement — parfois le mort.
    limites.mockResolvedValueOnce(false);
    abonnementLu.mockResolvedValueOnce({ data: { etat: "actif", stripe_subscription_id: "sub_A" } });
    subRetrieve.mockResolvedValueOnce({ status: "active" });
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(res.headers.get("location"), "le refus doit être LISIBLE, pas un JSON").toContain(
      "/abonnement?etat=contrat_ouvert",
    );
    expect(sessionsCreate, "aucune seconde souscription ne doit être montée").not.toHaveBeenCalled();
  });

  // ── LE CŒUR DE LA REVUE 3.6 (R1) ────────────────────────────────────────────────────────────────
  //
  // Ces quatre statuts sont projetés `expire` chez nous — la garde M9, calée sur `etat === "actif"`,
  // ne mordait sur AUCUN. Ce sont pourtant des contrats que Stripe relance et finira par encaisser.
  // Le test d'origine nommait sa variable `sub_mort` et gravait le trou en vert : un `past_due`
  // n'est pas mort.
  it.each(["past_due", "unpaid", "incomplete", "paused"])(
    "[R1] un contrat Stripe « %s » REFUSE la seconde souscription (projeté `expire` chez nous)",
    async (statut) => {
      limites.mockResolvedValueOnce(false);
      abonnementLu.mockResolvedValueOnce({
        data: { etat: "expire", stripe_subscription_id: "sub_vivant" },
      });
      subRetrieve.mockResolvedValueOnce({ status: statut });
      const res = await POST(req());
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toContain("etat=contrat_ouvert");
      expect(sessionsCreate, "69 € débités par-dessus un contrat qui court").not.toHaveBeenCalled();
    },
  );

  it.each(["canceled", "incomplete_expired"])(
    "[R1] un contrat Stripe « %s » est MORT : le réabonnement passe — la garde n'enferme pas dehors",
    async (statut) => {
      // Contrôle non-tautologique, et il porte un cas réel : une PREMIÈRE carte refusée expire en
      // `incomplete_expired` à H+23. Refuser sur « identifiant non nul » l'aurait bannie à vie.
      limites.mockResolvedValueOnce(false);
      abonnementLu.mockResolvedValueOnce({
        data: { etat: "expire", stripe_subscription_id: "sub_mort" },
      });
      subRetrieve.mockResolvedValueOnce({ status: statut });
      sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
      const res = await POST(req());
      expect(res.status).toBe(303);
      expect(sessionsCreate).toHaveBeenCalledTimes(1);
    },
  );

  it("[R1] un statut Stripe INCONNU est tenu pour VIVANT — une liste d'autorisation s'ouvrirait toute seule", async () => {
    // Stripe ajoute des statuts. Écrire la garde en LISTE D'AUTORISATION (« vivant ⟺ l'un de ces
    // six ») laisserait passer le septième le jour où il naît, sans que rien ne rougisse. La garde
    // est donc écrite en liste de REFUS : seuls `canceled` et `incomplete_expired` sont morts.
    limites.mockResolvedValueOnce(false);
    abonnementLu.mockResolvedValueOnce({
      data: { etat: "expire", stripe_subscription_id: "sub_A" },
    });
    subRetrieve.mockResolvedValueOnce({ status: "statut_que_stripe_inventera" });
    const res = await POST(req());
    expect(res.headers.get("location")).toContain("etat=contrat_ouvert");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("[R1] une souscription INCONNUE de Stripe ne bloque pas — une ligne périmée n'est pas un contrat", async () => {
    limites.mockResolvedValueOnce(false);
    abonnementLu.mockResolvedValueOnce({
      data: { etat: "expire", stripe_subscription_id: "sub_fantome" },
    });
    subRetrieve.mockRejectedValueOnce(Object.assign(new Error("No such subscription"), {
      code: "resource_missing",
    }));
    sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("[R1] Stripe ILLISIBLE → on REFUSE : le repli est du côté qui ne débite pas deux fois", async () => {
    limites.mockResolvedValueOnce(false);
    abonnementLu.mockResolvedValueOnce({
      data: { etat: "expire", stripe_subscription_id: "sub_A" },
    });
    subRetrieve.mockRejectedValueOnce(new Error("timeout"));
    const res = await POST(req());
    expect(res.headers.get("location")).toContain("etat=contrat_ouvert");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("[R1] le cas NOMINAL n'interroge pas Stripe : un compte gratuit ne paie pas un aller-retour", async () => {
    limites.mockResolvedValueOnce(false);
    // `abonnementLu` rend `{ data: null }` par défaut — aucun identifiant à interroger.
    sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(subRetrieve).not.toHaveBeenCalled();
  });
});

/**
 * ON NE VEND PAS À UN COMPTE QUE LE PRODUIT VIENT DE SUSPENDRE (revue du 2026-08-13).
 *
 * La seule garde d'état de cette route dérivait de `episode_detresse.fin IS NULL`. Un compte
 * suspendu pour minorité soupçonnée — à trente jours de sa suppression, et à qui l'application
 * n'affiche plus que /barriere — pouvait POSTer ici et être débité de 69 €, parce que sa session
 * survit délibérément à la suspension (l'export en a besoin).
 */
describe("La route Checkout refuse un compte non éligible (revue du 2026-08-13)", () => {
  it.each([
    ["barre", "suspendu pour minorité soupçonnée — à 30 jours de la suppression"],
    ["mineur", "mineur déclaré"],
    ["revoque", "consentement art. 9 révoqué"],
    ["consentement", "n'a jamais consenti"],
    ["naissance", "n'a pas encore donné sa date de naissance"],
  ])("étape « %s » (%s) → refus lisible ET aucune session Stripe", async (etat) => {
    etape.mockResolvedValueOnce(etat);
    const res = await POST(req());
    expect(res.status).toBe(303);
    // ⚠️ LA DESTINATION EST `/abonnement`, ET C'EST ELLE QUI ROUTE ENSUITE. Sa propre machine
    // d'état renvoie « barre » vers /barriere, « mineur » vers la sortie de session, etc. Refaire
    // ce routage dans la route de vente serait une seconde machine d'état à maintenir.
    expect(res.headers.get("location")).toContain("/abonnement?etat=vente_fermee");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("étape « suite » → la vente se fait (contrôle positif : la garde ne ferme pas tout)", async () => {
    sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("l'origine SERT : success_url et cancel_url portent la base configurée, pas l'hôte de la requête", async () => {
    sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    await POST(req());
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.success_url).toBe("https://anima.example/?paiement=succes");
    expect(arg.cancel_url).toBe("https://anima.example/?paiement=annule");
    // La requête vient de `anima.test` : si le Host servait encore, ces deux-là le porteraient.
    expect(`${arg.success_url}${arg.cancel_url}`).not.toMatch(/anima\.test/);
  });

  it("l'origine reste-t-elle correcte quand la variable porte une barre finale ?", async () => {
    vi.stubEnv("ANIMA_SITE_URL", "https://anima.example/");
    sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    await POST(req());
    expect(sessionsCreate.mock.calls[0][0].success_url).toBe("https://anima.example/?paiement=succes");
  });

  it.each([
    ["", "absente"],
    ["http://anima.example", "http hors localhost — un lien en clair, interceptable"],
    ["https://anima.example/base", "porte un chemin — avalerait la suite de l'URL"],
    ["https://x:y@anima.example", "identifiant dans l'URL — la forme de l'hameçonnage"],
    ["pas-une-url", "inanalysable"],
  ])("hors développement, origine %j (%s) → refus lisible ET aucune session Stripe", async (valeur) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANIMA_SITE_URL", valeur);
    const res = await POST(req());
    expect(res.status).toBe(303);
    // Même VÉRITÉ que la clé de test — quelque chose n'est pas en place de notre côté, rien n'a été
    // débité, recharger n'y changera rien — donc même `etat` et même phrase.
    expect(res.headers.get("location")).toContain("/abonnement?etat=paiement_indisponible");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("en développement SEULEMENT, l'origine de la requête sert de repli", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ANIMA_SITE_URL", "");
    sessionsCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    const res = await POST(req());
    expect(res.status).toBe(303);
    expect(sessionsCreate.mock.calls[0][0].success_url).toBe("https://anima.test/?paiement=succes");
  });

  it("plus AUCUN code ne lit `NEXT_PUBLIC_SITE_URL` — une seule variable d'origine, celle qui est documentée", () => {
    // Le défaut d'origine : `.env.example` documente `ANIMA_SITE_URL`, le checkout lisait
    // `NEXT_PUBLIC_SITE_URL`. Deux noms pour une seule idée, dont un jamais défini → la garde était
    // morte. Cette garde-ci empêche le second nom de revenir par une autre porte.
    const source = execSync("git ls-files app lib render", { encoding: "utf-8" })
      .split("\n")
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .map((f) => readFileSync(resolve(process.cwd(), f), "utf-8"))
      .join("\n");
    expect(sansCommentaires(source)).not.toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it("la SORTIE reste ouverte : la garde ne touche qu'à l'entrée dans le paiement", () => {
    // Fermer résiliation/remboursement à un compte suspendu serait la faute grave — on garde donc
    // la preuve, ici, que ces routes n'ont PAS reçu cette condition.
    const lu = (c: string) => readFileSync(resolve(process.cwd(), c), "utf-8");
    for (const route of [
      "app/api/abonnement/resilier/route.ts",
      "app/api/abonnement/remboursement/route.ts",
    ]) {
      expect(lu(route), `${route} ne doit PAS conditionner la sortie à l'onboarding`).not.toMatch(
        /etapeOnboardingPour/,
      );
    }
  });
});
