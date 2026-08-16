import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * REVUE DE CODE du 2026-08-12, lot 2 (M12 et le fuseau) — LA PORTE DE SORTIE, RÉELLEMENT MONTÉE.
 *
 * ══ POURQUOI CE FICHIER ═════════════════════════════════════════════════════════════════════════
 *
 * `/abonnement` était gardée par deux fichiers qui lisent son TEXTE SOURCE (`sortie-abonnement`,
 * `sortie-absence`) : ils prouvent qu'aucun dark pattern n'y est écrit, et c'est précieux. Aucun ne
 * montait la page. Or les deux défauts trouvés en revue ne sont visibles QU'AU RENDU :
 *
 *   M12 — le geste de résiliation était gardé par `actif`. Un paiement en échec passe l'abonnement
 *         en `past_due` chez Stripe, donc `etat = 'expire'` ici. La page affichait « Ton abonnement
 *         n'est plus actif » et AUCUN bouton — pendant que Stripe poursuivait ses relances et
 *         finirait par encaisser. La personne la plus coincée du produit était la seule sans porte.
 *         C'est le chemin de la loi du 16 août 2022 : trois clics, quel que soit l'état d'accès.
 *
 *   Le FUSEAU — `toLocaleDateString` sans `timeZone` rend la date dans le fuseau du SERVEUR, UTC sur
 *         Vercel. Une échéance au 5 mars 23 h 30 UTC est le 6 mars à Paris : l'écran annonçait la
 *         reconduction (art. L215-1) un jour trop tôt.
 *
 * Les deux se lisent parfaitement dans la source, et aucune garde de source ne les voyait — parce
 * qu'une garde de source prouve le CÂBLAGE, jamais ce qui atteint l'écran (acquis de la re-revue 4.6).
 */

const getUser = vi.fn();
const lireAbonnement = vi.fn();
const eligible = vi.fn();
const etapeOnboarding = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (chemin: string) => {
    throw new Error(`redirect:${chemin}`);
  },
}));
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/data/depot-resiliation", () => ({
  lireAbonnement: () => lireAbonnement(),
  eligibleAuRemboursement: () => eligible(),
}));
/**
 * La garde d'onboarding, ajoutée par la QA tour 1 (T15) : la page était atteignable par un compte
 * qui n'avait consenti à rien. Ce mock la neutralise pour les scénarios de sortie — sa VALEUR est
 * éprouvée juste en dessous, par le bloc dédié.
 */
vi.mock("@/app/(auth)/etat-onboarding", () => ({
  etapeOnboardingPour: () => etapeOnboarding(),
}));

const { default: PageAbonnement } = await import("@/app/abonnement/page");

type Abonnement = {
  etat: string;
  subscriptionId: string | null;
  periodeFin: string | null;
  resiliationDemandeeLe: string | null;
};

const abonnement = (a: Partial<Abonnement>): Abonnement => ({
  etat: "actif",
  subscriptionId: "sub_1",
  periodeFin: "2027-01-01T10:00:00Z",
  resiliationDemandeeLe: null,
  ...a,
});

/** Monte la page comme Next le ferait : le composant est asynchrone, on attend son JSX. */
async function monter(opts: { abonnement?: Abonnement | null; retour?: string; confirmer?: string } = {}) {
  lireAbonnement.mockResolvedValue(opts.abonnement === undefined ? abonnement({}) : opts.abonnement);
  const vue = await PageAbonnement({
    searchParams: Promise.resolve({ etat: opts.retour, confirmer: opts.confirmer }),
  });
  render(vue);
}

beforeEach(() => {
  getUser.mockReset();
  lireAbonnement.mockReset();
  eligible.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  eligible.mockResolvedValue(false);
  etapeOnboarding.mockReset();
  etapeOnboarding.mockResolvedValue("suite");
});

describe("[QA tour 1, T15] la page commerciale est GARDÉE — sauf pour qui doit encore en sortir", () => {
  /**
   * Mesuré le 2026-08-15 : un compte neuf, sans date de naissance ni consentement art. 9, atteignait
   * `/abonnement` et `/reglages` en tapant l'adresse. Tout le reste redirigeait ; ces deux-là
   * passaient au travers.
   */
  for (const [etape, cible] of [
    ["naissance", "/naissance"],
    ["consentement", "/consentement"],
    ["barre", "/barriere"],
  ] as const) {
    it(`« ${etape} » renvoie sur ${cible}`, async () => {
      etapeOnboarding.mockResolvedValue(etape);
      await expect(monter({})).rejects.toThrow(`redirect:${cible}`);
    });
  }

  it("[LE TEST QUI COMPTE] « revoque » N'EST PAS redirigé — la sortie ne doit pas être une impasse", async () => {
    // ⚠️ LE RÉFLEXE D'HARMONISATION EST LE PIÈGE ICI. Toutes les autres pages renvoient `revoque`
    // sur l'écran de révocation ; celle-ci ne le peut pas. Quelqu'un qui a retiré son consentement
    // garde un abonnement à résilier — l'enfermer ferait de la porte de sortie une impasse, soit
    // exactement ce que la 3.5 et FR-089 existent pour empêcher. Le traitement art. 9 est suspendu
    // par la base, pas par une redirection.
    etapeOnboarding.mockResolvedValue("revoque");
    await monter({ abonnement: abonnement({ etat: "actif" }) });
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// M12 — la sortie ne dépend pas de l'état d'accès
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[M12] le geste de résiliation survit à un paiement en échec", () => {
  it("[CONTRÔLE POSITIF] abonnement ACTIF : le geste est là", async () => {
    await monter({ abonnement: abonnement({ etat: "actif" }) });
    expect(screen.getByRole("link", { name: /résilier mon abonnement/i })).toBeTruthy();
  });

  it("[LE TEST QUI COMPTE] `etat = expire` avec un contrat OUVERT : le geste est là aussi", async () => {
    // C'est `past_due` chez Stripe : l'accès est éteint, le contrat court, les relances continuent.
    // Sans bouton ici, la seule sortie était l'opposition bancaire.
    await monter({ abonnement: abonnement({ etat: "expire" }) });
    expect(
      screen.getByRole("link", { name: /résilier mon abonnement/i }),
      "un contrat ouvert doit TOUJOURS pouvoir se fermer, quel que soit l'état d'accès",
    ).toBeTruthy();
  });

  it("`etat = expire` : l'écran dit la vérité sur l'accès SANS retirer la porte", async () => {
    // Les deux choses sont vraies en même temps et doivent coexister : l'accès n'est plus actif,
    // et le contrat est encore résiliable. Dire l'un en taisant l'autre est ce qui coinçait.
    await monter({ abonnement: abonnement({ etat: "expire" }) });
    expect(screen.getByText(/n'est plus actif/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /résilier mon abonnement/i })).toBeTruthy();
  });

  it("[LE BORD] plus AUCUN contrat chez Stripe : pas de bouton — il n'y a rien à résilier", async () => {
    // Sans ce test, `contratOuvert = true` en dur passerait le test précédent. La garde doit
    // distinguer « accès fermé, contrat ouvert » de « tout est terminé ».
    await monter({ abonnement: abonnement({ etat: "expire", subscriptionId: null }) });
    expect(screen.queryByRole("link", { name: /résilier mon abonnement/i })).toBeNull();
    expect(screen.getByText(/n'est plus actif/i)).toBeTruthy();
  });

  it("aucun abonnement du tout : aucun geste, aucune promesse", async () => {
    await monter({ abonnement: null });
    expect(screen.queryByRole("link", { name: /résilier/i })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("résiliation déjà demandée : c'est REPRENDRE qui est proposé, jamais résilier deux fois", async () => {
    await monter({ abonnement: abonnement({ resiliationDemandeeLe: "2027-01-01T10:00:00Z" }) });
    expect(screen.getByRole("button", { name: /reprendre mon abonnement/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /résilier/i })).toBeNull();
  });

  it("la confirmation est SUR LA MÊME VUE, un seul bouton (FR-060 — trois clics)", async () => {
    await monter({ abonnement: abonnement({ etat: "expire" }), confirmer: "1" });
    const bouton = screen.getByRole("button", { name: /résilier mon abonnement/i });
    expect(bouton.getAttribute("type")).toBe("submit");
    // Un quatrième clic serait illégal : il n'existe aucun second bouton concurrent.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LE FUSEAU — une date légale rendue dans le bon pays
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("les dates sont rendues à l'heure de Paris, pas à celle du serveur", () => {
  // ⚠️ ON SE MET À LA PLACE DE VERCEL, QUI TOURNE EN UTC.
  //
  // Sans ça, cette garde ne vaudrait rien : ma machine est déjà à Paris, donc RETIRER le
  // `timeZone: 'Europe/Paris'` du code laisserait les trois tests verts chez moi et rouges nulle
  // part. Une garde qui ne peut mordre que sur la machine où le défaut n'existe pas est une garde
  // décorative. Le fuseau est reposé après, pour ne pas contaminer les autres fichiers du worker.
  const fuseauInitial = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    // `process.env.TZ = undefined` poserait la CHAÎNE « undefined » et laisserait le worker dans un
    // fuseau inventé pour tous les fichiers suivants. On efface au lieu d'affecter.
    if (fuseauInitial === undefined) delete process.env.TZ;
    else process.env.TZ = fuseauInitial;
  });

  it("[CONTRÔLE DU HARNAIS] le processus rend bien ses dates en UTC pendant ce bloc", () => {
    // Si Node cessait d'honorer un changement de `TZ` à chaud, les tests suivants passeraient pour
    // une mauvaise raison. On le vérifie plutôt que de l'espérer.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  it("[LE TEST QUI COMPTE] 23 h 30 UTC le 5 mars est le 6 mars à Paris", async () => {
    // Sans `timeZone: 'Europe/Paris'`, Vercel (UTC) affichait « 5 mars » : la date de reconduction
    // annoncée au titre de l'art. L215-1 était fausse d'un jour.
    await monter({ abonnement: abonnement({ periodeFin: "2027-03-05T23:30:00Z" }) });
    expect(screen.getByText(/6 mars 2027/)).toBeTruthy();
    expect(screen.queryByText(/5 mars 2027/)).toBeNull();
  });

  it("[LE CONTRÔLE QUI ENCADRE] 22 h 30 UTC le 5 mars est ENCORE le 5 mars à Paris", async () => {
    // ⚠️ CE TEST A ÉTÉ ÉCRIT DEUX FOIS.
    //
    // La première version prenait midi UTC et vérifiait « 5 mars » — un contrôle qui ne contrôlait
    // rien : la campagne de mutation a posé `Asia/Tokyo` à la place de `Europe/Paris` et les deux
    // tests sont restés verts. À midi UTC comme à 23 h 30 UTC, Tokyo tombe du même côté que Paris.
    //
    // Il faut donc un instant qui SÉPARE. Avec la paire 22 h 30 → « 5 mars » et 23 h 30 → « 6 mars »,
    // le fuseau retenu doit décaler d'au moins 30 min et de moins d'1 h 30 : UTC est exclu (il rendrait
    // 5 mars deux fois), Tokyo est exclu (il rendrait 6 mars deux fois), New York aussi. Paris (+1 en
    // mars, avant le changement d'heure) est le seul de la liste à tenir les deux.
    await monter({ abonnement: abonnement({ periodeFin: "2027-03-05T22:30:00Z" }) });
    expect(screen.getByText(/5 mars 2027/)).toBeTruthy();
    expect(screen.queryByText(/6 mars 2027/)).toBeNull();
  });

  it("la date de FIN D'ACCÈS après résiliation suit la même règle", async () => {
    await monter({ abonnement: abonnement({ resiliationDemandeeLe: "2027-03-05T23:30:00Z" }) });
    expect(screen.getByText(/6 mars 2027/)).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// M2 — l'écran dit ce qui s'est réellement passé
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[M2] « aucun paiement retrouvé » a sa propre phrase", () => {
  it("`etat=sans_paiement` ne promet AUCUN virement", async () => {
    await monter({ retour: "sans_paiement" });
    const message = screen.getByText(/aucun paiement à te rembourser/i);
    expect(message.getAttribute("role"), "un retour d'action doit être annoncé, pas seulement affiché").toBe("status");
    expect(screen.queryByText(/arrive sur ton moyen de paiement/i)).toBeNull();
  });

  it("`etat=rembourse` promet bien le virement (les deux phrases ne se confondent pas)", async () => {
    await monter({ retour: "rembourse" });
    expect(screen.queryByText(/aucun paiement à te rembourser/i)).toBeNull();
  });
});
