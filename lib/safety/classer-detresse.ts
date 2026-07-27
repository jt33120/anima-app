import type { NiveauSecurite } from "@/lib/ai/port";

/**
 * Classifieur de détresse — logique PURE (Story 2.3, AC1/AC3 ; §5). Aucune I/O, aucun import infra
 * (AD-1/AD-10), sur le patron de `barriere-minorite`. Traduit une VALEUR DE NIVEAU (0-3, déjà
 * extraite de la sortie du modèle FORT — cf. `detecteur-detresse`) en un `VerdictSecurite` que le
 * pipeline sécurité applique.
 *
 * ⚠️ Ce module ne porte AUCUN jugement clinique : les seuils et le prompt qui PRODUISENT le niveau
 * vivent dans le détecteur et sont PROVISOIRES (porte pré-lancement, PRD §5). Ici, uniquement la
 * MACHINE de décision : niveau → suspension du travail de schéma (FR-037) + étiquette de décision.
 *
 * Invariant dur : le DOUTE penche vers la sécurité. Une entrée illisible / hors 0-3 ne retombe
 * JAMAIS sur niveau 0 — elle produit un repli sûr (`repliSur`).
 */

export type DecisionSecurite = "poursuivre" | "adoucir" | "intervenir" | "urgence" | "repli_sur";

export interface VerdictSecurite {
  /** Niveau §5 : 0 journée difficile · 1 détresse marquée · 2 idéation passive · 3 idéation active. */
  niveau: NiveauSecurite;
  /** Étiquette de décision (non clinique) — la formulation réelle d'Anam relève de la Story 2.6. */
  decision: DecisionSecurite;
  /** FR-037 : dès niveau ≥ 1, tout travail de schéma/contradiction/reconceptualisation est suspendu. */
  supprimerTravailSchema: boolean;
}

/**
 * Niveau plancher du repli sûr (AD-15) : 1 = « détresse marquée ». Assez pour suspendre le schéma et
 * poser `limites_levees` (dérive de niveau ≥ 1, AD-17), SANS fabriquer une idéation (jamais 2/3 par
 * défaut). Quand on ne peut pas classer, on protège — on ne dramatise pas.
 */
export const NIVEAU_REPLI: NiveauSecurite = 1;

/** Verdict de repli sûr — utilisé par le détecteur quand la classification au fort est impossible. */
export function repliSur(): VerdictSecurite {
  return { niveau: NIVEAU_REPLI, decision: "repli_sur", supprimerTravailSchema: true };
}

/** Traduit un niveau (issu du modèle) en verdict. Entrée illisible / hors 0-3 → repli sûr. */
export function classerDetresse(niveau: unknown): VerdictSecurite {
  switch (niveau) {
    case 0:
      return { niveau: 0, decision: "poursuivre", supprimerTravailSchema: false };
    case 1:
      return { niveau: 1, decision: "adoucir", supprimerTravailSchema: true };
    case 2:
      return { niveau: 2, decision: "intervenir", supprimerTravailSchema: true };
    case 3:
      return { niveau: 3, decision: "urgence", supprimerTravailSchema: true };
    default:
      return repliSur(); // le doute penche vers la sécurité (jamais niveau 0)
  }
}
