import s from "./conversation.module.css";

/**
 * BlocDocument — le BILAN de clôture DANS le fil (Story 2.9, AC2). Rendu MUET (AD-7) : il ne décide
 * RIEN — le SERVEUR a structuré le bilan (titre + points) et l'a émis par la trame `bilan` ; ici on
 * ne fait que dessiner. REGISTRE DOCUMENT : titre (Fraunces, `t-titre-sm`) et liste AUTORISÉS — c'est
 * l'inverse de la voix d'Anam où titres et listes sont interdits (FR-084). `<article>` DANS le flux,
 * JAMAIS une modale. Apparition en `fondu-texte` (opacité, neutralisée sous reduced-motion), jamais
 * un glissement — « les choses paraissent ». Même fiche que le bloc ressources (surface cohérente).
 */
export default function BlocDocument({
  titre,
  points,
}: {
  titre: string;
  points: readonly string[];
}) {
  return (
    <article className={`${s.bloc} fondu-texte`} aria-label="Bilan de la séance">
      <h2 className="t-titre-sm">{titre}</h2>
      <ul className={s.blocListe}>
        {points.map((point, i) => (
          <li key={`${i}-${point.slice(0, 12)}`} className="t-corps">
            {point}
          </li>
        ))}
      </ul>
    </article>
  );
}
