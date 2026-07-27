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

/* ── Story 2.2 (B6) : la vue conversation ne parle qu'à app/api (AD-7/AD-2). ── */
const conversation = fichiersTs("render/conversation");

describe("render/conversation/ — la vue ne connaît que fetch vers app/api (AD-7/AD-2, B6)", () => {
  it("a bien été scanné (fichiers présents)", () => {
    expect(conversation.length).toBeGreaterThan(0);
  });

  it("n'importe NI lib/ai NI lib/data/supabase (le rendu ne touche ni IA ni base)", () => {
    for (const f of conversation) {
      for (const i of imports(lire(f))) {
        expect(i, `${f} → ${i}`).not.toMatch(/@\/lib\/(ai|data|safety|astro|domain)/);
        expect(i, `${f} → ${i}`).not.toMatch(/@supabase/);
      }
    }
  });

  it("n'importe pas lib/ai / lib/data même en SIDE-EFFECT (import \"x\", sans `from`)", () => {
    // `imports()` ne capte que les imports avec `from` ; un side-effect `import "@/lib/ai/…"`
    // contournerait la garde ci-dessus. On le ferme explicitement (angle mort trouvé en mutation).
    for (const f of conversation) {
      expect(lire(f), `side-effect import interdit dans ${f}`).not.toMatch(
        /import\s+["']@\/lib\/(ai|data|safety|astro|domain)/,
      );
      expect(lire(f), `side-effect import supabase dans ${f}`).not.toMatch(/import\s+["']@supabase/);
    }
  });

  it("ne référence AUCUN secret (process.env interdit — frontière serveur = app/)", () => {
    for (const f of conversation) {
      expect(lire(f), `process.env dans ${f}`).not.toMatch(/process\.env/);
    }
  });

  it("ne fait de requête réseau QUE vers un chemin interne /api/ (aucune origine tierce)", () => {
    for (const f of conversation) {
      const src = lire(f);
      const cibles = [...src.matchAll(/fetch\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
      for (const url of cibles) {
        expect(url, `${f} : fetch vers ${url}`).toMatch(/^\/api\//);
      }
      expect(src, `URL absolue (origine tierce) dans ${f}`).not.toMatch(/https?:\/\//);
    }
  });
});

describe("lib/scene/ — aucun concept de conversation/flux n'y a fui (AD-7, B6)", () => {
  it("reste pur : ni diffuser, ni streaming/flux, ni message (le fil est une feature de VUE)", () => {
    for (const f of libScene) {
      const src = lire(f);
      expect(src, `« diffuser » dans ${f}`).not.toMatch(/diffuser/);
      expect(src, `« streaming/flux » dans ${f}`).not.toMatch(/streaming|\bflux\b/i);
      expect(src, `« message » dans ${f}`).not.toMatch(/\bmessage/i);
    }
  });
});
