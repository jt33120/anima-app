import s from "./conversation.module.css";
import type { RessourceVue } from "./types";

/**
 * BlocRessources — le bloc ressources de détresse DANS le fil (Story 2.6, AC4). Rendu MUET (AD-7) :
 * il ne décide RIEN — ni le niveau, ni la sélection, ni l'ordre (le SERVEUR a décidé, sécurité-d'abord
 * AD-16) ; il dessine ce que la trame porte, dans l'ordre reçu.
 *
 * `<article>` dans le flux, JAMAIS une modale, JAMAIS rouge/alerte, JAMAIS de pictogramme de danger
 * (le filet rassure, il n'alarme pas — AD-9). Fiche `surface-elevee` + `bordure-forte`. Numéros en
 * lien `tel:`, lus CHIFFRE PAR CHIFFRE (`aria-label` = service + chiffres espacés). Apparition en
 * `fondu-texte` (opacity, neutralisée en reduced-motion), jamais un glissement — « les choses paraissent ».
 */
export default function BlocRessources({
  ressources,
  verifieLe,
}: {
  ressources: readonly RessourceVue[];
  verifieLe: string;
}) {
  return (
    // aria-live polite : le bloc s'annonce à son insertion sans voler le focus (le composeur reste au
    // focus, AC2). Doublé par une annonce dans la région dédiée du fil (Conversation.onRessources, R3).
    <article className={`${s.bloc} fondu-texte`} aria-label="Ressources d’aide" aria-live="polite">

      <ul className={s.blocListe}>
        {ressources.map((r) => (
          <li key={r.tel} className={s.blocRessource}>
            <a className={s.blocNumero} href={`tel:${r.tel}`} aria-label={`${r.numero}, ${r.service}, ${r.aria}`}>
              <span className="t-titre-sm" aria-hidden>
                {r.numero}
              </span>
            </a>
            <span className={`t-corps ${s.blocDesc}`}>{r.desc}</span>
          </li>
        ))}
      </ul>
      <p className={`t-meta ${s.blocVerifie}`}>Vérifié le {verifieLe}</p>
    </article>
  );
}
