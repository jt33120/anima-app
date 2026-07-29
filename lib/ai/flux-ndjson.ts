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
  | { t: "bilan"; titre: string; points: ReadonlyArray<string> };

/** Sérialise une trame en une ligne NDJSON (JSON compact + `\n` terminal). */
export function ligneNdjson(trame: TrameClient): string {
  return JSON.stringify(trame) + "\n";
}
