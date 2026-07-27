import "server-only";

/**
 * `AiPort` — le port IA unique (AD-3). L'applicatif ne connaît QUE ce contrat ; aucun code hors
 * `lib/ai/adapters/` n'importe un SDK fournisseur. Le tier est un paramètre du port (jamais un
 * `if` fournisseur) : l'appelant déclare sa CAPACITÉ, la politique résout le tier (AD-3, AD-5).
 *
 * Story 2.1 : `completer()`. Story 2.2 : le streaming (`diffuser()`) + la dimension
 * `niveauSecurite` de la requête (posée par le SERVEUR ; le client ne la fournit JAMAIS —
 * `extraireMessages` n'extrait que `messages[]`, et la route construit le reste). Le tier n'est
 * donc jamais choisi par le client : la politique unique (AD-5) le résout côté serveur.
 */

// `detection` = la classification de détresse du pipeline sécurité (Story 2.3, §5). Toujours
// résolue au tier FORT, inconditionnellement (AD-5, NFR-012) — voir `politique-tier`.
export type CapaciteIa = "echange" | "reconceptualisation" | "synthese" | "detection";
export type TierIa = "leger" | "fort";
/** Niveau de détresse (Story 2.3 le PRODUIT ; ici, la politique le CONSOMME — défaut 0). */
export type NiveauSecurite = 0 | 1 | 2 | 3;

export interface MessageIa {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RequeteIa {
  capacite: CapaciteIa;
  messages: MessageIa[];
  /** Le contenu est-il art. 9 ? détermine si l'egress-guard (AD-13) s'applique à l'envoi. */
  contientArt9: boolean;
  /**
   * Niveau de détresse résolu CÔTÉ SERVEUR (AD-5). Optionnel = 0 (échange normal). Le client ne
   * peut pas le poser : il n'arrive que par la construction serveur de la requête. En 2.2 il vaut
   * toujours 0 ; la Story 2.3 (pipeline sécurité) posera le vrai niveau.
   */
  niveauSecurite?: NiveauSecurite;
}

export interface ReponseIa {
  texte: string;
  tier: TierIa;
  modele: string;
  usage: { tokensEntree: number; tokensSortie: number };
}

/**
 * Événement d'un flux `diffuser()` (Story 2.2). Union discriminée :
 *  - `delta` : un fragment de texte (à rendre par GROUPES DE MOTS côté client, NFR-014) ;
 *  - `fin` : le tour est complet — porte l'usage RÉEL de fin de flux (métrage exactement-une-fois).
 * Le métrage (usage/tier/modele) ne transite JAMAIS jusqu'au client : il reste serveur.
 */
export type EvenementIa =
  | { type: "delta"; texte: string }
  | { type: "fin"; tier: TierIa; modele: string; usage: { tokensEntree: number; tokensSortie: number } };

export interface AiPort {
  completer(req: RequeteIa): Promise<ReponseIa>;
  /**
   * Streaming (Story 2.2). Émet des `delta` puis exactement UN `fin`. `async function*` : le corps
   * ne s'exécute pas avant la première itération → l'egress-guard peut poser ses gardes AVANT le
   * premier octet (AD-13).
   */
  diffuser(req: RequeteIa): AsyncIterable<EvenementIa>;
  /**
   * L'adaptateur atteste-t-il un chemin ZDR prouvé ? Interrogé par l'egress-guard, qui reste
   * ainsi AGNOSTIQUE au fournisseur (AD-3) — pas de lecture d'env dans l'egress. Mistral : vrai
   * seulement si le boot-guard a validé ZDR/DPA/scale ; adaptateur factice : vrai par construction
   * (in-process, rien ne quitte le système).
   */
  estZdrProuve(): boolean;
}
