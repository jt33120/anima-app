import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { dimensionnerTout } from "./_outils";
import ArbreInteractif from "@/render/arbre/ArbreInteractif";
import type { ProjectionScene } from "@/lib/scene/projection";

/**
 * geste-propre.test.tsx — UNE COUCHE QUI A SON PROPRE GESTE DOIT LE DÉCLARER
 *
 * ══ CE QUI EST EN JEU ═════════════════════════════════════════════════════════════════════════
 *
 * La scène lit désormais le glissement latéral du doigt pour passer d'une région à l'autre
 * (QA manuelle du 2026-08-19 : « j'aimerais pouvoir swiper entre les trois écrans »). Le canevas
 * de l'arbre, lui, lit le MÊME mouvement horizontal depuis la story 4.6 — c'est son pan. Deux
 * lecteurs pour un seul doigt : sans arbitrage, cadrer une branche change de région.
 *
 * L'arbitrage tient en un attribut, `data-sans-glissement`, que la scène cherche sur toute la
 * chaîne d'ancêtres du point de contact. Il n'a d'effet que s'il est posé au BON endroit, et rien
 * dans le typage ne l'impose : un attribut absent ne casse aucune compilation, ne rougit aucun
 * test de rendu, et ne se voit qu'au doigt, sur un arbre qui a des branches.
 *
 * ⚠️ ET CETTE GARDE-CI NE PEUT PAS VIVRE DANS `e2e/`. Un compte neuf a un arbre VIDE : le canevas
 * n'est même pas monté, donc un parcours de bout en bout mesurerait l'absence d'un élément absent
 * et passerait au vert pour la mauvaise raison. Il faut une projection AVEC branche — c'est-à-dire
 * exactement ce que le projet `rendu` sait fabriquer.
 */

const AVEC_BRANCHE: ProjectionScene = {
  tronc: { present: true },
  branches: [{ id: "b1", nom: "Une branche", etat: "ouverte", verbatim: null }],
} as unknown as ProjectionScene;

function monter() {
  dimensionnerTout(800, 800);
  return render(
    <ArbreInteractif
      projection={AVEC_BRANCHE}
      camera={{ pan: { x: 0, y: 0 }, zoom: 1 }}
      brancheSelectionnee={null}
      onCadrer={vi.fn()}
      onOuvrirFiche={vi.fn()}
      onFermerFiche={vi.fn()}
      onVoirDansConversation={vi.fn()}
      onRenommer={vi.fn(async () => true)}
      onDeclarerRayonnement={vi.fn(async () => "ok" as const)}
    />,
  );
}

describe("[QA 2026-08-19] le canevas de l'arbre garde son geste", () => {
  it("la couche qui capte le pointeur porte `data-sans-glissement`", () => {
    const { container } = monter();
    // On part du CAPTEUR RÉEL, pas d'un nom de classe : l'élément qui écoute `pointerdown` est
    // celui que la scène doit apprendre à ne pas lire. Le chercher par sa classe reviendrait à
    // vérifier qu'une chaîne de caractères existe.
    const capteur = container.querySelector('[role="group"][aria-label]');
    expect(capteur, "témoin : le canevas n'est pas monté, la mesure ne prouverait rien").not.toBeNull();
    expect(
      capteur!.hasAttribute("data-sans-glissement"),
      "le canevas lit le glissement horizontal comme un pan : sans cet attribut, cadrer une " +
        "branche fait changer de région",
    ).toBe(true);
  });
});

describe("[QA 2026-08-19] aucune autre couche ne capte le doigt en silence", () => {
  it("tout `touch-action: none` de `render/` est adossé à un `data-sans-glissement`", () => {
    // ⚠️ C'EST LA GARDE QUI SURVIT À L'AJOUT D'UNE COUCHE. Celle du dessus protège le canevas
    // d'aujourd'hui ; celle-ci dit la RÈGLE : `touch-action: none` signifie « ce que fait le doigt
    // ici me regarde », et la scène doit l'apprendre au même endroit. Une nouvelle surface
    // gestuelle ajoutée demain sans l'attribut rougit ici, et pas seulement au doigt de quelqu'un.
    const racine = process.cwd();
    const feuilles: string[] = [];
    const parcourir = (d: string) => {
      for (const e of readdirSync(resolve(racine, d))) {
        const c = join(d, e);
        if (statSync(resolve(racine, c)).isDirectory()) parcourir(c);
        else if (e.endsWith(".module.css")) feuilles.push(c);
      }
    };
    parcourir("render");
    expect(feuilles.length, "témoin : aucune feuille trouvée").toBeGreaterThan(3);

    const classes: string[] = [];
    for (const f of feuilles) {
      // ⚠️ LES COMMENTAIRES D'ABORD, ET CETTE GARDE A COMMENCÉ PAR L'OUBLIER. Sa première version
      // a dénoncé `.ficheCouche`, qui déclare `touch-action: pan-y` — mais dont le commentaire
      // CITE `touch-action: none` en expliquant le canevas voisin. Une garde qui lit du texte au
      // lieu de lire une règle accuse la prose ; c'est le défaut qu'elle prétend chercher.
      const css = readFileSync(resolve(racine, f), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of css.matchAll(/\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g)) {
        if (/touch-action:\s*none/.test(m[2])) classes.push(m[1]);
      }
    }
    expect(classes, "témoin : plus aucune couche ne déclare `touch-action: none`").not.toEqual([]);

    const sources: string[] = [];
    const parcourirTsx = (d: string) => {
      for (const e of readdirSync(resolve(racine, d))) {
        const c = join(d, e);
        if (statSync(resolve(racine, c)).isDirectory()) parcourirTsx(c);
        else if (e.endsWith(".tsx")) sources.push(readFileSync(resolve(racine, c), "utf-8"));
      }
    };
    parcourirTsx("render");
    const tout = sources.join("\n");

    const orphelines = classes.filter((cl) => {
      // L'élément JSX qui porte `s.<classe>` doit porter `data-sans-glissement` dans le même
      // élément — on borne au `>` qui ferme la balise ouvrante.
      const i = tout.indexOf(`s.${cl}`);
      if (i < 0) return false; // classe morte : ce n'est pas le sujet de cette garde
      const debut = tout.lastIndexOf("<", i);
      const fin = tout.indexOf(">", i);
      return !tout.slice(debut, fin).includes("data-sans-glissement");
    });
    expect(
      orphelines,
      `couches gestuelles que la scène ne sait pas éviter : ${orphelines.join(", ")}`,
    ).toEqual([]);
  });
});
