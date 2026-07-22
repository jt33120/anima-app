// @ts-check
import tseslint from "typescript-eslint";

/**
 * Garde de la DIRECTION DES DÉPENDANCES (AD-1 / AD-10 / AD-7).
 * L'objet de cette règle : empêcher une dépendance remontante entre couches.
 * (Les règles Next web-vitals sont volontairement hors périmètre de l'échafaudage.)
 */
export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"] },

  ...tseslint.configs.recommended,

  // Le domaine est pur : ni framework, ni infra, ni remontée vers l'app/le rendu/les données.
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
              group: ["@/app/*", "@/render/*", "@/lib/data/*"],
              message: "AD-10 : dépendance remontante interdite.",
            },
          ],
        },
      ],
    },
  },

  // Le modèle de scène ne dépend jamais du rendu (AD-7).
  {
    files: ["lib/scene/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/render/*"], message: "AD-7 : le modèle de scène ne dépend pas du rendu." }] },
      ],
    },
  },
);
