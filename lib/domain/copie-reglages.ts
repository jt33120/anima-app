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

/**
 * ── LES COURRIELS D'ANAM (revue Epic 6, R7 · art. 21) ──────────────────────────────────────────
 *
 * ⚠️ **CETTE SECTION MANQUAIT, ET SON ABSENCE FAISAIT MENTIR LE BOUTON D'À CÔTÉ.**
 *
 * Le seul geste d'arrêt de cet écran s'appelle « Ne plus rien recevoir sur cet appareil ». Il ne
 * touche que la poussée. Quelqu'un qui le clique, sur une page intitulée « Réglages », a toute raison
 * de croire qu'elle a tout arrêté — et continue de recevoir rappels d'échéance et synthèses.
 *
 * Le désabonnement par jeton (4.9) existait, mais seulement dans le lien d'un courriel DÉJÀ REÇU :
 * inatteignable pour qui les a supprimés ou classés en indésirables.
 *
 * ⚠️ La description NOMME les deux courriels qui existent, et rien d'autre. Écrire « les courriels
 * d'Anam » sans dire lesquels laisserait croire à une correspondance qui n'a pas lieu — et le jour où
 * un troisième naîtrait, cette phrase deviendrait fausse toute seule.
 */
export const SECTION_COURRIELS = "Les courriels d'Anam";

export const DESCRIPTION_COURRIELS =
  "Anam t'écrit deux fois : quand une échéance que tu as posée arrive, et quand une synthèse est " +
  "prête. Rien d'autre. Tu peux arrêter, et reprendre, quand tu veux.";

export const ETAT_COURRIELS_RECUS = "Tu reçois les courriels d'Anam.";
export const ETAT_COURRIELS_ARRETES = "Tu ne reçois aucun courriel d'Anam.";

export const ARRETER_COURRIELS = "Ne plus recevoir de courriels";
export const REPRENDRE_COURRIELS = "Recevoir à nouveau les courriels";

/**
 * ⚠️ Ce qui NE s'arrête pas, et qui doit se dire au même endroit. Les courriels de connexion ne sont
 * pas de la correspondance d'Anam : les couper l'enfermerait dehors. Le taire, en revanche, ferait
 * d'un courriel reçu après l'arrêt une promesse rompue.
 */
export const COURRIELS_QUI_RESTENT =
  "Les courriels qui servent à te connecter continuent d'arriver : sans eux, tu ne pourrais plus " +
  "entrer.";

/**
 * ── REFERMER SA SESSION (QA tour 1, T22) ───────────────────────────────────────────────────────
 *
 * Le produit n'avait aucune déconnexion. Les seuls `signOut` du dépôt fermaient la session de
 * quelqu'un que le produit REFUSE (minorité détectée), jamais de quelqu'un qui le demande.
 *
 * Sur un téléphone partagé, ça veut dire qu'on ne peut pas refermer ce qu'on vient d'écrire — en
 * contradiction directe avec l'attention portée partout ailleurs à la discrétion : l'aperçu de
 * notification neutre, et les titres d'onglet qui disent tous « Anam » et rien d'autre (NFR-015).
 */
export const SECTION_SESSION = "Cette session";

/**
 * ⚠️ ELLE ANNONCE LE COÛT AVANT LE CLIC. Sans mot de passe, se déconnecter n'est pas gratuit : il
 * faut rouvrir sa boîte mail pour revenir. Le taire ferait de la sortie un piège — et c'est
 * exactement le reproche fait à l'écran de résiliation qu'on a refusé d'écrire (3.5).
 */
export const DESCRIPTION_SESSION =
  "Sur un appareil que tu partages, c'est ce qui referme ta session. Pour revenir, tu redemanderas " +
  "un lien — il n'y a pas de mot de passe à retenir.";

/** Le mot que les gens cherchent, pas celui qui décrit le mécanisme. */
export const SE_DECONNECTER = "Me déconnecter";

/**
 * Ce que lit la personne en arrivant sur `/entrer` après le geste.
 *
 * Registre PRODUIT, pas voix d'Anam — précédent posé par l'effacement (6.7, `ADIEU`) : c'est un
 * fait de session, et Anam n'a rien à dire sur une porte qu'on vient de tirer derrière soi.
 */
export const SESSION_FERMEE = "Ta session est fermée sur cet appareil.";
