import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * REVUE 4.9 (T6-20) — LE GRAPHE DES MODULES EST ACYCLIQUE.
 *
 * ── POURQUOI CETTE GARDE EXISTE ────────────────────────────────────────────────────────────────────────
 *
 * Il y avait un cycle, et personne ne l'a jamais vu : `registre` → `jobs/*` → `registre`. Il était EFFACÉ
 * AU BUILD parce que les jobs n'importaient `ContexteJob` qu'en `import type` — un import de type
 * disparaît à la compilation, donc le cycle n'existait pas à l'exécution. Rien n'empêchait qu'un jour
 * quelqu'un ait besoin d'une VALEUR du registre et retire le mot `type` : le cycle serait alors réel,
 * silencieusement, avec pour symptôme un `undefined` à l'initialisation dans une lambda, en production.
 *
 * `codeDErreur` a précisément été extrait dans `lib/domain/` pour éviter ce cycle-là. Cette garde est ce
 * qui empêche l'extraction d'être défaite par distraction.
 *
 * ── CE QUE LA GARDE REGARDE ────────────────────────────────────────────────────────────────────────────
 *
 * Les imports de VALEUR uniquement (`import type` et `import { type X }` sont retirés) : ce sont les
 * seuls qui existent à l'exécution, donc les seuls qui peuvent produire un `undefined` d'initialisation.
 * Le graphe couvre `lib/`, `app/` et `render/` — les trois arbres où vit le code du produit.
 */

const RACINE = process.cwd();

function fichiers(dossier: string): string[] {
  return (readdirSync(resolve(RACINE, dossier), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts"))
    .map((f) => `${dossier}/${f}`);
}

/** Résout `@/lib/x` vers le chemin réel du dépôt, en essayant les suffixes que Node/Next essaierait. */
function resoudre(specificateur: string, tous: Set<string>): string | null {
  if (!specificateur.startsWith("@/")) return null; // dépendance externe : hors du graphe
  const base = specificateur.slice(2);
  for (const candidat of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (tous.has(candidat)) return candidat;
  }
  return null;
}

/**
 * Les imports de VALEUR d'un fichier. Trois formes retirées, et chacune compte :
 *   • `import type { X } from "…"`      — effacé au build ;
 *   • `import { type X } from "…"`      — idem, forme en ligne ;
 *   • les commentaires                  — un exemple d'import dans une docstring n'est pas un import.
 * Une déclaration dont TOUS les spécificateurs sont `type` ne produit aucun import de valeur.
 */
function importsDeValeur(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const trouves: string[] = [];
  const motif = /import\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  for (const m of code.matchAll(motif)) {
    const [, motType, clause, cible] = m;
    if (motType) continue; // `import type { … } from` : effacé au build
    const nomme = clause.match(/\{([\s\S]*)\}/);
    if (nomme) {
      const specificateurs = nomme[1].split(",").map((s) => s.trim()).filter(Boolean);
      // `import { type A, type B }` n'importe aucune valeur ; `import { type A, b }` en importe une.
      const valeurs = specificateurs.filter((s) => !s.startsWith("type "));
      const defautOuEtoile = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim();
      if (valeurs.length === 0 && defautOuEtoile.length === 0) continue;
    }
    trouves.push(cible);
  }
  return trouves;
}

const TOUS = new Set([...fichiers("lib"), ...fichiers("app"), ...fichiers("render")]);

const GRAPHE = new Map<string, string[]>();
for (const f of TOUS) {
  const source = readFileSync(resolve(RACINE, f), "utf-8");
  GRAPHE.set(
    f,
    importsDeValeur(source)
      .map((s) => resoudre(s, TOUS))
      .filter((s): s is string => s !== null),
  );
}

/** Parcours en profondeur avec pile — rend le PREMIER cycle trouvé, chemin complet. */
function trouverCycle(): string[] | null {
  const etat = new Map<string, "en_cours" | "fini">();
  const pile: string[] = [];

  function visiter(noeud: string): string[] | null {
    if (etat.get(noeud) === "fini") return null;
    if (etat.get(noeud) === "en_cours") return [...pile.slice(pile.indexOf(noeud)), noeud];
    etat.set(noeud, "en_cours");
    pile.push(noeud);
    for (const voisin of GRAPHE.get(noeud) ?? []) {
      const cycle = visiter(voisin);
      if (cycle) return cycle;
    }
    pile.pop();
    etat.set(noeud, "fini");
    return null;
  }

  for (const noeud of GRAPHE.keys()) {
    const cycle = visiter(noeud);
    if (cycle) return cycle;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[T6-20] le graphe des imports de valeur n'a aucun cycle", () => {
  it("le graphe est RÉELLEMENT construit — sinon la garde ne garde rien", () => {
    // Le contrôle non-vacue. Un résolveur cassé rendrait un graphe sans arête : aucun cycle, jamais, et
    // le test le plus vert du dépôt ne prouverait plus rien du tout.
    expect(TOUS.size, "trop peu de fichiers découverts").toBeGreaterThan(80);
    const aretes = [...GRAPHE.values()].reduce((n, v) => n + v.length, 0);
    expect(aretes, "aucune arête : la résolution des chemins `@/` est cassée").toBeGreaterThan(100);
  });

  it("[CONTRÔLE POSITIF] un cycle fabriqué serait bien détecté", () => {
    // Sans lui, `trouverCycle` pourrait rendre `null` par construction et personne ne s'en apercevrait.
    const sauvegarde = new Map(GRAPHE);
    try {
      GRAPHE.clear();
      GRAPHE.set("a.ts", ["b.ts"]);
      GRAPHE.set("b.ts", ["c.ts"]);
      GRAPHE.set("c.ts", ["a.ts"]);
      expect(trouverCycle()).toEqual(["a.ts", "b.ts", "c.ts", "a.ts"]);
    } finally {
      GRAPHE.clear();
      for (const [k, v] of sauvegarde) GRAPHE.set(k, v);
    }
  });

  it("[LE CŒUR] aucun cycle dans le dépôt", () => {
    // Le cycle qu'on attend en premier est `registre` → `jobs/*` → `registre`, aujourd'hui effacé au
    // build par un `import type`. Le jour où quelqu'un a besoin d'une VALEUR du registre dans un job, le
    // cycle devient réel — et son symptôme est un `undefined` à l'initialisation, dans une lambda, en
    // production, six heures du matin.
    const cycle = trouverCycle();
    expect(cycle, cycle ? `cycle d'imports de valeur : ${cycle.join(" → ")}` : "").toBeNull();
  });
});
