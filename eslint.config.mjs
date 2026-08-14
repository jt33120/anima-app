// @ts-check
import tseslint from "typescript-eslint";

/**
 * Garde de la DIRECTION DES DÉPENDANCES (AD-1 / AD-10 / AD-7).
 * L'objet de cette règle : empêcher une dépendance remontante entre couches.
 * (Les règles Next web-vitals sont volontairement hors périmètre de l'échafaudage.)
 */
export default tseslint.config(
  // `images/**` = assets de design (handoff Claude Design : prototypes .dc.html/support.js de référence, « ne pas porter »).
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts", "images/**"] },

  ...tseslint.configs.recommended,

  // Le domaine est pur : ni framework, ni infra, ni remontée vers l'app/le rendu/les données.
  //
  // ── DEUX ÉCHAPPATOIRES MESURÉES, REFERMÉES LE 2026-08-13 ────────────────────────────────────────
  //
  // La garde d'origine n'énumérait que des chemins ALIASÉS (`@/lib/data/*`…). Deux formes
  // d'import la traversaient sans rien déclencher, ni au lint ni dans les gardes vitest :
  //
  //   1. LE CHEMIN RELATIF QUI REMONTE. Les motifs sont comparés au spécificateur BRUT :
  //      `"../data/depot-branche"` ne ressemble à aucun `@/…`. Un fichier du domaine pouvait donc
  //      tirer Supabase par `../data/…` et le build restait vert. `lib/domain/` est PLAT — aucun
  //      sous-dossier — donc tout `../` sort de la couche, sans exception à ménager.
  //
  //   2. L'IMPORT DYNAMIQUE. `no-restricted-imports` ne visite que `ImportDeclaration`,
  //      `ExportNamedDeclaration` et `ExportAllDeclaration` (source de la règle) : `await
  //      import("@supabase/supabase-js")` ne lui est jamais présenté. AC3 était littéralement faux
  //      pour cette forme. Le domaine étant pur, il n'a aucun usage d'un import dynamique : on
  //      l'interdit en bloc plutôt que d'énumérer des cibles qu'on oubliera.
  {
    files: ["lib/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*"], message: "AD-1 : le domaine ne dépend pas du framework." },
            { group: ["@supabase/*"], message: "AD-1 : le domaine ne dépend pas de l'infra Supabase." },
            {
              group: ["@mistralai/*", "stripe", "astronomy-engine", "server-only"],
              message: "AD-3 : le domaine ne connaît aucun SDK fournisseur, et ne s'ancre pas au serveur.",
            },
            {
              group: ["@/app/*", "@/render/*", "@/lib/data/*"],
              message: "AD-10 : dépendance remontante interdite.",
            },
            {
              group: ["../*", "../**"],
              message:
                "AD-10 : `lib/domain/` est plat — tout « ../ » sort de la couche et échappe aux motifs par alias.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message:
            "AD-1 : le domaine est pur — pas d'import dynamique (il échappe à `no-restricted-imports`).",
        },
      ],
    },
  },

  // Le modèle de scène ne dépend jamais du rendu (AD-7). Mêmes échappatoires, même fermeture :
  // `lib/scene/` est plat lui aussi.
  {
    files: ["lib/scene/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/render/*"], message: "AD-7 : le modèle de scène ne dépend pas du rendu." },
            {
              group: ["../*", "../**"],
              message: "AD-7 : `lib/scene/` est plat — tout « ../ » sort de la couche.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "ImportExpression", message: "AD-7 : pas d'import dynamique dans le modèle de scène." },
      ],
    },
  },

  // ── LE TIRAGE EST AVEUGLE (AD-11, Story 5.7) ───────────────────────────────────────────────────
  //
  // AD-11 exige que le point d'entrée du tirage n'ait AUCUN accès au profil, à l'historique ni à
  // l'état émotionnel, et précise : « contrainte d'architecture, PAS règle de code ». Ce bloc EST
  // cette contrainte. Sans lui, l'exigence ne serait qu'un commentaire — et une garde qui vit dans
  // un commentaire n'existe pas.
  //
  // La liste n'est pas défensive au hasard, chaque entrée ferme une porte nommée :
  //   `@/lib/data`    → le profil, l'historique, les branches, les abonnements ;
  //   `@/lib/domain`  → le thème natal, la numérologie, l'ennéagramme — le profil calculé ;
  //   `@/lib/safety`  → l'épisode de détresse, c'est-à-dire l'ÉTAT ÉMOTIONNEL nommément visé ;
  //   `@/lib/ai`      → aucun modèle ne choisit une carte (ce serait FR-016 par la grande porte) ;
  //   `@/lib/lecture` → le CATALOGUE DE SENS. C'est l'entrée décisive : un tireur qui ne peut pas
  //                     savoir ce qu'une carte veut dire ne peut pas la choisir pour ce qu'elle veut
  //                     dire. FR-016 devient impossible plutôt qu'interdit.
  //   `@/lib/corpus`  → même raison, par l'autre bout (les descriptions).
  //
  // Mêmes deux échappatoires refermées qu'en AD-10, pour les mêmes raisons : `lib/tirage/` est PLAT,
  // donc tout `../` sort de la couche ; et l'import dynamique n'est jamais visité par
  // `no-restricted-imports`.
  {
    files: ["lib/tirage/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/data/*",
                "@/lib/domain/*",
                "@/lib/safety/*",
                "@/lib/ai/*",
                "@/lib/lecture/*",
                "@/lib/corpus/*",
                "@/app/*",
                "@/render/*",
              ],
              message:
                "AD-11 : le tirage n'a aucun accès au profil, à l'historique, à l'état émotionnel ni au sens des cartes.",
            },
            {
              group: ["next", "next/*", "@supabase/*", "@mistralai/*", "stripe", "astronomy-engine"],
              message: "AD-11 : le tirage ne connaît ni le framework, ni la base, ni aucun fournisseur.",
            },
            {
              group: ["../*", "../**"],
              message:
                "AD-11 : `lib/tirage/` est plat — tout « ../ » sort de la couche et échappe aux motifs par alias.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "AD-11 : pas d'import dynamique dans le tirage (il échappe à `no-restricted-imports`).",
        },
        {
          // `Math.random` n'est pas cryptographique et n'est pas journalisable : il n'expose aucune
          // graine, donc un tirage qui s'en servirait serait inauditable (AC2/AC3). L'interdire ici
          // vaut mieux que de compter sur la relecture — la substitution est d'une facilité redoutable.
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: "AD-11 : la graine vient d'un CSPRNG système (`csprngSysteme`), jamais de `Math.random`.",
        },
      ],
    },
  },
);
