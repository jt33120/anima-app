/**
 * copie-abonnement.ts — Les libellés de la page « L'abonnement » (Story 3.5, FR-060/FR-089).
 *
 * Vit dans `render/` : le rendu ne peut pas importer `lib/` (frontière AD-7), et la copie d'UI est du
 * rendu. Aucune décision ici — que des chaînes.
 *
 * ══ CE QUE CETTE PAGE NE CONTIENT PAS, ET CHAQUE ABSENCE EST UN CHOIX (AC2 [DUR]) ═══════════════════════
 *
 *   • aucun questionnaire de départ — pas même facultatif, pas même « pour nous aider à nous améliorer » ;
 *   • aucune offre de rétention — ni remise, ni pause, ni mois offert, ni « es-tu sûre ? » à étages ;
 *   • aucun compte à rebours, aucune rareté, aucun « ton arbre va disparaître » (il ne disparaît pas) ;
 *   • aucun chiffre de progression, aucune jauge, aucun décompte de branches (FR-031) ;
 *   • aucun ton de reproche, aucun « déjà ? », aucun « tu es sûre de vouloir tout perdre ».
 *
 * La confirmation tient sur la MÊME VUE et n'a qu'UN bouton (FR-060) : trois clics au total depuis la
 * surimpression. Un second écran de confirmation ferait quatre, et quatre est illégal depuis la loi du
 * 16 août 2022.
 *
 * ══ CE QU'ELLE DIT DE L'ARBRE, ET POURQUOI C'EST LÀ ══════════════════════════════════════════════════════
 *
 * Résilier ne fait rien disparaître (FR-029, décision D1-A de la 3.3 : un compte expiré lit, renomme et
 * déclare le rayonnement — il ne peut plus faire NAÎTRE). Le dire est le contraire d'un argument de
 * rétention : c'est retirer la peur du geste. Une phrase qui laisserait planer le doute serait une
 * rétention par l'angoisse, et ce serait la plus efficace de toutes.
 */

export const TITRE = "L'abonnement";

/** L'état, en toutes lettres. Aucune date n'est écrite ici : elles sont interpolées par la page. */
export const ETAT_ACTIF = "Ton abonnement est actif.";
export const ETAT_ACTIF_JUSQU_AU = (date: string) => `Il se renouvellera le ${date}.`;
/** Résiliée mais encore ouverte — l'accès court jusqu'au bout de ce qui est payé. */
export const ETAT_RESILIE = "Ton abonnement est résilié.";
export const ETAT_RESILIE_JUSQU_AU = (date: string) => `Tu y as accès jusqu'au ${date}.`;
export const ETAT_TERMINE = "Ton abonnement n'est plus actif.";

/**
 * ── STORY 3.6 (QA T2) — CE QU'ON DIT À QUELQU'UN QUI N'A JAMAIS EU D'ABONNEMENT ────────────────
 *
 * ⚠️ CETTE PHRASE MANQUAIT, ET SON ABSENCE PRODUISAIT UN MENSONGE. La page traitait « jamais
 * abonnée » et « abonnement terminé » dans la MÊME branche : un compte gratuit qui arrivait ici —
 * envoyé par `/ancrages`, par exemple — lisait « Ton abonnement n'est plus actif », à propos d'un
 * abonnement qui n'a jamais existé. Un état inventé, sur la page qui parle d'argent.
 *
 * Elle est FACTUELLE et sans reproche : ni « tu n'as pas encore souscrit » (qui suppose une
 * intention), ni « passe au premium » (qui vend dans une phrase d'état). Ce qui vend est l'offre
 * en dessous, et elle est nommée comme telle.
 */
export const ETAT_JAMAIS_ABONNEE = "Tu n'as pas d'abonnement.";

/** Le titre de l'offre. Le MÊME que celui de la carte du fil : une seule offre, un seul nom. */
export const TITRE_OFFRE = "Continuer avec Anam";
/** Panne de lecture : ne jamais dire « tu n'as pas d'abonnement » à quelqu'un qui en a un (patron 4.6). */
export const ETAT_INDISPONIBLE = "Je n'arrive pas à afficher ton abonnement pour l'instant.";
export const ETAT_INDISPONIBLE_CORPS = "Il est là. Réessaie dans un moment.";

export const ACTION_RESILIER = "Résilier mon abonnement";
export const ACTION_REPRENDRE = "Reprendre mon abonnement";
export const SUCCES_RESILIATION = "C'est fait. Tu gardes ton accès jusqu'à la fin de la période payée.";
export const SUCCES_REPRISE = "C'est fait. Ton abonnement continue.";
export const ECHEC = "Je n'ai pas pu enregistrer ça. Tu peux réessayer.";

/**
 * Quand le paiement n'est pas configuré (porte pré-lancement §4).
 *
 * ⚠️ ELLE NE DIT PAS « RÉESSAIE ». Une clé de test en production ne se répare pas en rechargeant :
 * lui proposer de recommencer serait l'envoyer buter deux fois. Le texte dit ce qui est — ça ne
 * marche pas maintenant, ce n'est pas de son fait, rien n'a été débité — et s'arrête là.
 */
export const REFUS_PAIEMENT_INDISPONIBLE =
  "Je ne peux pas prendre ton abonnement en ce moment : quelque chose n'est pas en place de notre " +
  "côté. Rien n'a été débité. Ça n'a rien à voir avec toi, et ça se règle sans toi.";

/**
 * ── QUAND LE CONTRAT COURT ENCORE (revue 3.6, R1 · art. L215-1 / FR-060) ───────────────────────────
 *
 * Un paiement en échec passe l'abonnement en `past_due` chez Stripe : l'accès s'éteint, mais le
 * contrat court et les relances continuent. L'écran disait « Ton abonnement n'est plus actif » ET
 * proposait « M'abonner » — le geste évident quand on veut que ça remarche. Elle payait alors une
 * SECONDE souscription par-dessus la première.
 *
 * ⚠️ CE TEXTE DOIT PORTER LE CHEMIN, PAS SEULEMENT LE REFUS. Un refus sans issue est une impasse, et
 * l'impasse est ce qu'on reprochait à l'écran d'origine. Le chemin existe et il tient en deux gestes
 * qui vivent DÉJÀ sur cette page : résilier le contrat coincé, puis reprendre l'offre.
 *
 * DETTE NOMMÉE : le produit n'a AUCUNE surface de mise à jour de carte (aucun portail de facturation
 * Stripe nulle part dans le dépôt). Tant qu'elle n'existe pas, « résilier puis reprendre » est le
 * seul chemin honnête — et il coûte à celle qui voulait simplement changer de carte.
 */
export const REFUS_CONTRAT_OUVERT =
  "Ton abonnement précédent court encore chez notre prestataire de paiement, même s'il ne te donne " +
  "plus accès : je ne peux pas t'en vendre un second par-dessus, tu paierais deux fois. Résilie " +
  "celui-là d'abord — le bouton est plus haut — puis reprends ici.";

/** La garantie (FR-089) — proposée SEULEMENT quand elle y a droit. Jamais annoncée comme un lot de consolation. */
export const ACTION_REMBOURSEMENT = "Demander le remboursement";
export const GARANTIE_DISPONIBLE =
  "Aucune branche n'a été posée depuis trois mois. Tu peux demander le remboursement, sans avoir à te justifier.";
export const SUCCES_REMBOURSEMENT = "C'est demandé. Le remboursement arrive sur ton moyen de paiement.";
/**
 * Le cas où la résiliation a eu lieu mais qu'aucun paiement n'a été retrouvé à rembourser.
 *
 * Revue du 2026-08-11 (M2) : la route affichait `SUCCES_REMBOURSEMENT` dans CE cas aussi. Quelqu'un
 * lisait « le remboursement arrive » et attendait un virement qui ne viendrait jamais, sans qu'aucun
 * écran, aucun journal ni aucune alerte ne le contredise. C'est la même discipline que FR-050 pour le
 * socle : une absence dite vaut mieux qu'une valeur qui a l'air juste.
 */
export const REMBOURSEMENT_SANS_PAIEMENT =
  "Ton abonnement est résilié. Mais je n'ai trouvé aucun paiement à te rembourser — je préfère te le dire plutôt que de te laisser attendre.";
/**
 * REFUS : réessayer n'a PAS de sens ici, et le patron `REFUS_RAYONNEMENT` (4.7) s'applique — on ne
 * promet pas « tu peux réessayer » à quelqu'un qui se heurterait au même mur. On ne dit pas non plus
 * POURQUOI dans le détail : « tu as posé une branche » ou « il te manque trois semaines » seraient l'un
 * et l'autre un décompte (FR-031), et le second une invitation à revenir compter les jours.
 */
export const REFUS_REMBOURSEMENT = "Cette demande n'est pas ouverte sur ton abonnement.";

/** L'arbre ne recule pas — dit une fois, platement, pour retirer la peur du geste (FR-029). */
export const RIEN_NE_DISPARAIT =
  "Ton arbre, tes branches et ce que tu as écrit restent là, et restent à toi.";
