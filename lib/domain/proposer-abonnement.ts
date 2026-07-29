/**
 * proposer-abonnement.ts — le PRÉDICAT PUR du gate de proposition d'abonnement (Story 3.2, AC1/AC6,
 * AD-1). La carte ne se propose QUE sous un bilan RÉELLEMENT émis (elle s'y ancre) ET si l'utilisatrice
 * n'est pas déjà premium.
 *
 * La DÉTRESSE est déjà filtrée EN AMONT : le bilan lui-même n'est produit qu'hors détresse
 * (`clotureAutorisee = niveauSecurite === 0 && !limitesLevees`, route 2.9) → pas de bilan = pas de
 * carte (AD-9). Aucune 2ᵉ dérivation de `limites_levees` ici (source unique, AD-17) : `bilanEmis` porte
 * déjà le verdict de sécurité.
 */
export function doitProposerAbonnement(params: { bilanEmis: boolean; premium: boolean }): boolean {
  return params.bilanEmis && !params.premium;
}
