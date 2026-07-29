import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 3.2 (T5) — la carte (`render/conversation/CarteAbonnement.tsx`). Composant client de rendu →
 * gardes de LECTURE DE SOURCE : form POST natif vers Checkout, deux actions d'ÉGALE lisibilité, prix
 * via le formateur pur (couplé au prix facturé), garantie + périmètres sur la carte, ZÉRO dark pattern,
 * `<article>` DANS le flux (jamais modale), frontière client (aucun secret/serveur, AD-2).
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const src = sansCommentaires(readFileSync(resolve(racine, "render/conversation/CarteAbonnement.tsx"), "utf-8"));

describe("Story 3.2 — la carte d'abonnement dans le fil (AC1-AC4)", () => {
  it("« M'abonner » = form POST NATIF vers /api/stripe/checkout (3.1), robuste même sans JS", () => {
    expect(src).toMatch(/method=["']post["']/i);
    expect(src).toMatch(/action=["']\/api\/stripe\/checkout["']/);
  });

  it("deux actions d'ÉGALE lisibilité : même rôle typo t-bouton ; la primaire n'ajoute QUE la couleur", () => {
    const nb = (src.match(/t-bouton/g) ?? []).length;
    expect(nb, "les DEUX actions doivent porter t-bouton").toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/ACTION_ABONNER/);
    expect(src).toMatch(/ACTION_PAS_MAINTENANT/);
    expect(src).toMatch(/onRefuser/);
  });

  it("CSS : la primaire ne change QUE la couleur — jamais la taille/graisse/cible (égalité réelle, AC2)", () => {
    const css = readFileSync(resolve(racine, "render/conversation/conversation.module.css"), "utf-8");
    // La BASE `.carteAction` porte la taille partagée (cible ≥ 44 px + padding) → identique aux deux boutons.
    const base = css.match(/\.carteAction\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(base, "la base carteAction doit poser la cible tactile partagée").toMatch(/min-height/);
    // La variante PRIMAIRE ne doit toucher QUE des propriétés de COULEUR — aucune propriété qui la
    // grossirait ou l'appuierait (taille, graisse, retrait, échelle) au détriment de la secondaire.
    const primaire = css.match(/\.carteActionPrimaire\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(primaire.length, "bloc .carteActionPrimaire introuvable").toBeGreaterThan(0);
    expect(primaire, "la primaire ne doit PAS changer la taille/graisse/échelle").not.toMatch(
      /min-height|min-width|padding|font-size|font-weight|transform|scale|letter-spacing/,
    );
  });

  it("prix affiché via le formateur pur (couplé au prix facturé) — jamais un chiffre en dur", () => {
    expect(src).toMatch(/formaterPrixAnnuel\(\)/);
    expect(src, "aucun prix codé en dur").not.toMatch(/\b69\b|\d+\s*€|€\s*\d/);
  });

  it("garantie + périmètres gratuit ET premium sur la carte (AC3/AC4)", () => {
    expect(src).toMatch(/GARANTIE_REMBOURSEMENT/);
    expect(src).toMatch(/PERIMETRE_GRATUIT/);
    expect(src).toMatch(/PERIMETRE_PREMIUM/);
  });

  it("ZÉRO dark pattern : pas de barré, pas de minuterie, pas de rareté (FR-061)", () => {
    expect(src).not.toMatch(/line-through|<s>|<del|barr/i);
    expect(src).not.toMatch(/rebours|setInterval|setTimeout|Date\.now/i);
  });

  it("DANS le flux, JAMAIS une modale (AC1) ; apparition fondu (reduced-motion neutralisé)", () => {
    expect(src).toMatch(/<article/);
    expect(src, "jamais une modale").not.toMatch(/role=["']dialog["']|aria-modal/);
    expect(src).toMatch(/fondu-texte/);
  });

  it("frontière AD-2 : la carte (client) ne touche aucun secret / module serveur", () => {
    expect(src).not.toMatch(/server-only|process\.env|@\/lib\/stripe|STRIPE_/);
  });
});
