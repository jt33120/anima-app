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
export const ECHEC_RAYONNEMENT = "Je n'ai pas pu enregistrer ça. Tu peux réessayer.";
/** Repère TEXTUEL du message exact dans le rejeu (l'identification ne repose jamais sur la teinte seule). */
export const MENTION_MOMENT = "Le moment d'où vient cette branche";
export const CHAMP_RENOMMER_LABEL = "Le nom de cette branche";

/** Re-exporté depuis le module partagé : une seule borne pour la naissance ET le renommage (R1-bis). */
export { NOM_LONGUEUR_MAX } from "@/render/nom-branche";
