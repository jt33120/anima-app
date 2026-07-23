import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * GARDE DE PRÉSENCE des hooks d'accessibilité (AC5 / AC6) — empêche la régression
 * silencieuse : si quelqu'un supprime un de ces mécanismes, la CI le voit.
 */

const css = readFileSync(resolve(process.cwd(), "app/styles/globals.css"), "utf-8");

describe("Hooks d'accessibilité présents", () => {
  it("prefers-reduced-motion: reduce neutralise le mouvement (AC6)", () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  });

  it("prefers-contrast: more déclenche le mode accessibilité (AC5)", () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-contrast:\s*more\s*\)/);
  });

  it('attribut data-a11y="contraste" comme déclencheur manuel (AC5)', () => {
    expect(css).toMatch(/:root\[data-a11y="contraste"\]/);
  });

  it("aucune bascule vers un thème jour de confort (prefers-color-scheme: light)", () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*light/);
  });
});
