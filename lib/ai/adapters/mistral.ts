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

/** Le temps d'attente avant l'unique reprise. Assez pour laisser passer un pic, pas assez pour
 *  qu'on croie l'écran figé — la latence du modèle est déjà de sept à neuf secondes. */
const DELAI_REPRISE_MS = 400;

/**
 * Classe un échec du fournisseur, pour que le journal DISE quelque chose.
 *
 * ⚠️ « PASSAGER » EST UNE LISTE FERMÉE, JAMAIS UN REPLI. Un défaut de configuration (401, 403), une
 * requête malformée (400) ou un modèle inconnu (404) ne se réparent pas en réessayant : les
 * reprendre masquerait la panne et doublerait la facture. Seuls le quota (429), les pannes serveur
 * (5xx) et les coupures réseau sans statut méritent une seconde chance.
 */
export type ClasseEchec = "passager" | "configuration" | "inconnu";

export function classerEchec(e: unknown): ClasseEchec {
  const statut =
    typeof e === "object" && e !== null && "statusCode" in e
      ? Number((e as { statusCode: unknown }).statusCode)
      : typeof e === "object" && e !== null && "status" in e
        ? Number((e as { status: unknown }).status)
        : NaN;
  if (statut === 429 || (statut >= 500 && statut <= 599)) return "passager";
  if (statut >= 400 && statut <= 499) return "configuration";
  // Aucun statut : coupure réseau, flux interrompu, délai dépassé. Rien n'a été produit puisqu'on
  // n'est pas encore entré dans la boucle — reprendre est sûr.
  if (Number.isNaN(statut)) return "passager";
  return "inconnu";
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

    // ⚠️ LA REPRISE S'ARRÊTE AU PREMIER FRAGMENT, ET C'EST TOUTE LA GARDE.
    //
    // La QA du 2026-08-19 a mesuré UNE RÉPONSE SUR TROIS en échec — deux sur quatorze le 15 août —
    // sans erreur console ni requête en 4xx/5xx côté client : le flux mourait côté serveur et
    // l'écran affichait « Je n'ai pas pu répondre ». Rien ne classait l'erreur : un 429 de quota,
    // une coupure réseau et une panne du fournisseur ressortaient identiques, donc introuvables.
    //
    // Reprendre APRÈS qu'un fragment est parti dupliquerait du texte dans le fil — Anam se
    // répéterait au milieu d'une phrase, sur un produit où elle est censée être quelqu'un. La
    // reprise n'a donc lieu que tant que RIEN n'a été émis, et une seule fois.
    let flux: Awaited<ReturnType<typeof this.client.chat.stream>>;
    try {
      flux = await this.client.chat.stream({ model: modele, messages });
    } catch (e) {
      const classe = classerEchec(e);
      console.error("mistral/diffuser : ouverture du flux refusée", { classe, modele });
      if (classe !== "passager") throw e;
      await new Promise((r) => setTimeout(r, DELAI_REPRISE_MS));
      flux = await this.client.chat.stream({ model: modele, messages });
    }

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
