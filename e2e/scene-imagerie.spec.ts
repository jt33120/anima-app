import { test, expect, type Page } from "@playwright/test";
import { ouvrirUnCompteNeuf } from "./_entrer";

/**
 * scene-imagerie.spec.ts — CE QUE L'ARRIÈRE-PLAN PEINT VRAIMENT, RÉGION PAR RÉGION
 *
 * ══ POURQUOI CE FICHIER ═══════════════════════════════════════════════════════════════════════
 *
 * Deux défauts nés du même endroit, et aucun des 5 037 tests Vitest ne pouvait les voir : ils
 * montent des composants en mémoire, jamais une CASCADE.
 *
 *  • B4 (QA visuelle du 2026-08-19) — « un artefact clair traverse l'interstice entre deux cartes ».
 *    L'accueil est une pile de cartes opaques qui défile, posée sur une scène qui ne défile pas :
 *    les 16 px entre deux cartes forment une fente mobile sur un feuillage bleu pâle.
 *  • Le jeton `--imagerie-opacite` était MORT sur le décor de l'arbre. `imagerie` et `fondu-image`
 *    vivaient sur le même élément ; une animation `fill: both` l'emporte sur une déclaration et
 *    pinçait l'opacité à 1 pour toujours. En contraste renforcé, la lune et les étoiles
 *    disparaissaient (`display: none`) et l'arbre restait. La règle était écrite, elle ne
 *    s'appliquait pas — le genre de défaut qu'une relecture de source ne trouve jamais, parce
 *    que chacune des deux lignes est juste.
 *
 * ⚠️ CE QUI SE MESURE ICI EST CONCLUSIF, ET C'EST VOULU. `opacity: 0` ne veut pas dire « peu
 * visible » : le navigateur ne peint RIEN. Une opacité effective nulle prouve donc l'absence de
 * l'artefact, sans avoir à échantillonner un pixel. Et on multiplie les opacités de toute la
 * chaîne d'ancêtres : gouverner le parent et laisser l'enfant à 1 serait une garde à moitié
 * aveugle, alors que c'est justement la séparation parent/enfant qui corrige le défaut.
 */

/** L'opacité EFFECTIVE du décor : le produit de toute la chaîne, du canevas jusqu'à la scène. */
async function opaciteEffectiveArbre(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const conteneur = document.querySelector('[class*="arbreMonde"]');
    if (!conteneur) return null;
    let o = 1;
    for (let n: Element | null = conteneur.querySelector("canvas") ?? conteneur; n; n = n.parentElement) {
      o *= Number(getComputedStyle(n).opacity);
      if (n.tagName === "MAIN") break;
    }
    return o;
  });
}

/** Attendre que le fondu de région (--duree-longue) soit retombé avant de mesurer. */
const laisserRetomber = (page: Page) => page.waitForTimeout(1500);

test.describe("Le décor de l'arbre", () => {
  test("[B4] derrière l'accueil, il ne peint RIEN — la fente entre deux cartes ne montre que le ciel", async ({
    page,
  }) => {
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");
    await laisserRetomber(page);
    await page.getByRole("button", { name: /entrer dans le monde/i }).click();
    await laisserRetomber(page);

    // La région d'accueil est bien celle qui est active — sans quoi la mesure ne dirait rien.
    await expect(page.getByRole("heading", { name: /^Accueil$/, level: 1 })).toBeVisible();

    expect(
      await opaciteEffectiveArbre(page),
      "le feuillage repasse dans l'interstice entre les cartes",
    ).toBe(0);
  });

  test("au seuil, il est PEINT — le retrait est local, la scène n'a pas perdu son arbre", async ({
    page,
  }) => {
    // ⚠️ SANS CE TEST, « supprimer l'arbre partout » passerait pour une correction de B4.
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");
    await laisserRetomber(page);

    const o = await opaciteEffectiveArbre(page);
    expect(o, "le décor a disparu de la scène entière").not.toBeNull();
    expect(o!).toBeGreaterThan(0.9);
  });

  test("[LE JETON MORT] en contraste renforcé, l'imagerie cède aux aplats — l'arbre compris", async ({
    page,
  }) => {
    // On passe par la MÉDIA-REQUÊTE, pas par un attribut posé à la main : c'est le chemin qu'une
    // vraie personne emprunte (réglage du système), et le seul des deux qui soit branché.
    await page.emulateMedia({ contrast: "more" });
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");
    await laisserRetomber(page);

    const jeton = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--imagerie-opacite").trim(),
    );
    expect(jeton, "la média-requête de contraste n'a pas pris : la mesure qui suit ne prouverait rien").toBe("0");

    expect(
      await opaciteEffectiveArbre(page),
      "le jeton vaut 0 et l'arbre est peint quand même : la règle est écrite mais ne s'applique pas",
    ).toBe(0);
  });
});
