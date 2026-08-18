import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { cspPageArt9 } from "@/lib/ai/entetes-art9";

/**
 * csp-nempeche-pas-le-produit.test.ts — LA CSP TENAIT DEUX CHEMINS FERMÉS
 * (revue adversariale du 2026-08-18, R5 et R6).
 *
 * ══ CE QUE LA SUITE NE POUVAIT PAS VOIR ═══════════════════════════════════════════════════════
 *
 * Aucun des deux projets Vitest n'applique de CSP, et le prérendu statique n'existe qu'en build de
 * PRODUCTION. Les deux défauts ci-dessous ont donc dû être MESURÉS dans un navigateur
 * (`verif-csp-*.mjs`, `next build && next start`), et ce fichier grave ce que la mesure a établi.
 *
 * ── R5 — /aide était prérendue, donc sans un seul script ────────────────────────────────────────
 *
 * `proxy.ts` pose un nonce NOUVEAU À CHAQUE REQUÊTE. Une page prérendue au build porte un HTML figé :
 * ses balises `<script>` ne peuvent porter aucun nonce, puisque celui du jour n'existait pas encore.
 *
 * Et `'self'` ne les sauve pas : en CSP niveau 3, la présence de `'strict-dynamic'` fait IGNORER
 * `'self'` et toutes les sources d'hôte. C'était donc tout ou rien, et c'était rien.
 *
 * Mesuré le 2026-08-18 sur `next start` : **16 balises `<script>` sur `/aide`, 0 avec nonce, 16
 * refusées par le navigateur.** React ne s'hydrate jamais. Le bouton « Quitter » — la SORTIE DE
 * SECOURS de FR-077, sur la page d'aide, celle qu'on atteint en détresse — était présent à l'écran
 * et ne faisait rien. La même page dynamique (`/entrer`) rend 16 scripts sur 16 noncés.
 *
 * ── R6 — le seul chemin d'abonnement du produit ────────────────────────────────────────────────
 *
 * `form-action 'self'` s'applique à TOUTE LA CHAÎNE de redirection d'une soumission, pas seulement à
 * sa première étape (Chromium et WebKit ; Firefox, lui, ne suit pas la chaîne). Or `MontagePaywall`
 * est un `<form>` sans JavaScript qui POSTe vers `/api/stripe/checkout`, laquelle répond 303 vers
 * `checkout.stripe.com`.
 *
 * Mesuré, avec le contrôle qui sépare :
 *   • réponse 200 same-origin → la soumission ABOUTIT, zéro refus ;
 *   • réponse 303 vers un tiers → « Sending form data … violates form-action 'self'. The request has
 *     been blocked. » et la page ne bouge pas.
 *
 * Sans ce contrôle j'aurais conclu de travers : le message d'erreur du navigateur nomme l'URL du
 * FORMULAIRE, pas celle de la redirection — il donne à croire que c'est l'envoi same-origin qui est
 * refusé, ce qui est faux.
 */

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(resolve(RACINE, p), "utf-8");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// R6 — la vente doit pouvoir atteindre le prestataire de paiement
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[R6] `form-action` laisse passer la redirection vers le paiement", () => {
  const csp = cspPageArt9("N0NCE", { dev: false });

  it("[LE CŒUR] l'hôte de Checkout est nommé dans `form-action`", () => {
    const directive = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("form-action"));
    expect(directive, "la directive doit exister — la retirer ouvrirait la soumission à tout").toBeTruthy();
    expect(directive, "sans cet hôte, le seul chemin d'abonnement est mort sur Chrome et Safari").toContain(
      "https://checkout.stripe.com",
    );
  });

  it("elle reste FERMÉE par ailleurs — on nomme un hôte, on n'ouvre pas la porte", () => {
    const directive = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("form-action"))!;
    expect(directive).toContain("'self'");
    expect(directive, "un joker rendrait la directive inutile").not.toMatch(/\*|https:(?!\/\/checkout)/);
  });

  it("la route de vente redirige bien vers cet hôte-là, et pas un autre", () => {
    // Si Stripe changeait d'hôte de Checkout, la CSP et la route divergeraient en silence — et le
    // symptôme serait un bouton qui ne fait rien. On lie les deux ici.
    const route = lire("app/api/stripe/checkout/route.ts");
    expect(route).toMatch(/checkout\.sessions\.create/);
    expect(route, "la redirection part de `session.url`, servie par Stripe").toMatch(
      /NextResponse\.redirect\(session\.url, 303\)/,
    );
  });

  it("`connect-src` n'est PAS élargi au passage — la frontière art. 9 ne bouge pas", () => {
    // ⚠️ LA TENTATION À CÔTÉ. Élargir `connect-src` « pendant qu'on y est » rouvrirait exactement ce
    // que la CSP existe pour fermer : l'exfiltration de contenu art. 9 vers un tiers par `fetch`.
    // Soumettre un formulaire et ouvrir une socket ne sont pas le même geste.
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/connect-src[^;]*stripe/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// R5 — une page prérendue ne peut pas s'hydrater sous une CSP à nonce
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Les pages de l'App Router, et rien d'autre. */
function pages(): string[] {
  const out: string[] = [];
  const marcher = (rel: string) => {
    for (const e of readdirSync(resolve(RACINE, rel), { withFileTypes: true })) {
      if (e.isDirectory()) marcher(join(rel, e.name));
      else if (e.name === "page.tsx") out.push(join(rel, e.name));
    }
  };
  marcher("app");
  return out;
}

/** Les modules qu'un fichier importe par chemin RELATIF ou par alias `@/`, résolus sur le disque. */
function importsResolus(fichier: string): string[] {
  const src = lire(fichier);
  const cibles: string[] = [];
  for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
    const spec = m[1];
    let base: string | null = null;
    if (spec.startsWith("@/")) base = spec.slice(2);
    else if (spec.startsWith(".")) base = join(dirname(fichier), spec);
    if (!base) continue;
    for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
      const p = base + ext;
      if (existsSync(resolve(RACINE, p))) {
        cibles.push(p);
        break;
      }
    }
  }
  return cibles;
}

const estClient = (f: string) => /^\s*["']use client["']/.test(lire(f));
const estDynamique = (f: string) =>
  /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(lire(f));

describe("[R5] aucune page qui a besoin de JavaScript n'est prérendue", () => {
  const toutes = pages();

  it("[CONTRÔLE DU CONTRÔLE] on a bien trouvé les pages", () => {
    expect(toutes.length, "sinon la garde ci-dessous est vraie sur du vide").toBeGreaterThan(10);
  });

  it("[LE CŒUR] une page qui monte un composant client est rendue à la demande", () => {
    // ⚠️ LA GARDE EST GÉNÉRALE, ET C'EST LE POINT. Nommer `/aide` aurait fermé le cas d'hier ; la
    // prochaine page interactive écrite sans `dynamic` serait muette de la même façon, et le
    // symptôme — un bouton présent qui ne réagit pas — ne ressemble à rien qu'on pense à chercher.
    const fautives: string[] = [];
    for (const page of toutes) {
      const monteDuClient = importsResolus(page).some(estClient);
      if (monteDuClient && !estDynamique(page)) fautives.push(page);
    }
    expect(
      fautives,
      "prérendue + CSP à nonce par requête = zéro script chargé, donc zéro hydratation",
    ).toEqual([]);
  });

  it("[CONTRÔLE POSITIF] la garde sait reconnaître un composant client", () => {
    // Sans lui, une erreur de résolution rendrait `monteDuClient` toujours faux et la garde vide.
    expect(estClient("app/aide/SortieRapide.tsx")).toBe(true);
    expect(importsResolus("app/aide/page.tsx")).toContain("app/aide/SortieRapide.tsx");
  });

  it("[LE CAS MESURÉ] `/aide` porte la sortie de secours, donc elle est dynamique", () => {
    // Mesuré le 2026-08-18 : prérendue, elle rendait 16 scripts, 0 noncés, 16 refusés — et le bouton
    // « Quitter » ne faisait rien. C'est la page qu'on atteint en détresse.
    expect(estDynamique("app/aide/page.tsx")).toBe(true);
  });
});
