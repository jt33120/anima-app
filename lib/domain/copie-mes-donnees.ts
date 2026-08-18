import { RETENUS_PAR_LA_LOI } from "./sous-traitants";

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

// ── L'effacement total (Story 6.7) ──────────────────────────────────────────────────────────────
//
// ⚠️ AUCUNE DE CES PHRASES NE RETIENT, NE DEMANDE POURQUOI, NI NE PROPOSE AUTRE CHOSE. L'AC3
// interdit l'écran de rétention, l'offre et le « es-tu sûre ? » à étages. Une seule confirmation,
// sur le même écran, et elle porte sur ce qui se passe — pas sur ce qu'elle perdrait.

export const SECTION_EFFACEMENT = "Tout effacer";

export const EFFACEMENT_CE_QUI_PART =
  "Tes conversations, tes branches, ce qu'Anam retient, ton thème natal, ton compte : tout part " +
  "d'un coup, et rien ne revient.";

/** Ce que l'effacement ne peut pas retirer. Le sujet est DÉRIVÉ de `sous-traitants.ts`. */
export const EFFACEMENT_CE_QUI_RESTE_PREFIXE = "Une seule chose ne peut pas partir :";

/**
 * La phrase qui dit ce qui SURVIT à l'effacement, fabriquée depuis le registre des sous-traitants.
 *
 * ⚠️ C'EST UNE FONCTION, ET UN MUTANT SURVIVANT L'A IMPOSÉ. La phrase vivait dans le JSX, derrière
 * un `RETENUS_PAR_LA_LOI.length > 0 &&`. Remplacer cette condition par `false` — donc taire ce qui
 * reste — ne faisait rougir aucun test : le nom du registre était toujours dans le fichier, et la
 * garde ne regardait que ça. Sortie de la page, la phrase devient une valeur qu'on peut éprouver.
 *
 * Rend `""` si rien n'est retenu — React n'affiche alors rien, et la page n'a besoin d'AUCUNE
 * condition, donc d'aucune condition qu'on puisse neutraliser en silence.
 */
export function phraseCeQuiReste(): string {
  if (RETENUS_PAR_LA_LOI.length === 0) return "";
  // ⚠️ LE `role` EST DANS LA PHRASE, ET SON ABSENCE ÉTAIT LE DÉFAUT (QA tour 2). On ne joignait que
  // les motifs ; le motif du paiement disait « restent chez lui » et ce « lui » ne renvoyait à rien
  // de ce qui est affiché. `role` est pourtant décrit dans le registre comme « ce qu'il fait pour
  // le produit, en français d'utilisatrice » — un champ écrit pour être lu par elle, qu'AUCUN
  // consommateur ne lisait. Un champ obligé d'être substantiel puis jamais montré est un mensonge
  // par omission, sur l'écran même où elle exerce son droit à l'effacement.
  const parts = RETENUS_PAR_LA_LOI.map((t) => `${t.role} ${t.motif}`);
  return `${EFFACEMENT_CE_QUI_RESTE_PREFIXE} ${parts.join(" ")}`;
}

export function effacementFenetre(jours: number): string {
  if (jours <= 0) return "Aucune copie de sauvegarde ne subsiste.";
  return `Les copies de sauvegarde s'effacent d'elles-mêmes sous ${jours} jours.`;
}

export const EFFACEMENT_EXPORT_DABORD =
  "Si tu veux garder une trace, télécharge d'abord — le bouton est juste au-dessus.";

export const EFFACEMENT_CONFIRMATION = "J'ai compris que tout disparaît et que rien ne revient.";

export const ACTION_EFFACER = "Tout effacer";

export const EFFACEMENT_ECHEC =
  "L'effacement n'a pas abouti. Rien n'a été touché — tu peux recommencer.";

export const EFFACEMENT_SANS_CONFIRMATION = "Coche la case pour que l'effacement puisse partir.";

/** Sur `/entrer`, après l'effacement. Registre PRODUIT — jamais la voix d'Anam. */
export const ADIEU = "Tout a été effacé. Il ne reste rien de toi ici.";
