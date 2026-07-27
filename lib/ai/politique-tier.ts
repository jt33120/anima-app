import "server-only";
import type { CapaciteIa, TierIa } from "./port";

/**
 * Politique de tier — résolveur MINIMAL `capacité → tier → modèle` (Story 2.1).
 *
 * ⚠️ La politique COMPLÈTE `(capacité, niveau_sécurité) → tier` (AD-5) — notamment « la détection
 * de détresse force TOUJOURS le modèle le plus capable » — vit dans les Stories 2.2/2.3. Ne PAS
 * l'ajouter ici : 2.1 ne connaît pas encore la dimension sécurité.
 *
 * Modèles par id DATÉ (jamais `-latest`) : un repoint amont silencieux ne doit pas changer le
 * comportement sur le chemin art. 9. (Vérifié 2026-07-27 : Small 4 / Large 3.)
 */

const MODELE: Record<TierIa, string> = {
  leger: "mistral-small-2603",
  fort: "mistral-large-2512",
};

/** Échange courant → léger ; reconceptualisation & synthèse → fort. */
export function tierPour(capacite: CapaciteIa): TierIa {
  return capacite === "echange" ? "leger" : "fort";
}

export function modelePour(tier: TierIa): string {
  return MODELE[tier];
}
