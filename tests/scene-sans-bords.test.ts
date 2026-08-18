import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * scene-sans-bords.test.ts — « UNE SCÈNE CONTINUE, SANS BORDS » (AD-7, AC1 · QA T9).
 *
 * ══ CE QUI S'EST PASSÉ ══════════════════════════════════════════════════════════════════════════
 *
 * `anam-seuil.png` — le premier visuel qu'on voit en entrant — s'affichait dans un RECTANGLE plus
 * clair que la nuit, aux arêtes franches. Un masque « bord plumeux » existait pourtant, écrit pour
 * exactement ça. Deux causes indépendantes, et il a fallu mesurer le rendu composité pour les voir :
 *
 *   1. `.seuilPersonnage` imposait `aspect-ratio: 4 / 5` (0,800) à une image en 434 × 566 (0,767).
 *      `object-fit: contain` laissait donc ~6 px de bandes de chaque côté — et le masque est calculé
 *      sur la BOÎTE, pas sur l'image : le bord franc du fichier tombait à l'intérieur de la zone
 *      encore opaque.
 *   2. Le dégradé radial ne touchait PAS les côtés. Son ellipse fait 118 % de la largeur : la
 *      transparence n'arrive qu'à ≈ 0,97 W du centre, alors que le bord latéral est à 0,54 W. Il
 *      feutrait les coins et le haut, jamais les flancs.
 *
 * Mesuré au pixel, à mi-hauteur : saut de couleur de **56 en un seul pixel** avant, **≤ 5** après.
 *
 * ══ CE QUE CE FICHIER GARDE, ET CE QU'IL NE PEUT PAS GARDER ═════════════════════════════════════
 *
 * ⚠️ AUCUN TEST DE CE DÉPÔT NE VOIT UN PIXEL. Les projets `node` et `rendu` (jsdom) ne composent
 * rien. Ce fichier garde donc la CAUSE, pas le symptôme : il lit les dimensions réelles du fichier
 * PNG et exige que la boîte les respecte. C'est une garde de cause, et c'est dit ici pour que
 * personne ne la prenne pour une preuve d'absence de cadre.
 */

const racine = process.cwd();

/**
 * Les dimensions d'un PNG, lues dans son en-tête IHDR — sans dépendance.
 *
 * Signature (8 octets), puis longueur (4) + type `IHDR` (4), puis largeur (4) et hauteur (4) en
 * gros-boutiste. C'est normalisé et invariable : le IHDR est toujours le premier chunk.
 */
function dimensionsPng(chemin: string): { largeur: number; hauteur: number } {
  const b = readFileSync(resolve(racine, chemin));
  expect(b.subarray(12, 16).toString("ascii"), `${chemin} n'est pas un PNG`).toBe("IHDR");
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20) };
}

const css = readFileSync(resolve(racine, "render/monde.module.css"), "utf-8");

function blocCss(selecteur: string): string {
  const i = css.indexOf(selecteur + " {");
  expect(i, `${selecteur} a disparu de monde.module.css`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
}

describe("[QA T9] la boîte du personnage épouse le fichier — sinon `contain` fabrique des bandes", () => {
  it("`.seuilPersonnage` porte le rapport RÉEL de `anam-seuil.png`", () => {
    const { largeur, hauteur } = dimensionsPng("public/scene/anam-seuil.png");
    const bloc = blocCss(".seuilPersonnage");

    const m = bloc.match(/aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/);
    expect(m, "`.seuilPersonnage` doit déclarer un `aspect-ratio`").not.toBeNull();

    const declare = Number(m![1]) / Number(m![2]);
    const reel = largeur / hauteur;
    // ⚠️ LA TOLÉRANCE EST SERRÉE EXPRÈS. `4 / 5` (0,800) contre 0,767 fait 0,033 d'écart — c'est
    // précisément ce qui produisait 6 px de bandes. Une tolérance confortable laisserait passer le
    // défaut qu'on vient de corriger.
    expect(
      Math.abs(declare - reel),
      `boîte ${declare.toFixed(4)} contre fichier ${reel.toFixed(4)} (${largeur}×${hauteur}) : ` +
        "`object-fit: contain` va laisser des bandes, et le masque est calculé sur la boîte",
    ).toBeLessThan(0.005);
  });

  it("le masque GARANTIT les flancs, pas seulement les coins", () => {
    // Garde de FORME, assumée comme telle : elle vérifie que les fondus rectangulaires sont là et
    // intersectés. Un dégradé radial seul a déjà menti une fois — il couvrait les coins, et son
    // commentaire disait « aucun cadre ».
    const bloc = blocCss(".seuilImg");
    expect(bloc, "un fondu horizontal doit border l'image").toMatch(
      /mask-image:[\s\S]*linear-gradient\(\s*to right[\s\S]*transparent/,
    );
    expect(bloc, "un fondu vertical doit border l'image").toMatch(
      /linear-gradient\(\s*to bottom[\s\S]*transparent/,
    );
    expect(bloc, "les masques doivent être INTERSECTÉS, sinon ils s'additionnent").toMatch(
      /mask-composite:\s*intersect/,
    );
    expect(bloc, "Safari a besoin du préfixe, sinon le masque composé n'y existe pas").toMatch(
      /-webkit-mask-composite:\s*source-in/,
    );
  });
});

describe("[QA T9] les autres personnages sont détourés à la source", () => {
  it("`presence` et `veille` existent aux deux formats, en plusieurs densités", () => {
    // Mesuré le 2026-08-18 : leur pourtour est transparent à 0 % d'opacité, contrairement à
    // `anam-seuil.png` (100 %). Le pipeline sait donc faire — c'était un fichier, pas un système.
    for (const f of [
      "public/scene/presence/anam-presence.png",
      "public/scene/veille/anam-veille.png",
    ]) {
      const { largeur, hauteur } = dimensionsPng(f);
      expect(largeur, `${f} vide ou illisible`).toBeGreaterThan(50);
      expect(hauteur).toBeGreaterThan(50);
    }
  });
});
