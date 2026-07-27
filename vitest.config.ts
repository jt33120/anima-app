import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

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
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
