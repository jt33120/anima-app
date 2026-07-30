/**
 * Port des FAITS EXTRAITS (AD-8 couche 2, AD-18). Domaine PUR : aucune dépendance infra
 * (Next/Supabase/SDK). Propriétaire unique de la FORME canonique d'un fait — les deux écrivains
 * (extraction automatique et édition utilisatrice) convergent vers `DepotFaits` : il n'existe aucun
 * second chemin d'écriture (AC4, garde de source `faits-architecture.test.ts`).
 */

export type OrigineFait = "extrait" | "utilisatrice";
export type StatutFait = "actif" | "corrige" | "supprime";

/**
 * Ce que le FUTUR extracteur (Story 4.4, passe FORT sous egress art. 9) produira — la couture. En 4.2,
 * alimenté directement par les tests. `cleDedoublonnage` est OPAQUE et STABLE (jamais de contenu en clair,
 * art. 9-safe) : une info = une ligne. `extraitSourceId` = l'entrée de journal source (message exact, AC5 de 4.1).
 */
export interface FaitCandidat {
  cleDedoublonnage: string;
  contenu: string;
  extraitSourceId: string;
}

export interface DepotFaits {
  /**
   * Écrivain AUTO (`origine='extrait'`) : upsert idempotent par `cleDedoublonnage`. NO-OP silencieux si
   * le fait est déjà un tombstone (corrige/supprime) ou possédé par l'utilisatrice — ne ressuscite JAMAIS (AD-18).
   */
  fusionner(fait: FaitCandidat): Promise<void>;
  /** Écrivain UTILISATRICE : corrige un fait existant (`origine='utilisatrice'`, `statut='corrige'`). Prime toujours. */
  corriger(cleDedoublonnage: string, contenu: string): Promise<void>;
  /** Écrivain UTILISATRICE : supprime (soft) un fait existant (`statut='supprime'`, contenu vidé). Tombstone. */
  supprimer(cleDedoublonnage: string): Promise<void>;
}
