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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LA FENÊTRE DE L'ARTICLE L215-1 (revue du 2026-08-12, M10)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** Au plus TARD un mois avant le terme. En deçà, l'information part hors délai. */
export const L215_JOURS_MIN = 30;
/** Au plus TÔT trois mois avant le terme. Au-delà, elle part trop tôt (92 j = trois mois pleins). */
export const L215_JOURS_MAX = 92;

export type VerdictL215 = "dans_la_fenetre" | "trop_tot" | "trop_tard" | "echeance_illisible";

/**
 * Où tombe une information de reconduction par rapport à la fenêtre légale ?
 *
 * ── POURQUOI C'EST UNE FONCTION, ET PAS DEUX COMPARAISONS DANS LA ROUTE ─────────────────────────────────
 *
 * Elle y était. Écrite ainsi :
 *
 *     const joursAvant = (new Date(echeance).getTime() - Date.now()) / 86_400_000;
 *     if (joursAvant < 30 || joursAvant > 92) { console.error(…); }
 *
 * Deux défauts, dont un seul se voyait. Le premier : aucun test ne pouvait l'atteindre sans monter la
 * route entière. Le second, découvert en la déplaçant — une échéance ILLISIBLE rend `NaN`, et toute
 * comparaison avec `NaN` est FAUSSE. `NaN < 30` est faux, `NaN > 92` est faux : la garde se taisait
 * précisément dans le cas où l'on ne sait rien de la date. Le silence le plus dangereux est celui
 * qu'on prend pour une approbation.
 *
 * ── CE QUE LA FONCTION NE FAIT PAS ──────────────────────────────────────────────────────────────────────
 *
 * Elle ne DÉCIDE pas d'envoyer. La date d'émission d'`invoice.upcoming` est un réglage du tableau de
 * bord Stripe, que le code ne peut pas corriger ; informer hors délai vaut toujours mieux que ne pas
 * informer. Elle rend un verdict pour que la route puisse CRIER — cesser d'être aveugle est tout ce
 * que cette couche peut offrir.
 */
export function fenetreInformationReconduction(echeanceIso: string, maintenant: Date): VerdictL215 {
  const jours = joursAvantEcheance(echeanceIso, maintenant);
  if (jours === null) return "echeance_illisible";
  if (jours < L215_JOURS_MIN) return "trop_tard"; // trop près du terme — y compris une échéance PASSÉE
  if (jours > L215_JOURS_MAX) return "trop_tot";
  return "dans_la_fenetre";
}

/** Jours (fractionnaires) jusqu'à l'échéance, ou `null` si la date est illisible. Jamais `NaN`. */
export function joursAvantEcheance(echeanceIso: string, maintenant: Date): number | null {
  const terme = new Date(echeanceIso).getTime();
  if (Number.isNaN(terme)) return null;
  return (terme - maintenant.getTime()) / 86_400_000;
}
