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

/**
 * CSP des PAGES art. 9 (Story 2.2, B1) — LE verrou anti-exfiltration EFFECTIF : contrairement à
 * `CSP_ART9` (inerte sur une réponse d'API), le navigateur APPLIQUE la CSP d'un DOCUMENT. Posée par
 * `proxy.ts` avec un nonce par requête. `connect-src 'self'` bloque tout POST art. 9 vers un tiers.
 *
 * Le nonce + `strict-dynamic` verrouille les scripts : Next nonce AUTOMATIQUEMENT ses scripts
 * d'hydratation RSC en lisant l'en-tête CSP de la REQUÊTE (sans le nonce sur la requête → écran
 * blanc). `'unsafe-eval'` UNIQUEMENT en dev (React reconstruit les stacks). `style-src` garde
 * `'unsafe-inline'` (pas de Tailwind ; next/font self-hosté injecte des styles — nonce et
 * 'unsafe-inline' sont mutuellement exclusifs par spec, on choisit le sûr et pragmatique).
 *
 * Source UNIQUE des directives (même intention que `CSP_ART9`) : `proxy.ts` n'a qu'à injecter le nonce.
 */
export function cspPageArt9(nonce: string, options: { dev: boolean }): string {
  const scriptSrc = options.dev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    scriptSrc,
    "connect-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; ");
}
