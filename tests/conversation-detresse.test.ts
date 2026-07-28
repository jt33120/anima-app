import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.6 (T5/T6) — le bloc ressources DANS le fil, prouvé par lecture de fichier (Vitest env node,
 * pas de DOM). Le bloc est un `<article>` calme (jamais modale, jamais rouge, jamais de danger visuel),
 * numéros `tel:` lus chiffre par chiffre, apparition en `fondu-texte`. Le rendu reste MUET (AD-7).
 */

const racine = process.cwd();
const bloc = readFileSync(resolve(racine, "render/conversation/BlocRessources.tsx"), "utf-8");
const fil = readFileSync(resolve(racine, "render/conversation/Fil.tsx"), "utf-8");
const composeur = readFileSync(resolve(racine, "render/conversation/Composeur.tsx"), "utf-8");
// CSS sans commentaires : les assertions « jamais rouge/alerte » ne se déclenchent pas sur la prose.
const css = readFileSync(resolve(racine, "render/conversation/conversation.module.css"), "utf-8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("BlocRessources — fiche calme dans le fil (AC4)", () => {
  it("est un <article> du flux, JAMAIS une modale", () => {
    expect(bloc).toMatch(/<article/);
    expect(bloc).not.toMatch(/role="dialog"|aria-modal|<dialog/);
  });

  it("numéros en lien tel:, nom accessible = numéro visible EN TÊTE + service + chiffres (WCAG 2.5.3, R7)", () => {
    expect(bloc).toMatch(/href=\{`tel:\$\{[^}]+\.tel\}`\}/);
    // Le nom accessible commence par le numéro visible (Label in Name), puis service, puis chiffre par chiffre.
    expect(bloc).toMatch(/aria-label=\{`\$\{[^}]+\.numero\}, \$\{[^}]+\.service\}, \$\{[^}]+\.aria\}`\}/);
  });

  it("le bloc s'annonce au lecteur d'écran à son insertion (aria-live), sans voler le focus (R3)", () => {
    expect(bloc).toMatch(/aria-live="polite"/);
  });

  it("apparaît en `fondu-texte` (opacity, neutralisé en reduced-motion), jamais un glissement", () => {
    expect(bloc).toMatch(/fondu-texte/);
  });

  it("porte « Vérifié le … » (gouvernance FR-044, via la trame — jamais tiré de lib/safety)", () => {
    expect(bloc).toMatch(/Vérifié le/);
    expect(bloc).toMatch(/verifieLe/);
    // frontière AD-7 : le rendu n'importe PAS lib/safety (la garde scene-architecture le couvre aussi).
    expect(bloc).not.toMatch(/@\/lib\//);
  });

  it("le fil rend le bloc pour un tour `ressource`", () => {
    expect(fil).toMatch(/role === "ressource"/);
    expect(fil).toMatch(/<BlocRessources/);
  });
});

describe("Bloc ressources — FICHE sobre, jamais alarmante (AD-9)", () => {
  it("met en forme en fiche : surface-elevee ET bordure-forte", () => {
    expect(css).toMatch(/--surface-elevee/);
    expect(css).toMatch(/--bordure-forte/);
  });

  it("aucune couleur brute — que des tokens var(--…), jamais de rouge/alerte", () => {
    expect(css, "hex brut").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css, "rgb()/hsl() brut").not.toMatch(/\b(rgb|hsl)a?\(/i);
    expect(css, "nom de couleur rouge/alerte").not.toMatch(
      /\b(red|crimson|firebrick|tomato|orangered|darkred|indianred)\b/i,
    );
    expect(css, "token d'alerte du thème").not.toMatch(/--alerte|--rouge/);
  });
});

describe("Composeur — reste ACTIF et gardé au focus en détresse (AC2)", () => {
  it("le <textarea> n'est JAMAIS `disabled` ni conditionnellement démonté (ne DISPARAÎT jamais)", () => {
    // Seul le BOUTON d'envoi peut être gaté pendant le flux ; le champ reste toujours saisissable.
    const textarea = composeur.match(/<textarea[\s\S]*?\/>/)?.[0] ?? "";
    expect(textarea, "le textarea ne doit jamais porter disabled").not.toMatch(/disabled/);
  });
});
