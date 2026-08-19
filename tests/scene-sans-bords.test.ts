import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * scene-sans-bords.test.ts — « UNE SCÈNE CONTINUE, SANS BORDS » (AD-7, AC1 · QA T9, puis
 * QA manuelle du 2026-08-19).
 *
 * ══ CE QUI S'EST PASSÉ, EN DEUX TEMPS ═══════════════════════════════════════════════════════════
 *
 * T9 — `anam-seuil.png`, le premier visuel qu'on voyait en entrant, s'affichait dans un RECTANGLE
 * plus clair que la nuit, aux arêtes franches. Un masque « bord plumeux » existait pourtant. Deux
 * causes indépendantes ont été trouvées et corrigées : une boîte au mauvais rapport, et un dégradé
 * radial qui ne touchait pas les flancs. Mesuré au pixel : saut de 56 avant, ≤ 5 après.
 *
 * Le tour manuel du 2026-08-19 a montré que les deux corrections traitaient un symptôme. La cause
 * était dans le FICHIER : `anam-seuil.png` n'a pas de canal alpha du tout. Ce n'est pas un
 * personnage détouré, c'est une PEINTURE ENTIÈRE — avec son propre ciel étoilé, sa propre lune et
 * sa propre voie lactée — posée sur le ciel étoilé de la scène. Aucun masque ne rend un rectangle
 * opaque continu ; il le dissout au mieux, en dupliquant une nuit par-dessus une autre.
 *
 * Le seuil ne composite donc plus aucune image bitmap : son image est l'ARBRE, qui est procédural.
 * Ce fichier garde la RÈGLE qui en découle, pas la mise en page qui en est sortie.
 *
 * ⚠️ AUCUN TEST DE CE DÉPÔT NE VOIT UN PIXEL. Les projets `node` et `rendu` (jsdom) ne composent
 * rien. Ce sont des gardes de CAUSE — dit ici pour que personne ne les prenne pour une preuve
 * d'absence de cadre. La preuve de peinture, elle, vit dans `e2e/seuil.spec.ts`.
 */

const racine = process.cwd();

/**
 * L'en-tête IHDR d'un PNG : largeur, hauteur, profondeur, et TYPE DE COULEUR — sans dépendance.
 *
 * Signature (8 octets), longueur (4), type `IHDR` (4), puis largeur (4) et hauteur (4) en
 * gros-boutiste, profondeur (1), type de couleur (1). Normalisé et invariable : IHDR est toujours
 * le premier chunk. Les types PORTEURS D'ALPHA sont 4 (gris+alpha) et 6 (RVB+alpha) ; 0, 2 et 3
 * n'en ont aucun — un fichier de ces types-là est un rectangle, quoi qu'on peigne dessus.
 */
function enTetePng(chemin: string): { largeur: number; hauteur: number; typeCouleur: number } {
  const b = readFileSync(resolve(racine, chemin));
  expect(b.subarray(12, 16).toString("ascii"), `${chemin} n'est pas un PNG`).toBe("IHDR");
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), typeCouleur: b[25] };
}

const aUnAlpha = (typeCouleur: number) => typeCouleur === 4 || typeCouleur === 6;

/** Tous les fichiers d'un dossier, récursivement, filtrés par extension. */
function fichiers(dossier: string, extensions: readonly string[]): string[] {
  const sortie: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(resolve(racine, d))) {
      const chemin = join(d, e);
      if (statSync(resolve(racine, chemin)).isDirectory()) parcourir(chemin);
      else if (extensions.some((x) => e.endsWith(x))) sortie.push(chemin);
    }
  };
  parcourir(dossier);
  return sortie;
}

describe("[QA 2026-08-19] la scène ne composite AUCUNE image qui a un bord", () => {
  it("`anam-seuil.png` n'a pas de canal alpha — c'est la CAUSE, et elle est dans le fichier", () => {
    // Cette garde ne demande pas de corriger le fichier : elle empêche de le recomposer dans la
    // scène en croyant qu'un masque suffira. C'est exactement la croyance qui a produit T9.
    const { typeCouleur } = enTetePng("public/scene/anam-seuil.png");
    expect(
      aUnAlpha(typeCouleur),
      "si ce fichier gagne un jour un alpha, cette garde doit être RELUE, pas supprimée : " +
        "elle documente pourquoi il a quitté le seuil",
    ).toBe(false);
  });

  it("aucun fichier de `render/` ne référence une image sans alpha", () => {
    const sources = fichiers("render", [".tsx", ".ts", ".css"]);
    expect(sources.length, "témoin : le balayage de `render/` ne trouve plus rien").toBeGreaterThan(20);

    const fautifs: string[] = [];
    for (const f of sources) {
      const src = readFileSync(resolve(racine, f), "utf-8");
      // Les VRAIES références seulement : `src=`, `url(` — jamais un chemin cité dans un
      // commentaire, sans quoi l'en-tête de ce fichier-ci ferait rougir sa propre garde.
      for (const m of src.matchAll(/(?:src=\{?["']|url\(\s*["']?)(\/[^"')\s}]+\.png)/g)) {
        const { typeCouleur } = enTetePng(join("public", m[1]));
        if (!aUnAlpha(typeCouleur)) fautifs.push(`${f} → ${m[1]} (type ${typeCouleur})`);
      }
    }
    expect(
      fautifs,
      "une image au pourtour opaque est un RECTANGLE sur une scène qui se dit sans bords :\n" +
        fautifs.join("\n"),
    ).toEqual([]);
  });
});

describe("[QA 2026-08-19] la réserve du seuil se déduit de l'arbre, elle ne la devine pas", () => {
  it("le rapport déclaré dans le CSS est celui du canevas de `arbre-vivant.tsx`", () => {
    // ⚠️ CE QUI SE JOUE ICI : `.seuil` réserve `--arbre-h` au-dessus de son texte pour que le
    // titre ne remonte pas dans le feuillage. Si ce rapport s'écarte de celui du canevas, la
    // réserve devient fausse SANS que rien ne casse — c'est-à-dire exactement l'état mesuré avant
    // correction (« Anam » à 331 px, feuillage de 250 à 422).
    const moteur = readFileSync(resolve(racine, "render/arbre-vivant.tsx"), "utf-8");
    const W = Number(/private W = (\d+)/.exec(moteur)?.[1]);
    const H = Number(/private H = (\d+)/.exec(moteur)?.[1]);
    expect(Number.isFinite(W) && Number.isFinite(H), "constantes du canevas illisibles").toBe(true);

    const css = readFileSync(resolve(racine, "render/monde.module.css"), "utf-8");
    const m = /--arbre-h:\s*calc\(\s*var\(--arbre-l\)\s*\*\s*(\d+)\s*\/\s*(\d+)\s*\)/.exec(css);
    expect(m, "`--arbre-h` doit se déduire de `--arbre-l` par le rapport du canevas").not.toBeNull();
    expect(
      [Number(m![1]), Number(m![2])],
      `le CSS dit ${m![1]}/${m![2]}, le canevas dessine ${H}/${W}`,
    ).toEqual([H, W]);
  });

  it("`--arbre-l` est déclaré UNE fois et consommé par l'arbre ET par la réserve du seuil", () => {
    // Deux valeurs écrites séparément, c'est le titre dans le feuillage le jour où l'une bouge.
    const css = readFileSync(resolve(racine, "render/monde.module.css"), "utf-8");
    expect((css.match(/--arbre-l:/g) ?? []).length, "un seul point de déclaration").toBe(1);

    const bloc = (sel: string) => {
      const i = css.indexOf(sel + " {");
      expect(i, `${sel} a disparu de monde.module.css`).toBeGreaterThan(-1);
      return css.slice(i, css.indexOf("}", i));
    };
    expect(bloc(".arbreMonde"), "l'arbre doit tirer sa largeur du jeton").toMatch(/width:\s*var\(--arbre-l\)/);
    expect(bloc(".seuil"), "la réserve du seuil doit tirer sa hauteur du jeton").toMatch(/var\(--arbre-h\)/);
  });
});

describe("[QA T9] les autres personnages sont détourés à la source", () => {
  it("`presence` et `veille` portent un canal alpha, aux deux formats et en plusieurs densités", () => {
    // Mesuré le 2026-08-18 : leur pourtour est transparent à 0 % d'opacité, contrairement à
    // `anam-seuil.png`. Le pipeline sait donc faire — c'était un fichier, pas un système. Ils ne
    // sont composités nulle part aujourd'hui ; cette garde tient la porte ouverte pour le jour où.
    for (const f of [
      "public/scene/presence/anam-presence.png",
      "public/scene/presence/anam-presence@2x.png",
      "public/scene/veille/anam-veille.png",
      "public/scene/veille/anam-veille@2x.png",
    ]) {
      const { largeur, hauteur, typeCouleur } = enTetePng(f);
      expect(largeur, `${f} vide ou illisible`).toBeGreaterThan(50);
      expect(hauteur).toBeGreaterThan(50);
      expect(aUnAlpha(typeCouleur), `${f} a perdu son canal alpha (type ${typeCouleur})`).toBe(true);
    }
  });
});
