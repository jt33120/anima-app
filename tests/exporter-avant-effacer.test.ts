import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "./_absence";

/**
 * exporter-avant-effacer.test.ts — ON N'OFFRE JAMAIS D'EFFACER SANS OFFRIR D'EMPORTER
 * (revue adversariale du 2026-08-18, R11 · RGPD art. 15 et 17)
 *
 * ══ CE QUE L'ÉCRAN DE RÉVOCATION DISAIT ═══════════════════════════════════════════════════════
 *
 * Une utilisatrice de longue date retire son consentement art. 9. La page lui répond :
 *
 *     « Il te reste deux choses à portée : récupérer ce qui t'appartient, puis effacer ton compte. »
 *     [ Exporter mes données ]  ← désactivé, opacité 0,6
 *     « L'export sera disponible avant le lancement. »
 *     [ Supprimer mon compte ]  ← le seul bouton actif
 *
 * Le texte datait de la story 1.6 et n'avait jamais été repris après la 6.6, qui a LIVRÉ
 * `/api/export`. Deux autres écrans y pointaient déjà. Résultat : quelqu'un qui exerce l'article 17
 * perd définitivement ses données parce que le produit lui affirme que l'article 15 n'existe pas
 * encore. C'est le geste le plus irréversible du produit, offert seul.
 *
 * ══ POURQUOI UNE GARDE DE FAMILLE, ET PAS UN CORRECTIF DE PAGE ════════════════════════════════
 *
 * Réparer cette page-là refermerait le cas d'hier. Le défaut, lui, est que le lien d'export est
 * RECOPIÉ dans chaque écran : le troisième l'a oublié comme le quatrième l'oubliera. La garde
 * ci-dessous est donc structurelle — TOUT écran qui propose d'effacer un compte doit proposer
 * l'export, en lien vivant.
 */

const RACINE = process.cwd();
const lire = (p: string) => sansCommentaires(readFileSync(join(RACINE, p), "utf-8"));

/** Tous les écrans du produit — on ne suppose pas où vivra la prochaine porte de sortie. */
function pages(): string[] {
  const out: string[] = [];
  const marcher = (rel: string) => {
    for (const e of readdirSync(join(RACINE, rel), { withFileTypes: true })) {
      if (e.isDirectory()) marcher(join(rel, e.name));
      else if (/\.tsx$/.test(e.name)) out.push(join(rel, e.name));
    }
  };
  marcher("app");
  return out;
}

/** Les gestes qui font disparaître un compte, tels qu'un écran les câble. */
const OFFRE_EFFACEMENT =
  /supprimerCompteRevoque|effacerTout\b|action=\{effacer|effacer_toutes_mes_donnees/;
/** Le lien vivant vers l'article 15. */
const OFFRE_EXPORT = /href="\/api\/export"/;

describe("[R11] tout écran qui offre d'effacer offre aussi d'emporter", () => {
  const tous = pages();

  it("[CONTRÔLE DU CONTRÔLE] on a bien balayé des écrans", () => {
    expect(tous.length).toBeGreaterThan(15);
  });

  it("[CONTRÔLE DU CONTRÔLE] et au moins un écran offre réellement l'effacement", () => {
    // Sans lui, une regex devenue caduque rendrait ce fichier vert en ne mesurant plus rien.
    expect(tous.filter((f) => OFFRE_EFFACEMENT.test(lire(f))).length).toBeGreaterThan(0);
  });

  it("[LE CŒUR] aucun écran ne propose l'effacement sans l'export", () => {
    const fautifs = tous.filter((f) => {
      const src = lire(f);
      return OFFRE_EFFACEMENT.test(src) && !OFFRE_EXPORT.test(src);
    });
    expect(
      fautifs,
      "le geste le plus irréversible du produit est offert seul — art. 17 sans art. 15",
    ).toEqual([]);
  });

  it("[LE PIÈGE EXACT] aucun bouton d'export n'est DÉSACTIVÉ nulle part", () => {
    // Le défaut n'était pas un lien manquant : c'était un bouton PRÉSENT et mort, accompagné d'une
    // phrase qui affirmait que la fonctionnalité n'existait pas. Une garde qui ne cherche que
    // l'absence du lien ne voit pas ça.
    for (const f of tous) {
      const src = lire(f);
      if (!/Exporter mes données|ACTION_EXPORTER/.test(src)) continue;
      expect(src, `${f} : un bouton d'export désactivé`).not.toMatch(
        /Exporter mes données[\s\S]{0,400}disabled|disabled[\s\S]{0,400}Exporter mes données/,
      );
      expect(src, `${f} : le produit affirme que l'export n'existe pas encore`).not.toMatch(
        /export sera disponible/i,
      );
    }
  });
});
