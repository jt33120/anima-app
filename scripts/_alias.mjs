/**
 * Résout, pour un script Node lancé hors de Next, ce que Next résout tout seul :
 *   · l'alias `@/` déclaré dans `tsconfig.json` — Node ne lit pas `tsconfig.json` ;
 *   · l'extension `.ts` omise dans les imports — la convention TypeScript du projet.
 *
 * Sans ça, `lib/corpus/*.ts` n'est importable que par le harnais de test, et un cahier de
 * rédaction devrait recopier à la main des clés qui sont CALCULÉES dans le code — exactement la
 * divergence que ce cahier existe pour éviter.
 */
import { existsSync } from "node:fs";
import { resolve as resoudreChemin } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = resoudreChemin(import.meta.dirname, "..");

function avecExtension(url) {
  const chemin = fileURLToPath(url);
  if (existsSync(chemin) && !chemin.endsWith("/")) return url;
  for (const suffixe of [".ts", ".tsx", "/index.ts"]) {
    if (existsSync(chemin + suffixe)) return pathToFileURL(chemin + suffixe).href;
  }
  return url;
}

export async function resolve(specifier, context, nextResolve) {
  const cible = specifier.startsWith("@/")
    ? pathToFileURL(resoudreChemin(RACINE, specifier.slice(2))).href
    : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
      ? new URL(specifier, context.parentURL).href
      : specifier;
  const final = cible.startsWith("file:") ? avecExtension(cible) : cible;
  return nextResolve(final, context);
}
