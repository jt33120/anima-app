import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { couleursNuit, couleursClair, type CleCouleur } from "@/app/styles/tokens";

/**
 * GARDE ANTI-DÉRIVE (AC1) : globals.css ne doit jamais s'écarter de tokens.ts.
 * On parse les blocs :root (nuit) et :root[data-a11y="contraste"] (-clair) et on
 * vérifie chaque variable de couleur. tokens.ts est ainsi la source IMPOSÉE.
 */

const css = readFileSync(resolve(process.cwd(), "app/styles/globals.css"), "utf-8");

function extraireBloc(selecteur: RegExp): string {
  const m = selecteur.exec(css);
  if (!m) throw new Error(`Bloc CSS introuvable pour ${selecteur}`);
  return m[1];
}

function valeurVar(bloc: string, nom: CleCouleur): string | null {
  const m = new RegExp(`--${nom}:\\s*(#[0-9A-Fa-f]{6})`).exec(bloc);
  return m ? m[1].toUpperCase() : null;
}

describe("Parité tokens.ts ↔ globals.css — mode nuit", () => {
  const bloc = extraireBloc(/:root\s*\{([^}]*)\}/); // 1er :root = bloc nuit
  for (const cle of Object.keys(couleursNuit) as CleCouleur[]) {
    it(`--${cle} = ${couleursNuit[cle]}`, () => {
      expect(valeurVar(bloc, cle)).toBe(couleursNuit[cle].toUpperCase());
    });
  }
});

describe("Parité tokens.ts ↔ globals.css — mode accessibilité (-clair)", () => {
  const bloc = extraireBloc(/:root\[data-a11y="contraste"\]\s*\{([^}]*)\}/);
  for (const cle of Object.keys(couleursClair) as CleCouleur[]) {
    it(`--${cle} = ${couleursClair[cle]}`, () => {
      expect(valeurVar(bloc, cle)).toBe(couleursClair[cle].toUpperCase());
    });
  }
});
