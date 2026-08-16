import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import {
  HALTES,
  HORS_HALTE,
  MENTION_IA,
  URL_AIDE,
  URL_TRANSPARENCE,
  motifDeMention,
  piedPour,
  type IdHalte,
} from "@/lib/domain/pied-halte";

/**
 * pied-halte.test.ts — LA PORTE DE SECOURS EXISTE PARTOUT (Story 6.9, QA T7 · FR-077 · art. 50).
 *
 * ══ CE QUE CE FICHIER GARDE, ET POURQUOI IL RENVERSE LA CHARGE ═══════════════════════════════════
 *
 * Le constat de départ : hors de la scène, **aucune page ne menait à `/aide`**. Pas une omission
 * ponctuelle — une classe entière d'écrans construite sans le filet, sans que rien ne rougisse.
 *
 * Un test qui vérifierait « les neuf haltes actuelles portent le pied » n'empêcherait pas la
 * dixième d'être écrite sans lui : c'est exactement comme ça que la neuvième est arrivée. On garde
 * donc l'INVENTAIRE — `app/**\/page.tsx` doit être exactement l'union des haltes déclarées et des
 * exclusions justifiées. Une page ajoutée sans verdict casse la CI.
 *
 * C'est le même renversement que les inventaires d'export (6.6) et d'effacement (6.7).
 */

const RACINE = resolve(__dirname, "..");

/** Toutes les pages de `app/`, en identifiants de route (« memoire », « (auth)/entrer », « . »). */
function pagesDeApp(): string[] {
  const trouvees: string[] = [];
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const chemin = resolve(dossier, entree);
      if (statSync(chemin).isDirectory()) {
        // `api/` ne rend aucune page ; `_*` et `node_modules` n'existent pas ici mais coûtent zéro.
        if (entree !== "api" && !entree.startsWith("_")) parcourir(chemin);
      } else if (entree === "page.tsx") {
        const rel = relative(resolve(RACINE, "app"), dossier).replace(/\\/g, "/");
        trouvees.push(rel === "" ? "." : rel);
      }
    }
  };
  parcourir(resolve(RACINE, "app"));
  return trouvees.sort();
}

const lire = (f: string) => readFileSync(resolve(RACINE, f), "utf-8");

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.9/T7] L'inventaire des haltes est EXHAUSTIF", () => {
  it("[LE CŒUR] toute page de `app/` a un verdict : halte, ou exclusion justifiée", () => {
    const pages = pagesDeApp();
    const declarees = new Set<string>([...HALTES, ...Object.keys(HORS_HALTE)]);
    const sansVerdict = pages.filter((p) => !declarees.has(p));
    expect(
      sansVerdict,
      `page(s) sans verdict de pied de halte — ajoute-les à HALTES ou à HORS_HALTE dans lib/domain/pied-halte.ts`,
    ).toEqual([]);
  });

  it("aucun verdict ne désigne une page qui n'existe plus", () => {
    // L'autre moitié : un inventaire qui garderait des entrées mortes finirait par ne plus décrire
    // le produit, et son exhaustivité deviendrait une illusion.
    const pages = new Set(pagesDeApp());
    const fantomes = [...HALTES, ...Object.keys(HORS_HALTE)].filter((p) => !pages.has(p));
    expect(fantomes).toEqual([]);
  });

  it("chaque exclusion porte un motif écrit, jamais un `true` muet", () => {
    for (const [page, motif] of Object.entries(HORS_HALTE)) {
      expect(motif.length, `${page} est exclue sans motif`).toBeGreaterThan(20);
    }
  });

  it("chaque halte porte le motif de son verdict de mention IA", () => {
    for (const h of HALTES) {
      expect(motifDeMention(h).length, `${h} n'explique pas son verdict`).toBeGreaterThan(20);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.9/FR-077] La porte de secours est sur TOUTES les haltes", () => {
  it("[LE CŒUR] le modèle la rend `true` pour chacune — le type l'exige déjà, le test le mesure", () => {
    for (const h of HALTES) {
      expect(piedPour(h).porteSecours, `${h} sans porte de secours`).toBe(true);
    }
  });

  it("[LE CŒUR] chaque page de halte MONTE le pied", () => {
    // La garde qui compte : le modèle peut dire ce qu'il veut, si la page ne le rend pas.
    for (const h of HALTES) {
      const src = lire(`app/${h}/page.tsx`);
      expect(src, `app/${h}/page.tsx ne monte pas <PiedHalte>`).toMatch(/<PiedHalte/);
      expect(src, `app/${h}/page.tsx ne consulte pas le modèle`).toMatch(
        new RegExp(`piedPour\\("${h.replace(/[-/]/g, "\\$&")}"\\)`),
      );
    }
  });

  it("[ANTI-VACUITÉ] `/barriere` garde son propre lien vers l'aide", () => {
    // Elle est exclue de l'inventaire parce qu'elle a déjà le sien. Si ce lien disparaissait, la
    // page d'un compte barré-minorité — celle où le filet compte le plus — n'aurait plus rien.
    expect(lire("app/barriere/page.tsx")).toMatch(/\/aide/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.9/art. 50] La mention IA est due là où un modèle a écrit", () => {
  const ATTENDUES: readonly IdHalte[] = ["ancrages", "enneagramme", "lectures", "memoire", "synthese"];

  it("[LE CŒUR] elle est due sur les haltes qui affichent du texte PRODUIT", () => {
    for (const h of ATTENDUES) {
      expect(piedPour(h).mentionIA, `${h} affiche du texte produit sans le dire`).toBe(true);
    }
  });

  it("[LE CONTRE-TEST] elle n'est PAS due là où rien n'est produit", () => {
    // ⚠️ SANS CETTE MOITIÉ, LA RÈGLE SERAIT « PARTOUT », ET « PARTOUT » LA DÉTRUIT. Une mention
    // collée sur un écran de cases à cocher devient un décor de bas de page, et cesse d'être lue
    // là où elle désigne quelque chose.
    for (const h of ["reglages", "mes-donnees", "abonnement", "heure-naissance"] as IdHalte[]) {
      expect(piedPour(h).mentionIA, `${h} annonce une IA qui n'a rien écrit`).toBe(false);
    }
  });

  it("[LE CŒUR] le texte et la cible sont ceux de la SCÈNE — une seule source", () => {
    // Deux littéraux auraient divergé au premier ajustement de copie, et le produit aurait porté
    // deux formulations d'une mention à enjeu légal.
    const scene = lire("lib/scene/surimpression.ts");
    expect(scene).toMatch(/export const MENTION_IA = "Anam est une IA";/);
    expect(MENTION_IA).toBe("Anam est une IA");
    expect(URL_TRANSPARENCE).toBe(`${URL_AIDE}#transparence`);
    // …et le rendu de la scène ne réécrit plus le texte à la main.
    const rendu = lire("render/surimpression.tsx");
    expect(rendu, "le texte de la mention est redevenu un littéral dans le JSX").not.toMatch(
      /"Anam est une IA"|>Anam est une IA</,
    );
  });

  it("`/aide` porte bien l'ancre vers laquelle la mention pointe", () => {
    // Un lien qui ne mène nulle part est un reproche (leçon de la 4.10) — et celui-ci est la seule
    // explication de ce qu'est Anam.
    expect(lire("app/aide/page.tsx")).toMatch(/id="transparence"/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.9] Le pied reste un pied, pas un chrome d'application", () => {
  it("il ne porte que deux liens, et rien d'autre", () => {
    // Le jour où quelqu'un y ajoutera un plan du site, des réseaux sociaux ou un logo, la porte de
    // secours cessera d'être ce qu'on trouve des yeux quand on ne va pas bien.
    const src = lire("render/PiedHalte.tsx");
    const liens = src.match(/<Link/g) ?? [];
    expect(liens.length).toBe(2);
  });

  it("`render/` reste muet : le pied n'importe pas `lib/domain`", () => {
    expect(lire("render/PiedHalte.tsx")).not.toMatch(/@\/lib\/domain/);
  });

  it("la cible tactile passe par le JETON, jamais par un littéral", () => {
    const css = lire("render/pied-halte.module.css");
    expect(css).toMatch(/min-height:\s*var\(--cible-tactile\)/);
    expect(css).not.toMatch(/min-height:\s*44px/);
  });
});
