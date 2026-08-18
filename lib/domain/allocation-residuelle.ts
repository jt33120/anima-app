/**
 * allocation-residuelle.ts — Le cœur PUR de l'allocation résiduelle (Story 3.4, AD-1/AD-17). AUCUN
 * import : décide, seule et testable, si la conversation gratuite se COUPE. C'est la dérivation UNIQUE
 * de la coupure (jamais un 2ᵉ calcul ailleurs — ni le rendu muet AD-7, ni deux endroits du serveur).
 *
 * Ordre de court-circuit (chacun protège l'ACCÈS ; le premier vrai gagne — le doute ne coupe jamais) :
 *  - premium        → jamais de coupure (conversation illimitée, FR-056, AC5) ;
 *  - niveauSecurite → jamais de coupure dès qu'il dépasse 0 (revue adversariale, R8 — voir plus bas) ;
 *  - limitesLevees  → jamais de coupure (détresse lève toute limite, FR-043, AD-9/AD-17, AC6 ;
 *                     faux par défaut en l'absence du sous-système de détresse) ;
 *  - !seanceClose   → jamais de coupure PENDANT la 1ʳᵉ séance (gratuite, non décomptée, FR-059/AC2) ;
 *  - limite == null → non configuré → aucune coupure (FR-079/FR-058, AC3, jamais coupé à zéro) ;
 *  - sinon          → couper ssi `toursConsommes >= limite`.
 */
export interface EntreeAllocation {
  /** Entitlement premium (source 3.1) : premium = conversation illimitée. */
  readonly premium: boolean;
  /** `limites_levees` (AD-17, dérivé de `episode_detresse.fin IS NULL`) : la détresse lève toute limite. */
  readonly limitesLevees: boolean;
  /**
   * Le niveau de sécurité EFFECTIF de ce tour-ci — verdict détecté, relevé au plancher de l'épisode
   * ouvert (0067). 0 = rien signalé.
   *
   * ⚠️ IL NE DOUBLE PAS `limitesLevees`, ET C'EST TOUT L'OBJET (revue adversariale, R8). Les deux
   * signaux se DÉSALIGNENT au tour qui ÉTEINT l'épisode, et ce tour n'a rien d'exotique : c'est le
   * tour normal de sortie. La RPC éteint l'épisode et rend `limites_levees = false`, alors que le
   * verdict du tour a été calculé AVANT l'enregistrement, plancher compris — donc encore à 3.
   *
   * Avec `limitesLevees` seul, ce tour-là était COUPÉ : le flux ne portait plus que `{t:"quota"}`,
   * le client retirait la réponse d'Anam, désactivait le composeur, et le bloc de numéros
   * d'urgence quittait l'écran — sur le tour même que le serveur classe encore « urgence ».
   */
  readonly niveauSecurite: number;
  /** La 1ʳᵉ séance est-elle CLOSE (bilan livré) ? Faux pendant la séance → jamais de coupure. */
  readonly seanceClose: boolean;
  /** Tours post-séance déjà consommés dans le mois courant. */
  readonly toursConsommes: number;
  /** Volume alloué, lu de la config à l'exécution ; `null` = non configuré (aucune coupure). */
  readonly limite: number | null;
}

export function doitCouperConversation(e: EntreeAllocation): boolean {
  if (e.premium) return false; // AC5 — illimité
  // ⚠️ AVANT `limitesLevees`, ET C'EST LE CORRECTIF R8. Au tour qui éteint l'épisode, le second est
  // déjà faux tandis que le premier vaut encore 3. Les inverser ne changerait rien (les deux
  // rendent `false`), mais l'ordre dit ce qui prime : le NIVEAU du tour, pas l'état de l'épisode.
  if (e.niveauSecurite > 0) return false;
  if (e.limitesLevees) return false; // AC6 — la détresse prime sur toute limite
  if (!e.seanceClose) return false; // AC2 — la 1ʳᵉ séance ne compte pas
  if (e.limite === null) return false; // AC3 — non configuré → jamais coupé à zéro
  return e.toursConsommes >= e.limite;
}
