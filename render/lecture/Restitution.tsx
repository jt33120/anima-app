import type { ReactNode } from "react";
import s from "./lecture.module.css";

/**
 * Restitution.tsx — LA LECTURE, ÉCRITE (Story 5.8, AC4/AC6 · FR-021).
 *
 * Rendu MUET (AD-7) : le serveur a produit le texte, ici on dessine. REGISTRE DOCUMENT — la prose
 * respire en paragraphes, contrairement à la voix d'Anam bornée à trois phrases (FR-084).
 *
 * ── DEUX EMPLOIS, UN SEUL COMPOSANT ───────────────────────────────────────────────────────────
 *
 * Le même bloc sert DANS le fil (juste après qu'elle a répondu) et DANS « Mes lectures » (des mois
 * plus tard). Un seul composant parce que c'est un seul document : FR-021 demande que la restitution
 * consultable soit CE qu'elle a lu, pas une seconde version rédigée pour l'archive.
 *
 * ── SES MOTS SONT UNE CITATION VISUELLEMENT DISTINCTE, ET JAMAIS EN SOURDINE ──────────────────
 *
 * FR-021 : la restitution reprend « les mots de l'utilisatrice en citation visuellement distincte de
 * la prose d'Anam ». Un `<blockquote>` porte donc ses mots — filet vertical, sa police à elle, et
 * `--texte` à PLEINE VALEUR. La règle de DESIGN.md est explicite et vaut ici comme dans le fil :
 * jamais `texte-doux` pour ses mots à elle. On ne met jamais ses mots en sourdine.
 *
 * `sesMots` est optionnel : dans le fil, ils sont déjà juste au-dessus (son propre tour) et les
 * répéter à dix lignes d'intervalle serait un doublon. Dans « Mes lectures », ils sont la moitié du
 * document — sans eux, on lirait une interprétation sans savoir de quoi.
 */

export interface ProprietesRestitution {
  readonly texte: string;
  /** Ses mots, en citation. Omis dans le fil (son tour est juste au-dessus), portés dans la halte. */
  readonly sesMots?: string;
  /** La date, telle que la halte la formate. Absente dans le fil : le moment, c'est maintenant. */
  readonly date?: string;
  /** Le visuel de la carte (FR-021), fourni par l'appelant — le composant ne le fabrique pas. */
  readonly visuel?: ReactNode;
  /** Le lien vers l'échange source (FR-021), fourni par l'appelant. */
  readonly echangeSource?: ReactNode;
}

/**
 * Découpe la prose en paragraphes sur les lignes vides. Le rendu ne parse AUCUN markdown (AD-7) —
 * il n'interprète ni titre, ni liste, ni emphase : il respecte des blancs. C'est la seule
 * transformation qu'un rendu muet a le droit de faire.
 */
function paragraphes(texte: string): string[] {
  return texte
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export default function Restitution({ texte, sesMots, date, visuel, echangeSource }: ProprietesRestitution) {
  return (
    <article className={`${s.restitution} fondu-texte`} aria-label="Une lecture">
      {date ? <p className="t-meta">{date}</p> : null}
      {visuel}
      {sesMots ? (
        <blockquote className={s.sesMots}>
          <p className="t-corps">{sesMots}</p>
        </blockquote>
      ) : null}
      {paragraphes(texte).map((p, i) => (
        <p key={`${i}-${p.slice(0, 12)}`} className="t-corps">
          {p}
        </p>
      ))}
      {echangeSource}
    </article>
  );
}
