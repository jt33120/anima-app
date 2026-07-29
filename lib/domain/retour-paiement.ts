/**
 * Ligne système SOBRE au retour de Stripe (Story 3.1, AC5). Cœur PUR — aucun import. Registre PRODUIT :
 * jamais la voix d'Anam (aucune 1re personne, aucun affect), jamais dramatisé, jamais de relance.
 * Contenu PROVISOIRE (intention produit, à valider). Le RENDU in-fil de cette ligne relève de 3.2
 * (couplé à la carte streamée) ; 3.1 fournit la fonction pure + les cibles de redirection.
 *
 * Stripe Checkout ne redirige que sur `succes` (success_url) ou `annule` (cancel_url) ; un échec de
 * paiement récurrent passe par le webhook (`invoice.payment_failed`), pas par une redirection —
 * `echec` couvre néanmoins le cas pour complétude d'AC5.
 */
export type ResultatPaiement = "succes" | "echec" | "annule";

const LIGNES: Record<ResultatPaiement, string> = {
  succes: "Ton abonnement est actif.",
  echec: "Le paiement n'a pas abouti.",
  annule: "Paiement interrompu.",
};

export function ligneRetourPaiement(resultat: ResultatPaiement): string {
  return LIGNES[resultat];
}
