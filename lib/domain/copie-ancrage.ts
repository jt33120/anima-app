/**
 * copie-ancrage.ts — LES MOTS DE LA HALTE DES ANCRAGES (Story 5.9, T3).
 *
 * Source unique. Aucun de ces libellés ne se recopie dans un composant : `render/` n'a pas le droit
 * de connaître `lib/domain/` (AD-7/AD-10), donc la page serveur les passe en propriétés.
 *
 * ── DEUX GARDES BALAIENT CE FICHIER, ET AUCUNE NE COUVRE L'AUTRE ──────────────────────────────
 *
 *   1. Le contrôle de voix bloquant de la 2.8 (`tests/lexique-voix.test.ts`) — il balaie `lib/` en
 *      récursif, et refuse notamment le mot proscrit par FR-023 et ses dérivés ;
 *   2. la garde de vocabulaire (`chercherConfusionVocabulaire`, 5.6) — elle refuse qu'un texte
 *      présenté sous le terme « ancrage » nomme l'un des DEUX AUTRES formats (FR-080).
 *
 * La première attrape un mot interdit partout ; la seconde attrape un mot parfaitement licite
 * ailleurs, mais fautif ICI. `tests/ancrage-corpus.test.ts` les vise séparément.
 *
 * ── CE QU'ON N'ÉCRIT PAS ──────────────────────────────────────────────────────────────────────
 *
 *   • aucun « bientôt », aucun compte à rebours (FR-057 : on ne teaser pas ce qu'on n'a pas) ;
 *   • aucun texte de remplacement quand un créneau est vide — ce serait une parole fabriquée
 *     attribuée à une personne réelle (FR-054 + FR-086) ;
 *   • aucune mention d'une variante à venir (AC7 : l'audio est déféré, et le report ne se dit pas
 *     à l'utilisatrice sous forme de promesse).
 */

/** Le titre de la halte. */
export const TITRE_HALTE = "Les ancrages";

/**
 * Ce que lit un compte SANS l'offre.
 *
 * Elle dit ce qui est vrai et où aller, sans dramatiser un refus qui n'est pas un rejet. Pas de
 * cadenas, pas de compteur de ce qu'on n'a pas (FR-031, FR-057).
 */
export const REFUS_OFFRE =
  "Les ancrages font partie de l’offre complète. Tu peux la découvrir depuis ton abonnement.";

/**
 * L'état RÉEL du produit en v1 : les vingt-quatre créneaux sont déclarés, aucun n'est écrit.
 *
 * C'est la même phrase de fond que l'accueil (5.6) : elle nomme l'autrice, elle ne s'excuse pas, et
 * elle ne promet rien.
 */
export const AUCUN_ECRIT = "Anima n’a pas encore écrit d’ancrage.";

/** Quand la halte ne peut pas se charger. Une panne se dit comme une panne, jamais comme un vide. */
export const INDISPONIBLE =
  "Je n’arrive pas à ouvrir les ancrages en ce moment. Reviens un peu plus tard.";

/** Le bouton qui fait avancer d'un temps. */
export const AVANCER = "Continuer";

/** Le bouton du dernier temps — il ferme l'exercice, il ne le relance pas. */
export const TERMINER = "C’est fini";

/** Ce qui s'affiche quand l'exercice est traversé. Aucune félicitation, aucune série, aucun score. */
export const TRAVERSE = "Voilà. Tu peux rester là un moment.";
