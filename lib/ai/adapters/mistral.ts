import "server-only";
import { Mistral } from "@mistralai/mistralai";
import type { AiPort, RequeteIa, ReponseIa } from "../port";
import { modelePour, tierPour } from "../politique-tier";

/**
 * Adaptateur Mistral — le SEUL module autorisé à importer un SDK fournisseur (AD-3).
 * Gardé en CI : `tests/frontiere-serveur.test.ts` échoue si `@mistralai/mistralai` apparaît ailleurs.
 *
 * Endpoints STATELESS uniquement (`chat.complete` / `chat.stream` à venir en 2.2) — jamais
 * `agents`, `conversations`, `batch`, `fineTuning`, `libraries` : ZDR exclut ces surfaces (AD-4).
 * Modèles par id DATÉ (jamais `-latest`) sur le chemin art. 9.
 */

/**
 * Boot-guard art. 9 (AC3) : refuse de démarrer sans ZDR/DPA/scale PROUVÉS. Échec dur — jamais
 * de dégradation silencieuse ni de bascule direct-US. Les flags sont une ATTESTATION humaine
 * posée APRÈS signature du contrat (aucune API ne dit « ZDR actif ») ; absents du dev/free.
 */
function assertConformiteArt9(): void {
  const conforme =
    process.env.MISTRAL_ZDR_CONFIRMED === "true" &&
    process.env.MISTRAL_DPA_SIGNED === "true" &&
    process.env.MISTRAL_PLAN === "scale";
  if (!conforme) {
    throw new Error(
      "Chemin art. 9 bloqué : l'adaptateur Mistral refuse de démarrer sans ZDR/DPA prouvés. " +
        "Pose MISTRAL_ZDR_CONFIRMED=true, MISTRAL_DPA_SIGNED=true et MISTRAL_PLAN=scale UNIQUEMENT " +
        "après signature du contrat (plan Scale). Aucun repli direct-US.",
    );
  }
}

export class AdaptateurMistral implements AiPort {
  private readonly client: Mistral;
  private readonly zdrProuve: boolean;

  constructor() {
    assertConformiteArt9(); // lève avant toute construction si non conforme
    this.zdrProuve = true; // garanti par le boot-guard ci-dessus
    const cle = process.env.MISTRAL_API_KEY;
    if (!cle) {
      throw new Error("MISTRAL_API_KEY absente (secret serveur unique, jamais NEXT_PUBLIC_).");
    }
    this.client = new Mistral({ apiKey: cle });
  }

  estZdrProuve(): boolean {
    return this.zdrProuve;
  }

  async completer(req: RequeteIa): Promise<ReponseIa> {
    const tier = tierPour(req.capacite);
    const modele = modelePour(tier);
    // STATELESS : chat.complete uniquement.
    const res = await this.client.chat.complete({
      model: modele,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const brut = res.choices?.[0]?.message?.content;
    const texte = typeof brut === "string" ? brut : "";
    return {
      texte,
      tier,
      modele,
      usage: {
        tokensEntree: res.usage?.promptTokens ?? 0,
        tokensSortie: res.usage?.completionTokens ?? 0,
      },
    };
  }
}
