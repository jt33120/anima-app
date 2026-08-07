/**
 * copie-arbre.ts — Les libellés STATIQUES de l'arbre et le mapping d'AFFICHAGE de l'état. Le rendu ne peut
 * pas importer `lib/` (frontière AD-7) : la copie d'UI vit donc ici. Depuis 4.7, l'état s'appelle
 * « rayonnement » PARTOUT (base, modèle, écran) : plus aucune traduction, et jamais un objet-fruit.
 */

import type { EtatBranche } from "@/lib/scene/projection";

/** L'état écrit EN TOUTES LETTRES (vue liste, a11y). Jamais porté par la couleur seule (FR-031). */
export const LIBELLE_ETAT: Record<EtatBranche, string> = {
  naissance: "naissance",
  feuillaison: "feuillaison",
  rayonnement: "rayonnement", // pleine lumière déclarée par elle — plus aucune pomme
};

export const ARIA_CANEVAS = "Ton arbre : chaque branche est une prise de conscience que tu as nommée.";
export const ARIA_ZONE_ARBRE = "Zone de l'arbre — utilise les flèches pour te déplacer.";
export const VIDE_TITRE = "Rien n'a encore été nommé.";
export const VIDE_CORPS = "C'est normal, ça vient en parlant.";

/**
 * Story 3.3 (AC6) — LA PHRASE SOBRE, et la seule surface commerciale de toute la région arbre.
 *
 * Registre PRODUIT, jamais la voix d'Anam : Anam ne vend rien (3.2), et lui faire dire une phrase de
 * périmètre serait la transformer en commerciale au moment précis où l'écran est vide. Elle constate
 * comment les branches viennent — c'est une information, pas une offre.
 *
 * Ce qu'elle NE contient PAS, et chaque absence est un choix :
 *   • aucun prix, aucun lien, aucun bouton (AC6 : « sans bouton d'achat ») ;
 *   • aucun impératif — ni « passe au premium », ni « abonne-toi », ni « débloque », ni « découvre » ;
 *   • aucun compte, aucune jauge, aucun « il te manque N branches » (FR-031 et AC2 [DUR]) ;
 *   • aucun futur promis (« tu pourras… ») : on dit ce qui est, pas ce qu'elle gagnerait.
 *
 * ⚠️ ELLE MENTIONNE L'ABONNEMENT, ET C'EST DÉLIBÉRÉ. AC6 n'exige littéralement que « les branches se
 * posent en conversation ». S'en tenir là serait pourtant, sur un compte gratuit, la faute même que
 * cette story passe son temps à fermer : depuis la 3.3, Anam ne propose plus de branche sans
 * abonnement. Une phrase qui dirait seulement « ça vient en parlant » enverrait quelqu'un parler en
 * attendant quelque chose qui n'arrivera pas — un mensonge par omission, avec l'attente en plus.
 * FR-088 demande « la représentation HONNÊTE de ce qu'elle n'a pas encore » : honnête veut dire
 * complète. On nomme donc le périmètre, une fois, platement, sans rien vendre.
 *
 * Le mot est « abonnement », jamais « premium » : « premium » est le registre de l'étiquette et de la
 * pastille (AC1 l'interdit explicitement), « abonnement » est le mot neutre qui décrit ce qui est.
 *
 * « Une seule fois » (D3-A) se lit littéralement : elle n'apparaît jamais — elle EST là, dans l'état
 * vide, et elle s'en va d'elle-même dès qu'une branche existe. Aucune persistance, aucun marqueur,
 * aucune relance : fabriquer une colonne `vu_le` pour une phrase en ferait un événement commercial
 * daté, ce que FR-057 refuse.
 */
export const VIDE_OU_NAISSENT_LES_BRANCHES =
  "Les branches se posent en conversation avec Anam, et elles font partie de l'abonnement.";

/** Une PANNE de lecture n'est pas un arbre vide : dire « rien n'a été nommé » à quelqu'un qui a des
 *  branches serait un mensonge, et la pire régression au sens de FR-029 (revue 4.6). */
export const INDISPONIBLE_TITRE = "Je n'arrive pas à afficher ton arbre pour l'instant.";
export const INDISPONIBLE_CORPS = "Il est là. Réessaie dans un moment.";

export const ACTION_VOIR_CONVERSATION = "Voir dans la conversation";
export const ACTION_RENOMMER = "Renommer";
/** Libellé DISTINCT de `ACTION_RENOMMER` : les deux boutons coexistent dans le même formulaire, et
 *  un lecteur d'écran qui annonce « Renommer » deux fois ne dit pas lequel ouvre et lequel valide. */
export const ACTION_VALIDER_RENOMMAGE = "Enregistrer le nom";
export const ACTION_ANNULER_RENOMMAGE = "Annuler";
/** Remplace le double-clic sur l'accroche, qui ne pouvait jamais se déclencher (re-revue) — et qui n'était
 *  de toute façon atteignable ni au clavier ni au lecteur d'écran. */
export const ACTION_CENTRER = "Centrer sur cette branche";
export const ACTION_RETOUR_ARBRE = "Revenir à l'arbre";
export const ACTION_FERMER = "Fermer";
export const BASCULE_LISTE = "Vue liste";
export const BASCULE_ARBRE = "Vue arbre";
export const ZOOM_PLUS = "Agrandir l'arbre";
export const ZOOM_MOINS = "Réduire l'arbre";
export const ECHEC_RENOMMAGE = "Je n'ai pas pu renommer cette branche. Tu peux réessayer.";
export const SUCCES_RENOMMAGE = "Le nom a été changé.";

/** La fiche parle de l'ORIGINE, sobrement — jamais de félicitation ni de décret (charte §6). */
export const FICHE_EXTRAIT_INTRO = "Née de ce moment :";

/**
 * Story 4.7 (AC5) — « une phrase sur la fiche dit ce qui a changé et quand ». Sobre, factuelle, DATÉE.
 * Aucune félicitation, aucun « bravo », aucun chiffre, aucune jauge (FR-031) : on constate, on ne
 * récompense pas. Le verbe reste le sien — « tu as dit », pas « tu as débloqué ».
 */
export const FICHE_DEPUIS_FEUILLAISON = (date: string) => `Elle s'étoffe depuis le ${date}.`;
export const FICHE_DEPUIS_RAYONNEMENT = (date: string) => `En pleine lumière depuis le ${date}, parce que tu l'as dit.`;

/**
 * Le GESTE (AC3). Formulé comme une constatation qu'elle fait, jamais comme un objectif atteint : la
 * pleine lumière n'est pas une récompense qu'on décroche, c'est quelque chose qu'elle reconnaît.
 */
export const ACTION_DECLARER_RAYONNEMENT = "C'est devenu vrai en moi";
/** Le geste est IRRÉVERSIBLE (rien ne peut le retirer, sauf l'effacement) : on le dit avant, pas après. */
export const CONFIRMER_RAYONNEMENT = "Cette branche entrera en pleine lumière, et elle y restera. C'est bien ça ?";
export const CONFIRMER_OUI = "Oui, c'est devenu vrai";
export const CONFIRMER_NON = "Pas encore";
export const SUCCES_RAYONNEMENT = "Cette branche est en pleine lumière.";
/** PANNE (500) : réessayer a du sens. */
export const ECHEC_RAYONNEMENT = "Je n'ai pas pu enregistrer ça. Tu peux réessayer.";
/**
 * REFUS (403) : réessayer n'a PAS de sens — la garde tiendra encore pendant des heures. Promettre
 * « tu peux réessayer » à quelqu'un qui sort d'une crise, c'est l'inviter à se heurter au même mur
 * plusieurs fois. On dit ce qui est vrai : ce n'est pas perdu, c'est juste pas maintenant. Et on
 * n'explique PAS pourquoi — lui annoncer que le système l'a classée n'est autorisé nulle part.
 */
export const REFUS_RAYONNEMENT = "Pas maintenant. Cette branche t'attend, elle ne bougera pas.";
/* ── Story 4.10 — LE PLAN D'ÉTAPES (FR-032/FR-081) ──────────────────────────────────────────────────
 *
 * Aucun exemple, aucun placeholder rédigé, aucune suggestion. C'est la même règle que le nommage de
 * branche (« Tes mots, pas les miens ») et elle est encore plus importante ici : une intention
 * d'implémentation est une PRESCRIPTION COMPORTEMENTALE. Un exemple pré-rempli — « Si je me sens
 * anxieuse, alors je respire » — serait Anam décidant à sa place de ce qu'elle devrait faire, ce que le
 * PRD interdit. Les deux étiquettes ne portent donc que la CONJONCTION, jamais le contenu.
 */
export const PLAN_TITRE = "Plan d'étapes";
export const PLAN_VIDE = "Rien encore.";
export const PLAN_INDISPONIBLE = "Je n'arrive pas à afficher ce plan pour l'instant.";
export const ACTION_AJOUTER_ETAPE = "Ajouter une étape";
export const ACTION_ENREGISTRER_ETAPE = "Enregistrer l'étape";
export const ACTION_ANNULER_ETAPE = "Annuler";
export const ACTION_RETIRER_ETAPE = "Retirer";
/** AC2 « modifiées » — le chemin qui manquait : la plomberie existait, le geste non (revue 4.10). */
export const ACTION_MODIFIER_ETAPE = "Modifier";
export const SUCCES_MODIF_ETAPE = "L'étape est modifiée.";
/** Les deux moitiés. Le libellé EST la forme — c'est lui qui rend « si X, alors Y » sans rien dicter. */
export const CHAMP_SI_LABEL = "Si…";
export const CHAMP_ALORS_LABEL = "…alors…";
export const CHAMP_ECHEANCE_LABEL = "Une date, si tu veux";
export const SUCCES_ETAPE = "L'étape est enregistrée.";
export const SUCCES_RETRAIT_ETAPE = "L'étape est retirée.";
/** PANNE : réessayer a du sens. Neutre, sans dramatiser (patron `ECHEC_RENOMMAGE`). */
export const ECHEC_ETAPE = "Je n'ai pas pu enregistrer cette étape. Tu peux réessayer.";
/**
 * REFUS (403/409) : réessayer n'a PAS de sens — la garde tiendra encore des heures. C'est le patron
 * `REFUS_RAYONNEMENT` de la 4.7, qui manquait ici : promettre « tu peux réessayer » à quelqu'un qui sort
 * d'une crise, c'est l'inviter à se heurter au même mur plusieurs fois. Et on n'explique PAS pourquoi.
 */
export const REFUS_ETAPE = "Pas maintenant. Ce que tu as écrit n'est pas perdu.";
/** Le retrait a son PROPRE échec : annoncer « je n'ai pas pu enregistrer » après un retrait est un mensonge. */
export const ECHEC_RETRAIT_ETAPE = "Je n'ai pas pu retirer cette étape. Tu peux réessayer.";
/** Une échéance déjà passée — ou celle du jour, dont le rappel est déjà parti — ne se déclenchera jamais. */
export const ECHEANCE_TROP_TOT = "Choisis une date à partir de demain : le rappel du jour est déjà passé.";
/** Pendant le chargement : ni « rien encore », ni « panne » — on ne sait pas encore. */
export const PLAN_EN_COURS = "Je regarde…";
/** L'échéance rendue lisible — jamais un ISO nu à l'écran. */
export const ECHEANCE_LE = (date: string) => `Pour le ${date}.`;

/** Repère TEXTUEL du message exact dans le rejeu (l'identification ne repose jamais sur la teinte seule). */
export const MENTION_MOMENT = "Le moment d'où vient cette branche";
export const CHAMP_RENOMMER_LABEL = "Le nom de cette branche";

/** Re-exporté depuis le module partagé : une seule borne pour la naissance ET le renommage (R1-bis). */
export { NOM_LONGUEUR_MAX } from "@/render/nom-branche";
