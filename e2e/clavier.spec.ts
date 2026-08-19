import { test, expect, type Page } from "@playwright/test";
import { ouvrirUnCompteNeuf } from "./_entrer";

/**
 * clavier.spec.ts — LA TABULATION RÉELLE, CE QUE PERSONNE N'AVAIT PU MESURER
 *
 * ══ POURQUOI CE FICHIER ═══════════════════════════════════════════════════════════════════════
 *
 * Le tour de QA 1 a écrit, honnêtement : « les règles CSS sont en `:focus-visible`, qu'un focus
 * déclenché par SCRIPT n'active pas. Seul le CSS a été vérifié, pas l'affichage effectif. » Le
 * tour 2 n'a pas pu le faire non plus — l'extension ne s'appairait plus. Le point est resté NON
 * TESTÉ deux tours de suite.
 *
 * Playwright, lui, envoie de vraies frappes : `:focus-visible` s'active pour de bon, et l'anneau
 * est réellement peint. C'est la seule façon d'en finir avec ce trou.
 *
 * ⚠️ CE QUI SE MESURE ICI NE SE MESURE PAS DANS LA SOURCE. `tests/qa-visuelle-19-aout.test.ts`
 * prouve que les 41 déclarations `outline` du dépôt sont identiques ; il ne peut rien dire de ce
 * qui est PEINT — une règle juste peut être écrasée par la cascade, ou l'élément peut ne jamais
 * recevoir le focus. Les deux gardes se complètent, aucune ne remplace l'autre.
 */

/** L'anneau de la charte : `2px solid #77719C`, décalé de 2px. */
const ANNEAU = { largeur: "2px", style: "solid", couleur: "rgb(119, 113, 156)" };

type Arret = {
  readonly balise: string;
  readonly nom: string;
  readonly anneau: string;
  readonly decalage: string;
};

/**
 * Traverse l'écran à la touche Tab et relève, à CHAQUE arrêt, ce que le navigateur peint vraiment.
 * S'arrête quand le focus revient au point de départ (le cycle est bouclé) ou au plafond.
 */
async function traverser(page: Page, plafond = 40): Promise<Arret[]> {
  const arrets: Arret[] = [];
  const vus = new Set<string>();

  for (let i = 0; i < plafond; i++) {
    await page.keyboard.press("Tab");
    const a = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      // ⚠️ `nextjs-portal` EST LA SURCOUCHE DE DÉVELOPPEMENT DE NEXT, PAS LE PRODUIT. Elle prend le
      // focus en fin de traversée et peint son propre contour ; la compter ferait rougir la garde
      // sur quelque chose que personne ne voit en production. On l'ignore, nommément.
      if (el.tagName.toLowerCase() === "nextjs-portal") return null;
      const s = getComputedStyle(el);
      return {
        balise: el.tagName.toLowerCase(),
        nom:
          el.getAttribute("name") ||
          el.getAttribute("aria-label") ||
          (el.textContent || "").trim().slice(0, 40) ||
          el.getAttribute("href") ||
          "",
        anneau: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
        decalage: s.outlineOffset,
      };
    });
    if (!a) break;
    const cle = `${a.balise}|${a.nom}`;
    if (vus.has(cle)) break; // on a bouclé
    vus.add(cle);
    arrets.push(a);
  }
  return arrets;
}

const ecartsDAnneau = (arrets: Arret[]) =>
  arrets.filter(
    (a) =>
      !a.anneau.includes(ANNEAU.largeur) ||
      !a.anneau.includes(ANNEAU.style) ||
      !a.anneau.includes(ANNEAU.couleur),
  );

test.describe("La tabulation, avec de vraies frappes", () => {
  // ⚠️ CE CANAL NE MESURE RIEN SOUS WEBKIT, ET CE N'EST PAS UN DÉFAUT DU PRODUIT. Safari n'amène
  // pas le focus sur les LIENS à la touche Tab tant que « Press Tab to highlight each item » n'est
  // pas coché dans ses réglages — comportement par défaut du système, pas propriété de la page.
  // Mesuré ici : zéro arrêt sur `/memoire`, `/mes-donnees`, `/abonnement` et `/aide`, qui n'ont que
  // des liens. En tirer « l'écran est inatteignable au clavier » serait faux, et c'est exactement
  // le genre de conclusion qu'une mesure de navigateur invite à écrire.
  test.skip(
    ({ browserName }) => browserName === "webkit",
    "Safari n'inclut pas les liens dans l'ordre de tabulation par défaut : la traversée y est inobservable.",
  );

  test("l'entrée — chaque arrêt peint le MÊME anneau", async ({ page }) => {
    await page.goto("/entrer");
    const arrets = await traverser(page);

    expect(arrets.length, "aucun arrêt de tabulation : l'écran est inatteignable au clavier").toBeGreaterThan(2);
    const ecarts = ecartsDAnneau(arrets);
    expect(
      ecarts,
      `anneaux peints hors charte :\n${ecarts.map((a) => `${a.balise}[${a.nom}] → ${a.anneau} / ${a.decalage}`).join("\n")}`,
    ).toEqual([]);
  });

  test("[LE RISQUE SIGNALÉ] l'anneau est peint DEHORS, jamais collé au bord", async ({ page }) => {
    // Le tour de QA 2 l'a nommé avant qu'il n'arrive : `--bordure-forte` sur l'accent donnerait
    // 2,39:1, sous le seuil. Ça ne se produit pas parce que le décalage dessine l'anneau sur le
    // fond de page, où il tient à 4,29:1. Une garde de source interdit déjà `outline-offset: 0` ;
    // celle-ci vérifie ce que le navigateur CALCULE, cascade comprise.
    await page.goto("/entrer");
    const arrets = await traverser(page);
    const colles = arrets.filter((a) => a.decalage === "0px");
    expect(
      colles,
      `anneaux collés au bord :\n${colles.map((a) => `${a.balise}[${a.nom}]`).join("\n")}`,
    ).toEqual([]);
  });

  test("les écrans du compte — anneau unique, et aucun piège à focus", async ({ page }) => {
    await ouvrirUnCompteNeuf(page);

    const fautifs: string[] = [];
    for (const chemin of ["/memoire", "/reglages", "/mes-donnees", "/abonnement", "/aide"]) {
      await page.goto(chemin);
      const arrets = await traverser(page);

      // ⚠️ UN PIÈGE À FOCUS SE RECONNAÎT À CECI : la traversée atteint le plafond sans jamais
      // boucler, parce qu'on retombe indéfiniment sur les mêmes éléments sous d'autres noms. Un
      // écran de ce produit compte quelques poignées d'arrêts, jamais quarante.
      if (arrets.length >= 40) fautifs.push(`${chemin} → la tabulation ne boucle jamais (piège ?)`);
      if (arrets.length === 0) fautifs.push(`${chemin} → aucun arrêt : inatteignable au clavier`);
      for (const e of ecartsDAnneau(arrets)) {
        fautifs.push(`${chemin} → ${e.balise}[${e.nom}] peint ${e.anneau}`);
      }
    }
    expect(fautifs, fautifs.join("\n")).toEqual([]);
  });

  test("[FR-077] sur une halte, « Aide » est le DERNIER arrêt", async ({ page }) => {
    // La porte de secours ne cède sa place à rien, et rien ne se glisse après elle — c'est écrit
    // dans l'en-tête de `render/PiedHalte.tsx`, et ça n'avait jamais été vérifié en traversant.
    // Quelqu'un qui ne va pas bien et qui cherche au clavier finit toujours par la trouver.
    await ouvrirUnCompteNeuf(page);

    const fautifs: string[] = [];
    for (const chemin of ["/memoire", "/reglages", "/mes-donnees", "/abonnement"]) {
      await page.goto(chemin);
      const arrets = await traverser(page);
      const dernier = arrets[arrets.length - 1];
      if (!/aide/i.test(dernier?.nom ?? "")) {
        fautifs.push(`${chemin} → dernier arrêt : ${dernier?.balise}[${dernier?.nom}]`);
      }
    }
    expect(fautifs, `« Aide » n'est plus le dernier arrêt :\n${fautifs.join("\n")}`).toEqual([]);
  });
});
