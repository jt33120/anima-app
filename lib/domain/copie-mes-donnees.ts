/**
 * copie-mes-donnees.ts — LES MOTS DE LA HALTE « MES DONNÉES » ET DU DOCUMENT (Story 6.6).
 *
 * Toute la copie vit ici, comme pour `/reglages` et `/memoire` : `render/` et `app/` ne portent
 * aucun texte, et les détecteurs de voix (FR-085) comme le lexique zéro-médical (NFR-008) passent
 * sur ce fichier avec tous les autres.
 *
 * ⚠️ AUCUNE PHRASE NE DEMANDE POURQUOI, NE PRÉVIENT D'UN DÉLAI, NI NE PARLE DE PARTIR. L'AC1 et
 * l'AC2 interdisent la friction dissuasive et l'adossement à une fermeture de compte : le seul
 * moyen sûr de ne pas en écrire est de ne pas avoir les mots sous la main. `tests/export-route.test.ts`
 * lit ce fichier et refuse tout vocabulaire de rétention.
 */

export const TITRE_HALTE = "Mes données";

export const INTRODUCTION =
  "Tout ce qu'Anam a de toi tient dans un fichier. Tu peux le prendre quand tu veux, autant de fois que tu veux.";

export const ACTION_EXPORTER = "Télécharger mes données";

/**
 * Ce que le fichier contient, dit en clair AVANT le clic. Ce n'est pas une question qu'on lui pose :
 * c'est ce qu'elle est en droit de savoir de ce qu'elle emporte.
 */
export const CE_QUE_TU_EMPORTES =
  "Le fichier contient tes conversations mot pour mot, ce qu'Anam retient de toi, tes branches, " +
  "tes lectures, ton thème natal, ton abonnement et tout le reste. Il s'ouvre dans n'importe quel " +
  "navigateur, hors ligne, et il porte aussi tes données en format machine si tu veux les reprendre ailleurs.";

/** Rien ne se ferme, rien ne se perd : la phrase qui dit que l'export ne coûte rien (AC2). */
export const RIEN_NE_CHANGE = "Télécharger ne change rien : ton compte, tes branches et tes conversations restent là.";

export const ECHEC =
  "Le fichier n'a pas pu être fabriqué. Rien n'a été touché — réessaie dans un moment.";

// ── Le document lui-même ────────────────────────────────────────────────────────────────────────

export const DOCUMENT_TITRE = "Tout ce qu'Anam a de toi";

export const DOCUMENT_GENERE_LE = "Fichier établi le";

export const DOCUMENT_PREAMBULE =
  "Ce fichier est complet : il porte toutes les couches, y compris celles que l'application ne " +
  "montre nulle part. Tu peux le garder, l'ouvrir hors ligne, le transmettre à qui tu veux.";

export const DOCUMENT_TITRE_RETRAITS = "Deux choses ne sont pas dans ce fichier, et voici lesquelles :";

export const DOCUMENT_ANNEXE =
  "Les mêmes données, en format machine, sont dans ce fichier sous l'identifiant « donnees-brutes » — " +
  "de quoi les reprendre ailleurs sans rien retaper.";

/** Le nom du fichier téléchargé. Sobre : il finira dans un dossier de téléchargements partagé. */
export const NOM_FICHIER_PREFIXE = "anam-mes-donnees";
