import { test, expect, type Page } from "@playwright/test";
import { ouvrirUnCompteNeuf, passerLeTour } from "./_entrer";

/**
 * glissement.spec.ts — LE DOIGT MÈNE (QA manuelle du 2026-08-19)
 *
 * « J'aimerais pouvoir swiper entre les trois écrans, une dynamique d'appli quoi. »
 *
 * ══ CE QUI SE MESURE ICI, ET CE QUI NE PEUT PAS S'Y MESURER ═══════════════════════════════════
 *
 * Les gestes sont SYNTHÉTISÉS (`PointerEvent` de type `touch`, envoyés sur l'élément réellement
 * sous le point de contact). Ils traversent les vrais gestionnaires, la vraie cascade et les
 * vraies transformations : ce qu'on lit ci-dessous est ce que le navigateur a calculé, pas ce que
 * le code prétend faire.
 *
 * ⚠️ CE QU'ILS NE PROUVENT PAS : l'arbitrage NATIF entre défilement vertical et glissement
 * latéral. Il ne se joue pas en JavaScript mais dans `touch-action`, que le navigateur consulte
 * avant d'émettre quoi que ce soit. Un événement synthétique contourne cette décision par
 * construction. C'est pourquoi `touch-action` est mesuré séparément, sur le style CALCULÉ — deux
 * gardes pour un seul geste, parce qu'il a deux moitiés et qu'aucun outil ne voit les deux.
 */

/**
 * Un doigt, du vrai type `touch`, sur l'élément réellement sous le point de départ.
 *
 * ⚠️ IL SUIT UN CHEMIN, PAS UN VECTEUR, ET C'EST UN MUTANT QUI L'A EXIGÉ. Une trajectoire droite
 * garde le même rapport dx/dy à chaque trame : elle ne peut donc pas mettre à l'épreuve un verrou
 * d'axe, puisque le verrou et l'absence de verrou décident la même chose à tous les instants. Le
 * geste qui compte a un COUDE — on défile, puis le pouce dérive de côté en se levant.
 */
async function doigt(
  page: Page,
  depart: { x: number; y: number },
  chemin: readonly { x: number; y: number }[],
  options: { lacher?: boolean } = {},
) {
  await page.evaluate(
    async ({ depart, chemin, lacher }) => {
      // ⚠️ UNE TRAME ENTRE CHAQUE MOUVEMENT, ET CE N'EST PAS DU CONFORT. Envoyés d'affilée dans la
      // même tâche, les événements sont bien reçus — mais le navigateur ne PEINT jamais les états
      // intermédiaires. Une transition démarrée après coup part alors de la dernière valeur peinte,
      // c'est-à-dire de zéro : la garde de trajectoire mesurait un mouvement que personne n'aurait
      // jamais vu, et accusait le produit d'un décollement qui n'existait que dans la mesure.
      const trame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      const cible = document.elementFromPoint(depart.x, depart.y) ?? document.body;
      const ev = (type: string, x: number, y: number) =>
        cible.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            clientX: x,
            clientY: y,
          }),
        );
      ev("pointerdown", depart.x, depart.y);
      let de = { x: 0, y: 0 };
      for (const vers of chemin) {
        for (let i = 1; i <= 8; i++) {
          ev(
            "pointermove",
            depart.x + de.x + ((vers.x - de.x) * i) / 8,
            depart.y + de.y + ((vers.y - de.y) * i) / 8,
          );
          await trame();
        }
        de = vers;
      }
      if (lacher !== false) ev("pointerup", depart.x + de.x, depart.y + de.y);
    },
    { depart, chemin, lacher: options.lacher },
  );
}

/** Le nom de la région active — celle qui n'est pas `inert`. */
const regionActive = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("section[aria-label]")]
        .filter((s) => !s.hasAttribute("inert"))
        .map((s) => s.getAttribute("aria-label"))
        .join(",") || "(aucune)",
  );

/** Ce que le navigateur peint pour chaque région VISIBLE : position et opacité. */
const panneauxVisibles = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("section[aria-label]")]
      .map((s) => {
        const cs = getComputedStyle(s);
        return {
          nom: s.getAttribute("aria-label")!,
          x: Math.round(new DOMMatrix(cs.transform).m41),
          opacite: Number(cs.opacity),
          visible: cs.visibility === "visible",
        };
      })
      .filter((r) => r.visible && r.opacite > 0.01),
  );

async function dansLeMonde(page: Page) {
  await ouvrirUnCompteNeuf(page);
  await page.goto("/");
  await page.getByRole("button", { name: /entrer dans le monde/i }).click();
  await passerLeTour(page);
  await expect(page.getByRole("heading", { name: /^Accueil$/, level: 1 })).toBeVisible();
  await page.waitForTimeout(1200);
}

test.describe("Le glissement entre régions", () => {
  test("[LE DOIGT MÈNE] à mi-course, les deux régions sont CÔTE À CÔTE et pleinement opaques", async ({
    page,
  }) => {
    // ⚠️ C'EST LA PROPRIÉTÉ QUI DISTINGUE UN GLISSEMENT D'UN BOUTON DÉGUISÉ. Un geste qui se
    // contente de DÉCLENCHER une transition à la fin laisse l'écran immobile pendant tout le
    // mouvement : la mesure ci-dessous serait alors « une seule région, à x = 0 ». Et la seconde
    // moitié — les deux à opacité 1 — interdit de « suivre le doigt » avec un fondu croisé, qui
    // remettrait deux textes lisibles l'un à travers l'autre.
    await dansLeMonde(page);
    const largeur = page.viewportSize()!.width;

    await doigt(page, { x: largeur * 0.75, y: 400 }, [{ x: -120, y: 0 }], { lacher: false });
    const pendant = await panneauxVisibles(page);

    expect(
      pendant.map((p) => p.nom).sort(),
      `régions peintes à mi-course : ${JSON.stringify(pendant)}`,
    ).toEqual(["Accueil", "Anam"]);
    const accueil = pendant.find((p) => p.nom === "Accueil")!;
    const anam = pendant.find((p) => p.nom === "Anam")!;
    expect(accueil.x, "la région courante ne suit pas le doigt").toBe(-120);
    expect(anam.x, "la voisine n'arrive pas collée à elle").toBe(largeur - 120);
    expect(Math.min(accueil.opacite, anam.opacite), "un fondu croisé s'est glissé dans le geste").toBe(1);
  });

  test("[FRANCHIR OU REVENIR] la course décide, pas l'intention", async ({ page }) => {
    await dansLeMonde(page);

    await doigt(page, { x: 300, y: 400 }, [{ x: -160, y: 0 }]);
    await page.waitForTimeout(700);
    expect(await regionActive(page), "un geste franc n'a pas changé de région").toBe("Anam");

    await doigt(page, { x: 300, y: 400 }, [{ x: 160, y: 0 }]);
    await page.waitForTimeout(700);
    expect(await regionActive(page), "on ne revient pas en arrière").toBe("Accueil");

    // Trop court : le monde revient exactement d'où il vient.
    await doigt(page, { x: 300, y: 400 }, [{ x: -30, y: 0 }]);
    await page.waitForTimeout(700);
    expect(await regionActive(page), "un frôlement de 30 px suffit à changer d'écran").toBe("Accueil");
    expect(
      (await panneauxVisibles(page)).map((p) => p.x),
      "le panneau n'est pas revenu à sa place après un geste avorté",
    ).toEqual([0]);
  });

  test("[LA FIN DU GESTE] les deux panneaux restent COLLÉS jusqu'au bout", async ({ page }) => {
    // ⚠️ CE QUI SE MESURE ICI EST UN TRAJET, PAS UNE DESTINATION — et c'est un mutant survivant qui
    // l'a exigé. Calculer les positions sur la région COURANTE plutôt que sur celle d'où l'on part
    // laisse arriver au bon endroit : la bascule d'état a lieu AU RELÂCHEMENT, donc à la fin tout
    // est en place et la garde de destination reste verte. Entre les deux, pendant les 280 ms de
    // l'animation, les deux panneaux sautent d'une largeur d'écran — un à-coup que personne ne peut
    // décrire après coup, et que rien ne mesurait.
    //
    // L'invariant tient en une phrase : pendant tout le mouvement, les deux panneaux sont exactement
    // à UNE LARGEUR D'ÉCRAN l'un de l'autre. C'est vrai au doigt, c'est vrai pendant la fin, et
    // c'est faux à la première désynchronisation, quelle qu'en soit la cause.
    await dansLeMonde(page);
    const largeur = page.viewportSize()!.width;

    /* ⚠️ ON ENREGISTRE CHAQUE TRAME, ON N'ÉCHANTILLONNE PAS. Un sondage tous les 40 ms rate par
       construction les défauts de deux trames — et il en existe un ici : si les positions se
       calculaient sur la région COURANTE plutôt que sur celle d'où l'on part, le panneau arrivé
       repartirait hors écran pendant les deux trames qui séparent la bascule d'état du nettoyage.
       33 ms de blanc, invisibles à tout sondage, et parfaitement visibles à l'œil qui les attrape. */
    await page.evaluate(() => {
      const w = window as unknown as { __trames: { nom: string; x: number }[][] };
      w.__trames = [];
      const tic = () => {
        w.__trames.push(
          [...document.querySelectorAll("section[aria-label]")]
            .map((s) => {
              const cs = getComputedStyle(s);
              return {
                nom: s.getAttribute("aria-label")!,
                x: Math.round(new DOMMatrix(cs.transform).m41),
                vu: cs.visibility === "visible" && Number(cs.opacity) > 0.01,
              };
            })
            .filter((r) => r.vu)
            .map(({ nom, x }) => ({ nom, x })),
        );
        if (w.__trames.length < 120) requestAnimationFrame(tic);
      };
      requestAnimationFrame(tic);
    });

    await doigt(page, { x: 300, y: 300 }, [{ x: -160, y: 0 }]);
    await page.waitForTimeout(900);
    const trames = await page.evaluate(() => (window as unknown as { __trames: { nom: string; x: number }[][] }).__trames);

    const aDeux = trames.filter((t) => t.length === 2);
    expect(aDeux.length, "témoin : les deux panneaux n'ont jamais été peints ensemble").toBeGreaterThan(4);

    const decolles = aDeux.filter((t) => {
      const tries = [...t].sort((a, b) => a.x - b.x);
      return Math.abs(tries[1].x - tries[0].x - largeur) > 2;
    });
    expect(
      decolles.length,
      `les panneaux se sont décollés sur ${decolles.length} trames (largeur ${largeur}) : ` +
        "l'écran saute au lieu de finir sa course",
    ).toBe(0);

    /* Et le panneau qui ARRIVE ne repart plus une fois posé. C'est la propriété que les deux
       trames de blanc violent, et la seule qu'un enregistrement image par image puisse voir. */
    const arrivee = trames.map((t) => t.find((r) => r.nom === "Anam")?.x).filter((x) => x !== undefined);
    const pose = arrivee.findIndex((x) => Math.abs(x!) <= 1);
    expect(pose, "le panneau d'arrivée n'a jamais atteint sa place").toBeGreaterThanOrEqual(0);
    const repartis = arrivee.slice(pose).filter((x) => Math.abs(x!) > 1);
    expect(
      repartis,
      `après s'être posé, le panneau d'arrivée est reparti à ${repartis.join(", ")} : ` +
        "un clignotement de quelques trames à la toute fin du geste",
    ).toEqual([]);
  });

  test("[UN SEUL AXE] un défilement vertical un peu oblique ne fait pas changer d'écran", async ({
    page,
  }) => {
    // ⚠️ LE VERROU D'AXE SE PROUVE DANS LES DEUX SENS, ET IL A FALLU DEUX MUTANTS SURVIVANTS POUR
    // L'ÉCRIRE. Le premier a survécu à une trajectoire droite : sur une droite, le rapport dx/dy ne
    // change jamais, donc rejuger l'axe ou le verrouiller tranche pareil à tous les instants. Le
    // second a survécu à un geste COUDÉ vertical-puis-horizontal — parce qu'un axe jugé vertical
    // ABANDONNE le geste sur-le-champ, et qu'un geste abandonné ne peut plus être rejugé. Les deux
    // fois, la garde mesurait une propriété qu'elle ne mettait pas à l'épreuve.
    //
    // Ce que le verrou décide vraiment tient en deux phrases, et il faut les deux :
    //   • ce qui commence vertical le reste — on défile les cartes, le pouce dérive de 200 px de
    //     côté en se levant, et l'écran ne change pas ;
    //   • ce qui commence horizontal le reste — on tire l'écran de 160 px, le doigt descend de
    //     300 px avant de se lever, et la page arrive quand même. Sans verrou, ce geste-là est
    //     ANNULÉ : on a tiré l'écran à moitié, on lâche, et il revient sans raison visible.
    await dansLeMonde(page);
    await doigt(
      page,
      { x: 300, y: 300 },
      [
        { x: 0, y: 40 },
        { x: -200, y: 40 },
      ],
      { lacher: false },
    );
    // ⚠️ ON MESURE AVANT LE LÂCHER, ET C'EST UN TROISIÈME MUTANT QUI L'A RÉCLAMÉ. Ne plus ABANDONNER
    // le geste jugé vertical (se contenter d'un `return`) laisse la région suivre le doigt à chaque
    // trame suivante, puis revenir au lâcher : l'écran GLISSE ET REBONDIT pendant qu'on défile,
    // sans jamais changer de région. Une garde qui ne regarde que la région d'arrivée ne voit rien
    // de ce va-et-vient — elle mesure la destination d'un geste dont le défaut est le trajet.
    expect(
      (await panneauxVisibles(page)).map((p) => p.x),
      "l'écran suit le doigt pendant un défilement vertical : il glissera et rebondira au lâcher",
    ).toEqual([0]);
    await page.evaluate(() =>
      (document.elementFromPoint(100, 340) ?? document.body).dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: 100,
          clientY: 340,
        }),
      ),
    );
    await page.waitForTimeout(700);
    expect(
      await regionActive(page),
      "commencé vertical, fini horizontal : un défilement qui dérive a fait changer d'écran",
    ).toBe("Accueil");

    await doigt(page, { x: 300, y: 300 }, [
      { x: -160, y: 0 },
      { x: -160, y: 300 },
    ]);
    await page.waitForTimeout(700);
    expect(
      await regionActive(page),
      "commencé horizontal, fini vertical : le glissement a été annulé par la dérive du doigt",
    ).toBe("Anam");
  });

  test("[UN SEUL AXE, DROIT] un geste franchement vertical ne fait rien non plus", async ({ page }) => {
    await dansLeMonde(page);
    await doigt(page, { x: 300, y: 400 }, [{ x: -70, y: 220 }]);
    await page.waitForTimeout(700);
    expect(await regionActive(page), "un geste vertical a changé de région").toBe("Accueil");
  });

  test("[LE MONDE NE BOUCLE PAS] aux extrémités, il résiste au lieu de sauter", async ({ page }) => {
    await dansLeMonde(page);
    const largeur = page.viewportSize()!.width;

    await doigt(page, { x: 200, y: 400 }, [{ x: 240, y: 0 }], { lacher: false });
    const pendant = await panneauxVisibles(page);
    expect(pendant.map((p) => p.nom), "une région est apparue à gauche de la première").toEqual(["Accueil"]);
    // Il RÉPOND quand même — sans quoi le geste paraît cassé — mais au quart de la course.
    expect(pendant[0].x, "aux extrémités, le geste est mort ou entier").toBe(Math.round(240 * 0.25));

    await doigt(page, { x: 200, y: 400 }, [{ x: 240, y: 0 }]);
    await page.waitForTimeout(700);
    expect(await regionActive(page), "le monde a bouclé").toBe("Accueil");
    expect(largeur).toBeGreaterThan(0);
  });

  test("[LA SOURIS NE GLISSE PAS] la sélection de texte reste possible", async ({ page }) => {
    // Un glissement à la souris avalerait la sélection dans une conversation qu'on veut pouvoir
    // citer. Le geste est réservé au doigt ; la barre reste le chemin de tout le monde.
    await dansLeMonde(page);
    await page.mouse.move(300, 400);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(300 - (160 * i) / 8, 400);
    await page.mouse.up();
    await page.waitForTimeout(700);
    expect(await regionActive(page), "la souris a fait glisser le monde").toBe("Accueil");
  });

  test("[L'AUTRE MOITIÉ] `touch-action: pan-y` laisse le défilement au navigateur", async ({ page }) => {
    // Cette moitié-là ne se prouve pas avec des événements synthétiques : `touch-action` est
    // consulté AVANT que le navigateur n'émette quoi que ce soit. On mesure donc la déclaration
    // telle qu'il l'a CALCULÉE — cascade comprise, ce qu'une lecture de source ne dit pas.
    await dansLeMonde(page);
    const axes = await page.evaluate(() =>
      [...document.querySelectorAll("section[aria-label]")].map((s) => ({
        nom: s.getAttribute("aria-label")!,
        axe: getComputedStyle(s).touchAction,
      })),
    );
    const fautives = axes.filter((a) => a.axe !== "pan-y");
    expect(
      fautives,
      `régions dont l'axe n'est pas rendu au navigateur : ${JSON.stringify(fautives)} — ` +
        "le geste latéral et le défilement vont se disputer le même doigt",
    ).toEqual([]);
  });
});
