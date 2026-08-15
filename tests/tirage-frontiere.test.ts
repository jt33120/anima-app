import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { CORPUS_SENS_CARTES, cleSens, lireSensCarte } from "@/lib/lecture/sens-cartes";
import { clesEcrites, clesNonEcrites } from "@/lib/corpus/port";
import { CLES_JEU } from "@/lib/tirage/jeu";

/**
 * tirage-frontiere.test.ts — LE SENS NE TRAVERSE PAS (Story 5.7, AC4 · FR-016 / FR-018 · AD-11).
 *
 * ══ L'EXIGENCE ══════════════════════════════════════════════════════════════════════════════════
 *
 * « Le catalogue de sens n'existe QUE côté serveur et n'a AUCUNE représentation côté client avant la
 * réponse de l'utilisatrice. » Trois gardes, de forces très inégales, et il faut savoir laquelle
 * porte vraiment :
 *
 *   §1  `server-only` — LA GARDE FORTE. Elle transforme l'exigence en ÉCHEC DE BUILD, y compris pour
 *       un import TRANSITIF que personne n'aurait vu venir. C'est elle qui fait le travail.
 *   §2  Le balayage des modules client — la garde qui NOMME la faute. `server-only` dit « ce module
 *       ne peut pas être importé ici » sans dire pourquoi c'est grave ; ce balayage le dit.
 *   §3  La forme du type de vue — la garde qui empêche la fuite par la porte d'à côté : un champ
 *       `sens` posé dans le modèle de vue traverserait sans jamais toucher au module server-only.
 *
 * ⚠️ §3 EST LA MOINS ÉVIDENTE ET LA PLUS UTILE. C'est exactement la leçon de la 5.6, où `terme` ne
 * devait pas franchir la frontière pour que le rendu ne puisse pas déduire un cadenas. Ici l'enjeu
 * est plus grand : le rendu ne doit pas pouvoir déduire une LECTURE.
 */

const RACINE = process.cwd();

/** Parcourt récursivement un dossier et rend les chemins des fichiers TS/TSX. */
function fichiersSources(dossier: string): string[] {
  const trouves: string[] = [];
  const entrees = (() => {
    try {
      return readdirSync(dossier);
    } catch {
      return [];
    }
  })();
  for (const e of entrees) {
    if (e === "node_modules" || e === ".next" || e === "coverage") continue;
    const chemin = join(dossier, e);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersSources(chemin));
    else if (/\.tsx?$/.test(chemin)) trouves.push(chemin);
  }
  return trouves;
}

/** Le module server-only du catalogue, sous toutes ses écritures possibles. */
const MOTIF_CATALOGUE = /["'](?:@\/lib\/lecture\/sens-cartes|(?:\.\.?\/)+(?:lib\/)?lecture\/sens-cartes|\.\/sens-cartes)["']/;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. La garde forte
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4] le catalogue de sens porte `server-only`", () => {
  it("c'est la PREMIÈRE ligne du fichier", () => {
    // La position compte : placé après un autre import, un module à effet de bord peut s'exécuter
    // avant lui. En première ligne, l'échec est garanti d'être le premier.
    const src = readFileSync(resolve(RACINE, "lib/lecture/sens-cartes.ts"), "utf8");
    expect(src.split("\n")[0]).toMatch(/^import "server-only";/);
  });

  it("le module de DESCRIPTION, lui, ne le porte PAS — et c'est voulu", () => {
    // Les descriptions traversent : elles sont le texte alternatif du visuel. Confondre les deux
    // corpus casserait soit l'accessibilité (si les descriptions devenaient server-only), soit
    // AC4 (si le sens cessait de l'être). L'assertion existe pour que l'asymétrie soit vérifiée
    // plutôt que supposée.
    // ⚠️ On vise l'IMPORT, pas la mention : l'en-tête du fichier EXPLIQUE l'asymétrie et cite donc
    // « server-only » en toutes lettres. Un `not.toMatch(/server-only/)` naïf rougissait sur sa
    // propre documentation — et l'aurait fait supprimer pour faire passer le test.
    const src = readFileSync(resolve(RACINE, "lib/corpus/description-cartes.ts"), "utf8");
    expect(src).not.toMatch(/^\s*import\s+["']server-only["']/m);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Aucun module client n'atteint le catalogue
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4] aucun module atteignable par le client n'importe le catalogue de sens", () => {
  const SOURCES = [
    ...fichiersSources(resolve(RACINE, "render")),
    ...fichiersSources(resolve(RACINE, "app")),
    ...fichiersSources(resolve(RACINE, "lib")),
  ];

  it("le balayage voit réellement le dépôt (garde SUR la garde)", () => {
    // Un balayage aveugle serait vert. Plancher volontairement bas et ancres nommées : si demain
    // quelqu'un casse `fichiersSources`, c'est CETTE assertion qui rougit, pas le silence.
    expect(SOURCES.length).toBeGreaterThan(100);
    const relatifs = SOURCES.map((f) => relative(RACINE, f));
    expect(relatifs).toContain("render/lecture/CarteTiree.tsx");
    expect(relatifs).toContain("lib/lecture/sens-cartes.ts");
  });

  it("tout module `\"use client\"` est vierge du catalogue", () => {
    const clients = SOURCES.filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8")));
    // Ancre : s'il n'y avait aucun module client, l'assertion suivante serait vacue.
    expect(clients.length).toBeGreaterThan(5);
    for (const f of clients) {
      expect(MOTIF_CATALOGUE.test(readFileSync(f, "utf8")), relative(RACINE, f)).toBe(false);
    }
  });

  it("`render/` tout entier est vierge du catalogue, client ou non", () => {
    // Le rendu n'a aucune raison légitime de connaître le sens, même dans un module serveur : c'est
    // la couche qui DESSINE, et dessiner un sens avant qu'elle ait parlé est précisément l'interdit.
    for (const f of fichiersSources(resolve(RACINE, "render"))) {
      expect(MOTIF_CATALOGUE.test(readFileSync(f, "utf8")), relative(RACINE, f)).toBe(false);
    }
  });

  it("LE BALAYAGE MORD — prouvé sur de fausses sources", () => {
    for (const faux of [
      'import { lireSensCarte } from "@/lib/lecture/sens-cartes";',
      'import { CORPUS_SENS_CARTES } from "../../lib/lecture/sens-cartes";',
      'export { lireSensCarte } from "./sens-cartes";',
    ]) {
      expect(MOTIF_CATALOGUE.test(faux), faux).toBe(true);
    }
    // Et il ne mord pas sur le voisin légitime.
    expect(MOTIF_CATALOGUE.test('import { lireDescriptionCarte } from "@/lib/corpus/description-cartes";')).toBe(
      false,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. Le modèle de vue n'a AUCUN champ où un sens pourrait s'écrire
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4] le type de vue de la carte ne peut pas porter de signification", () => {
  const vue = readFileSync(resolve(RACINE, "render/lecture/types.ts"), "utf8");
  /** Le corps de `CarteTireeVue` seul — pas les commentaires du fichier, qui NOMMENT ces champs. */
  const corpsVue = vue.slice(vue.indexOf("interface CarteTireeVue")).split("}")[0];

  it("`CarteTireeVue` n'a QUE `cle` et `description`", () => {
    const champs = [...corpsVue.matchAll(/^\s*readonly\s+(\w+)/gm)].map((m) => m[1]);
    expect(champs.sort()).toEqual(["cle", "description"]);
  });

  it.each(["sens", "signification", "meaning", "interpretation", "mot_cle", "motCle", "nom", "titre", "libelle"])(
    "aucun champ « %s »",
    (interdit) => {
      // Un champ optionnel jamais rempli suffirait : il serait la porte par laquelle la signification
      // traverserait un jour, sans que rien ne rougisse. `nom`/`titre`/`libelle` sont là aussi —
      // l'UX interdit de NOMMER la carte avant la réponse, et un nom est déjà une amorce de sens.
      expect(corpsVue).not.toMatch(new RegExp(`readonly\\s+${interdit}\\b`));
    },
  );
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. Le catalogue lui-même
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4] 21 créneaux de sens, déclarés, aucun écrit", () => {
  it("un créneau par carte, aucun orphelin", () => {
    expect(Object.keys(CORPUS_SENS_CARTES.textes).sort()).toEqual(CLES_JEU.map(cleSens).sort());
  });

  it("[porte pré-lancement] l'inventaire dit exactement où on en est", () => {
    // ⚠️ Ce chiffre est VOULU. Il monte quand ANIMA écrit — jamais quand un modèle « aide »
    // (FR-047/FR-054), jamais quand nous écrivons à sa place (FR-086).
    expect(clesEcrites(CORPUS_SENS_CARTES).length).toBe(0);
    expect(clesNonEcrites(CORPUS_SENS_CARTES).length).toBe(21);
  });

  it("un créneau non écrit ne se déguise pas en texte, et une clé inconnue JETTE", () => {
    expect(lireSensCarte("barque")).toEqual({ statut: "non_ecrit" });
    expect(() => lireSensCarte("carte-fantome" as never)).toThrow(/non déclaré/);
  });
});
