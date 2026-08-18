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
/** Prend le contrat courant en argument depuis la 0075 (R3) — et l'ENREGISTRE : c'est ce qu'on mesure. */
const etatRemboursement =
  vi.fn<(sub: string | null) => Promise<"confirme" | "echec" | "en_cours" | null>>();
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
  // Revue 1-4 (#4) : l'ÉTAT PERSISTANT du remboursement. Par défaut `null` — aucune demande en
  // cours —, pour que les cas ci-dessous n'aient à parler que de ce qu'ils testent.
  lireEtatRemboursement: (sub: string | null) => etatRemboursement(sub),
}));
/**
 * La garde d'onboarding, ajoutée par la QA tour 1 (T15) : la page était atteignable par un compte
 * qui n'avait consenti à rien. Ce mock la neutralise pour les scénarios de sortie — sa VALEUR est
 * éprouvée juste en dessous, par le bloc dédié.
 */
vi.mock("@/app/(auth)/etat-onboarding", () => ({
  etapeOnboardingPour: () => etapeOnboarding(),
}));
/**
 * ⚠️ L'OFFRE EST DOUBLÉE, ET C'EST LA BONNE FRONTIÈRE (Story 3.6).
 *
 * Depuis la 3.6, la page monte `<MontagePaywall>` quand il n'y a pas de contrat actif — c'est-à-dire
 * exactement dans le scénario `etat = expire` que ce fichier existe pour éprouver. C'est un composant
 * SERVEUR async qui lit `lib/safety` : le rendre ici ferait de ce test une épreuve de la garde AD-9,
 * qu'il n'a pas à porter, et il échouerait sur une base absente plutôt que sur un défaut de sortie.
 *
 * La garde de l'offre — qu'elle refuse de se monter en détresse, et que la SORTIE, elle, ne se ferme
 * jamais — vit dans `tests/offre-gardee.test.ts`. Ce fichier-ci mesure une seule chose : que la porte
 * reste là quel que soit l'état d'accès.
 */
vi.mock("@/app/_commerce/MontagePaywall", () => ({
  // Un MARQUEUR plutôt que `null` (revue des Epics 1 à 4, #16) : sans lui, aucun test de ce fichier
  // ne pouvait dire si l'offre s'était montée ou non. Il ne porte aucun rôle ARIA, donc les
  // assertions de boutons/liens ci-dessous comptent exactement ce qu'elles comptaient avant.
  MontagePaywall: () => <p>[offre montée]</p>,
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
async function monter(
  opts: {
    abonnement?: Abonnement | null;
    retour?: string;
    confirmer?: string;
    remboursement?: "confirme" | "echec" | "en_cours" | null;
  } = {},
) {
  lireAbonnement.mockResolvedValue(opts.abonnement === undefined ? abonnement({}) : opts.abonnement);
  etatRemboursement.mockResolvedValue(opts.remboursement ?? null);
  const vue = await PageAbonnement({
    searchParams: Promise.resolve({ etat: opts.retour, confirmer: opts.confirmer }),
  });
  render(vue);
}

beforeEach(() => {
  getUser.mockReset();
  lireAbonnement.mockReset();
  eligible.mockReset();
  etatRemboursement.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  eligible.mockResolvedValue(false);
  etatRemboursement.mockResolvedValue(null);
  etapeOnboarding.mockReset();
  etapeOnboarding.mockResolvedValue("suite");
});

describe("[revue 1-4, #16] un compte RÉVOQUÉ ne voit pas un bouton qui ne peut pas marcher", () => {
  /**
   * ⚠️ UNE BOUCLE FERMÉE, PAS UNE GARDE DE PLUS. Un compte révoqué n'est délibérément PAS redirigé
   * hors de `/abonnement` — il a un abonnement à résilier et des droits à exercer, et l'enfermer
   * ailleurs ferait de la sortie une impasse. Mais il voyait aussi l'offre complète et son bouton
   * « M'abonner », que `/api/stripe/checkout` refuse ensuite systématiquement (`etape !== "suite"`).
   * Un bouton qui ne peut pas marcher, sur la page qui parle d'argent.
   *
   * Montrer la sortie sans montrer l'entrée est exactement la distinction que cette page tient déjà.
   */
  it("[LE TEST QUI COMPTE] « revoque » : la SORTIE reste, l'OFFRE disparaît", async () => {
    etapeOnboarding.mockResolvedValue("revoque");
    await monter({ abonnement: abonnement({ etat: "expire" }) });
    expect(screen.queryByText("[offre montée]"), "l'offre ne doit pas se monter").toBeNull();
    // La porte, elle, est toujours là — c'est la moitié qu'on ne ferme jamais.
    expect(screen.getByRole("link", { name: /résilier/i })).toBeTruthy();
  });

  it("[CONTRÔLE POSITIF] « suite » : l'offre se monte — la garde ne ferme pas tout", async () => {
    etapeOnboarding.mockResolvedValue("suite");
    await monter({ abonnement: abonnement({ etat: "expire" }) });
    expect(screen.getByText("[offre montée]")).toBeTruthy();
  });

  it("un compte révoqué SANS aucun abonnement ne voit rien à acheter non plus", async () => {
    etapeOnboarding.mockResolvedValue("revoque");
    await monter({ abonnement: null });
    expect(screen.queryByText("[offre montée]")).toBeNull();
  });
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

describe("[revue 1-4, #4] l'état du remboursement VIT sur la page", () => {
  /**
   * `SUCCES_REMBOURSEMENT` ne paraît qu'une fois, au retour de l'action. `confirme_le` était écrite
   * par le webhook et lue par PERSONNE : un remboursement refusé par la banque (compte clos, carte
   * remplacée) était donc invisible des deux côtés — elle attendait un virement annoncé, et nous
   * n'avions aucun signal. Ces trois lignes vivent sur la page, tant qu'il y a à dire.
   */

  it("⚠️ un remboursement en ÉCHEC est DIT — c'est tout l'objet de la trouvaille", async () => {
    await monter({ remboursement: "echec" });
    const ligne = screen.getByText(/ta banque a refusé le remboursement/i);
    expect(ligne.getAttribute("role"), "un état doit être annoncé au lecteur d'écran").toBe("status");
    // Et surtout : plus aucune promesse de virement à l'écran.
    expect(screen.queryByText(/arrive sur ton moyen de paiement/i)).toBeNull();
  });

  it("elle apprend que sa demande TIENT — sinon elle croit devoir tout refaire, ou avoir perdu", async () => {
    await monter({ remboursement: "echec" });
    expect(screen.getByText(/ta demande reste ouverte/i)).toBeTruthy();
  });

  it("un remboursement CONFIRMÉ est dit aussi — et il ne se confond pas avec l'échec", async () => {
    await monter({ remboursement: "confirme" });
    expect(screen.getByText(/est parti sur ton moyen de paiement/i)).toBeTruthy();
    expect(screen.queryByText(/ta banque a refusé/i)).toBeNull();
  });

  it("en cours : on dit qu'il arrive, sans prétendre qu'il est arrivé", async () => {
    await monter({ remboursement: "en_cours" });
    expect(screen.getByText(/est demandé/i)).toBeTruthy();
    expect(screen.queryByText(/est parti sur/i)).toBeNull();
  });

  it("aucune demande : AUCUNE de ces trois lignes — on ne parle pas d'un remboursement qui n'existe pas", async () => {
    await monter({ remboursement: null });
    expect(screen.queryByText(/remboursement/i), "une ligne d'état sans demande").toBeNull();
  });

  it("⚠️ et une PANNE de cette lecture retire la ligne, jamais la page de sortie", async () => {
    // LE MUTANT QUI COMPTE : remettre cette lecture dans le `try` principal. La page basculerait en
    // mode dégradé — « Je n'arrive pas à afficher ton abonnement » — et le bouton de résiliation
    // disparaîtrait. Fermer la porte de sortie sur un timeout enferme quelqu'un dans un abonnement.
    etatRemboursement.mockRejectedValue(new Error("timeout"));
    await monter({});
    expect(
      screen.queryByText(/je n'arrive pas à afficher ton abonnement/i),
      "une panne de la ligne d'état a emporté la page entière",
    ).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("abonnement");
  });
});


// ══════════════════════════════════════════════════════════════════════════════════════════════════
// R2 — la résiliation ABOUTIE (revue adversariale du 2026-08-18)
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[R2] une fois la résiliation ABOUTIE, la page n'est plus un cul-de-sac", () => {
  /**
   * À l'échéance, Stripe émet `customer.subscription.deleted` : `status = 'canceled'` ET `cancel_at`
   * toujours renseigné — c'est ainsi qu'elle a résilié, il n'y a pas d'autre chemin dans le produit.
   * La projection portait donc `etat = 'resilie'` et une date, et la page lisait la date comme si
   * elle signifiait « résiliation en cours ». Trois torts dans le même document, et le troisième
   * était définitif : depuis la 3.6, cette page est le SEUL chemin d'abonnement d'un compte sans
   * branche. Toute personne ayant résilié une fois ne pouvait plus jamais s'abonner.
   */
  const aboutie = () =>
    abonnement({ etat: "resilie", resiliationDemandeeLe: "2026-03-04T10:00:00Z" });

  it("[LE TEST QUI COMPTE] l'OFFRE se monte — sinon elle est inencaissable à vie", async () => {
    await monter({ abonnement: aboutie() });
    expect(
      screen.getByText("[offre montée]"),
      "la seule surface d'abonnement du produit reste fermée après une résiliation",
    ).toBeTruthy();
  });

  it("plus de bouton « Reprendre » — Stripe le refuse toujours sur un contrat clos", async () => {
    await monter({ abonnement: aboutie() });
    expect(
      screen.queryByRole("button", { name: /reprendre/i }),
      "un bouton qui ne peut pas marcher, sur la page qui parle d'argent",
    ).toBeNull();
  });

  it("plus de bouton « Résilier » non plus — il n'y a plus rien à résilier", async () => {
    await monter({ abonnement: aboutie() });
    expect(screen.queryByRole("link", { name: /résilier/i })).toBeNull();
  });

  it("[LE MENSONGE] l'écran ne promet plus un accès jusqu'à une date RÉVOLUE", async () => {
    await monter({ abonnement: aboutie() });
    expect(
      screen.queryByText(/tu y as accès jusqu'au/i),
      "la page annonce un accès qui n'existe plus",
    ).toBeNull();
    expect(screen.getByText(/n'est plus actif/i)).toBeTruthy();
  });

  it("elle dit QUAND il s'est terminé — la date est vraie, c'est son libellé qui mentait", async () => {
    await monter({ abonnement: aboutie() });
    expect(screen.getByText(/4 mars 2026/)).toBeTruthy();
  });

  it("[CONTRÔLE QUI SÉPARE] résiliation EN COURS : « Reprendre » est là, l'offre non", async () => {
    // Sans ce contrôle, rendre `termine` partout passerait le test ci-dessus. Les deux situations
    // portent la MÊME date en base : seul `etat` les distingue.
    await monter({ abonnement: abonnement({ etat: "actif", resiliationDemandeeLe: "2027-03-04T10:00:00Z" }) });
    expect(screen.getByRole("button", { name: /reprendre/i })).toBeTruthy();
    expect(screen.queryByText("[offre montée]"), "on ne vend pas à qui a encore son accès").toBeNull();
    expect(screen.getByText(/tu y as accès jusqu'au/i)).toBeTruthy();
  });

  it("[CONTRÔLE] un abonnement ACTIF ne voit toujours aucune offre", async () => {
    await monter({ abonnement: abonnement({ etat: "actif" }) });
    expect(screen.queryByText("[offre montée]")).toBeNull();
  });
});

describe("[R2] chaque situation a SA phrase — aucune n'en emprunte une autre", () => {
  /**
   * Le comportement que `tests/offre-gardee.test.ts` gravait dans la syntaxe de la page, mesuré ici
   * là où il compte : à l'écran. Une phrase par situation, et jamais deux situations sous la même.
   */
  const cas = [
    { nom: "jamais abonnée", ab: null, dit: /tu n'as pas d'abonnement/i, pasDit: /n'est plus actif/i },
    {
      nom: "actif",
      ab: abonnement({ etat: "actif" }),
      dit: /ton abonnement est actif/i,
      pasDit: /n'est plus actif/i,
    },
    {
      nom: "résiliation en cours",
      ab: abonnement({ etat: "actif", resiliationDemandeeLe: "2027-03-04T10:00:00Z" }),
      dit: /ton abonnement est résilié/i,
      pasDit: /n'est plus actif/i,
    },
    {
      nom: "contrat coincé (past_due)",
      ab: abonnement({ etat: "expire" }),
      dit: /n'est plus actif/i,
      pasDit: /il s'est terminé le/i,
    },
    {
      nom: "résiliation aboutie",
      ab: abonnement({ etat: "resilie", resiliationDemandeeLe: "2026-03-04T10:00:00Z" }),
      dit: /il s'est terminé le/i,
      pasDit: /tu y as accès jusqu'au/i,
    },
  ] as const;

  for (const { nom, ab, dit, pasDit } of cas) {
    it(`« ${nom} » : sa phrase, et pas celle d'à côté`, async () => {
      await monter({ abonnement: ab });
      expect(screen.getByText(dit)).toBeTruthy();
      expect(screen.queryByText(pasDit), `« ${nom} » emprunte la phrase d'une autre situation`).toBeNull();
    });
  }
});

describe("[R3] l'état affiché est celui du contrat COURANT, pas d'un remboursement d'il y a un an", () => {
  /**
   * `remboursement` n'est jamais purgée, et la lecture ne visait aucun contrat : après un
   * réabonnement, la page affichait EN PERMANENCE « Ton remboursement est parti sur ton moyen de
   * paiement » — à propos d'une souscription qui n'existe plus. Et depuis que la garantie s'exerce
   * par contrat (0075), un compte peut porter plusieurs lignes : un `.maybeSingle()` non ciblé ne
   * rend même plus une réponse, il rend une erreur — donc la ligne d'état disparaît en silence.
   */
  it("[LE CŒUR] la page passe le contrat courant à la lecture d'état", async () => {
    await monter({ abonnement: abonnement({ subscriptionId: "sub_neuf" }) });
    expect(etatRemboursement).toHaveBeenCalledWith("sub_neuf");
  });

  it("aucun contrat : elle passe `null` — c'est la ligne du chemin minorité (FR-071)", async () => {
    // Un compte détecté mineur qui n'a JAMAIS payé a bien une ligne de remboursement, sans
    // souscription. Ne rien lire du tout la priverait de l'état de son propre remboursement.
    await monter({ abonnement: abonnement({ subscriptionId: null, etat: "expire" }) });
    expect(etatRemboursement).toHaveBeenCalledWith(null);
  });

  it("aucun abonnement du tout : `null` aussi, jamais `undefined`", async () => {
    await monter({ abonnement: null });
    expect(etatRemboursement).toHaveBeenCalledWith(null);
  });
});
