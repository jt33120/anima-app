/**
 * copie-reglages.ts — LA COPIE DE L'ÉCRAN DE RÉGLAGES (Story 6.2, T6).
 *
 * Module PUR, comme `copie-ancrage.ts` et `copie-lecture.ts` : le texte vit hors du composant, pour
 * qu'un test puisse le passer aux détecteurs sans monter un arbre React, et pour qu'Anima puisse le
 * relire dans un fichier plutôt que dans du JSX.
 *
 * ⚠️ **CE QUE CETTE COPIE N'A PAS LE DROIT DE FAIRE : INSISTER.** L'AC4 dit « aucune bannière
 * insistante », l'AC3 dit qu'aucun réengagement n'existe. Un écran de réglages est pourtant l'endroit
 * naturel où l'on écrit « activez les notifications pour ne rien manquer » — c'est-à-dire une phrase
 * qui invente une perte pour vendre une permission. Il n'y en a aucune ici, et le test le vérifie.
 */

export const TITRE_HALTE = "Réglages";

export const SECTION_SOCLE = "Le rythme quotidien";

/**
 * ⚠️ Cette description est la SEULE promesse faite avant de demander la permission du navigateur, et
 * c'est à ce titre qu'elle est contraignante : elle doit décrire exactement ce qui va arriver, sans
 * rien vendre. Une fois par jour, quelques mots, rien qui dise ce qu'il y a dedans.
 */
export const DESCRIPTION_SOCLE =
  "Une fois par jour, à l'heure que tu choisis, ton téléphone peut afficher quelques mots. " +
  "L'aperçu ne dit jamais ce qu'il y a dans l'application. Tu peux l'arrêter quand tu veux.";

export const ACTIVER = "Recevoir le rythme quotidien";
export const DESACTIVER = "Ne plus rien recevoir sur cet appareil";
export const LABEL_HEURE = "À quelle heure";

export const ETAT_ACTIF = "Cet appareil reçoit le rythme quotidien.";
export const ETAT_INACTIF = "Cet appareil ne reçoit rien.";

/**
 * ⚠️ LE REFUS DE PERMISSION NE SE REPROPOSE PAS, et ce texte est ce qui le rend acceptable. Une fois
 * la permission refusée au niveau du navigateur, l'application ne peut plus la redemander — insister
 * serait de toute façon impossible. On explique donc où ça se répare, et on n'en reparle plus (AC4).
 */
export const PERMISSION_REFUSEE =
  "Ton navigateur a refusé les notifications pour ce site. Rien ne se passera, et c'est très bien : " +
  "le rythme quotidien vit aussi dans l'application. Si tu changes d'avis, ça se règle dans les " +
  "réglages du navigateur, pas ici.";

/**
 * La dégradation propre de l'AC4, dans les mots de l'utilisatrice. Safari iOS ne sait pousser que
 * depuis une application ajoutée à l'écran d'accueil — c'est un fait de plateforme, pas une panne, et
 * ça se dit comme tel.
 */
export const INDISPONIBLE =
  "Ce navigateur ne sait pas afficher de notifications. Sur iPhone, il faut d'abord ajouter Anam à " +
  "l'écran d'accueil. Sans ça, tout fonctionne pareil — simplement, rien ne s'affichera en dehors de " +
  "l'application.";

export const ECHEC = "Ça n'a pas marché. Tu peux réessayer.";

/**
 * L'unique mention du palier, côté produit.
 *
 * ⚠️ Elle est **honnête, et c'est inhabituel** : on dit à l'utilisatrice que le réglage est enregistré
 * mais que rien ne partira encore. L'alternative — l'accepter en silence — reviendrait à lui promettre
 * une notification qui n'arrivera pas, et la panne serait invisible pour elle comme pour nous.
 */
export const PAS_ENCORE_ACTIF =
  "Ton choix est enregistré. Les notifications ne partent pas encore : elles attendent une mise en " +
  "service qui n'est pas de ton ressort.";
