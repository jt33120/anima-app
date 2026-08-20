import { CANEVAS } from "./geometrie";
import s from "./arbre.module.css";

/**
 * Tronc.tsx — LE TRONC, DESSINÉ EN UN SEUL ENDROIT (Story 5.6, T9 — dette de la Story 3.3).
 *
 * ── CE QUI MANQUAIT, ET POURQUOI PERSONNE NE L'AVAIT VU ────────────────────────────────────────
 *
 * FR-088 dit « elle voit son tronc, y compris incomplet ». Le tronc était bien dessiné — mais
 * seulement dans le canevas d'`ArbreInteractif`. Or l'état vide **remplace** ce canevas par un écran
 * de texte : la personne qui n'a encore aucune branche, c'est-à-dire **tout le monde le premier
 * jour**, ne voyait aucun tronc. Le seul moment où FR-088 comptait vraiment était le seul où il
 * n'était pas honoré.
 *
 * La 5.3 avait rendu la FICHE du tronc atteignable dans les trois états (`BoutonTronc`), donc rien
 * n'était inaccessible — c'est pour cela que le manque est resté invisible. Ce qui manquait, c'était
 * le DESSIN. `deferred-work.md` l'avait noté et assigné à cette story.
 *
 * ── UNE SEULE SOURCE POUR LE CHEMIN ────────────────────────────────────────────────────────────
 *
 * Même raisonnement que l'en-tête d'`EtatVideArbre` : deux copies du même tronc, c'est deux endroits
 * où la matière « en réserve » (5.3/AC3) peut diverger, et un endroit où l'oublier. Le chemin et ses
 * classes vivent donc ici, et les deux écrans les consomment.
 */

/**
 * Tronc + racines. Coordonnées du canevas 1000×1000 : la fourche est à `y = 560`, d'où partent
 * les branches — ne pas la déplacer sans `geometrie.ts`.
 */
/**
 * ⚠️ LES RACINES MONTAIENT, ET LE DESSIN SE LISAIT COMME UNE FLÈCHE VERS LE BAS.
 *
 * L'ancien chemin partait de la base (500, 950) vers (430, 880) et (570, 880) — c'est-à-dire, en
 * repère SVG où `y` croît vers le bas, vers le HAUT et vers l'extérieur. Un trait vertical surmonté
 * de deux obliques qui remontent : la forme exacte d'une pointe de flèche. Retour du 2026-08-20,
 * mot pour mot : « Où est sa graine ??? ». La question était la bonne — ce qui était à l'écran
 * n'était pas un arbre.
 *
 * Les racines DESCENDENT maintenant sous la graine, et le tronc en sort. La fourche reste à
 * `y = 560` : les branches s'y accrochent (`geometrie.ts`), et rien au-dessus de la graine ne bouge.
 */
export const CHEMIN_TRONC = [
  "M 500 946 L 500 560", // le tronc, jusqu'à la fourche — inchangé
  "M 500 946 C 476 962 452 972 424 976", // racine gauche, vers le bas et le dehors
  "M 500 946 C 524 962 548 972 576 976", // racine droite
  "M 500 952 C 492 970 486 982 478 994", // deux radicelles, pour que la base ait de la matière
  "M 500 952 C 508 970 514 982 522 994",
].join(" ");

/**
 * LA GRAINE — d'où le tronc sort. Elle n'existait pas, et c'est ce qui manquait pour que le dessin
 * se lise. Un cercle plein à la naissance du tronc : la seule surface remplie de tout l'arbre, donc
 * le point que l'œil trouve en premier.
 */
export const GRAINE = { cx: 500, cy: 946, r: 26 } as const;

export interface ProprietesTronc {
  /**
   * Story 5.3 (AC3) — la MATIÈRE EN RÉSERVE quand l'heure de naissance manque. Le contour reste
   * ENTIER : jamais un pointillé, jamais un fantôme. Un tronc en pointillés dirait « cassé » ou
   * « à débloquer » ; celui-ci dit « pas encore rempli », ce qui est l'état des faits.
   */
  readonly enReserve?: boolean;
}

/** Le `<path>` seul — à poser dans un `<svg>` au repère du canevas (`ArbreInteractif`). */
export function CheminTronc({ enReserve }: ProprietesTronc) {
  return (
    <>
      <path d={CHEMIN_TRONC} className={`${s.tronc} ${enReserve ? s.troncEnReserve : ""}`} />
      <circle
        cx={GRAINE.cx}
        cy={GRAINE.cy}
        r={GRAINE.r}
        className={`${s.graine} ${enReserve ? s.graineEnReserve : ""}`}
      />
    </>
  );
}

/**
 * Le tronc AVEC son propre `<svg>` — pour l'état vide, qui n'a pas de canevas.
 *
 * `aria-hidden` : ce n'est pas une information, c'est le décor de l'écran vide. Ce que l'écran a à
 * dire est déjà dit en toutes lettres par `EtatVideArbre`, et le chemin vers la fiche du tronc
 * passe par un bouton nommé (5.3). Un `role="img"` de plus ferait annoncer deux fois la même chose.
 */
export default function TroncSeul({ enReserve }: ProprietesTronc) {
  return (
    <svg
      /* ⚠️ ON CADRE LA BASE, PAS TOUT LE TRONC — ET C'EST LE SUJET DE L'ÉCRAN QUI LE DIT. Cette
         boîte montrait `380 540 240 430`, c'est-à-dire le tronc ENTIER jusqu'à la fourche : sur un
         arbre sans branche, la fourche ne porte rien, et le dessin se réduisait à un trait fin de
         400 unités qui montait s'arrêter dans le vide. Mesuré à l'écran : un trait et une pointe.

         Ce qu'on a à montrer ici, c'est le DÉBUT : la graine, ses racines, et la pousse qui en
         sort. On cadre donc les 190 unités du bas, où la graine occupe un bon quart de la largeur
         au lieu d'un dixième. Le tronc entier reste dessiné par le même chemin sur le canevas,
         là où des branches s'y accrochent. */
      viewBox={`400 850 200 190`}
      className={s.troncSeul}
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      <CheminTronc enReserve={enReserve} />
    </svg>
  );
}

/** Exporté pour que les tests puissent vérifier que le repère n'a pas glissé. */
export const REPERE_CANEVAS = CANEVAS;
