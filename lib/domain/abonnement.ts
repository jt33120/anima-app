/**
 * Cœur PUR de l'abonnement (Story 3.1, AD-1/AD-10). AUCUN import : ni SDK Stripe, ni Supabase, ni Next.
 * La route webhook extrait les primitives d'un événement Stripe (couche infra, `lib/stripe/`) puis
 * appelle ces fonctions ; la PROJECTION d'état vit ICI (testable sans SDK), la persistance au dépôt.
 */

export type EtatAbonnement = "actif" | "resilie" | "expire";

/**
 * Dérive l'état d'abonnement du `subscription.status` Stripe — l'AUTORITÉ canonique de l'état
 * (`customer.subscription.*`). Mapping :
 *  - `active` | `trialing`                                             → `actif`   (premium)
 *  - `canceled`                                                        → `resilie` (résiliation aboutie)
 *  - `past_due` | `unpaid` | `incomplete` | `incomplete_expired` | `paused` (et tout autre) → `expire`
 *
 * Note (FR-060/3.5) : une résiliation « en fin de période » garde `status = active` chez Stripe → l'état
 * reste `actif` (l'accès continue jusqu'à la fin payée) ; il ne passe `resilie` qu'au
 * `customer.subscription.deleted`. Le drapeau `cancel_at_period_end` est donc PORTÉ par l'affichage
 * (3.2), pas par l'état ici.
 */
export function etatDepuisStatutStripe(statut: string): EtatAbonnement {
  switch (statut) {
    case "active":
    case "trialing":
      return "actif";
    case "canceled":
      return "resilie";
    default:
      return "expire";
  }
}

/**
 * L'ENTITLEMENT premium (source de vérité unique, AC4) : premium ⟺ abonnement `actif`. Les gardes par
 * fonctionnalité (Stories 3.3/3.4) interrogent CETTE dérivation, jamais un flag stocké en double.
 */
export function estPremium(abonnement: { etat: EtatAbonnement } | null | undefined): boolean {
  return abonnement?.etat === "actif";
}
