import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import ArbreInteractif from "@/render/arbre/ArbreInteractif";
import { ARIA_CANEVAS } from "@/render/arbre/copie-arbre";
import type { BrancheProjetee, ProjectionScene } from "@/lib/scene";
import { dimensionnerTout, notifierRedimensionnement, abonnementsVivants } from "./_outils";

/**
 * Story 4.6 — LA MESURE DU CARRÉ EFFECTIF, montée pour de vrai (jsdom).
 *
 * Pourquoi ce fichier existe : la RE-REVUE a trouvé que l'arbre était INVISIBLE dans le scénario
 * NOMINAL de la story (nouvelle utilisatrice → 0 branche → elle nomme la première), et qu'aucune
 * garde ne virait au rouge. La garde d'alors, `tests/arbre-rendu.test.ts`, n'assertait que la
 * PRÉSENCE des chaînes « ResizeObserver » et « width: boite.cote » dans la source : elle prouvait
 * le CÂBLAGE, jamais l'EXÉCUTION. Le seul moyen de prouver qu'un arbre est visible est de le monter.
 *
 * L'invariant tenu ici : dès que le canevas est à l'écran, il est MESURÉ — quel que soit le chemin
 * par lequel il est arrivé (montage direct, apparition après la première branche, reprise de panne).
 */

const CONTENEUR = { largeur: 800, hauteur: 600 };
/** Le canevas est carré et centré : côté = min(800, 600) = 600, marge gauche = (800 − 600) / 2 = 100. */
const COTE_ATTENDU = 600;
const GAUCHE_ATTENDU = 100;

const branche = (id: string): BrancheProjetee => ({
  id,
  etat: "naissance",
  intensite: 0,
  extraitSourceId: `extrait-${id}`,
  nom: `branche ${id}`,
});

const scene = (branches: readonly BrancheProjetee[], indisponible?: true): ProjectionScene =>
  indisponible ? { tronc: { present: true }, branches, indisponible } : { tronc: { present: true }, branches };

function proprietes(projection: ProjectionScene) {
  return {
    projection,
    camera: { pan: { x: 0, y: 0 }, zoom: 1 },
    brancheSelectionnee: null,
    onCadrer: vi.fn(),
    onOuvrirFiche: vi.fn(),
    onFermerFiche: vi.fn(),
    onVoirDansConversation: vi.fn(),
    onRenommer: vi.fn(async () => true),
  };
}

/** Le `.monde` est le parent direct du SVG : on le trouve par le rôle, jamais par un nom de classe
 *  (les classes de CSS Modules sont hachées à la compilation — s'y accrocher rendrait la garde fragile). */
function monde(): HTMLElement {
  const svg = screen.getByRole("img", { name: ARIA_CANEVAS });
  const parent = svg.parentElement;
  if (!parent) throw new Error("le SVG de l'arbre n'a pas de parent `.monde`");
  return parent;
}

describe("[HAUTE / re-revue] le canevas de l'arbre est MESURÉ dès qu'il est à l'écran", () => {
  it("TÉMOIN — monté directement avec une branche, le monde prend le carré effectif", () => {
    dimensionnerTout(CONTENEUR.largeur, CONTENEUR.hauteur);
    render(<ArbreInteractif {...proprietes(scene([branche("a")]))} />);

    const m = monde();
    expect(m.style.width).toBe(`${COTE_ATTENDU}px`);
    expect(m.style.height).toBe(`${COTE_ATTENDU}px`);
    expect(m.style.left).toBe(`${GAUCHE_ATTENDU}px`);
  });

  it("SCÉNARIO NOMINAL — arbre vide puis PREMIÈRE branche : le canevas apparaît et DOIT être mesuré", () => {
    dimensionnerTout(CONTENEUR.largeur, CONTENEUR.hauteur);
    // Elle arrive sans branche : le canevas n'est pas rendu du tout (écran « Rien n'a encore été nommé »).
    const { rerender } = render(<ArbreInteractif {...proprietes(scene([]))} />);
    expect(screen.queryByRole("img", { name: ARIA_CANEVAS })).toBeNull();

    // Story 4.5 : elle nomme sa première branche. `router.refresh()` sert une NOUVELLE projection
    // au composant DÉJÀ MONTÉ (la région arbre n'est pas remontée) → le canevas apparaît.
    rerender(<ArbreInteractif {...proprietes(scene([branche("a")]))} />);

    const m = monde();
    expect(m.style.width, "un monde de 0px = un arbre INVISIBLE au scénario nominal").toBe(`${COTE_ATTENDU}px`);
    expect(m.style.height).toBe(`${COTE_ATTENDU}px`);
    expect(m.style.left).toBe(`${GAUCHE_ATTENDU}px`);
  });

  it("REPRISE DE PANNE — `indisponible` puis lecture réussie : le canevas apparaît et DOIT être mesuré", () => {
    dimensionnerTout(CONTENEUR.largeur, CONTENEUR.hauteur);
    const { rerender } = render(<ArbreInteractif {...proprietes(scene([], true))} />);
    expect(screen.queryByRole("img", { name: ARIA_CANEVAS })).toBeNull();

    rerender(<ArbreInteractif {...proprietes(scene([branche("a")]))} />);
    expect(monde().style.width).toBe(`${COTE_ATTENDU}px`);
  });

  it("le monde SUIT le redimensionnement de la fenêtre (l'abonnement n'est pas décoratif)", () => {
    dimensionnerTout(CONTENEUR.largeur, CONTENEUR.hauteur);
    render(<ArbreInteractif {...proprietes(scene([branche("a")]))} />);
    expect(monde().style.width).toBe(`${COTE_ATTENDU}px`);

    // La fenêtre rétrécit (rotation, clavier virtuel, fenêtre redimensionnée). La notification vient
    // du navigateur, hors du cycle de React : `act` force la purge de la mise à jour qu'elle déclenche.
    dimensionnerTout(400, 300);
    act(() => notifierRedimensionnement());
    expect(monde().style.width, "le composant doit RÉAGIR à la notification, pas seulement s'y abonner").toBe("300px");
  });

  it("l'abonnement au redimensionnement est LIBÉRÉ au démontage (aucune fuite d'écouteur)", () => {
    dimensionnerTout(CONTENEUR.largeur, CONTENEUR.hauteur);
    const { unmount } = render(<ArbreInteractif {...proprietes(scene([branche("a")]))} />);
    expect(abonnementsVivants()).toBeGreaterThan(0);
    unmount();
    expect(abonnementsVivants()).toBe(0);
  });
});
