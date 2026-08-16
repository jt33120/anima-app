/**
 * memoire-retenue.ts — CE QU'ANAM RETIENT (Story 6.5, T2 ; FR-063/FR-064). Domaine PUR : zéro I/O,
 * aucun import (AD-1).
 *
 * La Story 4.2 a construit toute la base — tombstone, trigger anti-résurrection, fonction de fusion
 * unique — et personne ne pouvait rien en faire, faute d'un écran. Ce module porte les seules règles
 * qui manquaient : ce qui est AFFICHABLE, ce qu'une correction a le droit d'être, et combien de temps
 * dure une annulation.
 */

/** Les trois statuts de `fait_extrait` (0018). Recopiés ici : le domaine ne dépend d'aucune couche. */
export type StatutRetenu = "actif" | "corrige" | "supprime";

/**
 * Un fait tel qu'il atteint l'écran.
 *
 * ⚠️ AUCUN SCORE, ET IL N'Y EN A PAS EN BASE NON PLUS (AC1). Le type le rend impossible plutôt que
 * déconseillé — même geste que l'union `Ouverture` de la 4.10 : on ne peut pas afficher un chiffre
 * qu'on n'a jamais reçu. Un extracteur qui produirait un jour une confiance devrait la garder pour
 * lui : « Anam est sûre à 82 % que tu n'aimes pas ton travail » est une phrase qu'aucune personne ne
 * devrait avoir à lire sur elle-même.
 */
export interface FaitRetenu {
  /** La clé OPAQUE de dédoublonnage — l'adresse d'écriture, jamais du contenu en clair (0018). */
  readonly cle: string;
  readonly contenu: string;
  /** `corrige` ⇒ elle l'a réécrit elle-même. Voir `EST_DE_TOI`. */
  readonly statut: Exclude<StatutRetenu, "supprime">;
  /** Date ISO du jour de dernière mise à jour (AC1 : « avec sa date »). */
  readonly jour: string;
  /** Le message d'origine, affiché sur place (D5). `null` si la source a disparu du journal. */
  readonly source: { readonly texte: string; readonly jour: string } | null;
}

/**
 * ⚠️ UN TOMBSTONE NE S'AFFICHE PAS, et il n'a rien à afficher : son contenu est vide (0018, et
 * l'équivalence est désormais une contrainte de table — 0056). Le filtre vit ici plutôt que dans la
 * requête pour qu'un test puisse l'éprouver sans base ; la requête filtre AUSSI, avec une marge, pour
 * ne pas transporter de lignes mortes sur le réseau.
 */
export function estAffichable(statut: string, contenu: string): boolean {
  return (statut === "actif" || statut === "corrige") && contenu.trim() !== "";
}

/**
 * La fenêtre d'annulation d'une suppression (AC3) — dix secondes, au littéral de l'AC.
 *
 * ⚠️ LA SUPPRESSION EST ÉCRITE IMMÉDIATEMENT ; ce nombre ne retarde AUCUNE écriture. Le réflexe
 * inverse — différer l'écriture et l'annuler avant qu'elle parte — est plus simple et il est faux :
 * si elle ferme l'onglet dans les dix secondes, elle croit avoir effacé et rien n'a été effacé. Pour
 * un droit à l'effacement, le sens de l'erreur n'est pas négociable.
 */
export const FENETRE_ANNULATION_MS = 10_000;

/**
 * Une phrase de langage clair. Assez pour dire une chose vraie, trop peu pour y déposer un récit —
 * le journal existe pour ça, et il est la couche verbatim (AD-8).
 */
export const CORRECTION_LONGUEUR_MAX = 280;

export type RefusCorrection = "vide" | "trop_longue" | "inchangee";

/**
 * Ce qu'une correction a le droit d'être. Rend la phrase NETTOYÉE, ou le motif du refus.
 *
 * ⚠️ « VIDE » EST UN REFUS, ET C'EST LE PLUS IMPORTANT DES TROIS. Une correction vide serait une
 * suppression déguisée : la ligne resterait vivante au statut `corrige` sans rien à montrer, donc ni
 * affichable ni tombstone — la base le refuse depuis 0056, et ce refus-ci est là pour le DIRE plutôt
 * que de laisser remonter une erreur Postgres. Les deux gardes ne se couvrent pas l'une l'autre :
 * celle-ci explique, celle de la base empêche.
 */
export function validerCorrection(
  brut: string,
  actuel: string,
): { ok: true; contenu: string } | { ok: false; refus: RefusCorrection } {
  const contenu = brut.trim();
  if (contenu === "") return { ok: false, refus: "vide" };
  if (contenu.length > CORRECTION_LONGUEUR_MAX) return { ok: false, refus: "trop_longue" };
  // Réécrire à l'identique n'est pas une correction : ce serait changer l'origine du fait — donc le
  // soustraire à toute ré-extraction future — sans que rien n'ait changé de son sens.
  if (contenu === actuel.trim()) return { ok: false, refus: "inchangee" };
  return { ok: true, contenu };
}
