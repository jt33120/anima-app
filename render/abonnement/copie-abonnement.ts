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
 * ── QUAND IL S'EST TERMINÉ (revue adversariale du 2026-08-18, R2) ──────────────────────────────
 *
 * ⚠️ CETTE PHRASE EXISTE PARCE QUE LA DATE ÉTAIT DÉJÀ À L'ÉCRAN — SOUS LE MAUVAIS LIBELLÉ. Une
 * résiliation ABOUTIE porte `etat = 'resilie'` ET `cancel_at` : la page lisait la seconde comme
 * « résiliation en cours » et annonçait « Tu y as accès jusqu'au 4 mars 2026 » — une date révolue,
 * donc la promesse d'un accès qui n'existe plus. La date n'était pas fausse ; ce qu'on en disait
 * l'était.
 *
 * Elle reste FACTUELLE et ne vend rien : ni « reviens quand tu veux », ni « ton arbre t'attend ».
 * Ce qui vend est l'offre en dessous, et elle est nommée comme telle.
 */
export const ETAT_TERMINE_LE = (date: string) => `Il s'est terminé le ${date}.`;

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

/**
 * L'ACCÈS OFFERT (migration 0077). Il est DIT, jamais tu : quelqu'un qui ne verrait ni geste de
 * résiliation ni offre d'abonnement, sur une page qui parle d'argent, croirait à une panne.
 *
 * Et il est dit SANS ornement : ni « cadeau », ni « merci », ni exclamation. Cette page reste la
 * page de l'argent — c'est l'endroit où l'on vient quand on veut partir.
 */
export const ETAT_OFFERT = "Ton accès est ouvert, sans abonnement et sans paiement.";
export const ETAT_OFFERT_PRECISION =
  "Rien n'est prélevé, et il n'y a rien à résilier. Il se referme quand nous le refermons.";

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
 * ── QUAND LA VENTE EST FERMÉE (revue des Epics 1 à 4, #16) ─────────────────────────────────────────
 *
 * UNE SEULE PHRASE POUR DEUX SITUATIONS, ET C'EST LE POINT. Elle sert le refus AD-9 (un épisode de
 * détresse est ouvert : aucune sollicitation commerciale) et le refus d'état (compte révoqué,
 * suspendu, onboarding inachevé). Les distinguer aurait exigé de NOMMER le motif — et nommer le
 * premier motif, c'est écrire l'épisode de détresse dans une phrase à l'écran, puis dans l'historique
 * du navigateur par le paramètre d'URL.
 *
 * ⚠️ ELLE NE DIT PAS « RÉESSAIE », ET NE VEND RIEN. Ni « reviens quand ça ira », ni « tu pourras
 * t'abonner plus tard », ni le prix : ce serait relancer le commerce dans la phrase même qui le
 * refuse, à la personne que le refus protège. Elle dit ce qui est, dit que rien n'a été débité, et
 * s'arrête. Le « pas maintenant » porte l'information que ce n'est pas définitif, sans en faire une
 * promesse ni un rendez-vous.
 */
export const REFUS_VENTE_FERMEE =
  "Je ne peux pas prendre ton abonnement maintenant. Rien n'a été débité, et il n'y a rien à faire " +
  "de ton côté.";

/**
 * ── QUAND NOTRE PRESTATAIRE DE PAIEMENT NE RÉPOND PAS (revue des Epics 1 à 4, #16) ─────────────────
 *
 * Distincte de `REFUS_PAIEMENT_INDISPONIBLE` : une clé mal configurée ne se répare pas en rechargeant,
 * une panne de réseau, si. Confondre les deux dirait « réessaie » à quelqu'un que réessayer ne
 * sauvera pas — ou tairait le geste utile à quelqu'un pour qui il suffit.
 */
export const REFUS_PAIEMENT_INJOIGNABLE =
  "Je n'ai pas réussi à ouvrir la page de paiement — notre prestataire n'a pas répondu. Rien n'a été " +
  "débité. Tu peux réessayer dans un moment.";

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
/**
 * ── QUAND LE CONTRAT EST DÉJÀ CLOS (revue adversariale du 2026-08-18, R2) ──────────────────────
 *
 * Le miroir exact de `REFUS_CONTRAT_OUVERT`. Elle arrive ici avec une page ouverte dans un second
 * onglet, ou au retour d'un signet : le contrat s'est éteint entre l'affichage et le clic. La route
 * répondait alors `?etat=echec` — « Je n'ai pas pu enregistrer ça. Tu peux réessayer. » —, et
 * réessayer se heurtait au même mur, indéfiniment (patron `REFUS_RAYONNEMENT`, 4.7).
 *
 * ⚠️ ELLE PORTE LE CHEMIN, PARCE QU'IL Y EN A UN. Un contrat clos ne se reprend pas chez Stripe,
 * mais un nouvel abonnement s'ouvre — et l'offre est sur cette page, juste en dessous.
 */
export const REFUS_CONTRAT_CLOS =
  "Ton abonnement est terminé : il n'y a plus rien à résilier ni à reprendre de ce côté-là. Si tu " +
  "veux revenir, ça se fait plus bas — c'est un nouvel abonnement, pas la reprise de l'ancien.";

/**
 * Le refus qui tombe sur un onglet resté ouvert quand l'accès a été OFFERT entre-temps. Il dit
 * ce qui EST, pas ce qui a échoué : « rien à résilier » est un fait, pas une erreur.
 */
export const REFUS_RIEN_A_RESILIER =
  "Ton accès est ouvert sans abonnement : il n'y a rien à résilier, et rien n'est prélevé.";

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

/**
 * L'ÉTAT PERSISTANT d'un remboursement demandé (revue des Epics 1 à 4, trouvaille #4).
 *
 * `SUCCES_REMBOURSEMENT` ne paraît qu'UNE fois, au retour de l'action. Ensuite, plus rien : ni
 * confirmation, ni démenti. Un remboursement refusé par la banque (compte fermé, carte expirée)
 * était jeté sans trace, et elle continuait d'attendre un virement annoncé.
 *
 * Ces trois lignes vivent sur la page, tant qu'il y a quelque chose à dire. C'est la même discipline
 * que la révision M2 du 2026-08-11 : une absence dite vaut mieux qu'une promesse qui a l'air tenue.
 */
export const REMBOURSEMENT_EN_COURS =
  "Ton remboursement est demandé. Il arrive sur ton moyen de paiement.";
export const REMBOURSEMENT_CONFIRME =
  "Ton remboursement est parti sur ton moyen de paiement. Il peut mettre quelques jours à s'afficher.";
/**
 * ⚠️ ELLE N'A RIEN À RÉPARER, ET LA PHRASE DOIT LE DIRE. Un remboursement refusé l'est presque
 * toujours pour une raison qui lui appartient (compte clos, carte expirée) — mais la formuler comme
 * un reproche transformerait une panne de notre côté en faute du sien. On dit ce qui s'est passé, on
 * dit que sa demande TIENT TOUJOURS (la clé d'idempotence est en base : redemander ne rembourse pas
 * deux fois), et on donne la porte.
 */
export const REMBOURSEMENT_ECHOUE =
  "Ta banque a refusé le remboursement — cela arrive quand un compte a été clos ou une carte remplacée. " +
  "Ta demande reste ouverte : écris-moi depuis l'aide et on le refait sur un autre moyen de paiement.";

/** L'arbre ne recule pas — dit une fois, platement, pour retirer la peur du geste (FR-029). */
export const RIEN_NE_DISPARAIT =
  "Ton arbre, tes branches et ce que tu as écrit restent là, et restent à toi.";
