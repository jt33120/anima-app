/**
 * premier-passage.ts — CE QU'ON DIT À QUELQU'UN QUI ARRIVE (QA visuelle du 2026-08-19, H4)
 *
 * Le constat, tel quel : « Pas de passage "je viens de m'inscrire" → "je sais quoi faire". » Après
 * le code, la date de naissance et les deux cases de l'article 9, on arrive au seuil — une phrase,
 * une porte — et derrière, une pile de cartes et trois noms dans une barre. Rien n'a jamais dit ce
 * qu'est Anam, ce qu'est l'arbre, ni par quoi commencer.
 *
 * ── DOMAINE PUR (AD-1) : IL DÉCIDE, IL N'ÉCRIT PAS ────────────────────────────────────────────
 *
 * Ce module dit SI le texte d'orientation est dû, et QUELLE forme il prend. Les phrases, elles,
 * vivent dans `render/` : c'est de la présentation (AD-7), et `render/` n'a pas le droit
 * d'atteindre cette couche. Ce qui traverse la frontière est un modèle de vue minuscule, décrit
 * des deux côtés — même patron que `render/accueil/types.ts`.
 */

/** Ce que le rendu reçoit pour le seuil. Aucun champ numérique : il n'y a rien à compter ici. */
export interface PremierPassage {
  /**
   * Le texte d'orientation est-il dû ? Vrai tant que le seuil n'a jamais été franchi.
   *
   * ⚠️ CE N'EST PAS « LE COMPTE EST NEUF ». La marque se pose au GESTE (le bouton du seuil), pas à
   * la création du compte ni au rendu : quelqu'un qui ouvre l'application, lit, et referme l'onglet
   * retrouvera son texte au prochain chargement. C'est la leçon de la 0045, où une mention unique
   * se dépensait dans un rendu que personne ne regardait.
   */
  readonly du: boolean;
  /**
   * Des cartes attendent encore le texte d'Anima ?
   *
   * Le premier passage le DIT, parce que quatre cartes vides sans explication se lisent comme une
   * panne — c'est ce que la QA a vu en premier. Et il le dit **seulement tant que c'est vrai** :
   * le jour où le corpus sera écrit, la phrase disparaîtra d'elle-même, sans que personne ait à se
   * souvenir de l'effacer. Une phrase de bienvenue périmée est pire que pas de phrase.
   *
   * ⚠️ BOOLÉEN, ET JAMAIS UN COMPTE. « 4 cartes sur 6 » serait un compteur sur l'écran d'accueil,
   * exactement ce que FR-031 et UX-DR-30 interdisent. Il n'y a ici aucun type par où un chiffre
   * pourrait passer.
   */
  readonly desCartesAttendent: boolean;
}

/** La forme minimale que ce module a besoin de connaître d'une carte : son texte est-il écrit ? */
interface CarteLisible {
  readonly texte: { readonly statut: "ecrit" | "non_ecrit" };
}

/**
 * Le premier passage est-il dû, et que doit-il mentionner ?
 *
 * `seuilFranchiLe` vient de la base ; `cartes` de la bibliothèque du jour. Les deux peuvent être
 * absents — la bibliothèque n'est pas un chemin critique (`app/page.tsx` la replie sur `null` en
 * cas de panne) et le seuil doit s'ouvrir quand même.
 *
 * ⚠️ LES DEUX REPLIS NE PENCHENT PAS DU MÊME CÔTÉ, ET C'EST VOULU.
 *   — Bibliothèque illisible ⇒ `desCartesAttendent: false` : on préfère taire une excuse vraie que
 *     promettre des cartes à quelqu'un dont on ne sait pas ce qu'elles contiennent.
 *   — Date illisible ⇒ `du: true` (le dépôt replie sur `null`) : on redit le texte à quelqu'un qui
 *     l'a déjà lu. Se répéter est un accroc ; ne jamais présenter le lieu à quelqu'un qui vient
 *     d'accepter d'y déposer des données de l'article 9, c'est le constat H4 qui revient.
 */
export function premierPassage(
  seuilFranchiLe: string | null,
  cartes: readonly CarteLisible[] | null,
): PremierPassage {
  return {
    du: seuilFranchiLe === null,
    desCartesAttendent: (cartes ?? []).some((c) => c.texte.statut === "non_ecrit"),
  };
}
