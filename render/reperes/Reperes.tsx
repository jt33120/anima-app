import Link from "next/link";
import s from "./reperes.module.css";

/**
 * Reperes — LA HALTE « REPÈRES ». Rendu MUET (AD-7) : il dessine la copie qu'on lui passe.
 *
 * Aucun texte en dur ici : tout vient de `lib/domain/copie-reperes.ts`, pour qu'un test puisse le
 * passer aux détecteurs sans monter un arbre React, et pour qu'Anima puisse le relire ailleurs que
 * dans du JSX. Le composant ne décide ni l'ordre, ni la présence, ni la formulation.
 */

export interface Place {
  readonly nom: string;
  readonly quoi: string;
}
export interface Section {
  readonly titre: string;
  readonly paragraphes: readonly string[];
}

export interface ProprietesReperes {
  readonly titre: string;
  readonly ouverture: string;
  readonly places: readonly Place[];
  readonly sections: readonly Section[];
  readonly siCaNeVaPas: string;
  readonly parOuCommencer: string;
  readonly urlRetour: string;
}

export default function Reperes(p: ProprietesReperes) {
  return (
    <main className={s.page}>
      <article className={s.contenu}>
        <Link className={s.retour} href={p.urlRetour}>
          <span className="t-meta">← Revenir</span>
        </Link>

        <p className="t-surtitre">Anam</p>
        <h1 className="t-titre">{p.titre}</h1>
        <p className="t-corps">{p.ouverture}</p>

        <section className={s.section} aria-label="Les trois places">
          <h2 className="t-titre-sm">Les trois places</h2>
          <dl className={s.places}>
            {p.places.map((place) => (
              <div key={place.nom}>
                {/* ⚠️ `t-corps`, PAS `t-corps-fort`. La graisse d'INTERFACE (Inter) sur un nom de
                    place mettrait une seconde voix de titre à trois centimètres des `<h2>` en
                    Fraunces — c'est exactement le défaut relevé par la QA du 2026-08-19 sur les
                    cartes de l'accueil, et « corrigé » à moitié la première fois. Le nom se
                    distingue par sa COULEUR et sa place, comme dans `premier-passage.tsx`. */}
                <dt className="t-corps">{place.nom}</dt>
                <dd className="t-corps">{place.quoi}</dd>
              </div>
            ))}
          </dl>
        </section>

        {p.sections.map((section) => (
          <section className={s.section} key={section.titre} aria-label={section.titre}>
            <h2 className="t-titre-sm">{section.titre}</h2>
            {section.paragraphes.map((texte) => (
              <p className="t-corps" key={texte}>
                {texte}
              </p>
            ))}
          </section>
        ))}

        {/* ⚠️ EN DERNIER, ET SANS ENCADRÉ. Cette phrase désigne la porte de secours pour ce qu'elle
            est — des personnes, pas une rubrique d'assistance. Lui donner une fiche, une couleur ou
            une icône en ferait une alarme, ce que AD-9 refuse : le filet rassure, il n'alarme pas. */}
        <section className={s.section} aria-label="Si ça ne va pas">
          <p className="t-corps">{p.siCaNeVaPas}</p>
          <p className="t-anam">{p.parOuCommencer}</p>
        </section>
      </article>
    </main>
  );
}
