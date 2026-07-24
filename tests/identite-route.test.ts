import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 1.7 — identité discrète des routes (AC7, NFR-015). Le <title> vaut « Anam »
 * partout ; le favicon est un fragment abstrait tronc/branche (aucun symbole ésotérique) ;
 * l'og reste neutre. La garde interdit la réintroduction d'un titre parlant sur une route.
 */

const racine = process.cwd();
const layout = readFileSync(resolve(racine, "app/layout.tsx"), "utf-8");

// Tous les page.tsx sous app/ (Node 22 : readdirSync récursif).
const pages = (readdirSync(resolve(racine, "app"), { recursive: true, encoding: "utf-8" }) as string[])
  .filter((f) => f.endsWith("page.tsx"))
  .map((f) => resolve(racine, "app", f));

describe("Titre — « Anam » sur toutes les routes (AC7)", () => {
  it("le layout centralise title.default = « Anam » ET title.template = « Anam »", () => {
    expect(layout).toMatch(/default:\s*["']Anam["']/);
    expect(layout).toMatch(/template:\s*["']Anam["']/);
  });

  it("au moins une route a été scannée (le glob fonctionne)", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("aucune page ne déclare un title autre que « Anam »", () => {
    for (const p of pages) {
      const src = readFileSync(p, "utf-8");
      const titres = [...src.matchAll(/title:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
      for (const t of titres) {
        expect(t, `title parlant dans ${p}`).toBe("Anam");
      }
    }
  });

  it("aucune page (ni le layout) n'emploie title.absolute (contournement de la centralisation)", () => {
    for (const p of pages) {
      expect(readFileSync(p, "utf-8"), `title.absolute dans ${p}`).not.toMatch(/absolute:/);
    }
    expect(layout).not.toMatch(/absolute:/);
  });
});

describe("Favicon — fragment abstrait tronc/branche (AC7)", () => {
  const cheminIcone = resolve(racine, "app/icon.svg");

  it("app/icon.svg existe", () => {
    expect(existsSync(cheminIcone)).toBe(true);
  });

  it("n'emploie AUCUN symbole interdit (lune, étoile, lotus, œil, main, visage, chiffre…)", () => {
    const svg = readFileSync(cheminIcone, "utf-8").toLowerCase();
    const interdits = [
      "lune", "moon", "étoile", "etoile", "star", "lotus", "constellation",
      "croissant", "soleil", "roue", "wheel", "œil", "oeil", "visage", "tarot",
    ];
    for (const mot of interdits) {
      expect(svg, `symbole interdit « ${mot} » dans le favicon`).not.toContain(mot);
    }
  });
});

describe("Open Graph / description — neutres et impersonnels (AC7 / NFR-015)", () => {
  it("og:title = « Anam »", () => {
    expect(layout).toMatch(/openGraph:\s*\{[\s\S]*?title:\s*["']Anam["']/);
  });

  it("la valeur des descriptions ne trahit ni l'intimité ni l'ésotérisme", () => {
    const descriptions = [...layout.matchAll(/description:\s*["'`]([^"'`]+)["'`]/g)].map((m) =>
      m[1].toLowerCase(),
    );
    expect(descriptions.length).toBeGreaterThan(0);
    const interdits = [
      "horoscope", "astro", "tarot", "ennéagramme", "enneagramme", "médium",
      "voyance", "spiritu", "ésotér", "esoter", "introspection", "âme",
    ];
    for (const d of descriptions) {
      for (const mot of interdits) {
        expect(d, `terme révélateur « ${mot} » dans une description`).not.toContain(mot);
      }
    }
  });
});
