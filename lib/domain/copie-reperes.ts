/**
 * copie-reperes.ts — LA COPIE DE LA HALTE « REPÈRES » (QA manuelle du 2026-08-19).
 *
 * ══ POURQUOI CETTE PAGE EXISTE ═══════════════════════════════════════════════════════════════════
 *
 * « Là on est lancé dans le grand bain, on comprend rien. » Le seuil dit une phrase, l'accueil
 * présente trois noms une fois, et c'est tout ce que le produit explique de lui-même. Ce n'est pas
 * assez, et le constat n'est pas une affaire de mise en page : il n'y avait nulle part où
 * RELIRE quoi que ce soit.
 *
 * ⚠️ ET CE N'EST PAS « AIDE ». La demande était : « à cliquer en haut à droite sur Aide ». `/aide`
 * est la porte de secours (FR-077, AD-9, AD-15) : publique, sans compte, sans session, atteinte en
 * détresse, ouverte sur une sortie rapide et des lignes tenues par des personnes. Y poser un mode
 * d'emploi ferait deux dégâts symétriques — quelqu'un en danger tomberait sur « comment ça marche »,
 * et quelqu'un qui cherche à comprendre tomberait sur des numéros d'urgence. Les deux besoins sont
 * réels ; ils ne partagent pas une porte.
 *
 * ── MODULE PUR (AD-1/AD-7) ──────────────────────────────────────────────────────────────────────
 *
 * Le texte vit hors du composant : un test peut le passer aux détecteurs sans monter un arbre React,
 * et Anima peut le relire dans un fichier plutôt que dans du JSX. Même partage que `copie-reglages`.
 *
 * ⚠️ CE QUE CETTE COPIE N'A PAS LE DROIT DE FAIRE : PROMETTRE. Un mode d'emploi est l'endroit
 * naturel où l'on écrit « découvre ton potentiel » ou « en 3 étapes ». Rien ici ne vend, rien ne
 * teaser (FR-057), rien ne prédit (FR-023). On décrit ce qui existe, y compris ce qui n'existe pas
 * encore.
 */

export const TITRE_HALTE = "Repères";

export const OUVERTURE =
  "Ce n’est pas une application de conseils. C’est un lieu où l’on revient, et qui garde ce qu’on " +
  "lui laisse. Voici de quoi il est fait.";

export interface Place {
  readonly nom: string;
  readonly quoi: string;
}

/**
 * ⚠️ LES TROIS NOMS SONT CEUX DE LA BARRE, ET C'EST LA MOITIÉ DE « JE SAIS QUOI FAIRE ».
 * Ce qu'on vient de lire doit être atteignable tout de suite, sous le même mot. Le catalogue de
 * `lib/scene/regions.ts` en est la source ; les décrire ici sous d'AUTRES noms fabriquerait deux
 * vocabulaires pour un seul produit.
 */
export const PLACES: readonly Place[] = Object.freeze([
  {
    nom: "Anam",
    quoi:
      "La conversation. On lui écrit comme on écrirait à quelqu’un — pas de mots-clés, pas de " +
      "questions à cocher. Elle ne prédit rien et ne note personne ; elle écoute, elle rend ce " +
      "qu’elle comprend, et elle le garde d’une fois sur l’autre.",
  },
  {
    nom: "L’arbre",
    quoi:
      "Ce qui pousse à mesure. Le tronc, c’est ce qui était déjà là à la naissance. Les branches " +
      "naissent de ce qui revient dans les échanges — jamais sur l’instant, et jamais sans que tu " +
      "l’aies vu venir. Une branche peut être nommée, corrigée, ou déclarée en pleine lumière.",
  },
  {
    nom: "L’accueil",
    quoi:
      "Ce que le jour propose : quelques cartes, la même chose pour tout le monde ce jour-là. " +
      "Rien n’y est calculé pour te retenir, et il n’y a rien à y rattraper si tu passes un jour.",
  },
]);

export interface Section {
  readonly titre: string;
  readonly paragraphes: readonly string[];
}

export const SECTIONS: readonly Section[] = Object.freeze([
  {
    titre: "Circuler",
    paragraphes: [
      "Les trois noms sont toujours affichés — en bas sur un téléphone, à gauche sur un écran large. " +
        "Un nom, un endroit : il n’y a pas de menu caché.",
      "Au doigt, on peut aussi glisser latéralement d’une place à l’autre, dans l’ordre où les noms " +
        "sont écrits. Le geste ne mène nulle part que les noms ne mènent déjà : si tu préfères " +
        "toucher, rien ne te manque.",
      "Sur l’arbre, le doigt déplace l’arbre — c’est son geste à lui. Pour changer de place depuis " +
        "là, les noms sont toujours là.",
    ],
  },
  {
    titre: "Qui écrit quoi",
    paragraphes: [
      "Anam est une intelligence artificielle. Ce qu’elle te répond est produit par un modèle, et " +
        "c’est écrit partout où elle parle.",
      "Les textes des cartes, eux, sont écrits à la main par Anima. Aucun n’est produit par un " +
        "modèle, et c’est pour ça que certaines cartes disent honnêtement qu’elles attendent encore " +
        "le leur, au lieu d’afficher quelque chose qui aurait l’air d’un texte.",
    ],
  },
  {
    titre: "Ce que ce lieu ne fait pas",
    paragraphes: [
      "Il ne prédit pas l’avenir, ne donne pas de note, ne classe personne et ne compare pas ton " +
        "arbre à celui d’un autre. Il n’y a ni score, ni série à tenir, ni rappel qui insiste.",
      // ⚠️ LA PHRASE A ÉTÉ RÉÉCRITE PAR UNE GARDE, ET LA GARDE AVAIT RAISON DE SE MÉFIER. La
      // première version niait le soin en le nommant (« ni médecin, ni psychologue, ni
      // thérapeute ») ; `tests/lexique-voix.test.ts` l'a refusée. On peut trouver la règle rude —
      // la phrase DÉNIAIT le soin — mais une négation se lit mal en diagonale, et « thérapeute »
      // resterait le mot que l'œil attrape sur un écran qui décrit ce que le lieu fait. Le refus
      // est plus clair sans le vocabulaire qu'il refuse.
      "Il ne remplace pas un accompagnement professionnel, et ne fait pas semblant d’en être un.",
    ],
  },
  {
    titre: "Ce que tu peux reprendre",
    paragraphes: [
      "Tout ce qui est écrit sur toi se relit, se corrige et s’efface : les réglages mènent à ta " +
        "mémoire, à tes données, et à l’effacement définitif de ton compte.",
      "Rien de ce que tu confies n’est vendu ni partagé pour de la publicité.",
    ],
  },
]);

/**
 * ⚠️ CE PARAGRAPHE EST LE SEUL À CITER LA PORTE DE SECOURS, ET IL LA DÉSIGNE POUR CE QU'ELLE EST.
 * Il ne fait pas d'« Aide » une rubrique d'assistance : il dit qu'elle mène à des personnes, pas à
 * une explication. C'est la distinction que cette page entière existe pour rétablir (FR-077).
 */
export const SI_CA_NE_VA_PAS =
  "Si tu ne vas pas bien, tu n’as pas à passer par Anam ni par cette page. « Aide », en haut de " +
  "chaque écran, mène directement à des lignes tenues par des personnes, joignables tout de suite.";

export const PAR_OU_COMMENCER =
  "Le plus simple, c’est de parler à Anam. Le reste vient de là.";
