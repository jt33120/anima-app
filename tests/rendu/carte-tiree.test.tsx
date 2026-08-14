import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CarteTiree from "@/render/lecture/CarteTiree";
import type { CarteTireeVue } from "@/render/lecture/types";
import { CLES_JEU } from "@/lib/tirage/jeu";

/**
 * carte-tiree.test.tsx — LA CARTE TELLE QU'ELLE ATTEINT L'ÉCRAN (Story 5.7, T9 · AC5, AC8).
 *
 * `tirage-frontiere.test.ts` prouve que le SENS ne peut pas franchir la frontière des types. Ce
 * fichier prouve la chose complémentaire, qui n'est pas la même : **ce que le DOM contient vraiment**
 * — le texte alternatif, ce que dit une carte non dessinée, et les chemins par lesquels une
 * signification pourrait paraître sans jamais transiter par un champ (`alt`, `title`, `aria-label`).
 *
 * C'est la raison d'être du projet `rendu` (revue 4.6) : une garde de source reste verte alors que
 * l'écran, lui, ment.
 */

const vue = (o: Partial<CarteTireeVue> = {}): CarteTireeVue => ({
  cle: "porte-entrouverte",
  description: { statut: "non_ecrit" },
  ...o,
});

const DESCRIPTION = "Une porte entrouverte dans un mur de pierre, au crépuscule.";

describe("[AC5] tant que le visuel n'est pas dessiné, la carte le DIT", () => {
  it("l'état réel du produit : aucun visuel, donc l'absence annoncée", () => {
    render(<CarteTiree carte={vue()} />);
    expect(screen.getByText(/n'est pas encore dessiné/)).toBeTruthy();
    // Pas d'image cassée, pas de dos de carte générique : il n'y a AUCUNE balise `img`. Un substitut
    // « en attendant » serait littéralement un visuel non créé pour Anima, à la place d'un visuel
    // d'Anima (FR-022).
    expect(document.querySelector("img")).toBeNull();
  });

  it("l'absence est annoncée au lecteur d'écran, pas laissée en trou silencieux (NFR-016)", () => {
    render(<CarteTiree carte={vue()} />);
    expect(screen.getByRole("img", { name: /n'est pas encore dessiné/ })).toBeTruthy();
  });

  it("un visuel non déclaré NE S'AFFICHE PAS, même si la description est écrite", () => {
    // Le manifeste fait foi. Sans cette règle, une description écrite en avance ferait pointer une
    // balise `img` vers un fichier absent — l'icône d'image cassée du navigateur sur une carte de
    // tirage, c'est-à-dire un accident graphique là où le produit doit dire une vérité.
    render(<CarteTiree carte={vue({ description: { statut: "ecrit", texte: DESCRIPTION } })} />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(/n'est pas encore dessiné/)).toBeTruthy();
  });
});

describe("[AC8] quand le visuel existe, son texte alternatif est la DESCRIPTION", () => {
  it("le visuel déclaré s'affiche, avec la description littérale en `alt`", async () => {
    // On force le manifeste : l'ensemble réel est vide, donc sans ce montage, tout le chemin
    // « visuel dessiné » serait du code jamais exercé — et le mutant qui le casserait survivrait.
    vi.resetModules();
    vi.doMock("@/render/lecture/visuels", async (original) => {
      const reel = await original<typeof import("@/render/lecture/visuels")>();
      return { ...reel, VISUELS_DESSINES: new Set(["porte-entrouverte"]) };
    });
    const { default: CarteAvecVisuel } = await import("@/render/lecture/CarteTiree");

    render(<CarteAvecVisuel carte={vue({ description: { statut: "ecrit", texte: DESCRIPTION } })} />);
    const image = screen.getByRole("img", { name: DESCRIPTION });
    expect(image.getAttribute("src")).toBe("/jeu/porte-entrouverte.webp");
    expect(screen.queryByText(/n'est pas encore dessiné/)).toBeNull();

    vi.doUnmock("@/render/lecture/visuels");
    vi.resetModules();
  });
});

describe("[AC4/AC5] rien de ce qui paraît ne nomme la carte ni ne dit son sens", () => {
  it("le nom de la carte n'apparaît nulle part dans le DOM", () => {
    // L'UX interdit nommément de « nommer la carte avant la réponse ». La clé sert à désigner un
    // fichier ; elle ne doit pas se retrouver en texte, en `title`, ni en `aria-label`.
    render(<CarteTiree carte={vue({ cle: "porte-entrouverte" })} />);
    const html = document.body.innerHTML;
    expect(html).not.toContain("porte-entrouverte");
    expect(html).not.toContain("Porte entrouverte");
  });

  it("aucune des 24 clés ne fuit, quelle que soit la carte", () => {
    // La garde précédente sur une seule carte serait passée par chance si le composant n'affichait
    // que certaines clés. Ici, les 24 sont montées.
    for (const cle of CLES_JEU) {
      const { unmount, container } = render(<CarteTiree carte={vue({ cle })} />);
      expect(container.innerHTML, cle).not.toContain(cle);
      unmount();
    }
  });

  it("aucun `title` ni infobulle — l'UX les interdit nommément", () => {
    render(<CarteTiree carte={vue({ description: { statut: "ecrit", texte: DESCRIPTION } })} />);
    expect(document.querySelector("[title]")).toBeNull();
  });
});

describe("[UX] la carte est déjà là — aucune théâtralisation", () => {
  it("aucun bouton, aucun élément interactif : rien à retourner, rien à mélanger", () => {
    // « Pas de retournement, pas de scintillement, pas de son, pas de mélange animé — la
    // théâtralisation suggérerait une magie que le produit ne revendique pas. »
    render(<CarteTiree carte={vue()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelector("audio, video, canvas")).toBeNull();
  });

  it("une seule carte est rendue, jamais plusieurs", () => {
    // « Ne jamais faire : afficher plusieurs cartes. » Le composant n'a pas de tableau en entrée —
    // cette assertion garde la propriété au niveau du DOM, là où elle se vérifie.
    render(<CarteTiree carte={vue()} />);
    expect(document.querySelectorAll("figure")).toHaveLength(1);
  });
});
