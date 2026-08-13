import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * DEUX PROJETS, DEUX ENVIRONNEMENTS.
 *
 * `node` — l'immense majorité de la suite : domaine pur, endpoints, SQL réel contre Supabase local.
 *          Rapide, sans DOM, et c'est très bien ainsi : y basculer jsdom ralentirait ~1200 tests
 *          pour les besoins d'une poignée.
 *
 * `rendu` — MONTE VRAIMENT les composants (jsdom + Testing Library). Ajouté après la RE-REVUE 4.6,
 *          qui a démontré que les gardes de rendu par lecture de source prouvent le CÂBLAGE et
 *          jamais le COMPORTEMENT : un `useLayoutEffect` correctement écrit, mais dont le tableau
 *          de dépendances l'empêchait de rejouer, laissait l'arbre INVISIBLE au scénario nominal
 *          sans qu'une seule garde vire au rouge. Sept des dix-sept défauts de cette revue étaient
 *          dans `render/`. Ce projet est la réponse structurelle.
 *
 * Les tests de rendu portent l'extension `.test.tsx` et vivent dans `tests/rendu/` : la séparation
 * est lisible dans l'arborescence autant que dans la configuration, et les deux `include` sont
 * disjoints (`.test.ts` vs `.test.tsx`) — aucun fichier ne tourne deux fois.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` jette hors d'un contexte serveur ; en test node on le neutralise pour
      // pouvoir exercer les modules serveur (ex. le wrapper lib/safety/appliquer-barriere).
      "server-only": fileURLToPath(new URL("./tests/_stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    // Les tests SQL-réels frappent un Supabase local (Docker : auth + Postgres). Sous charge
    // parallèle, une requête peut dépasser les 5 s par défaut → marge élargie pour fiabiliser
    // la suite sans masquer d'erreur de logique (les assertions sont inchangées).
    testTimeout: 15000,
    hookTimeout: 20000,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          // La suite interroge la base LOCALE, jamais celle de lancement : voir l'en-tête de
          // `tests/_environnement.ts` pour la mesure qui l'impose (32 connexions / 5 min en cloud,
          // 95 par passe ici). Chargé avant tout client, et sans écraser un environnement explicite.
          setupFiles: ["./tests/_environnement.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "rendu",
          environment: "jsdom",
          include: ["tests/rendu/**/*.test.tsx"],
          setupFiles: ["./tests/_environnement.ts", "./tests/rendu/_installation.ts"],
        },
      },
    ],
  },
});
