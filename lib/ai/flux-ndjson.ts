/**
 * Cadrage NDJSON du flux de conversation (Story 2.2) — une ligne JSON par événement, `\n` en
 * séparateur. Trames client : `{"t":"delta","c":"…"}` (fragment de texte), `{"t":"fin"}` (fin
 * propre), `{"t":"erreur"}` (échec fournisseur). Le tier/usage/modèle ne transitent JAMAIS ici
 * (métrage serveur uniquement, AD-2).
 *
 * `JSON.stringify` échappe les sauts de ligne du contenu (`\n` → `\\n`) : un delta multi-lignes
 * (listes, paragraphes) NE casse PAS la frontière de ligne NDJSON. Verrouillé par `tests/ndjson.test.ts`.
 *
 * ⚠️ Contrat client (Phase B) : le flux est `delta* (fin | erreur)`. `erreur` est une trame
 * TERMINALE au même titre que `fin` (aucun `fin` n'est émis après une `erreur`). Le client doit la
 * traiter comme fin d'échec (texte partiel conservé + « Réessayer »). [voir deferred-work.md]
 */
export type TrameClient =
  | { t: "delta"; c: string }
  | { t: "fin" }
  | { t: "erreur" }
  /**
   * Beat d'apparition d'Anam en Présence (Story 2.7, AC5) : trame NON terminale, no-leak — elle ne
   * porte QUE l'identifiant du beat (jamais phase, signaux, compteurs). 2.7 n'émet que « nommer » (au
   * début du tour où Anam nomme) ; « ouverture » est monté au démarrage (2.2) et « cloture » est 2.9.
   */
  | { t: "beat"; beat: "ouverture" | "nommer" | "cloture" }
  /**
   * Bloc ressources de détresse (Story 2.6, AC4) : inséré dans le fil AVANT (niveau 3 vital) ou
   * APRÈS (niveau 2) le tour d'Anam. Seuls `position` + les champs présentationnels partent — NI
   * niveau, NI décision, NI tier (no-leak, AD-2). Type STRUCTUREL (aucun import `lib/safety` : le
   * sens de dépendance reste `safety → ai`, jamais l'inverse).
   */
  | {
      t: "ressources";
      position: "avant" | "apres";
      /** Libellé « Vérifié le … » (gouvernance FR-044) — porté par la trame : le rendu ne peut pas
       *  le tirer de `lib/safety` (frontière AD-7). */
      verifieLe: string;
      ressources: ReadonlyArray<{ numero: string; tel: string; aria: string; service: string; desc: string }>;
    }
  /**
   * Bilan de clôture (Story 2.9, AC2) : BLOC DOCUMENT inséré dans le fil APRÈS le drain de la phrase
   * de clôture et AVANT `fin`. Registre document — titres et listes autorisés (l'inverse de la voix).
   * La STRUCTURE est décidée SERVEUR (`{titre, points}`) : le rendu ne parse rien, il affiche (AD-7).
   * No-leak — la trame ne porte QUE le contenu à l'écran (jamais phase, niveau, tier, usage). Émise
   * uniquement hors détresse (gate `niveauSecurite === 0 && !limitesLevees`, route T4).
   */
  | { t: "bilan"; titre: string; points: ReadonlyArray<string> }
  /**
   * Proposition d'abonnement (Story 3.2, AC1) : SIGNAL pur — aucun payload, aucune donnée art. 9, ni
   * prix ni copie (tout vit en constantes CLIENT, `render/conversation/offre-abonnement`). Émise APRÈS la trame
   * `bilan` et AVANT `fin`, UNIQUEMENT hors détresse (elle SUIT le bilan, lui-même produit ssi
   * `clotureAutorisee`) et si l'utilisatrice n'est pas déjà premium (gate serveur, route). NON
   * terminale : le client insère la carte comme tour SOUS le bilan, puis continue de lire jusqu'à `fin`.
   */
  | { t: "paywall" }
  /**
   * Allocation résiduelle épuisée (Story 3.4, AC4) : SIGNAL pur — aucun payload, aucune donnée art. 9,
   * aucune copie (la ligne système et le motif vivent en constantes CLIENT, `render/conversation`). La
   * SEULE trame du flux quand on coupe (aucun `delta`, aucun `fin` — la conversation ne se génère pas
   * ce tour). Émise UNIQUEMENT hors détresse (jamais si `limites_levees`, AC6), post-séance, non premium,
   * allocation atteinte (gate serveur, route). Ce n'est PAS un paywall : jamais « Passe au premium ».
   */
  | { t: "quota" }
  /**
   * LA CARTE DÉPOSÉE (Story 5.8, AC2). Émise au tour de PRÉSENTATION, avant la question.
   *
   * ⚠️ DEUX CHAMPS, ET LE TROISIÈME EST CE QUI N'EST PAS LÀ. `cle` désigne un fichier de visuel (elle
   * ne s'affiche jamais : l'UX interdit de nommer la carte devant celle qui la tire) ; `description`
   * dit ce qui est DESSINÉ, pour que le lecteur d'écran reçoive la même matière que l'œil.
   *
   * IL N'Y A PAS DE CHAMP DE SIGNIFICATION, ET IL N'Y EN AURA PAS (FR-018). Le catalogue de sens
   * existe côté serveur et n'a AUCUNE représentation client avant la réponse de l'utilisatrice — un
   * champ `sens?: string` posé ici, même optionnel, même jamais rempli, serait la porte par laquelle
   * la signification traverserait un jour sans que rien ne rougisse.
   *
   * `description` peut être absente : aucun des 21 visuels n'est encore dessiné, et le rendu dit
   * l'absence honnêtement plutôt que de la combler.
   */
  | { t: "carte"; cle: string; description: string | null }
  /**
   * LA LECTURE (Story 5.8, AC4/AC6). BLOC DOCUMENT — même registre que `bilan`, même raison : elle
   * reprend ses mots en clair et contourne la troncature à trois phrases de la voix (FR-084).
   *
   * `lectureId` permet à « Mes lectures » d'y renvoyer et au fil de porter le lien vers l'échange
   * source (FR-021). Aucune donnée de sélection ne transite : ni graine, ni taille de jeu, ni sens.
   */
  | { t: "lecture"; lectureId: string; texte: string };

/** Sérialise une trame en une ligne NDJSON (JSON compact + `\n` terminal). */
export function ligneNdjson(trame: TrameClient): string {
  return JSON.stringify(trame) + "\n";
}
