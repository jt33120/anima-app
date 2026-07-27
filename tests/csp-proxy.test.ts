import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cspPageArt9 } from "@/lib/ai/entetes-art9";

/**
 * Story 2.2 (B1) — la CSP NONCE des pages art. 9 et la migration middleware → proxy (Next 16).
 * Deux niveaux : la fabrique de directives `cspPageArt9` testée en PUR, et `proxy.ts` gardé par
 * lecture du source (le vrai « pas d'écran blanc / pas de boucle de déconnexion » se vérifie sur un
 * navigateur — voir Completion Notes). Les gardes retirent les commentaires (test du CODE, pas prose).
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const proxy = sansCommentaires(readFileSync(resolve(racine, "proxy.ts"), "utf-8"));
const middlewareSupabase = sansCommentaires(
  readFileSync(resolve(racine, "lib/data/supabase/middleware.ts"), "utf-8"),
);

describe("cspPageArt9 — le verrou anti-exfiltration (AC6, NFR-020)", () => {
  const nonce = "abc123==";

  it("pose connect-src 'self' (bloque tout POST art. 9 vers un tiers)", () => {
    expect(cspPageArt9(nonce, { dev: false })).toMatch(/connect-src 'self'/);
  });

  it("embarque le nonce fourni + strict-dynamic sur script-src (Next nonce ses scripts RSC)", () => {
    const csp = cspPageArt9(nonce, { dev: false });
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toMatch(/script-src[^;]*'strict-dynamic'/);
  });

  it("verrouille l'ossature : default-src/base-uri/object-src/frame-ancestors serrés", () => {
    const csp = cspPageArt9(nonce, { dev: false });
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/base-uri 'none'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });

  it("'unsafe-eval' UNIQUEMENT en dev (jamais en production)", () => {
    expect(cspPageArt9(nonce, { dev: true })).toMatch(/'unsafe-eval'/);
    expect(cspPageArt9(nonce, { dev: false })).not.toMatch(/'unsafe-eval'/);
  });

  it("garde style-src 'unsafe-inline' (next/font self-hosté ; pas de nonce sur les styles)", () => {
    expect(cspPageArt9(nonce, { dev: false })).toMatch(/style-src 'self' 'unsafe-inline'/);
  });
});

describe("proxy.ts — contrat Next 16 (B1)", () => {
  it("exporte une fonction `proxy` (ex-middleware)", () => {
    expect(proxy).toMatch(/export\s+async\s+function\s+proxy\s*\(/);
  });

  it("ne déclare AUCUN runtime (un proxy tourne toujours en Node — E1031 sinon)", () => {
    expect(proxy).not.toMatch(/export\s+const\s+runtime/);
    expect(proxy).not.toMatch(/runtime:\s*["']/);
  });

  it("génère un nonce par requête (randomUUID → base64) et pose la CSP", () => {
    expect(proxy).toMatch(/crypto\.randomUUID\(\)/);
    expect(proxy).toMatch(/cspPageArt9\(/);
  });

  it("passe x-nonce ET la CSP sur la REQUÊTE propagée (Next en extrait le nonce → PAS d'écran blanc)", () => {
    // La CSP de REQUÊTE est le mécanisme framework : sans elle, Next ne nonce pas ses scripts RSC.
    expect(proxy).toMatch(
      /updateSession\(\s*request\s*,\s*\{[\s\S]*?["']x-nonce["']\s*:[\s\S]*?["']Content-Security-Policy["']\s*:/,
    );
  });

  it("pose la CSP sur la RÉPONSE (le navigateur applique la CSP du document)", () => {
    expect(proxy).toMatch(/response\.headers\.set\(\s*["']Content-Security-Policy["']/);
  });

  it("écarte /api de la CSP de page, avec /api/ EXACT (pas /apiXYZ) — la route pose ses en-têtes", () => {
    expect(proxy).toMatch(/pathname\s*===\s*["']\/api["']/);
    expect(proxy).toMatch(/pathname\.startsWith\(\s*["']\/api\/["']\)/);
  });

  it("réutilise `cspPageArt9` (source UNIQUE des directives, pas de CSP réécrite à la main)", () => {
    expect(proxy).toMatch(/from\s+["']@\/lib\/ai\/entetes-art9["']/);
  });

  it("continue de rafraîchir la session (updateSession appelé — pas de régression 1.3)", () => {
    expect(proxy).toMatch(/updateSession\(/);
  });

  it("le matcher exclut les assets statiques et _next", () => {
    expect(proxy).toMatch(/_next\/static/);
    expect(proxy).toMatch(/matcher/);
  });
});

describe("Migration : plus de middleware.ts ambigu + cookies repropagés (anti-régression B1)", () => {
  it("middleware.ts a bien été SUPPRIMÉ (sinon double fichier ambigu avec proxy.ts)", () => {
    expect(existsSync(resolve(racine, "middleware.ts"))).toBe(false);
    expect(existsSync(resolve(racine, "src/middleware.ts"))).toBe(false);
  });

  it("updateSession RECONSTRUIT les en-têtes depuis request.headers LIVE dans setAll (cookies frais, pas figés)", () => {
    // Le vrai piège n°1 : forwarder une COPIE figée des en-têtes (prise avant le refresh) → la page
    // rejoue l'ANCIEN cookie → boucle de déconnexion. La garde exige : (1) repropagation des cookies,
    // (2) la réponse RECONSTRUITE dans setAll (après mutation), (3) relue de request.headers vivant,
    // (4) le nonce MERGÉ (pas un remplacement figé).
    expect(middlewareSupabase, "cookies non repropagés").toMatch(/response\.cookies\.set\(/);
    expect(middlewareSupabase, "réponse non reconstruite dans setAll").toMatch(
      /setAll\([\s\S]*?construireReponse\(\)/,
    );
    expect(middlewareSupabase, "en-têtes non relus (copie figée ?)").toMatch(
      /new Headers\(request\.headers\)/,
    );
    expect(middlewareSupabase, "nonce non mergé").toMatch(/enTetesSupplementaires/);
  });
});
