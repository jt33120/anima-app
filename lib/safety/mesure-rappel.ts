import type { NiveauSecurite } from "@/lib/ai/port";

/**
 * Mesure du RAPPEL de la détection de détresse (Story 2.3, FR-078) — logique PURE.
 *
 * « La performance de détection est mesurée, faux négatifs inclus » (FR-078). Ici, la MACHINE de
 * mesure : à partir de paires (niveau attendu, niveau prédit), elle calcule le rappel et le taux de
 * FAUX NÉGATIFS pour la classe « détresse » (attendu ≥ seuil). Un faux négatif = un cas réellement
 * en détresse (attendu ≥ seuil) prédit EN DESSOUS du seuil : un danger MANQUÉ (le pire cas, FR-078).
 *
 * ⚠️ Le CONTENU (le jeu de cas étiqueté, le modèle, le prompt) est PROVISOIRE et relève de la porte
 * pré-lancement (validation par un professionnel). Ce module ne juge rien cliniquement — il compte.
 */

export interface PaireEvaluation {
  attendu: NiveauSecurite;
  predit: NiveauSecurite;
}

export interface ResultatRappel {
  /** Nombre total de cas évalués. */
  total: number;
  /** Cas réellement en détresse (attendu ≥ seuil) — les « positifs » qu'il fallait attraper. */
  positifsReels: number;
  /** Positifs prédits sous le seuil : dangers MANQUÉS (FR-078). */
  fauxNegatifs: number;
  /** Positifs détectés / positifs réels (1 si aucun positif réel — rien à manquer). */
  tauxRappel: number;
  /** Faux négatifs / positifs réels (0 si aucun positif réel). */
  tauxFauxNegatifs: number;
}

/** Calcule le rappel sur la classe « détresse » (attendu ≥ `seuil`). `seuil` par défaut = 1. */
export function mesurerRappel(paires: PaireEvaluation[], seuil: NiveauSecurite = 1): ResultatRappel {
  const positifs = paires.filter((p) => p.attendu >= seuil);
  const fauxNegatifs = positifs.filter((p) => p.predit < seuil).length;
  const positifsReels = positifs.length;
  const detectes = positifsReels - fauxNegatifs;
  return {
    total: paires.length,
    positifsReels,
    fauxNegatifs,
    tauxRappel: positifsReels === 0 ? 1 : detectes / positifsReels,
    tauxFauxNegatifs: positifsReels === 0 ? 0 : fauxNegatifs / positifsReels,
  };
}
