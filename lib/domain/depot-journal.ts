/**
 * Port du JOURNAL BRUT (AD-8, couche 1). Domaine PUR : aucune dépendance infra (Next/Supabase/SDK).
 * L'identité de l'utilisatrice est fixée à la CONSTRUCTION de l'adaptateur (comme `DepotSeance`).
 */

export type RoleJournal = "utilisatrice" | "anam";

export interface EntreeAConsigner {
  /** Clé du tour LOGIQUE (jeton de tour client, Story 3.4) — idempotence : réémission/retry = une entrée. */
  cleTour: string;
  /** Côté du tour. 4.1 n'écrit que `utilisatrice` ; `anam` viendra (4.6 « Voir dans la conversation »). */
  role: RoleJournal;
  /** Le VERBATIM, mot pour mot, jamais transformé (AC1). */
  contenu: string;
}

export interface DepotJournal {
  /** Grave une entrée. Append-only, idempotent par `(cleTour, role)`. Lève sur échec RÉEL. */
  consigner(entree: EntreeAConsigner): Promise<void>;
}
