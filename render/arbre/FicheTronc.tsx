"use client";

/*
 * FicheTronc — l'ÉTIQUETTE du tronc quand il manque l'heure de naissance (Story 5.3, AC2/AC5).
 *
 * Même forme que `FicheBranche` : une étiquette, jamais une modale (pas de rôle dialog, pas de piège
 * au focus ; un tap à côté ferme, Échap ferme, le focus revient au déclencheur).
 *
 * ── EXACTEMENT DEUX ACTIONS (AC5) ──────────────────────────────────────────────────────────────
 *
 * « Ajouter mon heure » et « Où la trouver ». Pas trois, pas une. La tentation serait d'ajouter un
 * « Plus tard » — ce serait un troisième chemin qui ne fait rien : la fiche se ferme déjà d'un tap à
 * côté et d'Échap, et un bouton qui ne fait que fermer laisse croire qu'on lui a demandé de choisir.
 *
 * ── CE QUE CE COMPOSANT NE DESSINE JAMAIS (AC2) ────────────────────────────────────────────────
 *
 * Aucun rouge, aucun cadenas, aucun pointillé, aucun pourcentage, aucune jauge. Il ne manque pas
 * « 40 % du socle » : il manque une information, elle a un nom, et on dit où la chercher.
 * `tests/tronc-absence.test.ts` garde le vocabulaire ; `tests/rendu/tronc-fiche.test.tsx` garde la
 * forme (deux actions, ni plus ni moins).
 *
 * AD-7 : muet. Il reçoit ses phrases en props (elles viennent de `lib/domain` via la projection) et
 * ne décide rien.
 */

import { useEffect, useRef, useState } from "react";
import {
  ACTION_AJOUTER_HEURE,
  ACTION_OU_TROUVER,
  ACTION_FERMER,
  TRONC_TITRE,
  URL_HEURE_NAISSANCE,
} from "./copie-arbre";
import s from "./arbre.module.css";

export interface ProprietesFicheTronc {
  /** L'aveu : ce qui manque, pourquoi, et ce qui reste (FR-050). Voix d'Anam, source `lib/domain`. */
  phrase: string;
  /** Où la trouver : copie intégrale de l'acte de naissance, mairie (FR-050). */
  ouTrouver: string;
  onFermer: () => void;
}

export default function FicheTronc({ phrase, ouTrouver, onFermer }: ProprietesFicheTronc) {
  // « Où la trouver » RÉVÈLE SUR PLACE. L'envoyer sur une autre page lui ferait perdre la scène pour
  // deux phrases — et la scène est « une », sans écran sec (EXPERIENCE).
  const [ouvert, setOuvert] = useState(false);
  const titre = useRef<HTMLHeadingElement>(null);

  // Le focus entre dans la fiche à l'ouverture (patron `FicheBranche`) : sans ça, un lecteur d'écran
  // reste sur le tronc et n'annonce jamais ce qui vient de s'ouvrir.
  useEffect(() => titre.current?.focus(), []);

  return (
    <div className={s.fiche}>
      <button type="button" className={s.ficheFermer} onClick={onFermer} aria-label={ACTION_FERMER}>
        ×
      </button>

      <h2 className="t-titre-sm" tabIndex={-1} ref={titre}>
        {TRONC_TITRE}
      </h2>

      {/* La voix d'Anam — même traitement typographique que partout ailleurs où elle parle. */}
      <p className="t-anam">{phrase}</p>

      <div className={s.ficheActions}>
        <a className={`${s.actionSecondaire} ${s.actionLien}`} href={URL_HEURE_NAISSANCE}>
          {ACTION_AJOUTER_HEURE}
        </a>
        <button
          type="button"
          className={s.actionSecondaire}
          aria-expanded={ouvert}
          onClick={() => setOuvert((v) => !v)}
        >
          {ACTION_OU_TROUVER}
        </button>
      </div>

      {ouvert && <p className="t-corps">{ouTrouver}</p>}
    </div>
  );
}
