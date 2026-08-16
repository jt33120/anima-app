import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sansCommentaires } from "./_absence";

/**
 * offre-gardee.test.ts — SORTIR N'EST PAS VENDRE (Story 3.6, QA T2 · AD-9 · FR-060).
 *
 * ══ LA DISTINCTION QUE CE FICHIER REND OPPOSABLE ════════════════════════════════════════════════
 *
 * `/abonnement` porte désormais DEUX choses de régimes opposés :
 *
 *   • la SORTIE (résilier, se faire rembourser) — JAMAIS gardée par AD-9. La 3.5 l'a écrit noir sur
 *     blanc : `limites_levees` est vrai pendant un épisode de détresse, donc garder la sortie
 *     reviendrait à empêcher quelqu'un en crise de résilier. Le dark pattern maximal, sur la
 *     personne la plus vulnérable du produit.
 *   • l'OFFRE (s'abonner) — TOUJOURS gardée. C'est du commerce entrant, et FR-043 dit qu'aucun
 *     commerce n'atteint quelqu'un en détresse.
 *
 * Sans ce fichier, la dérogation « sortie » de `tests/garde-commerciale.test.ts` deviendrait un trou :
 * elle exempte `app/abonnement/page.tsx` de porter la balise, et cette page monte maintenant une
 * surface commerciale. Ce qui la garde est `MontagePaywall`, à l'intérieur — et c'est ici qu'on
 * mesure que la garde mord vraiment.
 */

const RACINE = resolve(__dirname, "..");
const lire = (f: string) => readFileSync(resolve(RACINE, f), "utf-8");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA MESURE — la garde monte, ou ne monte pas
// ══════════════════════════════════════════════════════════════════════════════════════════════

const limitesCommercialesLevees = vi.fn(async () => false);
vi.mock("@/lib/safety/limites-commerciales", () => ({ limitesCommercialesLevees }));

const { MontagePaywall } = await import("@/app/_commerce/MontagePaywall");

beforeEach(() => {
  limitesCommercialesLevees.mockClear().mockResolvedValue(false);
});

/** Le rendu d'un composant serveur async, réduit à ce qui nous intéresse : monte-t-il, ou non ? */
async function monte(): Promise<boolean> {
  const arbre = await MontagePaywall({ utilisatriceId: "u-1", titre: "Continuer avec Anam" });
  // `GardeCommerciale` est elle-même async : on l'exécute pour obtenir son verdict.
  const garde = arbre as unknown as { type: (p: unknown) => Promise<unknown>; props: unknown };
  const rendu = await garde.type(garde.props);
  return rendu !== null;
}

describe("[3.6/AD-9] L'offre ne se monte JAMAIS pendant un épisode de détresse", () => {
  it("[CONTRÔLE POSITIF] hors détresse, l'offre se monte", async () => {
    expect(await monte()).toBe(true);
    expect(limitesCommercialesLevees).toHaveBeenCalledWith("u-1");
  });

  it("[LE CŒUR] pendant un épisode ouvert, elle ne se monte PAS", async () => {
    limitesCommercialesLevees.mockResolvedValue(true);
    expect(await monte(), "une offre commerciale a atteint quelqu'un en détresse").toBe(false);
  });

  it("[AD-15] une panne du prédicat penche vers la PROTECTION, jamais vers la vente", async () => {
    // `limitesCommercialesLevees` est écrit pour rendre `true` en cas de panne (repli sûr, 2.5). On
    // mesure ici que le montage en tient compte plutôt que de « réessayer » ou d'ignorer.
    limitesCommercialesLevees.mockRejectedValue(new Error("base_indisponible"));
    await expect(monte()).rejects.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA SORTIE, ELLE, RESTE OUVERTE — l'autre moitié, sans laquelle la première ne prouve rien
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[3.6/FR-060] La SORTIE n'hérite d'aucune garde de l'offre", () => {
  it("[LE CŒUR] la page ne garde ni l'état, ni la résiliation, ni la garantie", () => {
    const page = lire("app/abonnement/page.tsx");
    // Un seul point gardé sur toute la page, et c'est l'offre. Si quelqu'un « harmonisait » en
    // enveloppant la page entière, une personne en détresse ne pourrait plus ni voir son abonnement
    // ni le résilier — et ce test est la seule chose qui l'en empêche.
    expect((page.match(/<MontagePaywall/g) ?? []).length).toBe(1);
    expect(page, "la page entière a été enveloppée : la sortie est fermée").not.toMatch(
      /<GardeCommerciale/,
    );
    expect(page).toMatch(/ACTION_RESILIER/);
  });

  it("les routes de sortie n'appellent toujours pas le prédicat de détresse", () => {
    // ⚠️ `sansCommentaires` EST INDISPENSABLE ICI, et le premier jet l'a appris en rougissant : les
    // deux routes EXPLIQUENT en commentaire pourquoi elles ne portent pas la garde, en la nommant.
    // Sans dépouillement, le test mesurait la prose au lieu du code — exactement le piège rencontré
    // en 6.7 sur le `on delete restrict` compté dans un `comment on table`.
    for (const r of [
      "app/api/abonnement/resilier/route.ts",
      "app/api/abonnement/remboursement/route.ts",
    ]) {
      expect(sansCommentaires(lire(r)), `${r} s'est fermé en détresse`).not.toMatch(
        /limitesCommercialesLevees/,
      );
    }
  });

  it("[LE CŒUR] la route de CHECKOUT, elle, garde toujours", () => {
    // L'inverse exact : c'est du commerce entrant, et la garde y est la seconde couche (la première
    // étant le refus de montage ci-dessus).
    expect(lire("app/api/stripe/checkout/route.ts")).toMatch(/limitesCommercialesLevees/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE CHEMIN QUI MANQUAIT — la raison d'être de la story
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[3.6/T2] Un compte gratuit a enfin un chemin", () => {
  it("[LE CŒUR] l'offre est montée quand il n'y a AUCUN abonnement", () => {
    const page = lire("app/abonnement/page.tsx");
    // La condition est celle de l'ancienne impasse : `!abonnement || (!actif && !resiliationDemandee)`.
    // C'était exactement la branche qui affichait « Ton abonnement n'est plus actif » et rien d'autre.
    expect(page).toMatch(/\(!abonnement \|\| \(!actif && !resiliationDemandee\)\) && \(/);
  });

  it("[LE CŒUR] « jamais abonnée » et « abonnement terminé » ne disent plus la MÊME chose", () => {
    // Le mensonge d'origine : un compte gratuit lisait « ton abonnement n'est plus actif » à propos
    // d'un abonnement qui n'a jamais existé.
    const page = lire("app/abonnement/page.tsx");
    expect(page).toMatch(/abonnement \? c\.ETAT_TERMINE : c\.ETAT_JAMAIS_ABONNEE/);
    const copie = lire("render/abonnement/copie-abonnement.ts");
    expect(copie).toMatch(/ETAT_JAMAIS_ABONNEE/);
  });

  it("[LA PORTE] ouvrir ce chemin exige que la porte Stripe soit inscrite BLOQUANTE", () => {
    // ⚠️ CE TEST N'A RIEN À VOIR AVEC LE CODE, ET C'EST EXPRÈS. Tant qu'aucun compte gratuit ne
    // pouvait atteindre Checkout (3.3, D2-A : pas de branche ⇒ pas de paywall ⇒ pas de chemin), le
    // fait que Stripe soit en mode TEST en production était une gêne. Cette story ouvre le chemin à
    // tout le monde : le produit peut mener quelqu'un au bout d'une souscription qui n'encaisse rien.
    //
    // Le code est juste ; c'est le COMPTE qui est en test. Rien dans le dépôt ne peut le corriger —
    // on garde donc la seule chose qu'on puisse garder : que la porte soit écrite, et écrite
    // bloquante. Même patron que `tests/sous-traitants.test.ts`, qui exige que chaque verdict de
    // propagation désigne une porte réellement inscrite au suivi.
    const portes = lire("_bmad-output/implementation-artifacts/PORTES-AVANT-PUBLICATION.md");
    expect(portes, "la porte Stripe n'est plus marquée BLOQUANTE").toMatch(
      /## 4\. Stripe · 🔴 BLOQUANTE/,
    );
    expect(portes, "la raison du changement de couleur a disparu du document").toMatch(/3\.6/);
  });

  it("le bouton d'abonnement POSTe nativement — il ne dépend pas d'un script", () => {
    const montage = lire("app/_commerce/MontagePaywall.tsx");
    expect(montage).toMatch(/method="post"\s+action="\/api\/stripe\/checkout"/);
    expect(montage, "un îlot client s'est glissé dans la surface d'offre").not.toMatch(/"use client"/);
  });
});
