import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 1.7 — la FRONTIÈRE modèle/rendu (AC2, AD-7/AD-10) + le rendu muet et sans secret
 * (AC6, AD-2), prouvés par lecture de fichiers. Complète la garde eslint (qui interdit déjà
 * lib/scene → render) en couvrant react/next côté modèle et process.env/infra côté rendu.
 *
 * Les gardes testent le CODE, pas la prose : on retire les commentaires avant de chercher
 * un motif interdit (sinon un commentaire « aucun process.env ici » ferait échouer la garde).
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

/** Les cibles de tous les `import … from "x"` / `export … from "x"` d'un source. */
function imports(src: string): string[] {
  return [...src.matchAll(/(?:import|export)[^"']*from\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

const libScene = fichiersTs("lib/scene");
const render = fichiersTs("render");

describe("lib/scene/ — modèle PUR (AC2, AD-7)", () => {
  it("a bien été scanné (fichiers présents)", () => {
    expect(libScene.length).toBeGreaterThan(0);
  });

  it("n'importe JAMAIS react, next, ni render/ (dépendance remontante interdite)", () => {
    for (const f of libScene) {
      for (const i of imports(lire(f))) {
        expect(i, `${f} → ${i}`).not.toMatch(/^react($|\/)/);
        expect(i, `${f} → ${i}`).not.toMatch(/^next($|\/)/);
        expect(i, `${f} → ${i}`).not.toMatch(/render/);
      }
    }
  });

  it("ne dépend d'aucune infra (supabase, lib/data, lib/ai)", () => {
    for (const f of libScene) {
      for (const i of imports(lire(f))) {
        expect(i, `${f} → ${i}`).not.toMatch(/@supabase/);
        expect(i, `${f} → ${i}`).not.toMatch(/@\/lib\/(data|ai)/);
      }
    }
  });
});

describe("render/ — adaptateur muet et sans secret (AC6, AD-2/AD-10)", () => {
  it("a bien été scanné (fichiers présents)", () => {
    expect(render.length).toBeGreaterThan(0);
  });

  it("n'accède ni base ni IA ni domaine (supabase, lib/data, lib/ai, lib/safety, lib/astro, lib/domain)", () => {
    for (const f of render) {
      for (const i of imports(lire(f))) {
        expect(i, `${f} → ${i}`).not.toMatch(/@supabase/);
        expect(i, `${f} → ${i}`).not.toMatch(/@\/lib\/(data|ai|safety|astro|domain)/);
      }
    }
  });

  it("ne référence AUCUN secret : process.env est interdit (frontière serveur = app/)", () => {
    for (const f of render) {
      expect(lire(f), `process.env dans ${f}`).not.toMatch(/process\.env/);
    }
  });

  it("dépend BIEN de lib/scene (la seule dépendance autorisée, render/ → lib/scene/)", () => {
    const tous = render.flatMap((f) => imports(lire(f)));
    expect(tous.some((i) => i.includes("lib/scene"))).toBe(true);
  });
});
