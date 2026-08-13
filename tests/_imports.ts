/**
 * _imports.ts — CE QU'UN FICHIER IMPORTE VRAIMENT.
 *
 * ══ POURQUOI CE MODULE EXISTE (revue du 2026-08-12, E1/E5) ══════════════════════════════════════
 *
 * Une demi-douzaine de gardes d'architecture cherchaient les imports à la regex, chacune la sienne,
 * et toutes bâties sur `from "…"`. Elles avaient donc toutes le même trou, et il était béant :
 *
 *     import "server-only";        ← AUCUN `from`. C'est la SEULE forme employée dans le dépôt
 *                                    (`lib/ordonnanceur/environnement.ts:1`), et la garde qui
 *                                    l'interdit dans `lib/corpus/` ne pouvait pas la voir.
 *     await import("astronomy-engine")   ← import dynamique
 *     from "../astro/adapters/x"         ← chemin relatif au lieu de l'alias `@/`
 *     require("…")                       ← forme CommonJS
 *
 * Une garde d'absence qui regarde à côté est pire que pas de garde : elle est VERTE, et on la croit.
 *
 * On extrait donc les SPÉCIFICATEURS, une fois, correctement — puis chaque garde interroge cette
 * liste. Ajouter une forme d'import au langage se corrige ici, pour toutes les gardes à la fois.
 */

/** Les cinq façons dont un module peut entrer dans un fichier. */
const FORMES: readonly RegExp[] = [
  /\bimport\s+[^;'"]*?\bfrom\s*(["'])([^"']+)\1/g, // import … from "x"
  /\bexport\s+[^;'"]*?\bfrom\s*(["'])([^"']+)\1/g, // export … from "x" (ré-export)
  /\bimport\s*(["'])([^"']+)\1/g, //                  import "x"        (effet de bord)
  /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g, //        import("x")       (dynamique)
  /\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g, //       require("x")
];

/** Tout ce que ce source importe, sous la forme écrite (alias `@/…`, relatif, ou paquet). */
export function modulesImportes(source: string): string[] {
  const trouves = new Set<string>();
  for (const forme of FORMES) {
    for (const m of source.matchAll(forme)) trouves.add(m[2]);
  }
  return [...trouves];
}

/**
 * Ce source importe-t-il un module que `predicat` reconnaît ?
 *
 * Le prédicat reçoit le spécificateur TEL QU'ÉCRIT : à chaque garde de décider si elle veut
 * reconnaître la forme relative en plus de l'alias — les deux ne se valent pas toujours.
 */
export function importe(source: string, predicat: (specificateur: string) => boolean): boolean {
  return modulesImportes(source).some(predicat);
}

/**
 * Le module désigné est-il DANS ce dossier, quelle que soit la façon de l'écrire ?
 *
 * `@/lib/astro/adapters/x`, `../astro/adapters/x` et `./adapters/x` désignent le même endroit et
 * doivent compter pareil : c'est exactement par le chemin relatif qu'on contourne une garde bâtie
 * sur l'alias, sans même le faire exprès.
 */
export function viseLeDossier(specificateur: string, dossier: string): boolean {
  const d = dossier.replace(/^\/+|\/+$/g, "");
  return new RegExp(`(^|/)${d}/`).test(specificateur);
}
