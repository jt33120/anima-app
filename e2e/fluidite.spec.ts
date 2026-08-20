import { test, expect, type Page } from "@playwright/test";
import { ouvrirUnCompteNeuf, passerLeTour } from "./_entrer";

/**
 * fluidite.spec.ts — LA SCÈNE NE COÛTE PAS PLUS QU'UN DOCUMENT (mesuré le 2026-08-20)
 *
 * ══ CE QUI EST ARRIVÉ ═════════════════════════════════════════════════════════════════════════
 *
 * En rendant le fond « plus immersif », une voie lactée a été ajoutée : une bande diagonale
 * `filter: blur(44px)` sur un élément débordant de 20 % du viewport. Sur une capture d'écran, le
 * résultat était exactement celui voulu. À l'usage, l'application tombait à **4 images/seconde au
 * repos** — le navigateur devant recomposer un flou plein écran à chaque trame, puisque les étoiles
 * scintillent et que le canevas de l'arbre se peint derrière.
 *
 * ⚠️ AUCUNE DES GARDES DE CE DÉPÔT NE POUVAIT LE VOIR. Les tests de rendu ne composent rien ; les
 * gardes de pixels comparent des images FIXES, et l'image était juste ; les gardes de boîtes
 * mesurent une mise en page, qui était juste aussi. Un défaut de FLUIDITÉ n'est ni une position ni
 * une couleur : c'est un coût par trame, et il faut le compter.
 *
 * ══ POURQUOI LE SEUIL EST RELATIF, ET NON GRAVÉ ═══════════════════════════════════════════════
 *
 * Un nombre d'images/seconde absolu dépend de la machine, de la charge, du navigateur : gravé ici,
 * il rougirait un matin sans qu'une ligne du produit ait changé — c'est la leçon déjà écrite dans
 * `conversation-attente.spec.ts`. On mesure donc d'abord une RÉFÉRENCE sur `/aide`, qui est un
 * document statique du même produit, puis on exige que la scène s'en approche. Le rapport, lui, ne
 * dépend d'aucune machine : avec le flou il valait 0,13 ; sans lui, 1,0.
 */

/** Images par seconde, mesurées sur 1,5 s de `requestAnimationFrame`. */
const imagesParSeconde = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((res) => {
        let n = 0;
        const t0 = performance.now();
        const tic = () => {
          n++;
          if (performance.now() - t0 < 1500) requestAnimationFrame(tic);
          else res(Math.round((n * 1000) / (performance.now() - t0)));
        };
        requestAnimationFrame(tic);
      }),
  );

/** En deçà de cette part de la référence, la scène coûte trop cher par trame. */
const PART_MINIMALE = 0.6;

test("[LE COÛT PAR TRAME] la scène reste fluide sur chacune de ses régions", async ({ page }) => {
  await ouvrirUnCompteNeuf(page);

  // La RÉFÉRENCE : une halte du même produit, sans canevas, sans étoiles, sans dégradés animés.
  await page.goto("/aide");
  await page.waitForTimeout(900);
  const reference = await imagesParSeconde(page);
  expect(reference, "témoin : même un document statique ne tourne pas — la mesure ne dirait rien").toBeGreaterThan(8);

  await page.goto("/");
  await page.waitForTimeout(1400);
  const releves: Record<string, number> = { seuil: await imagesParSeconde(page) };

  await page.getByRole("button", { name: /entrer dans le monde/i }).click();
  await passerLeTour(page);
  const barre = page.getByRole("navigation", { name: "Régions" });
  for (const region of ["Accueil", "Anam", "L’arbre"]) {
    await barre.getByRole("button", { name: region, exact: true }).click();
    await page.waitForTimeout(1200);
    releves[region] = await imagesParSeconde(page);
  }

  const trop = Object.entries(releves).filter(([, v]) => v < reference * PART_MINIMALE);
  expect(
    trop.map(([nom, v]) => `${nom} : ${v} im/s`),
    `la scène rame par rapport à un document du même produit (${reference} im/s) :\n` +
      Object.entries(releves)
        .map(([n, v]) => `  ${n} → ${v} im/s`)
        .join("\n"),
  ).toEqual([]);
});

test("[PENDANT LE TOUR AUSSI] l'écran qui apprend le produit ne doit pas saccader", async ({ page }) => {
  // ⚠️ LE PIRE ENDROIT POUR UNE SACCADE. Le tour guidé est le premier écran qu'une personne voit
  // en entrant, et le seul dont le propos est de mettre en confiance. Il porte en plus quatre
  // volets et un contour qui se déplacent d'une étape à l'autre : c'est la surface la plus
  // susceptible de coûter cher, et celle où ça se pardonne le moins.
  await ouvrirUnCompteNeuf(page);
  await page.goto("/aide");
  await page.waitForTimeout(900);
  const reference = await imagesParSeconde(page);

  await page.goto("/");
  await page.getByRole("button", { name: /entrer dans le monde/i }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog"), "témoin : le tour n’est pas ouvert").toBeVisible();

  const pendant = await imagesParSeconde(page);
  expect(
    pendant,
    `le tour tourne à ${pendant} im/s contre ${reference} pour un document statique`,
  ).toBeGreaterThanOrEqual(reference * PART_MINIMALE);
});
