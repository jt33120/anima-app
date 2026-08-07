import "server-only";
import type { JetonDesabonnement } from "@/lib/domain/jeton-desabonnement";

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
 * Resend voit donc : une adresse, un motif, et — depuis la revue T5-2 — un jeton de désabonnement. Rien
 * d'autre : ni prénom, ni titre de branche, ni chiffre, ni date. Il devient sous-traitant art. 28 à ce
 * titre, et son DPA est une porte pré-lancement.
 *
 * ── LE TROISIÈME PARAMÈTRE, ET POURQUOI IL NE CASSE PAS LA PROPRIÉTÉ CI-DESSUS ──────────────────────────
 *
 * Le désabonnement en un clic est nécessairement PAR PERSONNE : un lien commun ne désabonnerait personne.
 * Il a donc fallu ouvrir un trou dans une signature dont l'absence de trou faisait toute la sûreté.
 *
 * Le trou est refermé par le TYPE. `JetonDesabonnement` (défini dans `lib/domain/`, cf. la note qui y
 * explique pourquoi) est une chaîne marquée que seul `jetonValide()` peut produire, et `jetonValide()`
 * n'accepte qu'un uuid. La phrase « ajoutons juste le premier paragraphe de la synthèse » reste donc
 * inécrivable : il n'existe toujours aucun paramètre où la mettre, et le seul qui accepte une chaîne
 * refuse tout ce qui n'est pas un uuid — à l'exécution, pas seulement à la compilation.
 */

/**
 * L'ensemble FERMÉ des motifs — miroir EXACT du CHECK `notification_envoyee.motif` (0029/0036) et de
 * `public.famille_motif` (0036). Trois choses doivent rester d'accord, et le désaccord est rendu bruyant :
 * un motif absent du CHECK ne s'insère pas, un motif sans famille fait LEVER la réservation.
 *
 * `echeance_intention` (Story 4.10, AC3) : « une échéance que tu as fixée arrive aujourd'hui ». C'est le
 * DEUXIÈME motif signé d'Anam — celui qui a rendu observable le fait que le plafond de 72 h était compté
 * par motif et non par famille (décision D4). L'Epic 6 ajoutera FR-033 (le socle), qui est une AUTRE
 * famille et n'entrera donc pas en concurrence avec ceux-ci.
 *
 * ⚠️ IL N'EXISTE AUCUN MOTIF DE RECONNEXION, et c'est structurel : « jamais un rappel de connexion »
 * (AC3, EXPERIENCE.md) n'est pas une règle de rédaction qu'on pourrait enfreindre en écrivant un joli
 * texte — il n'y a simplement aucune valeur ici où le loger.
 */
export type MotifCourriel = "synthese_prete" | "echeance_intention";

/**
 * Story 3.5 — L'ENSEMBLE FERMÉ DES INFORMATIONS LÉGALES, DÉLIBÉRÉMENT SÉPARÉ DE `MotifCourriel`.
 *
 * ⚠️ NE PAS FUSIONNER LES DEUX UNIONS. C'est le geste que cette séparation existe pour empêcher, et il
 * est parfaitement naturel : « c'est un courriel de plus, ajoutons un motif ». Sauf que `MotifCourriel`
 * n'est pas une liste de textes — c'est un RÉGIME. Tout ce qui y entre hérite de `reserver_notification`,
 * donc du refus de canal (`preference_courriel.refuse_le`, 0034) et du plafond par famille (0036).
 *
 * Or ces deux gardes sont exactement ce qu'une information avant reconduction tacite ne doit PAS subir.
 * Le refus de canal est un droit d'opposition (art. 21) sur les notifications produit ; l'information
 * avant reconduction est une obligation contractuelle (art. L215-1 C. consommation). Les confondre, c'est
 * décider qu'un clic dans un pied de courriel dispense de prévenir quelqu'un avant de le débiter de 69 €.
 *
 * La séparation est portée par le TYPE, et pas par une consigne : `envoyer` n'accepte pas un `MotifLegal`,
 * `envoyerInformationLegale` n'accepte pas un `MotifCourriel`. Aucun des deux chemins ne peut emprunter
 * les gardes de l'autre, ni s'en dispenser.
 */
export type MotifLegal = "reconduction_a_venir";


export interface PortCourriel {
  /**
   * Envoie le courriel du motif donné. Lève en cas d'échec — l'appelant décide de son repli (AD-15).
   * Ne renvoie rien : il n'y a rien d'utile à rapporter qu'on ait le droit de journaliser.
   */
  envoyer(destinataire: string, motif: MotifCourriel, jeton: JetonDesabonnement): Promise<void>;
  /**
   * Story 3.5 — l'information légale. PAS de `jeton`, et l'absence est le message : il n'y a rien à
   * désabonner. Proposer un lien de désabonnement sur une information contractuelle obligatoire serait
   * une promesse qu'on ne peut pas tenir — le courriel suivant partirait quand même, et le lien
   * n'aurait servi qu'à faire croire le contraire.
   *
   * Conséquence directe : aucun en-tête `List-Unsubscribe` non plus (RFC 8058 vise le courrier en
   * volume, pas le transactionnel). Voir `gabaritLegalPour`.
   */
  envoyerInformationLegale(destinataire: string, motif: MotifLegal): Promise<void>;
  /**
   * Le port peut-il réellement envoyer ? Interrogé AVANT toute réservation : réserver puis découvrir
   * qu'on ne peut pas envoyer consommerait le droit d'envoyer sans avoir envoyé.
   */
  estConfigure(): boolean;
}
