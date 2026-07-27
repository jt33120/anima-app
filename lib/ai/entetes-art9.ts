import "server-only";

/**
 * En-têtes des réponses art. 9 (AD-4 ; conventions « Routes art. 9 », NFR-002/NFR-020).
 *
 * - `no-store` : jamais de cache CDN d'une réponse art. 9.
 * - CSP stricte : `connect-src 'self'` → le navigateur ne peut exfiltrer vers AUCUN tiers ;
 *   `frame-ancestors 'none'` / `object-src 'none'` / `base-uri 'none'` durcissent la surface.
 *   Aucun moniteur/APM/analytics tiers n'est admis.
 *
 * Le **nonce** (`script-src 'nonce-…' 'strict-dynamic'`) concerne les PAGES art. 9 et arrive avec
 * l'écran de conversation (Story 2.2). Ici, réponses d'API sans script inline → CSP statique.
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
