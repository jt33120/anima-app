/**
 * bilan.ts — la STRUCTURATION du bilan de clôture (Story 2.9, T4), cœur PUR (AD-1). Transforme la
 * prose générée (tier fort, `consigneBilan`) en un bloc document `{titre, points}`. La STRUCTURE est
 * décidée SERVEUR : le rendu reçoit une donnée déjà structurée et ne parse aucun markdown (il reste
 * muet, AD-7). Découpe en lignes ; retire une éventuelle puce ou un numéro de tête.
 *
 * Fail-safe : rien de structurable (moins d'un titre + un point) → `null`. La route n'émet alors PAS
 * de trame `bilan` — jamais un bloc vide ou malformé (la clôture reste valide sans bilan).
 *
 * PUR : aucune dépendance (texte → structure). Aucun libellé produit ici (rien à valider par le
 * contrôle de contenu) — la prose vient du modèle, sous `consigneBilan`.
 */

export interface BilanStructure {
  titre: string;
  points: string[];
}

/** Retire une puce (`- `, `* `, `• `, `> `, `#`) ou un numéro de liste (`1.`, `2)`) de tête + blancs. */
function nettoyer(ligne: string): string {
  return ligne
    .replace(/^[\s>#*•\-–—]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

/** Prose générée → `{titre, points}`, ou `null` s'il n'y a pas au moins un titre et un point. */
export function structurerBilan(texte: string): BilanStructure | null {
  const lignes = texte.split("\n").map(nettoyer).filter((l) => l.length > 0);
  if (lignes.length < 2) return null; // besoin d'un titre ET d'au moins un point
  const [titre, ...points] = lignes;
  return { titre, points };
}
