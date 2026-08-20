/**
 * copie-guide.ts — LE TOUR GUIDÉ : ses étapes, dans l'ordre (retour du 2026-08-20).
 *
 * ══ POURQUOI CE FICHIER REMPLACE UNE PAGE ═══════════════════════════════════════════════════════
 *
 * La première réponse au « il est où le tutoriel ? » a été une PAGE : `/reperes`, un document qu'on
 * lit de haut en bas. Le retour a été net et juste — « le tutoriel doit me guider dans
 * l'application, pas être juste une liste de texte, elle doit mettre en évidence certaines parties,
 * entourer, l'utilisateur clique sur suivant et on avance ». Un document explique ; un tour
 * DÉSIGNE. Ce ne sont pas deux niveaux de qualité du même objet, ce sont deux objets : on garde les
 * deux, et le tour peut renvoyer au document.
 *
 * ⚠️ CHAQUE ÉTAPE VISE UN ÉLÉMENT QUI EXISTE VRAIMENT. `cible` est un sélecteur CSS résolu à
 * l'écran. Une étape dont la cible est absente est SAUTÉE — jamais un projecteur sur un rectangle
 * vide, jamais une flèche vers rien. C'est ce qui permet au tour de traverser des écrans dont le
 * contenu dépend du compte (un arbre vide n'a pas de branche à montrer).
 *
 * Module PUR : aucune dépendance React. Un test peut passer ces textes aux détecteurs de voix sans
 * monter quoi que ce soit.
 */

import type { IdRegion } from "@/lib/scene";

export interface EtapeGuide {
  /** La région où l'étape a lieu. Le tour y va lui-même avant de désigner. */
  readonly region: IdRegion;
  /**
   * Le sélecteur de ce qu'on met en évidence. `null` = aucune cible : la bulle se pose au centre,
   * pour ce qui parle de l'écran ENTIER plutôt que d'un élément.
   */
  readonly cible: string | null;
  readonly titre: string;
  readonly texte: string;
}

export const TITRE_GUIDE = "Le tour du lieu";
export const SUIVANT = "Suivant";
export const PRECEDENT = "Précédent";
export const TERMINER = "J’ai compris";
export const QUITTER = "Passer le tour";
export const RELANCER = "Faire le tour de l’application";

/**
 * ⚠️ L'ORDRE SUIT LE PARCOURS RÉEL, PAS L'ORDRE DU CODE. On commence là où l'on atterrit
 * (l'accueil), on va où l'on a le plus de chances d'aller ensuite (Anam), et on finit par ce qui se
 * remplit avec le temps (l'arbre). Un tour qui commence par la fonctionnalité la plus rare est un
 * tour qu'on abandonne.
 */
export const ETAPES: readonly EtapeGuide[] = Object.freeze([
  {
    region: "accueil",
    cible: null,
    /* ⚠️ CE TITRE DISAIT « TROIS PLACES, ET C'EST TOUT » — le MÊME nom accessible que le bloc de
       l'accueil, qui s'intitule « Trois places ». Deux entêtes de niveau 2 portant le même nom sur
       le même écran : au lecteur d'écran, on ne peut plus les distinguer, et une garde qui en
       cherchait un en trouvait deux. On nomme l'étape par ce qu'elle dit, pas par ce qu'elle
       répète. */
    titre: "Le lieu tient en trois endroits",
    texte:
      "Ce lieu tient en trois endroits. Pas de menu caché, pas de sous-menus : ce que tu vois est " +
      "ce qu’il y a. Je te les montre une par une.",
  },
  {
    region: "accueil",
    cible: "nav[aria-label='Régions']",
    titre: "Ta barre",
    texte:
      "Les trois noms sont toujours là — en bas sur un téléphone, à gauche sur un grand écran. Tu " +
      "peux aussi glisser l’écran de côté au doigt pour passer de l’un à l’autre.",
  },
  {
    region: "accueil",
    cible: "[class*='bibliotheque'] article",
    titre: "L’accueil",
    texte:
      "Ce que le jour propose : quelques cartes, les mêmes pour tout le monde ce jour-là. Rien à " +
      "rattraper si tu passes un jour, rien qui compte tes visites.",
  },
  {
    region: "anam",
    cible: "form, [class*='composeur']",
    titre: "Anam",
    texte:
      "C’est ici qu’on se parle. Écris comme tu écrirais à quelqu’un : pas de mots-clés, pas de " +
      "questions à cocher. Anam est une intelligence artificielle, et elle le dit elle-même.",
  },
  {
    region: "arbre",
    cible: "[class*='troncSeul'], [class*='canevas']",
    titre: "Ta graine",
    texte:
      "Ton arbre commence par une graine : ce qui était déjà là à ta naissance. Il pousse à mesure " +
      "que des choses se nomment quand tu parles à Anam — jamais sur l’instant, jamais sans que tu l’aies " +
      "vu venir.",
  },
  {
    region: "accueil",
    cible: "a[href='/reperes']",
    titre: "Et si tu perds le fil",
    texte:
      "« Repères » est là en haut de chaque écran : tout ce que je viens de dire y est écrit, en " +
      "plus long, et tu peux refaire ce tour quand tu veux. À côté, « Aide » ne sert pas à ça : " +
      "elle mène directement à des personnes, si ça ne va pas.",
  },
]);
