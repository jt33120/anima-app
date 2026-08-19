"use client";

import type { BibliothequeVue, CarteVue } from "./types";
import CarteAnam from "./CarteAnam";
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
  const { cartes, enAvant, jour, anam } = bibliotheque;
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

      {/* ── LA CARTE D'ANAM, HORS DE LA GRILLE (Story 6.3, D8) ─────────────────────────────────
          Hors de la `<ul>` parce qu'elle n'est pas du catalogue : elle n'entre pas dans la
          rotation du jour, et la mise en avant reste « la première de la grille ». La mettre
          dedans obligerait à l'exclure du tri, donc à écrire une règle dans le rendu — ce que
          ce fichier n'a pas le droit de faire (AD-7).

          ⚠️ ELLE COMPTE QUAND MÊME DANS UX-DR-30. Cinq cartes de catalogue plus celle-ci font
          SIX objets rendus, soit exactement le plafond : une sixième carte de catalogue en
          livrerait sept. La garde compte les objets rendus, pas les entrées du catalogue. */}
      <CarteAnam carte={anam} />
    </div>
  );
}

function Carte({ carte, enAvant }: { carte: CarteVue; enAvant: boolean }) {
  return (
    <article className={`${s.carte} ${enAvant ? s.enAvant : ""}`} aria-labelledby={`carte-${carte.cle}`}>
      {/* ⚠️ UNE SEULE VOIX DE TITRE PAR ÉCRAN (QA visuelle du 2026-08-19). `t-corps-fort` est de
          l'INTERFACE (Inter) : il mettait « Le mantra du jour » et « Ton ciel du jour » dans une
          grasse sans-serif à trois centimètres de « Tes nombres » en Fraunces — deux familles de
          titre sur le même écran. Un titre de carte est du CONTENU : il parle avec la voix d'Anam.
          La mise en avant reste distinguée par ce qui l'ANNONCE, comme le dit le commentaire plus
          bas, pas par un changement de police. */}
      <h2 id={`carte-${carte.cle}`} className="t-titre-sm">
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
