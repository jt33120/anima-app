import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 1.7 — accessibilité de la scène (AC3/AC4), gardée par lecture du CSS et du composant
 * de rendu. Verrouille en particulier le FIX du bug du prototype : sous prefers-reduced-motion,
 * le changement de région est instantané (transition de région neutralisée), et la parallaxe
 * au pointeur a bien été retirée.
 */

const racine = process.cwd();

/** Retire /* *​/ et // (sans toucher aux :// des URLs) : les gardes testent le CODE,
 *  pas la prose (un commentaire « parallaxe retirée » ne doit pas faire échouer la garde). */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const css = sansCommentaires(readFileSync(resolve(racine, "render/monde.module.css"), "utf-8"));
const scene = sansCommentaires(readFileSync(resolve(racine, "render/scene-dom.tsx"), "utf-8"));

describe("Fondu de région + reduced-motion (AC1/AC4)", () => {
  it("la région se relie en FONDU (transition d'opacité sur --duree-longue)", () => {
    expect(css).toMatch(/\.region\b[\s\S]*?transition:[\s\S]*?opacity/);
    expect(css).toMatch(/--duree-longue/);
  });

  it("un bloc @media (prefers-reduced-motion: reduce) existe dans le rendu", () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  });

  it("sous reduced-motion, le changement de région est INSTANTANÉ (transition région = none)", () => {
    // Le bug du prototype : la transition d'opacité de région n'était pas neutralisée.
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\.region[\s\S]*?transition:\s*none/,
    );
  });

  it("aucune parallaxe résiduelle (retirée — différée hors modèle, SPINE L272)", () => {
    expect(css).not.toMatch(/parallax/i);
    expect(scene).not.toMatch(/parallax/i);
    expect(scene).not.toMatch(/mousemove/);
  });
});

describe("Doublage non-spatial + focus (AC3)", () => {
  it("une navigation NOMMÉE (<nav aria-label>) tirée du modèle expose des liens", () => {
    expect(scene).toMatch(/<nav[^>]*aria-label=/);
    expect(scene).toMatch(/REGIONS\.map/);
  });

  it("les régions inactives sont retirées du focus et du lecteur (aria-hidden + inert)", () => {
    expect(scene).toMatch(/aria-hidden=/);
    expect(scene).toMatch(/\binert\b/);
  });

  it("le focus est déplacé vers l'entête de la région activée", () => {
    expect(scene).toMatch(/\.focus\(\)/);
  });

  it("l'anneau de focus est visible partout et JAMAIS supprimé (outline présent, aucun outline: none)", () => {
    expect(css).toMatch(/outline:\s*2px/);
    expect(css).not.toMatch(/outline:\s*none/);
  });

  it("aucune ombre portée de texte (le voile porte la lisibilité — AC5)", () => {
    expect(css).not.toMatch(/text-shadow\s*:/);
  });
});
