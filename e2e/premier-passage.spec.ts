import { test, expect } from "@playwright/test";
import { ouvrirUnCompteNeuf, passerLeTour } from "./_entrer";

/**
 * premier-passage.spec.ts — « JE VIENS DE M'INSCRIRE » → « JE SAIS QUOI FAIRE » (H4)
 *
 * ══ POURQUOI CE PARCOURS EXISTE ═══════════════════════════════════════════════════════════════
 *
 * Les tests unitaires prouvent chaque maillon : le domaine décide, la RPC pose la date, le rendu
 * dessine. Aucun ne prouve la CHAÎNE — et c'est la chaîne qui porte la promesse : le texte se dit
 * une fois, puis plus jamais. Entre le clic et la disparition il y a une Server Action, un verrou,
 * un grant de lecture et une frontière de couche ; chacun peut être juste isolément et rompre
 * l'ensemble. Ce parcours est le seul endroit où « une fois, puis plus jamais » se vérifie.
 *
 * ⚠️ ET IL GARDE LA MESURE QUI A DÉPLACÉ CE BLOC. La première version posait la présentation au
 * SEUIL, entre la phrase et la porte : sur iPhone 14, « entrer dans le monde » sortait entièrement
 * du viewport (ratio 0). Le `toBeInViewport()` sur la porte reste ici, à l'endroit exact où la
 * tentation reviendra — un seuil est fait pour être traversé, pas lu.
 */

test("[H4] le lieu se présente une fois, puis plus jamais", async ({ page }) => {
  await ouvrirUnCompteNeuf(page);
  await page.goto("/");

  // ── 1. On franchit le seuil, et l'accueil présente le lieu.
  const porte = page.getByRole("button", { name: /entrer dans le monde/i });
  await expect(porte, "la porte du seuil n'est pas atteignable").toBeInViewport();
  await porte.click();
  await passerLeTour(page);

  const titre = page.getByRole("heading", { name: "Trois places", level: 2, exact: true });
  await expect(titre, "un compte neuf n'a pas été présenté au lieu").toBeVisible();
  // ⚠️ DEUX PIÈGES DE LOCALISATION, TOUS DEUX PAYÉS ICI.
  //  1. un `<dt>` ne tire pas son nom accessible de son texte : `getByRole("term", { name })` ne
  //     trouve rien, et le croire ferait écrire une garde qui rougit sur du HTML parfaitement juste ;
  //  2. la bibliothèque a ses propres `<dt>` (« Chemin de vie », « Soleil »…) — un `getByRole` non
  //     borné en ramassait dix. On borne au repère nommé de la présentation.
  const presentation = page.getByRole("region", { name: "Trois places" });
  await expect(presentation.getByRole("term")).toHaveText(["Anam", "L’arbre", "L’accueil"]);
  await expect(presentation.getByText(/Le plus simple/), "rien ne dit par quoi commencer").toBeVisible();

  // ── 2. La présentation est LUE avant les cartes, et sans avoir à chercher.
  await expect(titre).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Accueil", level: 1 })).toBeVisible();

  // ── 3. Les trois noms de la présentation sont ceux de la barre : ce qu'on vient de lire est
  //       atteignable tout de suite, et c'est la moitié de « je sais quoi faire ».
  const barre = page.getByRole("navigation", { name: "Régions" });
  await expect(barre.getByRole("button")).toHaveText(["Accueil", "Anam", "L’arbre"]);

  // ── 4. On revient. Le monde s'ouvre DIRECTEMENT sur l'accueil — le seuil ne se redresse plus
  //       (QA manuelle du 2026-08-19 : il était rendu à chaque chargement) — et l'accueil s'est tu.
  await page.waitForTimeout(1500); // la Server Action pose la date avant qu'on recharge
  await page.reload();
  await expect(page.getByRole("heading", { name: "Accueil", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trois places", level: 2, exact: true }),
    "la présentation revient à chaque chargement : la date n'a pas été posée, ou pas relue",
  ).toHaveCount(0);
});
