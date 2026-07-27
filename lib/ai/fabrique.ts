import "server-only";
import type { AiPort } from "./port";
import { AdaptateurFactice } from "./adapters/factice";

/**
 * `creerAiPort()` — choisit l'adaptateur selon l'environnement.
 *
 * `AI_ADAPTER=mistral` → adaptateur Mistral (import dynamique : SDK/clé non requis en dev/CI ; le
 * boot-guard art. 9 s'exécute à la construction, AC3). Sinon → adaptateur factice.
 *
 * **Le repli factice est INTERDIT en production** (AD-4 : « échec dur, jamais de dégradation
 * silencieuse »). Sur une mauvaise config (AI_ADAPTER oublié ou mal orthographié sur Vercel), on
 * échoue haut et fort plutôt que de servir un stub à de vraies utilisatrices — revue 2.1.
 */
export async function creerAiPort(): Promise<AiPort> {
  if (process.env.AI_ADAPTER === "mistral") {
    const { AdaptateurMistral } = await import("./adapters/mistral");
    return new AdaptateurMistral(); // boot-guard art. 9 ici
  }

  const enProduction =
    process.env.VERCEL_ENV === "production" ||
    (process.env.VERCEL_ENV === undefined && process.env.NODE_ENV === "production");
  if (enProduction) {
    throw new Error(
      `AI_ADAPTER doit valoir "mistral" en production (repli factice interdit — AD-4). ` +
        `Valeur actuelle : ${process.env.AI_ADAPTER ?? "absente"}.`,
    );
  }

  return new AdaptateurFactice();
}
