/**
 * Barrière de minorité — logique PURE (Story 1.9, FR-071).
 *
 * Premier vrai module de la couche `lib/safety/` : la sécurité ne dépend d'aucune infra
 * (AD-1/AD-10, aucun import React/Next/Supabase ici). La DURÉE de suppression vit ICI, en un
 * seul endroit — AD-14 : les échéances sont PARAMÉTRÉES, jamais codées en dur, et surtout
 * jamais figées dans le SQL (le SQL reçoit une DATE déjà calculée). Le moteur unique de
 * rétention (Story 6.8) et l'application de la barrière lisent cette même valeur.
 */

/** FR-071 : les données d'un compte suspendu pour minorité sont supprimées sous 30 jours. */
export const DELAI_SUPPRESSION_MINORITE_JOURS = 30;

/**
 * Échéance de suppression = `maintenant` + le délai paramétré, en date UTC `YYYY-MM-DD`
 * (le type de la colonne `utilisatrice.echeance_suppression`). Sans dépendance à l'heure de
 * la journée : deux détections le même jour visent la même date.
 */
export function echeanceSuppression(maintenant: Date = new Date()): string {
  const d = new Date(maintenant);
  d.setUTCDate(d.getUTCDate() + DELAI_SUPPRESSION_MINORITE_JOURS);
  return d.toISOString().slice(0, 10);
}
