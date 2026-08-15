import "server-only";

/**
 * Story 6.2 — LE PORT DE POUSSÉE. Le troisième port du dépôt, après `AiPort` (AD-3) et `PortCourriel`
 * (4.9), et construit sur la même idée : **ce qui fait la sécurité d'un port, c'est sa signature.**
 *
 * ── CE QU'IL N'Y A PAS DANS `reveiller` ───────────────────────────────────────────────────────────────
 *
 * Pas de titre. Pas de corps. Pas de variables. Pas d'objet `donnees`. Un abonnement, et un MOTIF pris
 * dans un ensemble fermé.
 *
 * Le scénario qu'on tue est le même qu'en 4.9, et il est banal : « ajoutons juste le mantra du jour
 * dans l'aperçu, c'est plus engageant ». Ce mantra est déduit du thème natal — de l'art. 9. Il
 * s'afficherait sur un écran verrouillé, dans le métro (FR-035, NFR-015). Avec cette signature, la
 * phrase ne peut pas s'écrire : **il n'existe aucun paramètre où la mettre.**
 *
 * ⚠️ Et ce n'est PAS parce que le service de poussée lirait le contenu — il ne le peut pas, une charge
 * utile web push est chiffrée de bout en bout avec les clés de l'abonnée (RFC 8291). Le tiers dont il
 * est question ici est **l'écran verrouillé**, c'est-à-dire n'importe qui se tenant derrière elle.
 * C'est une menace plus banale qu'un sous-traitant, et bien plus probable.
 *
 * ── LE TRANSPORT NE PORTE AUCUNE CHARGE UTILE (décision D1) ──────────────────────────────────────────
 *
 * RFC 8030 autorise un corps vide. On s'en sert : l'adaptateur POSTe zéro octet, et le service worker
 * choisit titre et corps dans l'ensemble fini qu'il embarque (`lib/domain/socle-quotidien.ts`). Il n'y a
 * donc, aujourd'hui, aucun code de chiffrement de charge utile dans ce dépôt.
 *
 * ⚠️ **CE CHOIX A UNE DATE DE PÉREMPTION, ET ELLE EST GARDÉE.** Tant que `MotifPoussee` n'a qu'un
 * membre, le service worker sait quoi afficher sans qu'on le lui dise. Au DEUXIÈME motif (Story 6.3,
 * Anam rare et spécifique), il ne le saura plus — et sans garde, la notification d'Anam afficherait
 * silencieusement le texte du socle. `tests/poussee-architecture.test.ts` rougit donc à l'instant où un
 * second motif apparaît sans que le transport n'ait appris à le porter.
 */

/**
 * L'ensemble FERMÉ des motifs de poussée.
 *
 * ⚠️ IL N'EXISTE AUCUN MOTIF DE RECONNEXION, et c'est structurel — exactement comme pour
 * `MotifCourriel`. « Aucune notification de réengagement n'est jamais émise » (AC3) n'est pas une règle
 * de rédaction qu'on pourrait enfreindre en écrivant un joli texte : il n'y a aucune valeur ici où la
 * loger.
 */
export type MotifPoussee = "socle_quotidien";

/** Les motifs, en valeurs — pour que la garde d'architecture puisse les COMPTER. */
export const MOTIFS_POUSSEE: readonly MotifPoussee[] = Object.freeze(["socle_quotidien"]);

/** Un appareil abonné, tel que la base le rend. Trois identifiants de transport, aucun contenu. */
export interface AbonnementPoussee {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

/**
 * Ce qu'un service de poussée a répondu, réduit à ce dont l'appelant a besoin pour DÉCIDER.
 *
 * ⚠️ Trois valeurs et pas deux : `endpoint_mort` doit se distinguer de `refuse`, parce que les deux
 * appellent des gestes opposés. Un 410 dit « cet abonnement n'existe plus » et se répare en le
 * supprimant ; un 503 dit « réessaie » et se répare en ne touchant à rien. Les confondre, c'est soit
 * accumuler des endpoints morts jusqu'à ce que le fan-out n'atteigne plus les vivants, soit désabonner
 * quelqu'un sur un hoquet réseau.
 */
export type VerdictPoussee = "poussee" | "endpoint_mort" | "refuse";

export interface PortPoussee {
  /**
   * Réveille un appareil. **Ne lève pas** : une poussée qui échoue est un non-événement quotidien, et
   * la faire lever obligerait chaque appelant à décider quoi faire d'une exception dans une boucle.
   * Le verdict est la réponse.
   */
  reveiller(abonnement: AbonnementPoussee, motif: MotifPoussee): Promise<VerdictPoussee>;
  /**
   * Le port peut-il réellement pousser ? Interrogé AVANT toute réservation — réserver puis découvrir
   * qu'on ne peut pas pousser consommerait le droit de pousser sans avoir poussé (patron 4.9/4.10).
   */
  estConfigure(): boolean;
}
