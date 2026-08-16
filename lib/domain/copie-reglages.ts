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
 * ⚠️ QUAND LA BASE ET LE NAVIGATEUR NE DISENT PAS LA MÊME CHOSE (QA tour 1, T11-quater).
 *
 * Mesuré au clic réel le 2026-08-16 : après avoir réinitialisé l'autorisation dans Chrome, la page
 * continuait d'afficher « Cet appareil reçoit le rythme quotidien. » — y compris après rechargement
 * complet. L'écran se fiait à la ligne d'abonnement en base et ne consultait jamais l'état réel de la
 * permission.
 *
 * Le pire n'était pas la phrase fausse, c'était le seul bouton proposé : « Ne plus rien recevoir sur
 * cet appareil ». Il fallait le cliquer — donc demander à ne rien recevoir — pour revenir à un état
 * qui permette de se réabonner.
 *
 * Ce texte ne dit pas où réparer : le bouton juste en dessous propose de redonner l'autorisation, et
 * s'il se heurte à un refus définitif, `PERMISSION_REFUSEE` prend le relais avec le bon chemin.
 */
export const AUTORISATION_RETIREE =
  "Cet appareil ne reçoit plus rien : l'autorisation n'est plus accordée dans ton navigateur.";

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
 * ⚠️ « ELLE N'A PAS RÉPONDU » N'EST PAS « ELLE A REFUSÉ » (QA tour 1, en creusant T11).
 *
 * `Notification.requestPermission()` rend `default` quand la boîte de dialogue est fermée sans choix —
 * un clic à côté, une touche Échap, un onglet qui perd le focus. Le code rendait alors le texte du
 * REFUS, qui dit « ça se règle dans les réglages du navigateur, pas ici » : on lui apprenait qu'il n'y
 * avait plus rien à faire, alors qu'un second appui sur le même bouton aurait marché.
 *
 * Ce texte-ci dit donc exactement l'inverse — et sans insister : le bouton est là, il ne se rappelle
 * pas à elle.
 */
export const PERMISSION_SANS_REPONSE =
  "Le navigateur a posé sa question et elle est restée sans réponse — rien n'a été refusé. " +
  "Le bouton la repose si tu veux ; sinon tout fonctionne pareil.";

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
