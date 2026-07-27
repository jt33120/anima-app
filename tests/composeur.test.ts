import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.2 (B6) — le composeur TEXTE SEUL (AC5/AC7). La décision clavier sm/md est prouvée en pur
 * dans `composeur-clavier.test.ts` ; ici on garde la FORME par lecture du source (env node) : champ
 * multiligne, plafond 6 lignes, aucun micro / emoji / pièce jointe (décision produit v1 — l'epic
 * surcharge DESIGN.md), et le composeur consomme bien la décision pure (pas de logique dupliquée).
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const composeur = sansCommentaires(readFileSync(resolve(racine, "render/conversation/Composeur.tsx"), "utf-8"));

describe("Composeur — champ multiligne, plafond 6 lignes (AC7)", () => {
  it("emploie un <textarea> (multiligne), jamais un <input> simple ligne", () => {
    expect(composeur).toMatch(/<textarea/);
  });

  it("plafonne l'auto-extension à 6 lignes puis défilement interne", () => {
    expect(composeur).toMatch(/MAX_LIGNES\s*=\s*6/);
    expect(composeur).toMatch(/overflowY/); // bascule en défilement au-delà du plafond
  });

  it("applique la décision d'Entrée pure (une seule source, pas de logique réimplémentée)", () => {
    expect(composeur).toMatch(/decisionEntree\(/);
    expect(composeur).toMatch(/preventDefault\(\)/); // envoi md : empêche le saut de ligne
  });
});

describe("Composeur — TEXTE SEUL, aucun micro / emoji / pièce jointe (AC5, v1)", () => {
  it("aucun micro / capture audio (v1 : STT différée derrière SttPort)", () => {
    expect(composeur).not.toMatch(/micro|microphone|audio|speech|\bstt\b|record/i);
  });

  it("aucune pièce jointe / champ fichier", () => {
    expect(composeur).not.toMatch(/type=["']file["']|attach|pièce jointe|upload/i);
  });

  it("aucun sélecteur d'emoji", () => {
    expect(composeur).not.toMatch(/emoji/i);
  });
});
