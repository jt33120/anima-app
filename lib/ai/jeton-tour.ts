/**
 * jeton-tour.ts — Le JETON DE TOUR LOGIQUE (Story 3.4, AC1). PUR (aucun import) → testable en env node.
 *
 * Le client fournit un identifiant STABLE par tour logique (`crypto.randomUUID()`), réutilisé au
 * « Réessayer » : le retry est le MÊME tour logique. Le serveur l'emploie comme clé d'idempotence du
 * métrage `usage_ia`, scopée à l'utilisatrice par l'index unique `(utilisatrice_id, cle_idempotence)`.
 * Effet : un « Réessayer » ne recompte pas les tokens (upsert no-op) et ne sur-consomme pas
 * l'allocation résiduelle (3.4). Clôt la dette « jeton de tour stable » (2.2/2.4/2.7/2.9).
 *
 * Le serveur n'accepte qu'un UUID CANONIQUE (8-4-4-4-12 hex) — tout autre (absent, mal formé, non
 * borné) retombe sur l'UUID SERVEUR par requête (repli sûr : jamais de chaîne attaquante non bornée en
 * base ; au pire on perd l'idempotence d'UN retour client, jamais la sécurité). Un jeton spoofé ne
 * collisionne que le PROPRE métrage de la spoofeuse (index scopé, revue 2.1).
 *
 * Ce n'est PAS de l'art. 9 : un UUID opaque, aucun contenu. `usage_ia` reste sans colonne de contenu.
 */
const UUID_CANONIQUE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function jetonTourValide(v: unknown): string | null {
  return typeof v === "string" && UUID_CANONIQUE.test(v) ? v : null;
}
