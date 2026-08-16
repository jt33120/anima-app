import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.5 (T4) — la GARDE DE MONTAGE `<GardeCommerciale>` (AC4, AD-9). Une RSC async = une
 * fonction async : on l'appelle directement et on vérifie qu'elle rend `null` quand les limites
 * sont levées (le commerce « refuse de se monter »), ses enfants sinon. On prouve aussi les
 * invariants d'architecture : la DÉCISION vit dans `lib/safety` (render muet, AD-7), le prédicat
 * n'a aucun consommateur sauvage, et toute future UI commerciale devra passer par la garde.
 */

const limites = vi.fn();
vi.mock("@/lib/safety/limites-commerciales", () => ({
  limitesCommercialesLevees: (id: string) => limites(id),
}));

import { GardeCommerciale } from "@/app/_commerce/GardeCommerciale";
import { doitDireOuNaissentLesBranches, type ProjectionScene } from "@/lib/scene/projection";

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function fichiersSource(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => resolve(racine, dir, f));
}

beforeEach(() => limites.mockReset());

describe("GardeCommerciale — refuse de monter le commerce quand limites levées (AC4, FR-043)", () => {
  it("limites LEVÉES → rend null (paywall/quota/carte/bilan ne se montent pas)", async () => {
    limites.mockResolvedValueOnce(true);
    const out = await GardeCommerciale({ utilisatriceId: "u1", children: "COMMERCE" });
    expect(out).toBeNull();
    expect(limites).toHaveBeenCalledWith("u1");
  });

  it("limites NON levées → monte ses enfants", async () => {
    limites.mockResolvedValueOnce(false);
    const out = await GardeCommerciale({ utilisatriceId: "u1", children: "COMMERCE" });
    expect(out).not.toBeNull();
    expect(out?.props?.children).toBe("COMMERCE");
  });
});

describe("GardeCommerciale — invariants d'architecture (AD-7, AD-9)", () => {
  const guard = resolve(racine, "app/_commerce/GardeCommerciale.tsx");
  const guardSrc = sansCommentaires(readFileSync(guard, "utf-8"));

  it("la DÉCISION vit dans lib/safety : la garde consomme le prédicat, ne dérive rien (render muet)", () => {
    expect(guardSrc).toMatch(/limitesCommercialesLevees/);
    expect(guardSrc).toMatch(/@\/lib\/safety\/limites-commerciales/);
    // render/ ne parle jamais à la base ni ne dérive `fin IS NULL` lui-même.
    expect(guardSrc).not.toMatch(/@\/lib\/data\/supabase|episode_detresse|fin IS NULL/);
  });

  it("le prédicat n'est appelé QUE par la garde ou une route commerciale autorisée (aucun consommateur sauvage)", () => {
    const DEF = resolve(racine, "lib/safety/limites-commerciales.ts");
    // Consommateurs AUTORISÉS : la garde de montage (render) + toute ROUTE commerciale app/api/** qui
    // applique la même garde AD-9 côté serveur (raffinement Story 3.1 — ex. checkout). Tout autre appel
    // serait une 2ᵉ dérivation sauvage de limites_levees (interdit : source unique, AD-17).
    const MARQUEURS = /(paywall|abonnement|quota|bilan|checkout|premium)/i;
    const estRouteCommercialeAutorisee = (f: string) => /[/\\]app[/\\]api[/\\]/.test(f) && MARQUEURS.test(f);
    const tous = [...fichiersSource("app"), ...fichiersSource("render"), ...fichiersSource("lib")];
    for (const f of tous) {
      if (f === guard || f === DEF || estRouteCommercialeAutorisee(f)) continue;
      expect(
        sansCommentaires(readFileSync(f, "utf-8")),
        `appel sauvage du prédicat : ${f}`,
      ).not.toMatch(/limitesCommercialesLevees/);
    }
  });

  it("garde PROSPECTIVE : toute UI commerciale passe par la garde (armée pour 2.9/Epic 3)", () => {
    const MARQUEURS = /(paywall|abonnement|quota|bilan|checkout|premium)/i;
    // Le marqueur commercial vit dans le DOSSIER (App Router : la route est toujours `page.tsx`/
    // `route.ts`) → on matche le CHEMIN COMPLET, jamais le seul basename (sinon aveugle aux routes).
    // « désabonnement » CONTIENT « abonnement », et n'a rien de commercial : c'est le droit d'opposition
    // au canal courriel (art. 21, revue 4.9 / T5-2). On neutralise le mot AVANT d'appliquer le matcher,
    // plutôt que d'exclure le fichier — ainsi une future surface qui s'appellerait
    // `desabonnement-premium` resterait attrapée par les autres marqueurs.
    const estCommerciale = (f: string) => MARQUEURS.test(f.replace(/d[eé]sabonnement/gi, "canal-courriel"));
    expect(estCommerciale("app/desabonnement/actions.ts"), "faux positif sur le désabonnement").toBe(false);
    expect(estCommerciale("app/desabonnement/premium/page.tsx"), "les autres marqueurs restent actifs").toBe(
      true,
    );
    // Preuve non-tautologique que le matcher attrape bien une route nommée par son dossier :
    expect(estCommerciale("app/(scene)/abonnement/page.tsx"), "route commerciale par dossier ratée").toBe(true);
    expect(estCommerciale("app/bilan/page.tsx")).toBe(true);
    expect(estCommerciale("app/aide/page.tsx"), "faux positif sur une route non commerciale").toBe(false);

    // Une ROUTE handler (app/api/**) n'est PAS de l'UI React : elle ne peut pas être enveloppée d'une
    // balise `<GardeCommerciale>`. Elle applique la garde AD-9 CÔTÉ SERVEUR (limitesCommercialesLevees).
    // On sépare donc les deux surfaces (raffinement Story 3.1 : `checkout/route.ts` matche `checkout`).
    // `fichiersSource` renvoie des chemins ABSOLUS → `app` y est toujours précédé d'un séparateur.
    const estRoute = (f: string) => /[/\\]app[/\\]api[/\\]/.test(f);
    expect(estRoute("/repo/app/api/stripe/checkout/route.ts"), "matcher de route API cassé").toBe(true);
    expect(estRoute("/repo/app/(scene)/abonnement/page.tsx"), "une page n'est pas une route API").toBe(false);

    // UI commerciale GARDÉE PAR LE GATE SERVEUR (raffinement Story 3.2) : la carte d'abonnement in-fil
    // (`CarteAbonnement`) est un composant CLIENT inséré SOUS le bilan dans le fil streamé — elle ne
    // peut pas s'auto-envelopper de la balise SERVEUR `<GardeCommerciale>` (async, lit `lib/safety`).
    // Sa garde AD-9 est le GATE SERVEUR : la route RETIENT la trame `paywall` en détresse (pas de bilan
    // → pas de carte) et si premium — prouvé par tests/proposer-abonnement.test.ts. Même patron que la
    // route Checkout (gardée serveur, dérogée ci-dessus). Dérogation NOMMÉE, non un fichier générique.
    // La surface = le composant client `CarteAbonnement.tsx` + sa COPIE `offre-abonnement.ts` (3.2), ET
    // la COPIE de l'épuisement de quota `ligne-quota.ts` (3.4). Toutes gardées par le GATE SERVEUR : la
    // route RETIENT la trame (`paywall` en détresse/premium ; `quota` en détresse via `!limites_levees` —
    // prouvé par tests/gate-quota.test.ts). Ce sont des surfaces CLIENT dans le fil streamé qui ne peuvent
    // pas s'auto-envelopper de la balise SERVEUR `<GardeCommerciale>` (async, lit `lib/safety`). Pures
    // constantes de copie ou composant in-fil — rien à envelopper. Dérogation ancrée au CHEMIN EXACT
    // `render/conversation/` — jamais au seul basename : un futur homonyme ailleurs (ex. une surface paywall
    // SERVEUR sous `app/.../compte/CarteAbonnement.tsx`, VRAIE UI commerciale à envelopper) NE doit PAS
    // hériter de la dérogation (sinon angle mort : il passerait non gardé).
    const estCarteGardeeParGateServeur = (f: string) =>
      /[/\\]render[/\\]conversation[/\\](CarteAbonnement\.tsx|offre-abonnement\.ts|ligne-quota\.ts)$/.test(f);
    expect(estCarteGardeeParGateServeur("/repo/render/conversation/CarteAbonnement.tsx"), "matcher de carte cassé").toBe(true);
    expect(estCarteGardeeParGateServeur("/repo/render/conversation/offre-abonnement.ts"), "matcher de copie cassé").toBe(true);
    expect(estCarteGardeeParGateServeur("/repo/render/conversation/ligne-quota.ts"), "matcher de copie quota cassé").toBe(true);
    expect(estCarteGardeeParGateServeur("/repo/render/conversation/BlocDocument.tsx"), "faux positif dérogation carte").toBe(false);
    // ANGLE MORT fermé : un homonyme AILLEURS (future surface paywall serveur) n'est PAS dérogé → devra être gardé.
    expect(estCarteGardeeParGateServeur("/repo/app/(scene)/compte/CarteAbonnement.tsx"), "dérogation basename non ancrée — angle mort").toBe(false);
    expect(estCarteGardeeParGateServeur("/repo/app/(scene)/compte/ligne-quota.ts"), "dérogation quota basename non ancrée — angle mort").toBe(false);

    // ── STORY 3.5 — LES SURFACES DE SORTIE SONT DÉROGÉES, ET C'EST L'INVERSE D'UN RELÂCHEMENT ───────────
    //
    // Cette garde a fait son travail : elle a attrapé `app/abonnement/page.tsx` et
    // `app/api/abonnement/remboursement/route.ts` parce qu'ils contiennent « abonnement » et n'appliquent
    // aucune garde AD-9. La tentation est de l'ajouter pour faire verdir. Ce serait une faute grave :
    // `limites_levees` est vrai pendant un épisode de détresse OUVERT, donc la page se refuserait à
    // s'afficher et les routes refuseraient d'agir — c'est-à-dire qu'on EMPÊCHERAIT DE RÉSILIER ou de se
    // faire rembourser quelqu'un en crise. Le dark pattern maximal, sur la personne la plus vulnérable du
    // produit, au nom d'une garde de sécurité.
    //
    // AD-9 protège du commerce ENTRANT (paywall, carte, Checkout, quota). Sortir n'en est pas.
    //
    // Dérogation ancrée aux CHEMINS EXACTS — jamais au dossier `abonnement`, sinon une future surface
    // commerciale qu'on y poserait (`app/abonnement/souscrire/`) hériterait du trou.
    const estSortie = (f: string) =>
      /[/\\]app[/\\]api[/\\]abonnement[/\\](resilier|remboursement)[/\\]route\.ts$/.test(f) ||
      /[/\\]app[/\\]abonnement[/\\]page\.tsx$/.test(f) ||
      /[/\\]render[/\\]abonnement[/\\]copie-abonnement\.ts$/.test(f);
    expect(estSortie("/repo/app/api/abonnement/resilier/route.ts"), "matcher de sortie cassé").toBe(true);
    expect(estSortie("/repo/app/api/abonnement/remboursement/route.ts"), "matcher de sortie cassé").toBe(true);
    expect(estSortie("/repo/app/abonnement/page.tsx"), "matcher de page de sortie cassé").toBe(true);
    expect(estSortie("/repo/render/abonnement/copie-abonnement.ts"), "matcher de copie de sortie cassé").toBe(true);
    // ANGLES MORTS fermés : tout le reste de ces dossiers reste soumis à la garde.
    expect(
      estSortie("/repo/app/api/abonnement/souscrire/route.ts"),
      "dérogation trop large : une route commerciale du même dossier passerait non gardée",
    ).toBe(false);
    expect(
      estSortie("/repo/app/abonnement/souscrire/page.tsx"),
      "dérogation trop large : une page commerciale du même dossier passerait non gardée",
    ).toBe(false);
    expect(estSortie("/repo/app/api/stripe/checkout/route.ts"), "faux positif sur le Checkout").toBe(false);

    const uiCommerciales = [...fichiersSource("app"), ...fichiersSource("render")]
      .filter(estCommerciale)
      .filter((f) => !estRoute(f))
      .filter((f) => !estSortie(f)) // la SORTIE ne se ferme jamais (3.5, AC3)
      .filter((f) => !estCarteGardeeParGateServeur(f)); // gardée par le gate serveur, pas par la balise
    for (const f of uiCommerciales) {
      // Exige la BALISE `<GardeCommerciale`, pas une simple mention d'import (tripwire, pas preuve
      // formelle : un placement en frère reste possible — l'enveloppement réel relève de la revue).
      expect(
        sansCommentaires(readFileSync(f, "utf-8")),
        `UI commerciale montée sans <GardeCommerciale> : ${f}`,
      ).toMatch(/<GardeCommerciale/);
    }

    // Les ROUTES commerciales (app/api/**) appliquent la garde côté serveur, pas via la balise.
    const routesCommerciales = fichiersSource("app").filter(estCommerciale).filter(estRoute).filter((f) => !estSortie(f));
    for (const f of routesCommerciales) {
      expect(
        sansCommentaires(readFileSync(f, "utf-8")),
        `route commerciale sans garde serveur limites_levees : ${f}`,
      ).toMatch(/limitesCommercialesLevees/);
    }
    // Non-vacuité : depuis 3.1, la route Checkout EXISTE et doit être gardée (sinon la garde ne prouve rien).
    expect(routesCommerciales.length, "aucune route commerciale détectée — la garde serveur est vide").toBeGreaterThan(0);

    // Non-vacuité de la dérogation « sortie » (3.5). Deux conditions, et la seconde est la vraie : les
    // routes existent, ET une garde COMPORTEMENTALE prouve qu'elles restent ouvertes en détresse. Sans
    // elle, cette dérogation ne serait qu'une allowlist — c'est-à-dire un trou qu'on aurait documenté.
    for (const r of ["app/api/abonnement/resilier/route.ts", "app/api/abonnement/remboursement/route.ts"]) {
      expect(existsSync(resolve(racine, r)), `dérogation « sortie » morte : ${r} absent`).toBe(true);
    }
    expect(
      existsSync(resolve(racine, "tests/sortie-abonnement.test.ts")),
      "la dérogation « sortie » ne prouve rien sans son test d'inversion (AC3)",
    ).toBe(true);

    // Non-vacuité de la dérogation « gate serveur » (3.2) : la carte in-fil EXISTE et sa garde
    // COMPORTEMENTALE aussi — sinon la dérogation serait un trou (allowlist morte qui laisserait passer
    // une future carte non gardée). La preuve réelle que la carte est retenue en détresse/premium vit là.
    expect(
      existsSync(resolve(racine, "render/conversation/CarteAbonnement.tsx")),
      "carte in-fil absente — la dérogation `gate serveur` est morte",
    ).toBe(true);
    expect(
      existsSync(resolve(racine, "tests/proposer-abonnement.test.ts")),
      "garde comportementale du gate serveur absente — la dérogation ne prouve rien",
    ).toBe(true);
    // Idem pour la copie de quota (3.4) : la surface EXISTE et le gate serveur qui la retient en détresse
    // est prouvé (gate-quota.test.ts : le gate condition `!securite.limitesLevees`). Sinon dérogation morte.
    expect(
      existsSync(resolve(racine, "render/conversation/ligne-quota.ts")),
      "copie de quota absente — la dérogation `gate serveur` quota est morte",
    ).toBe(true);
    expect(
      existsSync(resolve(racine, "tests/gate-quota.test.ts")),
      "garde du gate serveur quota absente — la dérogation ne prouve rien",
    ).toBe(true);

    console.info(
      `[garde-commerciale] ${uiCommerciales.length} UI + ${routesCommerciales.length} route(s) commerciale(s) + 1 carte gardée par gate serveur.`,
    );
  });
});

describe("[Story 3.3 / AD-9] la phrase sobre de l'arbre vide est du COMMERCE, et elle passe sous la garde", () => {
  /**
   * ⚠️ POURQUOI CE BLOC EST ICI ET PAS DANS UN NOUVEAU FICHIER. AD-9 dit « aucun commerce ne
   * s'interpose sur la sécurité ». La 3.3 ajoute une surface commerciale — une phrase de périmètre
   * dans l'état vide de l'arbre (AC6) — et la question « est-elle gardée en détresse ? » appartient
   * à CETTE garde, celle qui tient l'inventaire du commerce. Une seconde garde ailleurs se serait
   * désynchronisée de celle-ci le jour où l'une des deux aurait bougé.
   *
   * Son gate n'est pas la balise `<GardeCommerciale>` : la phrase vit dans un composant de rendu MUET
   * (AD-7), qui ne peut pas s'envelopper d'un composant SERVEUR async. Sa garde est donc le GATE
   * SERVEUR — même dérogation nommée que `CarteAbonnement` (3.2) et `ligne-quota` (3.4) — et ce gate
   * est la fonction pure `doitDireOuNaissentLesBranches` de `lib/scene`, alimentée par
   * `chargerProjectionArbre` (qui pose `gestesSuspendus` depuis `branche_bloquee_par_detresse()`).
   */
  const VIDE_GRATUIT: ProjectionScene = { tronc: { present: true }, branches: [] };

  it("[CONTRÔLE POSITIF] hors détresse, sur un compte gratuit, la phrase EST de mise", () => {
    // Sans ce contrôle, un gate qui refuserait toujours satisferait le test ci-dessous — et la
    // surface serait morte sans que personne ne le sache.
    expect(doitDireOuNaissentLesBranches(VIDE_GRATUIT)).toBe(true);
  });

  it("[LE CŒUR / AD-9] pendant l'épisode et les 72 h, elle ne se monte PAS", () => {
    // Mutation-cible : retirer `p.gestesSuspendus !== true` de `doitDireOuNaissentLesBranches`.
    expect(doitDireOuNaissentLesBranches({ ...VIDE_GRATUIT, gestesSuspendus: true })).toBe(false);
  });

  it("la dérogation « gate serveur » n'est pas morte : la surface ET sa garde comportementale existent", () => {
    // Même discipline que pour `CarteAbonnement` : une allowlist qui pointe vers du vide laisserait
    // passer, demain, une surface non gardée sous couvert d'une dérogation qui ne protège plus rien.
    expect(
      existsSync(resolve(racine, "render/arbre/EtatVideArbre.tsx")),
      "surface AC6 absente — la dérogation `gate serveur` de la 3.3 est morte",
    ).toBe(true);
    expect(
      existsSync(resolve(racine, "tests/rendu/arbre-gratuit.test.tsx")),
      "garde comportementale AC6 absente — la dérogation ne prouve rien",
    ).toBe(true);
  });
});

describe("Story 3.6 — la couture de la 2.9, enfin remplie (l'offre rendue SERVEUR)", () => {
  const MONTAGE = resolve(racine, "app/_commerce/MontagePaywall.tsx");
  const src = sansCommentaires(readFileSync(MONTAGE, "utf-8"));

  /**
   * ⚠️ UN TEST A ÉTÉ RETOURNÉ ICI, ET IL FAUT SAVOIR POURQUOI.
   *
   * La 2.9 exigeait que ce fichier NE contienne « ni prix, ni Stripe, ni bouton d'abonnement » : à
   * l'époque il ne posait que le PLACEMENT, et la carte relevait de l'Epic 3. Son propre en-tête
   * annonçait pourtant la suite — « RESTE la couture gardée pour une future surface paywall RENDUE
   * SERVEUR (menu de compte, 3.3+) — inerte tant que cette surface n'existe pas ».
   *
   * **La Story 3.6 est cette surface.** L'assertion qui interdisait le prix gardait une inertie que
   * le fichier lui-même présentait comme provisoire ; la garder aurait obligé à ouvrir un SECOND
   * point de montage commercial — c'est-à-dire un second endroit où oublier la garde.
   *
   * Ce qui la remplace garde ce qui compte vraiment : que la surface soit enveloppée, et que le prix
   * vienne de la SOURCE UNIQUE plutôt que d'un littéral.
   */
  it("le point de montage enveloppe son contenu dans <GardeCommerciale utilisatriceId> (AD-9)", () => {
    expect(src).toMatch(/<GardeCommerciale\s+utilisatriceId=/);
  });

  it("[LE CŒUR] le prix n'est JAMAIS un littéral : il vient de la source couplée au prix facturé", () => {
    // `offre-abonnement.ts` est couplé au centime près à `PRIX_ABONNEMENT_ANNUEL_CENTIMES` par
    // `tests/offre-abonnement.test.ts`. Un « 69 € » écrit à la main ici afficherait un prix que
    // personne ne compare plus à celui que Stripe encaisse.
    expect(src).toMatch(/@\/render\/conversation\/offre-abonnement/);
    expect(src, "un prix en dur dans la surface d'offre").not.toMatch(/\b69\b|€/);
  });

  it("[LE CŒUR] la garantie ET la reconduction paraissent là où l'argent est demandé", () => {
    // FR-089 d'un côté, art. L215-1 de l'autre. Aucune des deux n'est reléguée aux CGU.
    expect(src).toMatch(/GARANTIE_REMBOURSEMENT/);
    expect(src).toMatch(/RECONDUCTION/);
  });

  it("[FR-061] le périmètre GRATUIT est écrit AVANT le premium", () => {
    // Ce qu'elle garde en repartant, avant ce qu'elle gagnerait. L'ordre inverse ferait du gratuit
    // le repoussoir du premium.
    expect(src.indexOf("PERIMETRE_GRATUIT_TITRE")).toBeLessThan(src.indexOf("PERIMETRE_PREMIUM_TITRE"));
  });

  it("le montage vit dans app/ (composition), jamais dans render/ (muet) — server-only", () => {
    expect(src).toMatch(/server-only/);
  });
});
