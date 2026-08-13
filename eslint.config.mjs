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
);
