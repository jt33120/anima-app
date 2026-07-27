import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.1 — la FRONTIÈRE serveur (AD-2, AD-3, AC1/AC2), prouvée par lecture de fichiers.
 *
 * On grep le NOM BRUT du package et de la variable-clé (pas seulement les `import … from`) : ainsi
 * un `import "@mistralai/…"` sans `from`, un `await import("@mistralai/…")` dynamique, un `require`
 * ou une chaîne cachée sont TOUS attrapés. Commentaires retirés avant match (sinon la garde
 * matcherait sa propre prose).
 */

const racine = process.cwd();

/** Retire /* *​/ et // (sans toucher aux :// des URLs). */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function fichiersTs(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => resolve(racine, dir, f));
}

const ADAPTATEUR = resolve(racine, "lib/ai/adapters/mistral.ts");
const tousSource = [...fichiersTs("app"), ...fichiersTs("lib"), ...fichiersTs("render")];
const horsAdaptateur = tousSource.filter((f) => f !== ADAPTATEUR);

describe("Frontière serveur — le SDK fournisseur et la clé ne fuitent pas (AD-2/AD-3)", () => {
  it("a bien scanné du code applicatif", () => {
    expect(horsAdaptateur.length).toBeGreaterThan(10);
  });

  it("SEUL lib/ai/adapters/mistral.ts référence @mistralai/mistralai (AD-3)", () => {
    for (const f of horsAdaptateur) {
      expect(lire(f), `SDK Mistral hors adapters/ : ${f}`).not.toMatch(/@mistralai\/mistralai/);
    }
    // Contrôle positif : l'adaptateur, lui, l'importe bien → la garde n'est pas vide.
    expect(lire(ADAPTATEUR)).toMatch(/@mistralai\/mistralai/);
  });

  it("aucune variable-clé MISTRAL_ hors de l'adaptateur (clé jamais atteignable ailleurs)", () => {
    for (const f of horsAdaptateur) {
      expect(lire(f), `réf MISTRAL_ hors adapters/ : ${f}`).not.toMatch(/MISTRAL_[A-Z]/);
    }
    expect(lire(ADAPTATEUR)).toMatch(/MISTRAL_API_KEY/);
  });

  it("aucune clé IA en NEXT_PUBLIC_ (jamais exposée au client, AC1)", () => {
    for (const f of tousSource) {
      expect(lire(f), `clé IA publique : ${f}`).not.toMatch(/NEXT_PUBLIC_MISTRAL/);
      expect(lire(f), `clé API publique : ${f}`).not.toMatch(/NEXT_PUBLIC_\w*API_KEY/);
    }
  });
});
