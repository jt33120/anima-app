import { describe, it, expect } from "vitest";
import { assemblerRappel, type FaitDate } from "@/lib/domain/rappel";

/**
 * Story 4.3 (T3) — l'assembleur PUR `assemblerRappel` (aucune base). Prouve les gardes de forme du rappel :
 *  - [DUR] AC3 : un tombstone (corrige/supprime) passé en entrée est EXCLU (filtre défensif domaine) ;
 *  - AC2 : tri daté décroissant (le récent d'abord) ;
 *  - base de pertinence : `limite` plafonne ;
 *  - AC5 : sans matière → structure vide et honnête (`aDeLaMatiere=false`), jamais inventée ;
 *  - résumé blanc normalisé à `null`.
 */

function fait(cle: string, statut: FaitDate["statut"], creeLe: string): FaitDate {
  return { cleDedoublonnage: cle, contenu: `contenu ${cle}`, statut, creeLe, majLe: creeLe };
}

describe("assemblerRappel — tombstone jamais rappelé (AC3, [DUR] côté domaine)", () => {
  // ⚠️ CE TEST GRAVAIT R1 EN VERT (revue Epic 6). Il exigeait qu'un fait CORRIGÉ soit exclu du
  // rappel « comme un tombstone » — c'est-à-dire que corriger une phrase la retire de la mémoire
  // d'Anam. L'écran affichait pourtant « voici ce qu'Anam a retenu » AVEC la correction : deux
  // lectures d'une même règle, écrites à deux epics d'écart, et l'utilisatrice au milieu.
  //
  // L'art. 16 est un droit de RECTIFICATION, pas d'effacement. Réécrire est une AFFIRMATION.
  //
  // ⚠️ ET CE TEST NE POUVAIT RIEN ATTRAPER : le dépôt tamponnait `statut: "actif"` sur chaque ligne
  // (la RPC ne rendait pas la colonne), donc ce filtre n'était jamais atteint en production. Il
  // éprouvait une fonction pure sur des entrées qui n'existaient pas. Le statut descend depuis 0065.
  it("[R1] garde le fait CORRIGÉ — réécrire est une affirmation, pas un effacement (art. 16)", () => {
    const r = assemblerRappel({
      resume: null,
      faits: [
        fait("a", "actif", "2026-07-10T00:00:00Z"),
        fait("b", "corrige", "2026-07-11T00:00:00Z"),
        fait("c", "supprime", "2026-07-12T00:00:00Z"),
      ],
    });
    const cles = r.faits.map((f) => f.cleDedoublonnage).sort();
    expect(cles).toEqual(["a", "b"]);
  });

  it("[AC3] et le TOMBSTONE, lui, ne rentre jamais — élargir n'a pas ouvert l'effacement", () => {
    // Mutation-cible : retirer le filtre. Le seul statut qui sorte est `supprime`, et c'est le même
    // prédicat que `public.fait_est_vivant` en base — une seule définition, deux implémentations qui
    // ne peuvent plus diverger sans faire rougir `corriger-nest-pas-supprimer.test.ts`.
    const r = assemblerRappel({
      resume: null,
      faits: [fait("c", "supprime", "2026-07-12T00:00:00Z")],
    });
    expect(r.faits).toEqual([]);
  });
});

describe("assemblerRappel — matière datée & sélection (AC2, pertinence déterministe)", () => {
  it("trie les faits actifs par date décroissante (le récent d'abord)", () => {
    const r = assemblerRappel({
      resume: null,
      faits: [
        fait("vieux", "actif", "2026-07-01T00:00:00Z"),
        fait("recent", "actif", "2026-07-20T00:00:00Z"),
        fait("moyen", "actif", "2026-07-10T00:00:00Z"),
      ],
    });
    expect(r.faits.map((f) => f.cleDedoublonnage)).toEqual(["recent", "moyen", "vieux"]);
  });

  it("(revue 4.3, B) départage déterministe : 3 faits de MÊME date, limite=2 → sélection FIXE (par cleDedoublonnage)", () => {
    const memeDate = "2026-07-15T00:00:00Z";
    const entree = {
      resume: null,
      faits: [fait("charlie", "actif", memeDate), fait("alpha", "actif", memeDate), fait("bravo", "actif", memeDate)],
      limite: 2,
    };
    const r1 = assemblerRappel(entree);
    const r2 = assemblerRappel({ ...entree, faits: [...entree.faits].reverse() }); // ordre d'entrée inversé
    // Même sélection quelle que soit l'ordre d'entrée : les 2 premières clés triées (alpha, bravo).
    expect(r1.faits.map((f) => f.cleDedoublonnage)).toEqual(["alpha", "bravo"]);
    expect(r2.faits.map((f) => f.cleDedoublonnage)).toEqual(["alpha", "bravo"]);
  });

  it("`limite` plafonne le nombre de faits (base déterministe — le récent est prioritaire)", () => {
    const r = assemblerRappel({
      resume: null,
      faits: [
        fait("vieux", "actif", "2026-07-01T00:00:00Z"),
        fait("recent", "actif", "2026-07-20T00:00:00Z"),
        fait("moyen", "actif", "2026-07-10T00:00:00Z"),
      ],
      limite: 2,
    });
    expect(r.faits.map((f) => f.cleDedoublonnage)).toEqual(["recent", "moyen"]);
  });

  it("le fait retenu porte sa date (AC2 : la comparaison cite un point réel)", () => {
    const r = assemblerRappel({ resume: null, faits: [fait("a", "actif", "2026-07-10T00:00:00Z")] });
    expect(r.faits[0].creeLe).toBe("2026-07-10T00:00:00Z");
    // FaitRappel n'expose pas `statut` (par construction, actif).
    expect("statut" in r.faits[0]).toBe(false);
  });
});

describe("assemblerRappel — non-invention (AC5) & normalisation du résumé", () => {
  it("sans résumé ni fait actif : structure VIDE et honnête (aDeLaMatiere=false, jamais inventé)", () => {
    const r = assemblerRappel({ resume: null, faits: [] });
    expect(r).toEqual({ resume: null, faits: [], aDeLaMatiere: false });
  });

  it("un seul tombstone en entrée, aucun résumé → toujours aDeLaMatiere=false (le tombstone ne compte pas)", () => {
    const r = assemblerRappel({ resume: null, faits: [fait("b", "supprime", "2026-07-11T00:00:00Z")] });
    expect(r.aDeLaMatiere).toBe(false);
    expect(r.faits).toEqual([]);
  });

  it("un résumé seul (sans fait) suffit à donner de la matière", () => {
    const r = assemblerRappel({ resume: "elle revient sur son père", faits: [] });
    expect(r.aDeLaMatiere).toBe(true);
    expect(r.resume).toBe("elle revient sur son père");
  });

  it("un fait actif seul (sans résumé) suffit à donner de la matière", () => {
    const r = assemblerRappel({ resume: null, faits: [fait("a", "actif", "2026-07-10T00:00:00Z")] });
    expect(r.aDeLaMatiere).toBe(true);
  });

  it("un résumé blanc/vide est normalisé à null (pas de faux positif de matière)", () => {
    expect(assemblerRappel({ resume: "   ", faits: [] })).toEqual({ resume: null, faits: [], aDeLaMatiere: false });
    expect(assemblerRappel({ resume: "", faits: [] }).resume).toBeNull();
  });

  it("(revue 4.3, E) un résumé fait de caractères invisibles Unicode (U+200B) est normalisé à null", () => {
    // ​ (zéro-largeur, catégorie Cf) que String.trim() ne retire PAS → faux positif de matière sans la garde.
    expect(assemblerRappel({ resume: "​​", faits: [] })).toEqual({ resume: null, faits: [], aDeLaMatiere: false });
    expect(assemblerRappel({ resume: "⁠‍", faits: [] }).aDeLaMatiere).toBe(false); // U+2060, U+200D
  });
});
