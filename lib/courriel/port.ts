import "server-only";

/**
 * Story 4.9 — LE PORT COURRIEL. Un contrat unique, à l'image d'`AiPort` (AD-3) : l'applicatif ne connaît
 * que ce contrat, et aucun code hors `lib/courriel/adaptateurs/` ne parle à un fournisseur d'envoi.
 *
 * ── CE QUI FAIT TOUTE LA SÉCURITÉ DE CE PORT : SA SIGNATURE ────────────────────────────────────────────
 *
 * `envoyer` ne prend PAS de sujet, PAS de corps, PAS de variables. Il prend un MOTIF, pris dans un
 * ensemble fermé. C'est délibéré, et c'est la même stratégie que `sante_ordonnanceur_publique` en 4.8 :
 * on ne demande pas à l'appelant d'être discipliné, on lui retire le moyen de ne pas l'être.
 *
 * Le scénario qu'on tue, et il est banal : « ajoutons juste le premier paragraphe de la synthèse en
 * aperçu, c'est plus engageant ». Ce paragraphe est de l'art. 9. Il partirait chez un sous-traitant qui
 * n'a aucune raison de le voir, s'afficherait sur un écran verrouillé (FR-035), et traînerait dans les
 * journaux d'un serveur de messagerie pour toujours. Avec cette signature, la phrase ne peut pas
 * s'écrire : il n'y a pas de paramètre où la mettre.
 *
 * Resend voit donc : une adresse, un motif. Rien d'autre — ni prénom, ni titre de branche, ni chiffre,
 * ni date. Il devient sous-traitant art. 28 à ce titre, et son DPA est une porte pré-lancement.
 */

/** L'ensemble FERMÉ des motifs. L'Epic 6 y ajoutera FR-033 (socle) et FR-034 (échéances). */
export type MotifCourriel = "synthese_prete";

export interface PortCourriel {
  /**
   * Envoie le courriel du motif donné. Lève en cas d'échec — l'appelant décide de son repli (AD-15).
   * Ne renvoie rien : il n'y a rien d'utile à rapporter qu'on ait le droit de journaliser.
   */
  envoyer(destinataire: string, motif: MotifCourriel): Promise<void>;
  /**
   * Le port peut-il réellement envoyer ? Interrogé AVANT toute réservation : réserver puis découvrir
   * qu'on ne peut pas envoyer consommerait le droit d'envoyer sans avoir envoyé.
   */
  estConfigure(): boolean;
}
