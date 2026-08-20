import { test, expect, type Page } from "@playwright/test";
import { ouvrirUnCompteNeuf } from "./_entrer";

/**
 * guide.spec.ts — LE TOUR GUIDÉ DÉSIGNE VRAIMENT (retour du 2026-08-20)
 *
 * « Le tutoriel doit me guider dans l'application, pas être juste une liste de texte, elle doit
 * mettre en évidence certaines parties, entourer, l'utilisateur clique sur suivant et on avance. »
 *
 * ══ CE QUI SE MESURE, ET POURQUOI DES BOÎTES ═════════════════════════════════════════════════
 *
 * La différence entre un tour et six boîtes de texte n'est pas dans la copie : elle est dans le
 * fait que le projecteur COÏNCIDE avec l'élément dont on parle. Une garde qui vérifierait la
 * présence des textes serait verte sur six modales posées au hasard — c'est-à-dire sur l'objet
 * qu'on refuse. On mesure donc des rectangles : celui du trou contre celui de la cible.
 */

const dialogue = (page: Page) => page.getByRole("dialog");

/** Le rectangle du trou de projecteur, et celui de l'élément qu'il prétend désigner. */
const coincidence = (page: Page, selecteurCible: string) =>
  page.evaluate((sel) => {
    const trou = document.querySelector("[class*='_trou']");
    const cible = document.querySelector(sel);
    if (!trou || !cible) return null;
    const a = trou.getBoundingClientRect();
    const b = cible.getBoundingClientRect();
    return {
      ecartTop: Math.abs(a.top - b.top),
      ecartBas: Math.abs(a.bottom - b.bottom),
      ecartGauche: Math.abs(a.left - b.left),
      ecartDroite: Math.abs(a.right - b.right),
    };
  }, selecteurCible);

async function arriverDansLeMonde(page: Page) {
  await ouvrirUnCompteNeuf(page);
  await page.goto("/");
  await page.getByRole("button", { name: /entrer dans le monde/i }).click();
  await page.waitForTimeout(1600);
}

test.describe("Le tour guidé", () => {
  test("[IL S'OUVRE SEUL] à la première arrivée, sans avoir été cherché", async ({
    page,
  }) => {
    await arriverDansLeMonde(page);
    await expect(
      dialogue(page),
      "personne ne va chercher un tutoriel le jour où il en a le plus besoin",
    ).toBeVisible();
    await expect(
      dialogue(page).getByRole("heading", { level: 2 }),
    ).toBeVisible();
  });

  test("[IL DÉSIGNE] le projecteur coïncide avec l'élément dont il parle", async ({
    page,
  }) => {
    // ⚠️ C'EST LA PROPRIÉTÉ QUI SÉPARE UN TOUR D'UNE PILE DE MODALES. Sans elle, six boîtes de
    // texte posées au centre de l'écran passeraient toutes les autres gardes de ce fichier.
    await arriverDansLeMonde(page);
    await dialogue(page).getByRole("button", { name: "Suivant" }).click();
    await page.waitForTimeout(1100);

    await expect(
      dialogue(page).getByRole("heading", { name: "Ta barre" }),
    ).toBeVisible();
    const e = await coincidence(page, "nav[aria-label='Régions']");
    expect(e, "aucun projecteur, ou aucune barre à désigner").not.toBeNull();
    // Le trou est ÉLARGI d'un souffle (8 px) : collé au pixel, il étrangle l'élément.
    for (const [nom, valeur] of Object.entries(e!)) {
      expect(
        valeur,
        `le projecteur est à côté de sa cible (${nom} = ${valeur} px)`,
      ).toBeLessThanOrEqual(14);
    }
  });

  test("[IL NE CACHE PAS CE QU'IL MONTRE] la bulle ne recouvre jamais le projecteur", async ({
    page,
  }) => {
    // ⚠️ NÉ D'UN DÉFAUT MESURÉ. La bulle se plaçait avec une hauteur SUPPOSÉE (232 px) : dès qu'un
    // texte passait à cinq lignes, elle débordait sur l'élément qu'elle désignait — donc sur la
    // barre, dans l'étape qui parle de la barre. Le texte est de la copie : il changera encore.
    await arriverDansLeMonde(page);
    const chevauchements: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await page.evaluate(() => {
        const trou = document.querySelector("[class*='_trou']");
        const bulle = document.querySelector("[class*='_bulle']");
        const titre = bulle?.querySelector("h2")?.textContent ?? "?";
        if (!trou || !bulle) return null;
        const a = trou.getBoundingClientRect();
        const b = bulle.getBoundingClientRect();
        if (a.width < 4) return null; // étape sans cible : la bulle EST au centre, c'est voulu
        const recouvre =
          a.top < b.bottom &&
          a.bottom > b.top &&
          a.left < b.right &&
          a.right > b.left;
        return recouvre ? titre : null;
      });
      if (r) chevauchements.push(r);
      const suivant = dialogue(page).getByRole("button", {
        name: /Suivant|J’ai compris/,
      });
      if (!(await suivant.count())) break;
      await suivant.click();
      await page.waitForTimeout(1100);
    }
    expect(
      chevauchements,
      `la bulle recouvre ce qu’elle désigne : ${chevauchements.join(", ")}`,
    ).toEqual([]);
  });

  test("[IL VOYAGE] « Suivant » emmène dans les autres régions, puis se termine", async ({
    page,
  }) => {
    await arriverDansLeMonde(page);
    const regions = new Set<string>();
    for (let i = 0; i < 8; i++) {
      regions.add(
        (await page.evaluate(
          () =>
            [...document.querySelectorAll("section[aria-label]")]
              .filter((s) => !s.hasAttribute("inert"))
              .map((s) => s.getAttribute("aria-label"))[0] ?? "?",
        )) ?? "?",
      );
      const suivant = dialogue(page).getByRole("button", {
        name: /Suivant|J’ai compris/,
      });
      if (!(await suivant.count())) break;
      await suivant.click();
      await page.waitForTimeout(1100);
    }
    expect(
      [...regions].sort(),
      "le tour reste sur un seul écran : il explique au lieu de guider",
    ).toEqual(["Accueil", "Anam", "L’arbre"]);
    await expect(dialogue(page), "le tour ne se termine jamais").toHaveCount(0);
  });

  test("[IL NE REVIENT PAS SEUL] mais il se refait depuis Repères", async ({
    page,
  }) => {
    await arriverDansLeMonde(page);
    await dialogue(page)
      .getByRole("button", { name: "Passer le tour" })
      .click();
    await expect(dialogue(page)).toHaveCount(0);

    await page.waitForTimeout(1200);
    await page.reload();
    await page.waitForTimeout(1600);
    await expect(
      dialogue(page),
      "une aide qu’on ne peut pas faire taire cesse d’en être une",
    ).toHaveCount(0);

    await page.getByRole("link", { name: "Repères" }).click();
    await page.getByRole("link", { name: /Faire le tour/ }).click();
    await page.waitForTimeout(1600);
    await expect(
      dialogue(page),
      "le tour ne se relance pas depuis Repères",
    ).toBeVisible();
    // ⚠️ ET L'URL EST NETTOYÉE : sans ça, un rechargement — ou un lien partagé — relance le tour
    // indéfiniment.
    expect(
      new URL(page.url()).search,
      "le paramètre `tour` reste dans l’URL",
    ).toBe("");
  });

  test("[ÉCHAP FERME] une surimpression bloquante sans sortie au clavier est un piège", async ({
    page,
  }) => {
    await arriverDansLeMonde(page);
    await expect(dialogue(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogue(page)).toHaveCount(0);
  });
});
