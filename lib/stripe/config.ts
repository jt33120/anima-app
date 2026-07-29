import "server-only";

/**
 * Configuration d'abonnement (Story 3.1). Valeurs NON secrètes, mais confinées serveur par cohérence
 * (le prix et le libellé n'ont rien à faire dans un bundle client).
 */

/** Prix unique de l'abonnement annuel — 69,00 € en ENTIERS CENTIMES EUR (convention « Data & formats »). */
export const PRIX_ABONNEMENT_ANNUEL_CENTIMES = 6900;

/** Devise de facturation (EUR). */
export const DEVISE_ABONNEMENT = "eur" as const;

/**
 * Libellé de relevé bancaire (AC6) — NEUTRE et lu depuis un PARAMÈTRE, jamais codé en dur. Sa valeur
 * finale dépend de l'entité juridique qui encaisse (porte pré-lancement Z-1). En mode `subscription`,
 * le libellé EFFECTIF sur le relevé se règle au niveau COMPTE Stripe (`statement_descriptor_prefix`,
 * porte ops) ; 3.1 paramètre la valeur et l'attache à la session pour traçabilité.
 */
export function libelleReleveBancaire(): string | undefined {
  const v = process.env.STRIPE_STATEMENT_DESCRIPTOR?.trim();
  return v ? v : undefined;
}
