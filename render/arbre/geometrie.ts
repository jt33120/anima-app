/**
 * geometrie.ts — Placement DÉTERMINISTE des branches sur le canevas (pur, testable sans navigateur).
 * L'ordre vient de la projection (par date_naissance) ; la position ne porte AUCUN sens (pas de taxonomie —
 * l'illumination sémantique est parquée).
 *
 * INVARIANT CENTRAL (DESIGN.md) : « une branche née reste née, même place, même échelle […] rien ne se
 * réorganise ». La position d'une branche est donc fonction de son RANG SEUL — jamais du nombre total.
 *
 * RE-REVUE (HAUTE) — l'ancien placement calculait `frac = i / (n − 1)`, donc chaque naissance déplaçait
 * toutes les branches déjà nées (221 unités de canevas mesurées entre 1 et 2 branches). L'arbre se
 * réorganisait sous les yeux de l'utilisatrice, le cadrage mémorisé pointait le vide, et la fiche ouverte
 * restait ancrée sur une branche qui avait bougé.
 *
 * Le rendu importe `lib/scene` (seule dépendance autorisée, AD-10) ; il n'y ÉCRIT rien.
 */

import type { BrancheProjetee } from "@/lib/scene/projection";

/** Repère logique du canevas (viewBox SVG). Le pan/zoom est une transform par-dessus (vue.ts). */
export const CANEVAS = { largeur: 1000, hauteur: 1000 } as const;
const FOURCHE = { x: 500, y: 560 } as const; // d'où partent les branches (au-dessus du tronc)
const RAYON = 330; // longueur de référence d'une branche depuis la fourche
const OUVERTURE_DEG = 150; // éventail total (−75°..+75° autour de la verticale)
const PART_ACCROCHE = 0.55; // le point d'accroche est à 55 % de la branche, sur le bois
/** Raccourcissement par niveau de remplissage : sépare RADIALEMENT des branches angulairement voisines.
 *  0,09 est l'optimum mesuré (écartement max à 9–15 branches sans que les tardives deviennent des brindilles). */
const RETRAIT_PAR_NIVEAU = 0.09;

export interface BranchePlacee {
  readonly branche: BrancheProjetee;
  /** Extrémité de la branche (le bouquet de feuillage). */
  readonly x: number;
  readonly y: number;
  /** Point d'accroche cliquable — sur le bois. */
  readonly accroche: { readonly x: number; readonly y: number };
  readonly fourche: { readonly x: number; readonly y: number };
  /**
   * Distance (unités de canevas) à l'accroche la plus proche. Le rendu s'en sert pour DIMENSIONNER la zone
   * cliquable : une cible plus large que la moitié de cet écart recouvrirait sa voisine et ouvrirait la
   * mauvaise branche (re-revue, HAUTE). `Infinity` quand la branche est seule.
   */
  readonly ecartVoisin: number;
}

/**
 * Fraction d'ouverture attribuée au rang `i`, par INVERSION BINAIRE (suite de van der Corput).
 * Elle remplit l'éventail du centre vers les bords en coupant à chaque fois le plus grand vide restant :
 *   rang 0 → 1/2 (droit vers le haut) · 1 → 1/4 · 2 → 3/4 · 3 → 1/8 · 4 → 5/8 · 5 → 3/8 · 6 → 7/8 …
 * Propriété recherchée : la valeur du rang `i` ne dépend QUE de `i`. Une naissance ajoute une position,
 * elle n'en déplace aucune — et la répartition reste régulière à tout effectif.
 */
function fractionDuRang(i: number): number {
  let k = i + 1; // le rang 0 doit tomber au centre (1/2), donc on inverse k = i + 1
  let resultat = 0;
  let poids = 0.5;
  while (k > 0) {
    resultat += (k & 1) * poids;
    poids /= 2;
    k >>= 1;
  }
  return resultat;
}

/** Niveau de remplissage du rang `i` : 0 pour la 1re branche, 1 pour les 2 suivantes, 2 pour les 4 suivantes… */
function niveauDuRang(i: number): number {
  return Math.floor(Math.log2(i + 1));
}

export function placerBranches(branches: readonly BrancheProjetee[]): BranchePlacee[] {
  const sansEcart = branches.map((branche, i) => {
    const angleDeg = (fractionDuRang(i) - 0.5) * OUVERTURE_DEG; // −75°..+75°
    const rad = (angleDeg * Math.PI) / 180;
    // Les branches d'un niveau plus profond sont un peu plus courtes : c'est ce qui empêche deux branches
    // angulairement voisines de se confondre quand l'arbre se densifie (et c'est la forme d'un vrai arbre).
    const longueur = RAYON * (1 - RETRAIT_PAR_NIVEAU * niveauDuRang(i));
    const x = FOURCHE.x + longueur * Math.sin(rad);
    const y = FOURCHE.y - longueur * Math.cos(rad);
    const ax = FOURCHE.x + longueur * PART_ACCROCHE * Math.sin(rad);
    const ay = FOURCHE.y - longueur * PART_ACCROCHE * Math.cos(rad);
    return { branche, x, y, accroche: { x: ax, y: ay }, fourche: FOURCHE };
  });

  return sansEcart.map((p, i) => {
    let ecartVoisin = Infinity;
    for (let j = 0; j < sansEcart.length; j++) {
      if (j === i) continue;
      const d = Math.hypot(p.accroche.x - sansEcart[j].accroche.x, p.accroche.y - sansEcart[j].accroche.y);
      if (d < ecartVoisin) ecartVoisin = d;
    }
    return { ...p, ecartVoisin };
  });
}
