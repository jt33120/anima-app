/**
 * lib/scene — Le MODÈLE de scène pur (AD-7). Barrel d'exports.
 *
 * Trois moitiés, une frontière : `regions` (catalogue + types), `vue` (view-state
 * client + transition, propriétaire unique), `projection` (domain-projection serveur,
 * lecture seule). Aucun fichier de ce dossier n'importe React, Next, ni `render/` :
 * la dépendance ne va que `render/ → lib/scene/`, jamais l'inverse (garde : eslint +
 * tests/scene-architecture.test.ts).
 */

export * from "./regions";
export * from "./vue";
export * from "./projection";
