import { test, expect, type Page } from "@playwright/test";
import { ouvrirUnCompteNeuf } from "./_entrer";

/**
 * barre-basse.spec.ts — CE QU'ON LIT DANS LA BARRE NE DÉPEND PAS DE CE QUI PASSE DERRIÈRE
 *
 * ══ LE DÉFAUT ═════════════════════════════════════════════════════════════════════════════════
 *
 * Mesuré sur iPhone 14, accueil à mi-défilement : « Anima n'a pas encore écrit cette carte. » se
 * lisait EXACTEMENT par-dessus « Accueil  Anam  L'arbre ». Deux textes de contraste voisin sur la
 * même ligne. Le dégradé de la barre n'est opaque que sur son tiers bas — délibérément, « la scène
 * n'a pas de bord franc » — donc tout ce qui défile la traverse.
 *
 * ══ POURQUOI CETTE GARDE NE PEUT PAS ÊTRE GÉOMÉTRIQUE ═════════════════════════════════════════
 *
 * ⚠️ LA CORRECTION NE DÉPLACE RIEN. Un masque dissout le contenu qui approche la barre : les
 * boîtes se chevauchent toujours, exactement comme avant. Une garde qui compterait les
 * intersections de rectangles serait donc ROUGE après la correction et VERTE si on retirait le
 * masque en gardant les marges — c'est-à-dire l'inverse de ce qu'on veut. Elle mesurerait la mise
 * en page ; le défaut est dans la PEINTURE.
 *
 * On mesure donc des PIXELS, et l'invariant est écrit dans le titre : la bande des libellés est
 * peinte à l'identique selon qu'il y a, ou non, du contenu défilé derrière elle. Si un seul pixel
 * diffère, quelque chose transparaît. C'est conclusif dans les deux sens, et ça ne présume rien du
 * mécanisme employé pour y arriver.
 *
 * ⚠️ LES ÉTOILES SCINTILLENT, ET ELLES RUINERAIENT LA COMPARAISON. `prefers-reduced-motion` les
 * fige (`animation: none; opacity: 0.55`) — sans ça, deux captures du même écran diffèrent déjà.
 */

/**
 * Ce qui, dans la région de l'arbre, est RÉELLEMENT PEINT par-dessus la barre.
 *
 * ⚠️ UN RECTANGLE NE SUFFIT PAS, ET CETTE GARDE A COMMENCÉ PAR LE CROIRE. Sur un écran très court,
 * l'état vide défile à l'intérieur de lui-même : ses derniers paragraphes ont bien un rectangle
 * sous la barre — et ils sont ROGNÉS par leur conteneur, donc personne ne les voit. La première
 * version les dénonçait, c'est-à-dire qu'elle rougissait sur un écran parfaitement correct.
 * On intersecte donc le rectangle avec celui de chaque ancêtre qui rogne, exactement comme le
 * navigateur le fait avant de peindre.
 */
function mesureurDeChevauchement() {
  const nav = document.querySelector("nav[aria-label='Régions']")!.getBoundingClientRect();
  // En ≥ 1024 px la barre devient un rail à GAUCHE : l'axe qui compte n'est plus le même.
  const rail = nav.height > innerHeight * 0.8;
  const fautifs: string[] = [];
  for (const e of document.querySelectorAll('[class*="regionArbre"] button, [class*="regionArbre"] p')) {
    if (!(e.textContent ?? "").trim()) continue;
    const r = e.getBoundingClientRect();
    let haut = r.top, bas = r.bottom, gauche = r.left, droite = r.right;
    for (let n = e.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflow === "visible" && cs.overflowY === "visible" && cs.overflowX === "visible") continue;
      const a = n.getBoundingClientRect();
      haut = Math.max(haut, a.top);
      bas = Math.min(bas, a.bottom);
      gauche = Math.max(gauche, a.left);
      droite = Math.min(droite, a.right);
    }
    if (bas - haut <= 1 || droite - gauche <= 1) continue; // entièrement rogné : rien n'est peint
    const touche = rail
      ? gauche < nav.right - 2 && droite > nav.left + 2
      : bas > nav.top + 2 && haut < nav.bottom - 2;
    if (touche) fautifs.push(`${e.tagName.toLowerCase()} « ${(e.textContent ?? "").trim().slice(0, 30)} »`);
  }
  return fautifs;
}

/** La bande réellement lue : la boîte englobante des liens de la barre, prise dans le DOM. */
async function bandeDesLibelles(page: Page) {
  return page.evaluate(() => {
    const liens = [...document.querySelectorAll("nav[aria-label='Régions'] button")];
    const r = liens.map((e) => e.getBoundingClientRect());
    return {
      x: Math.floor(Math.min(...r.map((b) => b.left))),
      y: Math.floor(Math.min(...r.map((b) => b.top))),
      width: Math.ceil(Math.max(...r.map((b) => b.right)) - Math.min(...r.map((b) => b.left))),
      height: Math.ceil(Math.max(...r.map((b) => b.bottom)) - Math.min(...r.map((b) => b.top))),
    };
  });
}

test.describe("La barre de régions", () => {
  test("[LE CŒUR] ses libellés sont peints à l'identique, quoi qu'on fasse défiler derrière", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");
    await page.getByRole("button", { name: /entrer dans le monde/i }).click();
    await expect(page.getByRole("heading", { name: "Accueil", level: 1 })).toBeVisible();
    await page.waitForTimeout(1200);

    const region = page.locator('[class*="regionActive"]');
    const defilable = await region.evaluate((e) => e.scrollHeight - e.clientHeight);
    expect(defilable, "l'accueil ne défile pas : la mesure ne prouverait rien").toBeGreaterThan(100);

    const bande = await bandeDesLibelles(page);

    // La RÉFÉRENCE : la barre posée sur la scène seule. On retire la région de la peinture sans
    // toucher à la barre (elle en est un frère, pas un enfant).
    await region.evaluate((e) => ((e as HTMLElement).style.visibility = "hidden"));
    await page.waitForTimeout(250);
    const seule = await page.screenshot({ clip: bande });

    await region.evaluate((e) => ((e as HTMLElement).style.visibility = ""));
    await page.waitForTimeout(250);

    // Puis à chaque hauteur de défilement : quelque chose finit toujours par passer là.
    const fautives: number[] = [];
    for (const part of [0.25, 0.5, 0.75, 1]) {
      await region.evaluate((e, p) => {
        e.scrollTop = Math.round((e.scrollHeight - e.clientHeight) * p);
      }, part);
      await page.waitForTimeout(300);
      const avec = await page.screenshot({ clip: bande });
      if (!avec.equals(seule)) fautives.push(part);
    }

    expect(
      fautives,
      `du contenu transparaît derrière les libellés, à ${fautives.map((f) => `${f * 100} %`).join(", ")} du défilement`,
    ).toEqual([]);
  });

  test("[À L'ARRÊT] le masque ne mange RIEN de ce qui se pose", async ({ page }) => {
    // ⚠️ CE TEST EST NÉ D'UN MUTANT SURVIVANT. Le masque dissout ce qui PASSE ; encore faut-il
    // qu'il ne touche pas ce qui S'ARRÊTE. Ramener la réserve du bas de `--hauteur-nav + --esp-6`
    // à `--hauteur-nav` seul fait pâlir les 32 derniers pixels de la dernière carte, à l'arrêt,
    // en bout de défilement — et la garde précédente restait verte, parce qu'elle ne regarde que
    // la bande des libellés. Le défaut aurait été exactement l'inverse de celui qu'on corrigeait :
    // du contenu effacé au lieu de contenu qui transparaît.
    //
    // L'invariant, mesuré en pixels comme l'autre : à plein défilement, la dernière carte est
    // peinte À L'IDENTIQUE avec et sans masque. Si le masque la touche, elle diffère.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");
    await page.getByRole("button", { name: /entrer dans le monde/i }).click();
    await expect(page.getByRole("heading", { name: "Accueil", level: 1 })).toBeVisible();
    await page.waitForTimeout(1200);

    const region = page.locator('[class*="regionActive"]');
    await region.evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    await page.waitForTimeout(400);

    const clip = await page.evaluate(() => {
      const cartes = [...document.querySelectorAll('[class*="regionActive"] article')];
      const r = cartes[cartes.length - 1]?.getBoundingClientRect();
      if (!r) return null;
      return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
    });
    expect(clip, "aucune carte rendue : la mesure ne prouverait rien").not.toBeNull();

    const avec = await page.screenshot({ clip: clip! });
    await region.evaluate((e) => {
      const st = (e as HTMLElement).style as CSSStyleDeclaration & { webkitMaskImage?: string };
      st.maskImage = "none";
      st.webkitMaskImage = "none";
    });
    await page.waitForTimeout(250);
    const sans = await page.screenshot({ clip: clip! });

    expect(
      avec.equals(sans),
      "la dernière carte est altérée par le masque à l'arrêt : la réserve du bas ne suit plus le fondu",
    ).toBe(true);
  });

  test("[L'ARBRE VIDE] le seul bouton de l'écran ne passe pas sous la barre", async ({ page }) => {
    // ⚠️ CELLE-CI EST GÉOMÉTRIQUE, ET C'EST LE BON OUTIL POUR CE DÉFAUT-LÀ — parce qu'il n'est pas
    // le même. « Ton heure de naissance » avait ses 14 px du bas sous la barre EN PERMANENCE, pas
    // au défilement : `.vide` débordait de 54 px en `overflow: visible` par-dessus la réserve de
    // la région, sans que celle-ci enregistre le moindre débordement (`scrollHeight ===
    // clientHeight`). Sa promesse de défilement était intacte et ne servait à rien. Ici c'est bien
    // la MISE EN PAGE qui était fausse, donc c'est elle qu'on mesure.
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");
    await page.getByRole("button", { name: /entrer dans le monde/i }).click();
    await page.getByRole("navigation", { name: "Régions" }).getByRole("button", { name: "L’arbre" }).click();
    await expect(page.getByRole("heading", { name: "L’arbre", level: 1 })).toBeVisible();
    await page.waitForTimeout(1200);

    const chevauche = await page.evaluate(mesureurDeChevauchement);
    expect(chevauche, `sous la barre :\n${chevauche.join("\n")}`).toEqual([]);

    // ⚠️ ET IL TIENT SANS AUCUN GESTE — C'EST UNE PROPRIÉTÉ DISTINCTE, ÉCRITE ICI PARCE QU'UN
    // MUTANT L'A RÉCLAMÉE. Rendre `.vide` compressible suffit à ce que rien ne passe sous la
    // barre : le contenu se met simplement à défiler à l'intérieur de lui-même. Sur un téléphone
    // ordinaire, ça mettrait « Ton heure de naissance » — le SEUL chemin vers la fiche du tronc
    // depuis un arbre vide, donc exactement ce dont on a besoin le premier jour — sous la ligne
    // de flottaison d'un défilement imbriqué que rien n'annonce. C'est ce que le rognage du
    // dessin sur écran court évite, et sans cette mesure-là il n'était prouvé par rien.
    const sansGeste = await page.evaluate(() => {
      const vide = document.querySelector('[class*="_vide"]') as HTMLElement | null;
      return vide ? vide.scrollHeight - vide.clientHeight : -1;
    });
    expect(sansGeste, "l'état vide défile déjà sur un écran ordinaire").toBe(0);
    await expect(
      page.getByRole("button", { name: /heure de naissance/i }),
      "le seul chemin vers la fiche du tronc demande un geste pour être vu",
    ).toBeInViewport();
  });

  test("[L'ARBRE VIDE, ÉCRAN TRÈS COURT] il se compresse au lieu de déborder", async ({ page }) => {
    // ⚠️ CE TEST EST NÉ D'UN MUTANT SURVIVANT, ET LE MUTANT AVAIT RAISON. Deux corrections tenaient
    // ce même écran : le dessin du tronc qui cède sur un écran court, et `.vide` rendu compressible
    // (`min-height: 0` + `overflow-y: auto`). Sur un iPhone 14, la première SUFFIT — donc annuler la
    // seconde ne faisait rougir personne. Deux défenses qui se couvrent l'une l'autre, c'est une
    // défense prouvée et une autre simplement espérée ; le jour où la première bouge, la seconde
    // tombe sans bruit.
    //
    // On descend donc à une hauteur où le dessin rogné ne suffit plus — paysage d'un petit
    // téléphone, ou zoom 200 %, deux situations réelles. Là, seule la compressibilité sauve.
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");
    await page.getByRole("button", { name: /entrer dans le monde/i }).click();
    await page.getByRole("navigation", { name: "Régions" }).getByRole("button", { name: "L’arbre" }).click();
    await expect(page.getByRole("heading", { name: "L’arbre", level: 1 })).toBeVisible();

    const largeur = page.viewportSize()!.width;
    await page.setViewportSize({ width: largeur, height: 460 });
    await page.waitForTimeout(600);

    const fautifs = await page.evaluate(mesureurDeChevauchement);
    const deborde = await page.evaluate(() => {
      const vide = document.querySelector('[class*="_vide"]') as HTMLElement | null;
      return vide ? vide.scrollHeight - vide.clientHeight : 0;
    });
    const etat = { fautifs, deborde };

    // Le TÉMOIN : sans débordement réel, l'absence de chevauchement ne prouverait rien — l'écran
    // tiendrait tout seul et la compressibilité ne serait pas sollicitée.
    expect(etat.deborde, "l'écran n'est pas assez court : rien ne met la compressibilité à l'épreuve").toBeGreaterThan(0);
    expect(etat.fautifs, `sous la barre à 460 px de haut :\n${etat.fautifs.join("\n")}`).toEqual([]);
  });
});
