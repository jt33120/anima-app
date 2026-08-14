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
// `retour_theme` (Story 4.7) = « ce tour revient-il sur le thème d'une branche existante ? ».
// FORT lui aussi : l'effet est IRRÉVERSIBLE (l'intensité ne redescend jamais), et lire une
// paraphrase demande le modèle capable — un faux positif s'inscrit définitivement dans son arbre.
// `hypothese_enneagramme` (Story 5.5) = « ce que cette personne raconte d'elle correspond-il à un
// type ? ». FORT, et tranché EXPLICITEMENT dans `politique-tier` : l'objet touche à l'IDENTITÉ.
// Se tromper ne coûte pas une phrase maladroite, ça pose une étiquette fausse sur quelqu'un.
// `lecture` (Story 5.8) = le texte long qui part de CE QU'ELLE A PROJETÉ sur la carte. FORT, et
// tranché explicitement dans `politique-tier` : registre document, il reprend ses mots en clair et
// n'a pas droit à la prédiction. C'est la capacité où vit toute la personnalisation du rituel —
// jamais dans la sélection de la carte, qui elle ne sait rien de personne (AD-11, FR-019).
export type CapaciteIa =
  | "echange"
  | "reconceptualisation"
  | "synthese"
  | "detection"
  | "retour_theme"
  | "hypothese_enneagramme"
  | "lecture";
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
