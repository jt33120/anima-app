import "server-only";
import type { AiPort } from "./port";
import { AdaptateurFactice } from "./adapters/factice";

/**
 * `creerAiPort()` — choisit l'adaptateur selon l'environnement.
 *
 * Défaut = **factice** (aucune clé, aucun réseau) hors prod. L'adaptateur Mistral n'est chargé
 * qu'en IMPORT DYNAMIQUE et uniquement si `AI_ADAPTER=mistral` : ainsi le SDK et la clé ne sont
 * jamais requis en dev/CI, et le boot-guard art. 9 s'exécute À LA CONSTRUCTION (AC3).
 */
export async function creerAiPort(): Promise<AiPort> {
  if (process.env.AI_ADAPTER === "mistral") {
    const { AdaptateurMistral } = await import("./adapters/mistral");
    return new AdaptateurMistral(); // boot-guard art. 9 ici
  }
  return new AdaptateurFactice();
}
