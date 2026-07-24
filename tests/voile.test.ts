import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { voile, couleursNuit } from "@/app/styles/tokens";
import { ratioContraste } from "@/app/styles/contraste";

/**
 * Story 1.7 — le VOILE de lisibilité (AC5), corrigé après revue. Le test ne valide plus
 * des CONSTANTES décorrélées du rendu : il vérifie que `.voile-seuil` CONSOMME réellement
 * les tokens et que la densité peinte derrière le texte garantit WCAG AA (composition pire
 * cas = image blanche). Il casse si l'on allège le voile OU si l'on cesse d'utiliser le token.
 */

const css = readFileSync(resolve(process.cwd(), "app/styles/globals.css"), "utf-8");

/** Isole le corps de la règle `.voile-seuil { … }`. */
function blocVoile(): string {
  const m = /\.voile-seuil\s*\{([\s\S]*?)\}/.exec(css);
  if (!m) throw new Error(".voile-seuil introuvable dans globals.css");
  return m[1];
}

/** Composite un premier plan (avec alpha) sur un fond opaque → hex #RRGGBB. */
function composer(fgHex: string, alpha: number, bgHex: string): string {
  const canaux = (h: string) => {
    const n = parseInt(h.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [fr, fg, fb] = canaux(fgHex);
  const [br, bg, bb] = canaux(bgHex);
  const mix = (f: number, b: number) => Math.round(alpha * f + (1 - alpha) * b);
  const hh = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hh(mix(fr, br))}${hh(mix(fg, bg))}${hh(mix(fb, bb))}`;
}

describe("Voile de lisibilité — token vivant + garantie sur ce qui est PEINT (AC5)", () => {
  it("l'opacité du voile est la source de vérité dans tokens.ts", () => {
    expect(voile.opaciteTexteCourant).toBe(0.85);
  });

  it("globals.css reflète les tokens (parité) : couleur = fond, opacité présente", () => {
    expect(css).toMatch(/--voile-opacite-texte-courant:\s*0?\.85\b/);
    expect(css).toMatch(/--voile-couleur:\s*var\(--fond\)/);
  });

  it(".voile-seuil CONSOMME réellement les deux tokens (plus de variable morte)", () => {
    const bloc = blocVoile();
    expect(bloc).toMatch(/var\(--voile-couleur\)/);
    expect(bloc).toMatch(/var\(--voile-opacite-texte-courant\)/);
  });

  it(".voile-seuil ne se dissout QUE dans le padding haut → le texte reste sur la bande dense", () => {
    expect(blocVoile()).toMatch(/calc\(100%\s*-\s*var\(--esp-7\)\)/);
  });

  it("n'emploie JAMAIS la propriété text-shadow comme substitut", () => {
    expect(css).not.toMatch(/text-shadow\s*:/);
  });

  it("la densité peinte (85 %) garantit AA (≥ 4,5:1) même sur l'image la plus claire (blanc)", () => {
    // .voile-seuil peint --fond composité à opaciteTexteCourant : c'est EXACTEMENT ce calcul.
    const sousVoile = composer(couleursNuit.fond, voile.opaciteTexteCourant, "#FFFFFF");
    expect(ratioContraste(sousVoile, couleursNuit.texte)).toBeGreaterThanOrEqual(4.5);
  });
});
