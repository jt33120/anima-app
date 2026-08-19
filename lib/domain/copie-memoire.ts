/**
 * copie-memoire.ts — LA COPIE DE « CE QU'ANAM RETIENT » (Story 6.5).
 *
 * Module PUR, comme `copie-reglages.ts` et `copie-ancrage.ts` : le texte vit hors du composant, pour
 * qu'un test puisse le passer aux détecteurs sans monter un arbre React, et pour qu'Anima puisse le
 * relire dans un fichier plutôt que dans du JSX.
 *
 * ⚠️ **LE REGISTRE DE CET ÉCRAN N'EST PAS CELUI D'ANAM.** C'est le produit qui parle, pas elle — on
 * y montre une base de données à quelqu'un, et la seule façon de le faire honnêtement est de le dire
 * platement. Une phrase chaleureuse ici (« voici les jolies choses qu'Anam garde de toi ») ferait
 * passer un registre d'intimité sur un écran dont l'objet est l'exercice d'un droit.
 */

export const TITRE_HALTE = "Ce qu'Anam retient";

/**
 * ⚠️ Cette introduction est CONTRAIGNANTE : elle est la seule explication de ce qu'est cette liste,
 * et elle doit dire les trois choses vraies — d'où ça vient, que c'est modifiable, et que ce n'est
 * pas le journal. Sans la troisième, quelqu'un qui supprime tout croirait avoir effacé ses messages.
 */
export const INTRODUCTION =
  "Voici ce qu'Anam a retenu de tes échanges, dans ses mots. Tu peux corriger ou supprimer chaque " +
  "ligne. Tes messages, eux, ne bougent pas : ils sont ailleurs, et c'est d'eux que ces phrases sont " +
  "tirées.";

/** AC5, au littéral de l'énoncé. */
export const ETAT_VIDE = "Anam ne retient encore rien de précis sur toi.";

export const ACTION_CORRIGER = "Corriger";
export const ACTION_SUPPRIMER = "Supprimer";
export const ACTION_ENREGISTRER = "Enregistrer";
export const ACTION_RENONCER = "Renoncer";
export const ACTION_ANNULER = "Annuler la suppression";

export const VOIR_SOURCE = "D'où vient cette phrase";
export const SOURCE_ABSENTE = "Le message d'origine n'est plus dans ton journal.";

/**
 * D6 — une correction est une DONNÉE, donc elle se voit.
 *
 * L'énoncé de la story le demande mot pour mot : « une correction étant une donnée et non une erreur
 * à masquer ». Ce n'est pas un compteur (FR-031 vise les scores, les séries et les progressions) :
 * c'est une provenance, exactement celle que la base persiste déjà dans `origine`.
 */
export const MENTION_CORRIGE = "Tu as réécrit cette phrase.";

export const SUPPRIME_ANNONCE = "Supprimé.";

/**
 * Le refus de correction après révocation (D2).
 *
 * ⚠️ IL EST ANNONCÉ D'AVANCE, jamais après coup. La base refuse déjà (le trigger de 0018 exige un
 * consentement valide pour déposer un contenu art. 9), mais laisser quelqu'un composer une phrase
 * pour se la voir rejeter à l'envoi serait lui faire écrire dans le vide. Et l'inverse — masquer le
 * bouton sans rien dire — laisserait croire à une panne.
 */
export const CORRECTION_APRES_REVOCATION =
  "Tu as retiré ton consentement : Anam ne peut plus enregistrer de nouveau texte te concernant. " +
  "Supprimer reste possible, et le restera toujours.";

/** Les trois refus de `validerCorrection`, dits sans reproche. */
export const REFUS_VIDE =
  "Une phrase vide effacerait la ligne sans le dire. Si c'est ce que tu veux, utilise Supprimer.";
export const REFUS_TROP_LONGUE = "C'est trop long pour une ligne. Une phrase suffit.";
export const REFUS_INCHANGEE = "C'est la même phrase — il n'y a rien à enregistrer.";
