import { describe, it, expect } from "vitest";
import { placerBranches, CANEVAS } from "@/render/arbre/geometrie";
import type { BrancheProjetee } from "@/lib/scene/projection";

/**
 * Story 4.6 (T5) — le placement DÉTERMINISTE des branches (pur, testable sans navigateur). L'ordre vient de la
 * projection ; la position ne porte AUCUN sens (pas de taxonomie).
 *
 * RE-REVUE (HAUTE) — l'invariant qui manquait. L'ancien placement calculait `frac = i / (n - 1)` : la position
 * dépendait du NOMBRE TOTAL, donc chaque naissance DÉPLAÇAIT toutes les branches déjà nées (mesuré : 221 unités
 * de canevas quand la 2ᵉ branche arrive). DESIGN.md l'interdit mot pour mot — « une branche née reste née, même
 * place, même échelle […] rien ne se réorganise ». Et l'ancienne garde « est STABLE » comparait `placer(l)` à
 * `placer(l)` sur la MÊME liste : elle prouvait le déterminisme, jamais la PERMANENCE. C'est ce que le premier
 * test ci-dessous tient désormais.
 */

const br = (id: string): BrancheProjetee => ({ id, etat: "naissance", intensite: 0, extraitSourceId: `s-${id}` });
const liste = (n: number) => Array.from({ length: n }, (_, i) => br(`b${i}`));

describe("placerBranches — PERMANENCE : une branche née ne bouge plus jamais", () => {
  it("[HAUTE / DESIGN.md] la position d'une branche ne dépend QUE de son rang, jamais du nombre total", () => {
    const complet = placerBranches(liste(24));
    for (let n = 1; n <= 24; n++) {
      const partiel = placerBranches(liste(n));
      for (let i = 0; i < n; i++) {
        expect(partiel[i].x, `branche ${i} déplacée en x quand l'arbre passe à ${n} branches`).toBeCloseTo(complet[i].x, 9);
        expect(partiel[i].y, `branche ${i} déplacée en y quand l'arbre passe à ${n} branches`).toBeCloseTo(complet[i].y, 9);
        expect(partiel[i].accroche.x).toBeCloseTo(complet[i].accroche.x, 9);
        expect(partiel[i].accroche.y).toBeCloseTo(complet[i].accroche.y, 9);
      }
    }
  });

  it("la NAISSANCE d'une branche ne bouge aucune des précédentes (le cas vécu : 1 → 2 branches)", () => {
    const avant = placerBranches(liste(1));
    const apres = placerBranches(liste(2));
    const deplacement = Math.hypot(apres[0].x - avant[0].x, apres[0].y - avant[0].y);
    expect(deplacement, "l'arbre s'est réorganisé sous les yeux de l'utilisatrice").toBe(0);
  });

  it("est DÉTERMINISTE : deux appels sur la même liste donnent exactement les mêmes positions", () => {
    const l = liste(4);
    expect(placerBranches(l)).toEqual(placerBranches(l));
  });
});

describe("placerBranches — forme de l'éventail", () => {
  it("aucune branche → aucune position", () => {
    expect(placerBranches([])).toEqual([]);
  });

  it("une seule branche pousse au centre (droit vers le haut)", () => {
    const [p] = placerBranches([br("a")]);
    expect(Math.round(p.x)).toBe(500); // centre du canevas
    expect(p.y).toBeLessThan(p.fourche.y); // vers le haut
  });

  it("le point d'accroche est SUR le bois, entre la fourche et l'extrémité", () => {
    for (const p of placerBranches(liste(8))) {
      const dFourche = Math.hypot(p.accroche.x - p.fourche.x, p.accroche.y - p.fourche.y);
      const dTotal = Math.hypot(p.x - p.fourche.x, p.y - p.fourche.y);
      expect(dFourche).toBeGreaterThan(0);
      expect(dFourche).toBeLessThan(dTotal);
    }
  });

  it("l'éventail reste DANS le canevas, quel que soit le nombre de branches", () => {
    for (const n of [1, 2, 3, 7, 15, 31, 60]) {
      for (const p of placerBranches(liste(n))) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(CANEVAS.largeur);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(CANEVAS.hauteur);
      }
    }
  });

  it("l'éventail est ÉQUILIBRÉ : à remplissage complet, autant de branches de chaque côté de l'axe", () => {
    // Le remplissage est centre-d'abord puis moitiés successives : il est exactement symétrique aux
    // effectifs 2^k − 1 (1, 3, 7, 15…), et au plus déséquilibré d'une branche entre deux.
    for (const n of [3, 7, 15]) {
      const places = placerBranches(liste(n));
      const gauche = places.filter((p) => p.x < 500 - 1e-9).length;
      const droite = places.filter((p) => p.x > 500 + 1e-9).length;
      expect(gauche, `éventail déséquilibré à ${n} branches`).toBe(droite);
    }
  });

  it("deux branches n'ont JAMAIS le même point d'accroche (une branche inatteignable serait perdue)", () => {
    for (const n of [2, 9, 20, 40]) {
      const acc = placerBranches(liste(n)).map((p) => `${p.accroche.x.toFixed(6)}|${p.accroche.y.toFixed(6)}`);
      expect(new Set(acc).size, `accroches confondues à ${n} branches`).toBe(n);
    }
  });

  it("l'écartement entre accroches se DÉGRADE GRACIEUSEMENT quand l'arbre se densifie", () => {
    // Un éventail de 150° à un seul niveau de ramification ne peut pas garder des cibles de 44 px
    // indéfiniment : l'écartement angulaire est divisé par deux à chaque niveau de remplissage. Ce que la
    // géométrie DOIT garantir, c'est que le raccourcissement par niveau maintienne un écart exploitable et
    // MONOTONE, jamais un effondrement. La cible cliquable, elle, est dimensionnée par le rendu à partir
    // de `ecartVoisin` (elle ne recouvre jamais sa voisine), et la vue liste reste l'équivalent
    // non spatial garanti (AC3) — c'est là que se règle l'adressabilité au-delà d'une quinzaine.
    const planchers: Record<number, number> = { 9: 25, 15: 25, 25: 15, 40: 12 };
    for (const [n, plancher] of Object.entries(planchers)) {
      const places = placerBranches(liste(Number(n)));
      const pire = Math.min(...places.map((p) => p.ecartVoisin));
      expect(pire, `accroches trop serrées à ${n} branches (${pire.toFixed(1)} unités)`).toBeGreaterThan(plancher);
    }
  });

  it("`ecartVoisin` dit la VÉRITÉ : c'est bien la distance à l'accroche la plus proche", () => {
    const places = placerBranches(liste(7));
    for (let i = 0; i < places.length; i++) {
      const attendu = Math.min(
        ...places.filter((_, j) => j !== i).map((q) => Math.hypot(places[i].accroche.x - q.accroche.x, places[i].accroche.y - q.accroche.y)),
      );
      expect(places[i].ecartVoisin).toBeCloseTo(attendu, 9);
    }
    expect(placerBranches(liste(1))[0].ecartVoisin, "une branche seule n'a pas de voisine").toBe(Infinity);
  });
});
