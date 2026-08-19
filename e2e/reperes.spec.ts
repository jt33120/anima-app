import { test, expect } from "@playwright/test";
import { ouvrirUnCompteNeuf } from "./_entrer";

/**
 * reperes.spec.ts — LE LIEU S'EXPLIQUE, ET ÇA SE RELIT (QA manuelle du 2026-08-19)
 *
 * « Là on est lancé dans le grand bain, on comprend rien. » Le seuil disait une phrase, l'accueil
 * présentait trois noms UNE fois (H4), et rien ne se relisait ensuite. Le manque n'était pas une
 * affaire de copie : il n'existait aucun ENDROIT où revenir.
 *
 * ══ LA DEMANDE DISAIT « SUR AIDE », ET C'EST LE SEUL POINT OÙ ELLE N'EST PAS SUIVIE ═══════════
 *
 * `/aide` est la porte de secours : publique, sans compte, sans session, atteinte en détresse,
 * ouverte sur une sortie rapide et des lignes tenues par des personnes (FR-077, AD-9, AD-15). Y
 * poser un mode d'emploi ferait deux dégâts symétriques — quelqu'un en danger tomberait sur
 * « comment ça marche », quelqu'un qui cherche à comprendre tomberait sur des numéros d'urgence.
 * Ce fichier garde cette séparation autant que l'existence de la page.
 */

test.describe("Repères", () => {
  test("[PARTOUT] le chemin existe depuis chaque région, et « Aide » reste le dernier", async ({
    page,
  }) => {
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");

    // ⚠️ AU SEUIL AUSSI. Celui qui ne comprend pas où il est peut être n'importe où — y compris
    // devant la porte, avant d'être entré. Une entrée conditionnelle serait absente là où elle sert.
    await expect(
      page.getByRole("link", { name: "Repères" }),
      "le seuil n'offre aucun chemin vers l'explication",
    ).toBeVisible();

    await page.getByRole("button", { name: /entrer dans le monde/i }).click();
    const barre = page.getByRole("navigation", { name: "Régions" });
    for (const region of ["Accueil", "Anam", "L’arbre"]) {
      await barre.getByRole("button", { name: region, exact: true }).click();
      await expect(
        page.getByRole("link", { name: "Repères" }),
        `aucun chemin vers l'explication depuis « ${region} »`,
      ).toBeVisible();

      // FR-077 — la porte de secours ne cède sa place à rien, et rien ne se glisse après elle.
      const ordre = await page.evaluate(() =>
        [...document.querySelectorAll('[class*="surimpression"] a')].map((a) =>
          (a.textContent ?? "").trim(),
        ),
      );
      expect(ordre[ordre.length - 1], `dans « ${region} », « Aide » n'est plus le dernier lien`).toBe(
        "Aide",
      );
    }
  });

  test("[CE QU'ELLE EXPLIQUE] les trois places, le geste, et qui écrit quoi", async ({ page }) => {
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");
    await page.getByRole("link", { name: "Repères" }).click();
    await page.waitForURL(/\/reperes/);

    await expect(page.getByRole("heading", { name: "Repères", level: 1 })).toBeVisible();

    // Les trois noms sont ceux de la barre : ce qu'on vient de lire est atteignable sous le même mot.
    const places = page.getByRole("region", { name: "Les trois places" });
    await expect(places.getByRole("term")).toHaveText(["Anam", "L’arbre", "L’accueil"]);

    // Le geste ajouté le même jour est EXPLIQUÉ, pas seulement disponible : un geste qu'on ne
    // découvre qu'en tâtonnant n'existe pas pour qui ne tâtonne pas.
    await expect(
      page.getByRole("region", { name: "Circuler" }).getByText(/glisser/i),
      "le glissement latéral n'est expliqué nulle part",
    ).toBeVisible();

    // FR-054/FR-086 — la frontière entre ce qu'écrit le modèle et ce qu'écrit Anima.
    const qui = page.getByRole("region", { name: "Qui écrit quoi" });
    await expect(qui.getByText(/intelligence artificielle/i)).toBeVisible();
    await expect(qui.getByText(/écrits à la main/i)).toBeVisible();

    // On revient d'où l'on vient, sans passer par l'historique du navigateur.
    await page.getByRole("link", { name: /Revenir/ }).click();
    await expect(page.getByRole("heading", { name: /^Accueil$|^Anam$|^L’arbre$/, level: 1 })).toBeVisible();
  });

  test("[LA PORTE DE SECOURS N'EST PAS UN MODE D'EMPLOI] les deux pages ne se confondent pas", async ({
    page,
  }) => {
    // ⚠️ LA GARDE QUI TIENT LA DÉCISION. La demande était de poser le tutoriel sur « Aide ». Si
    // quelqu'un le fait un jour, ce test rougit — et il dit pourquoi plutôt que de l'interdire.
    await ouvrirUnCompteNeuf(page);

    await page.goto("/aide");
    await expect(
      page.getByRole("button", { name: /quitter/i }),
      "témoin : /aide n'est plus la porte de secours, la comparaison ne prouve rien",
    ).toBeVisible();
    const aide = (await page.locator("main").innerText()).toLowerCase();
    expect(
      /les trois places|glisser latéralement|mode d’emploi/.test(aide),
      "/aide s'est mise à expliquer le produit : quelqu'un en détresse y arrive d'abord",
    ).toBe(false);

    await page.goto("/reperes");
    const reperes = (await page.locator("main").innerText()).toLowerCase();
    expect(
      /suicide|urgence|3114|numéro/.test(reperes),
      "/reperes s'est mise à porter des ressources de crise : elles vivent à un seul endroit (AD-9)",
    ).toBe(false);
    // Elle DÉSIGNE la porte, sans la remplacer.
    expect(
      /«\s*aide\s*»/.test(reperes),
      "/reperes ne dit nulle part où aller si ça ne va pas",
    ).toBe(true);
  });
});
