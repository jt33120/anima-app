"use client";

import type { BibliothequeVue, CarteVue } from "./types";
import s from "./accueil.module.css";

/**
 * Bibliotheque.tsx — LA RÉGION D'ACCUEIL (Story 5.6, T7).
 *
 * Le rendu ne décide RIEN (AD-7) : l'ordre lui arrive déjà fait, la carte mise en avant lui arrive
 * déjà désignée. Il n'y a ici ni tri, ni filtre, ni règle — les mettre reviendrait à donner au
 * rendu le pouvoir que `lib/domain/bibliotheque.ts` lui retire exprès.
 *
 * ⚠️ AUCUN BADGE, AUCUN COMPTEUR, AUCUN CADENAS — et il n'y a rien à retenir pour ça : les types de
 * `./types.ts` n'ont aucun champ où en écrire un, et une carte indisponible n'est jamais construite
 * côté serveur. Le seul chemin de fuite qui resterait serait un compte fabriqué ICI (« 3 cartes »,
 * « 2 nouvelles ») ou glissé dans un `aria-label` — c'est ce que garde
 * `tests/rendu/bibliotheque.test.tsx`.
 */

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export interface ProprietesBibliotheque {
  readonly bibliotheque: BibliothequeVue;
}

export default function Bibliotheque({ bibliotheque }: ProprietesBibliotheque) {
  const { cartes, enAvant, jour } = bibliotheque;
  const date = `${jour.j} ${MOIS[jour.m - 1]}`;

  return (
    <div className={s.bibliotheque}>
      <p className={`t-meta ${s.jour}`}>{date}</p>
      <ul className={s.grille}>
        {cartes.map((carte) => (
          <li key={carte.cle} className={s.item}>
            <Carte carte={carte} enAvant={carte.cle === enAvant} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Carte({ carte, enAvant }: { carte: CarteVue; enAvant: boolean }) {
  return (
    <article className={`${s.carte} ${enAvant ? s.enAvant : ""}`} aria-labelledby={`carte-${carte.cle}`}>
      <h2 id={`carte-${carte.cle}`} className={enAvant ? "t-titre-sm" : "t-corps-fort"}>
        {carte.titre}
      </h2>

      {/* La mise en avant est ANNONCÉE, pas seulement plus grande : sans ça, la seule différence
          serait visuelle, et l'information n'existerait pas pour qui n'y a pas accès. */}
      {enAvant && <p className={`t-meta ${s.mention}`}>Mise en avant aujourd&apos;hui</p>}

      {carte.faits.length > 0 && (
        <dl className={s.faits}>
          {carte.faits.map((f) => (
            <div key={f.intitule} className={s.fait}>
              <dt className="t-meta">{f.intitule}</dt>
              <dd className="t-corps">{f.valeur}</dd>
            </div>
          ))}
        </dl>
      )}

      {/*
        L'ABSENCE, DITE HONNÊTEMENT (AC5).

        165 créneaux de corpus sont déclarés et aucun n'est écrit : c'est l'état RÉEL du produit, pas
        un cas dégradé rare. Trois refus tiennent cette phrase :
          — pas de « bientôt » ni de compte à rebours (FR-057 : on ne teaser pas ce qu'on n'a pas) ;
          — pas d'excuse, et surtout pas de repli fabriqué : seule Anima peut écrire ces textes
            (FR-054 + FR-086), et une phrase de remplacement serait une citation inventée attribuée
            à une personne réelle ;
          — pas de silence : une carte vide sans explication se lit comme une panne.
      */}
      {carte.texte.statut === "ecrit" ? (
        <p className="t-anam">{carte.texte.texte}</p>
      ) : (
        <p className={`t-meta ${s.nonEcrit}`}>
          {carte.faits.length > 0
            ? "Anima n'a pas encore écrit ce texte."
            : "Anima n'a pas encore écrit cette carte."}
        </p>
      )}
    </article>
  );
}
