import "server-only";
import { Mistral } from "@mistralai/mistralai";
import type { AiPort, EvenementIa, RequeteIa, ReponseIa } from "../port";
import { modelePour, tierPour } from "../politique-tier";

/**
 * Adaptateur Mistral — le SEUL module autorisé à importer un SDK fournisseur (AD-3).
 * Gardé en CI : `tests/frontiere-serveur.test.ts` échoue si `@mistralai/mistralai` apparaît ailleurs.
 *
 * Endpoints STATELESS uniquement (`chat.complete` / `chat.stream`) — jamais `agents`,
 * `conversations`, `batch`, `fineTuning`, `libraries` : ZDR exclut ces surfaces (AD-4).
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

/**
 * Extrait le texte d'un contenu Mistral qui peut être `string` OU `ContentChunk[]` (type SDK).
 * Une réponse/delta en tableau de chunks (contenu structuré) verrait sinon son texte silencieusement
 * perdu (revue 2.2). Défensif (aucun couplage au type SDK) : ne garde que les fragments `.text`.
 */
function extraireTexte(contenu: unknown): string {
  if (typeof contenu === "string") return contenu;
  if (Array.isArray(contenu)) {
    return contenu
      .map((c) =>
        c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string"
          ? (c as { text: string }).text
          : "",
      )
      .join("");
  }
  return "";
}

export class AdaptateurMistral implements AiPort {
  private readonly client: Mistral;

  constructor() {
    assertConformiteArt9(); // lève avant toute construction si non conforme
    const cle = process.env.MISTRAL_API_KEY;
    if (!cle) {
      throw new Error("MISTRAL_API_KEY absente (secret serveur unique, jamais NEXT_PUBLIC_).");
    }
    this.client = new Mistral({ apiKey: cle });
  }

  estZdrProuve(): boolean {
    // `true` garanti par le boot-guard (assertConformiteArt9) exécuté au constructeur : toute
    // instance existante a prouvé ZDR/DPA/scale. Aucun état runtime à suivre (revue 2.1).
    return true;
  }

  /** Prépare tier/modele/messages EN UN endroit — completer et diffuser ne dérivent pas (revue 2.2). */
  private preparer(req: RequeteIa) {
    const tier = tierPour(req.capacite, req.niveauSecurite);
    return {
      tier,
      modele: modelePour(tier),
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };
  }

  async completer(req: RequeteIa): Promise<ReponseIa> {
    const { tier, modele, messages } = this.preparer(req);
    // STATELESS : chat.complete uniquement.
    const res = await this.client.chat.complete({ model: modele, messages });
    return {
      texte: extraireTexte(res.choices?.[0]?.message?.content),
      tier,
      modele,
      usage: {
        tokensEntree: res.usage?.promptTokens ?? 0,
        tokensSortie: res.usage?.completionTokens ?? 0,
      },
    };
  }

  /**
   * Streaming (Story 2.2) — STATELESS : `chat.stream` uniquement. Émet chaque fragment texte du
   * flux Mistral en `delta`, puis un `fin` avec l'usage (présent dans le dernier chunk). Le
   * regroupement par mots côté client (NFR-014) opère quelle que soit la taille des chunks amont.
   */
  async *diffuser(req: RequeteIa): AsyncIterable<EvenementIa> {
    const { tier, modele, messages } = this.preparer(req);
    let tokensEntree = 0;
    let tokensSortie = 0;
    const flux = await this.client.chat.stream({ model: modele, messages });
    for await (const evenement of flux) {
      // `delta.content` peut être `string` OU `ContentChunk[]` (type SDK) : extraire les DEUX,
      // sinon un delta structuré serait silencieusement perdu (revue 2.2).
      const texte = extraireTexte(evenement.data.choices?.[0]?.delta?.content);
      if (texte.length > 0) {
        yield { type: "delta", texte };
      }
      const usage = evenement.data.usage;
      if (usage) {
        tokensEntree = usage.promptTokens ?? tokensEntree;
        tokensSortie = usage.completionTokens ?? tokensSortie;
      }
    }
    yield { type: "fin", tier, modele, usage: { tokensEntree, tokensSortie } };
  }
}
