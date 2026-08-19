import { test, expect } from "@playwright/test";
import { ouvrirUnCompteNeuf } from "./_entrer";

/**
 * cibles-tactiles.spec.ts — LES CIBLES, MESURÉES RENDUES
 *
 * ══ POURQUOI CE FICHIER, ALORS QU'UNE GARDE DE SOURCE EXISTE DÉJÀ ═════════════════════════════
 *
 * `tests/cible-tactile.test.ts` lit les feuilles de style et vérifie qu'une commande NOMMÉE
 * déclare `min-height: var(--cible-tactile)`. C'est utile, et son propre en-tête dit ce qu'elle ne
 * peut pas faire : « la hauteur RENDUE — un `min-height` peut être annulé par un parent ; c'est une
 * garde de convention, pas une mesure ».
 *
 * La QA du 2026-08-19 a mesuré ce que cette convention laissait passer : la porte de secours à
 * **27,7 px de LARGE** (`min-height` était bien là, la largeur n'était bornée par rien), et une case
 * à cocher native de **13 × 13 px** sur l'écran qui efface définitivement le compte.
 *
 * ── LA CIBLE N'EST PAS TOUJOURS L'ÉLÉMENT ──────────────────────────────────────────────────────
 *
 * Une case à cocher enveloppée dans un `<label>` a pour cible le LABEL : cliquer l'étiquette coche
 * la case, c'est le comportement natif, et WCAG mesure ce qui est réellement activable. Mesurer
 * l'`<input>` seul aurait donné « 13 px » là où la cible réelle fait toute la ligne — un faux
 * positif qui aurait fait « corriger » quelque chose de juste. On mesure donc la cible EFFECTIVE.
 */

/** Le seuil de la charte. WCAG 2.5.8 exige 24 ; DESIGN.md tient 44, et c'est ce qu'on garde. */
const CIBLE = 44;

type Mesure = { readonly quoi: string; readonly l: number; readonly h: number };

/**
 * Mesure chaque commande visible de la page. Pour un `<input>` enveloppé d'un `<label>`, c'est le
 * label qui est mesuré — c'est lui la cible.
 */
async function mesurerLesCommandes(page: import("@playwright/test").Page): Promise<Mesure[]> {
  return page.evaluate(() => {
    const SELECTEUR = 'a[href], button, input, select, textarea, summary, [role="button"]';
    const vues = new Set<Element>();
    const out: { quoi: string; l: number; h: number }[] = [];

    for (const el of Array.from(document.querySelectorAll(SELECTEUR))) {
      if (el instanceof HTMLInputElement && el.type === "hidden") continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;

      // La cible effective : le label englobant s'il y en a un, l'élément sinon.
      const label = el.closest("label");
      const cible = label ?? el;
      if (vues.has(cible)) continue;
      vues.add(cible);

      const r = cible.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // hors flux : rien à viser, rien à mesurer

      const nom =
        el.getAttribute("name") ||
        el.getAttribute("aria-label") ||
        (el.textContent || "").trim().slice(0, 40) ||
        el.getAttribute("href") ||
        "";
      out.push({
        quoi: `${el.tagName.toLowerCase()}${nom ? `[${nom}]` : ""}${label ? " (via label)" : ""}`,
        l: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
      });
    }
    return out;
  });
}

function tropPetites(mesures: Mesure[]): Mesure[] {
  return mesures.filter((m) => m.l < CIBLE || m.h < CIBLE);
}

const rapport = (m: Mesure[]) => m.map((x) => `${x.quoi} → ${x.l} × ${x.h}`).join("\n");

test.describe("Les cibles tactiles, mesurées rendues", () => {
  test("l'entrée — la porte publique, et ses deux liens de bas de page", async ({ page }) => {
    await page.goto("/entrer");
    const mesures = await mesurerLesCommandes(page);
    expect(mesures.length, "aucune commande trouvée : la mesure ne mesure rien").toBeGreaterThan(2);
    expect(tropPetites(mesures), `sous ${CIBLE} px :\n${rapport(tropPetites(mesures))}`).toEqual([]);
  });

  test("le tunnel et les écrans du compte", async ({ page }) => {
    await ouvrirUnCompteNeuf(page);

    const fautives: string[] = [];
    for (const chemin of ["/", "/memoire", "/reglages", "/mes-donnees", "/abonnement", "/aide"]) {
      await page.goto(chemin);
      const petites = tropPetites(await mesurerLesCommandes(page));
      if (petites.length) fautives.push(`── ${chemin}\n${rapport(petites)}`);
    }
    expect(fautives, `cibles sous ${CIBLE} px :\n${fautives.join("\n")}`).toEqual([]);
  });

  test("[LE PIRE ENDROIT] la confirmation d'effacement définitif", async ({ page }) => {
    // C'est l'action la plus irréversible du produit. La QA du 19/08 a mesuré la case à 13 × 13 px
    // et en a conclu à un défaut ; la cible réelle est le label qui l'enveloppe. On le VÉRIFIE ici
    // plutôt que de le déduire — parce que si un jour quelqu'un sort la case de son label, plus
    // rien ne le dira.
    await ouvrirUnCompteNeuf(page);
    await page.goto("/mes-donnees");

    const cible = page.locator('label:has(input[name="compris"])');
    await expect(cible, "la case de confirmation n'est plus dans un label").toHaveCount(1);
    const boite = await cible.boundingBox();
    expect(boite, "la cible n'est pas rendue").not.toBeNull();
    expect(boite!.height, `la confirmation d'effacement fait ${boite!.height} px de haut`).toBeGreaterThanOrEqual(CIBLE);
    expect(boite!.width, `la confirmation d'effacement fait ${boite!.width} px de large`).toBeGreaterThanOrEqual(CIBLE);
  });
});
