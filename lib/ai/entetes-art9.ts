import "server-only";

/**
 * En-têtes des réponses art. 9 (AD-4 ; conventions « Routes art. 9 », NFR-020).
 *
 * - `Cache-Control: no-store` : **EFFECTIF ici** — jamais de cache CDN d'une réponse art. 9.
 * - `Content-Security-Policy` : **DÉCLARATION** de la politique art. 9. ⚠️ Sur une réponse d'API
 *   JSON (consommée par `fetch`/XHR), le navigateur **N'APPLIQUE PAS** cette CSP — seule la CSP
 *   d'un **document** (page) est appliquée. Le vrai verrou `connect-src 'self'` anti-exfiltration
 *   vit donc sur la **PAGE de conversation (Story 2.2)**, pas ici. On envoie quand même l'en-tête
 *   comme déclaration cohérente d'intention, mais **il ne protège rien sur cette route** : ne pas
 *   s'y fier (revue 2.1). Le nonce (`script-src 'nonce-…'`) est aussi une affaire de page (2.2).
 */
export const CSP_ART9 = [
  "default-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

export const ENTETES_ART9: Record<string, string> = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": CSP_ART9,
};
