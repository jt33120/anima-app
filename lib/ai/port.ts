import "server-only";

/**
 * `AiPort` — le port IA unique (AD-3). L'applicatif ne connaît QUE ce contrat ; aucun code hors
 * `lib/ai/adapters/` n'importe un SDK fournisseur. Le tier est un paramètre du port (jamais un
 * `if` fournisseur) : l'appelant déclare sa CAPACITÉ, la politique résout le tier (AD-3, AD-5).
 *
 * Story 2.1 : `completer()`. Le streaming (`diffuser()`) est ajouté en Story 2.2.
 */

export type CapaciteIa = "echange" | "reconceptualisation" | "synthese";
export type TierIa = "leger" | "fort";

export interface MessageIa {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RequeteIa {
  capacite: CapaciteIa;
  messages: MessageIa[];
  /** Le contenu est-il art. 9 ? détermine si l'egress-guard (AD-13) s'applique à l'envoi. */
  contientArt9: boolean;
}

export interface ReponseIa {
  texte: string;
  tier: TierIa;
  modele: string;
  usage: { tokensEntree: number; tokensSortie: number };
}

export interface AiPort {
  completer(req: RequeteIa): Promise<ReponseIa>;
  /**
   * L'adaptateur atteste-t-il un chemin ZDR prouvé ? Interrogé par l'egress-guard, qui reste
   * ainsi AGNOSTIQUE au fournisseur (AD-3) — pas de lecture d'env dans l'egress. Mistral : vrai
   * seulement si le boot-guard a validé ZDR/DPA/scale ; adaptateur factice : vrai par construction
   * (in-process, rien ne quitte le système).
   */
  estZdrProuve(): boolean;
  // diffuser(req: RequeteIa): AsyncIterable<...>  ← Story 2.2 (streaming)
}
