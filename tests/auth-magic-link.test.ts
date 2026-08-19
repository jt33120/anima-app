import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { destinationSure } from "@/app/auth/confirm/route";
import { OPTIONS_COOKIE_SESSION } from "@/lib/data/supabase/cookies-session";
import { sansCommentaires } from "./_absence";

/**
 * auth-magic-link.test.ts — LES TROIS DÉFAUTS DU LIEN MAGIQUE, REVUE DU 2026-08-13.
 *
 * La story 1.3 n'avait jamais été relue. Trois défauts distincts vivaient sur le chemin
 * d'entrée — celui que TOUT LE MONDE emprunte, et le seul, puisqu'il n'y a pas de mot de passe.
 *
 *   1. LA FIXATION DE SESSION. La route acceptait un second flux, `?token_hash=`, à côté de PKCE.
 *      Éprouvé de bout en bout contre un vrai Supabase : `verifyOtp` rend une session à un client
 *      NEUF, sans le moindre `code_verifier`. L'attaquant demandait un lien pour SA propre adresse,
 *      en extrayait le `token_hash` de son courriel, et envoyait le lien à la victime — qui se
 *      retrouvait connectée DANS LE COMPTE DE L'ATTAQUANT, sans rien voir. Tout ce qu'elle confiait
 *      ensuite à Anam — de l'article 9 — s'écrivait chez lui.
 *
 *   2. LA REDIRECTION OUVERTE. `?next=` partait sans validation dans `new URL(next, origin)`, qui
 *      n'est pas une garde : la base est ignorée dès que la valeur est absolue ou protocol-relative.
 *
 *   3. LE COOKIE DE SESSION LISIBLE ET EN CLAIR. `@supabase/ssr` pose `httpOnly: false` et ne pose
 *      jamais `Secure` — sur un cookie qui contient l'access_token ET le refresh_token.
 *
 * Les deux premiers se COMBINENT : `…/auth/confirm?token_hash=<le sien>&next=https://faux-anima`
 * connecte la victime au compte de l'attaquant PUIS la dépose sur une page qu'il contrôle, à la
 * seconde exacte où elle vient d'accorder sa confiance au lien reçu.
 */

/**
 * ⚠️ COMMENTAIRES RETIRÉS. Ces gardes cherchent des formes FAUTIVES dans le code — et le correctif
 * de chacune CITE la forme fautive dans son en-tête, pour que la prochaine personne comprenne ce
 * qu'on a fermé. Sans ce filtre, la garde rougissait sur l'explication du correctif : elle aurait
 * forcé à effacer la mémoire du défaut pour redevenir verte. Même piège que côté SQL, même jour.
 */
const lire = (chemin: string) =>
  sansCommentaires(readFileSync(resolve(process.cwd(), chemin), "utf-8"));

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 1. LA REDIRECTION — comportement, pas structure : `destinationSure` est pure et exportée.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

const ORIGINE = "https://anima.example";

describe("La destination après connexion ne quitte jamais notre origine", () => {
  it.each([
    ["https://evil.example", "absolue"],
    ["https://evil.example/reconfirme-ton-adresse", "absolue avec chemin"],
    ["//evil.example", "protocol-relative"],
    ["/\\evil.example", "anti-slash — commence pourtant par « / »"],
    ["\\\\evil.example", "double anti-slash"],
    ["https://anima.example.evil.com", "préfixe trompeur"],
    ["http://anima.example", "même hôte, protocole rétrogradé"],
  ])("refuse %s (%s) et retombe sur la racine", (next) => {
    expect(destinationSure(next, ORIGINE)).toBe("/");
  });

  it.each([
    ["/", "/"],
    ["/naissance", "/naissance"],
    ["/synthese?depuis=courriel", "/synthese?depuis=courriel"],
    ["/aide#ressources", "/aide#ressources"],
    ["https://anima.example/consentement", "/consentement"],
  ])("laisse passer %s → %s", (next, attendu) => {
    expect(destinationSure(next, ORIGINE)).toBe(attendu);
  });

  it("ne jette jamais, même sur une entrée non analysable", () => {
    expect(destinationSure("http://[", ORIGINE)).toBe("/");
    expect(destinationSure("", ORIGINE)).toBe("/");
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. LE FLUX — garde STRUCTURELLE assumée : instancier le route handler exigerait tout Next et un
//    Supabase. Ce qu'on garde ici est une PROPRIÉTÉ DU CODE, et elle est exacte : la seule façon
//    d'installer une session sans lien avec le navigateur appelant est d'appeler `verifyOtp`.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe("Un seul flux d'authentification, et il est lié au navigateur (PKCE)", () => {
  const route = lire("app/auth/confirm/route.ts");

  it("la route n'appelle JAMAIS verifyOtp — la porte sans code_verifier reste fermée", () => {
    expect(route).not.toMatch(/\bverifyOtp\b/);
  });

  it("la route ne lit plus token_hash ni type depuis l'URL", () => {
    expect(route).not.toMatch(/searchParams\.get\(\s*["']token_hash["']\s*\)/);
    expect(route).not.toMatch(/searchParams\.get\(\s*["']type["']\s*\)/);
  });

  it("elle échange bien un code PKCE — sinon plus personne ne se connecte", () => {
    expect(route).toMatch(/exchangeCodeForSession/);
  });

  it("le `next` brut ne va JAMAIS directement dans une redirection", () => {
    // La forme fautive d'origine : `new URL(next, origin)` avec un `next` non filtré.
    expect(route).toMatch(/destinationSure\(\s*searchParams\.get\(\s*["']next["']/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 3. LE COOKIE DE SESSION
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe("Le cookie qui porte l'access_token et le refresh_token", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("n'est pas lisible par le JavaScript de page", () => {
    expect(OPTIONS_COOKIE_SESSION.httpOnly).toBe(true);
  });

  it("reste sur son origine et sur tout le site", () => {
    expect(OPTIONS_COOKIE_SESSION.sameSite).toBe("lax");
    expect(OPTIONS_COOKIE_SESSION.path).toBe("/");
  });

  it.each([
    ["production", true],
    ["test", true],
    [undefined, true], // ← le cas qui compte : variable absente ⇒ `Secure` quand même
  ])("NODE_ENV=%s ⇒ Secure=%s (le refus échoue FERMÉ)", async (valeur, attendu) => {
    vi.stubEnv("NODE_ENV", valeur as string);
    vi.resetModules();
    const { OPTIONS_COOKIE_SESSION: relu } = await import("@/lib/data/supabase/cookies-session");
    expect(relu.secure).toBe(attendu);
  });

  it("est en clair UNIQUEMENT en développement explicite", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { OPTIONS_COOKIE_SESSION: relu } = await import("@/lib/data/supabase/cookies-session");
    expect(relu.secure).toBe(false);
  });

  it("LES DEUX chemins qui posent des cookies partagent le même objet", () => {
    // Le piège du miroir (leçon R1-bis) : durcir `server.ts` en laissant le proxy poser l'ancien
    // cookie ne durcit rien — c'est le proxy qui réécrit le cookie à CHAQUE requête.
    for (const chemin of ["lib/data/supabase/server.ts", "lib/data/supabase/middleware.ts"]) {
      const source = lire(chemin);
      expect(source, `${chemin} ne passe pas cookieOptions`).toMatch(
        /cookieOptions:\s*OPTIONS_COOKIE_SESSION/,
      );
      expect(source, `${chemin} n'importe pas l'objet partagé`).toMatch(
        /import\s*\{\s*OPTIONS_COOKIE_SESSION\s*\}\s*from\s*["']\.\/cookies-session["']/,
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 4. L'ORIGINE DU LIEN ENVOYÉ PAR COURRIEL
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe("Le lien de connexion ne part jamais en clair", () => {
  const action = lire("app/(auth)/entrer/actions.ts");

  it("ne retombe plus sur « http » quand l'en-tête de protocole manque", () => {
    expect(action).not.toMatch(/x-forwarded-proto["']\s*\)\s*\?\?\s*["']http["']/);
  });

  it("réutilise le validateur d'origine durci du produit plutôt qu'un second, divergent", () => {
    expect(action).toMatch(/origineDuSite\(\)/);
  });

  it("TOUTE comparaison de NODE_ENV dans ce fichier échoue FERMÉ", () => {
    // `=== "production"` laisse passer une variable absente — sur une porte qui ouvre un client
    // `service_role` depuis la page de connexion publique.
    //
    // ⚠️ LA GARDE COMPTAIT LES OCCURRENCES (« il y en a exactement deux »), et ce compte a rougi le
    // jour où un TROISIÈME usage légitime est apparu : le drapeau `Secure` du cookie d'attente du
    // code à six chiffres. Elle avait raison sur le fond — je l'avais écrit `=== "production"`,
    // donc un cookie de session en clair si `NODE_ENV` manquait — et tort sur la forme : un test
    // qui grave un nombre rougit à chaque ajout, y compris correct. On mesure donc la RÈGLE.
    //
    // ⚠️ ET ELLE A ROUGI UNE SECONDE FOIS, le 2026-08-19, pour la MÊME raison sous un autre
    // déguisement : le compte était juste passé de « exactement deux » à « au moins trois », et le
    // cookie d'attente a déménagé dans `attente.ts`. Un seuil dans un seul fichier reste un nombre
    // gravé. La règle, elle, porte sur TOUTES les portes d'entrée : on lit le dossier entier, et on
    // exige seulement qu'il en reste au moins une — sinon la garde passerait en ne mesurant rien.
    const portes = ["app/(auth)/entrer/actions.ts", "app/(auth)/entrer/attente.ts"];
    const comparaisons = portes.flatMap(
      (f) => lire(f).match(/NODE_ENV\s*[!=]==\s*["'][a-z]+["']/g) ?? [],
    );
    expect(comparaisons.length, "plus aucune comparaison de NODE_ENV ?").toBeGreaterThanOrEqual(1);
    for (const c of comparaisons) {
      expect(c, `« ${c} » échoue OUVERT quand la variable manque`).toMatch(
        /!==\s*["']development["']/,
      );
    }
  });
});
