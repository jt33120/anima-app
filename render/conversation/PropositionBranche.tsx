"use client";

import { useEffect, useRef, useState } from "react";
import {
  INVITE_NOMMAGE,
  SOUS_TITRE_NOMMAGE,
  REPONSE_REFUS,
  ACTION_NOMMER,
  CONFIRME_NAISSANCE,
  ECHEC_NAISSANCE,
} from "./copie-proposition";
import type { EtatProposition } from "./types";
import s from "./conversation.module.css";

/** Miroir applicatif du garde-fou serveur (AC2) — le doute (chaîne d'espaces) n'est pas un nom. Trivial,
 *  inline : le rendu ne peut pas importer le domaine (AD-7), et l'autorité reste le CHECK/policy/RPC. */
const nomDonne = (nom: string) => nom.trim().length > 0;

/**
 * PropositionBranche — la proposition de branche DANS le fil (Story 4.5, AC1/AC2/AC4). Composant CLIENT
 * présentationnel, MUET (AD-7) : il ne décide RIEN — le SERVEUR a décidé de proposer (prop d'ouverture), et
 * l'écriture passe par `Conversation` (callbacks) vers `/api/anam/branche`. La voix vient de `lib/domain/branche`.
 *
 * Ne DÉCRÈTE ni ne FÉLICITE (charte §6) : aucune « prise de conscience » annoncée, aucune célébration, aucune
 * étincelle. Deux réponses d'ÉGALE lisibilité « Oui » / « Non » (cibles ≥ 44 px, anneau de focus jamais retiré).
 * Le champ de nommage est VIDE, avec une étiquette VISIBLE (jamais un placeholder en guise d'étiquette), aucune
 * suggestion ni exemple — et le bouton reste désactivé tant qu'aucun nom n'est donné (AC2 : une branche sans
 * nom n'existe pas). Le nom saisi est rendu dans la police de l'UTILISATRICE (`t-corps`), jamais celle d'Anam.
 */
export default function PropositionBranche({
  phrase,
  etat,
  nom,
  enCours = false,
  echec = false,
  onOui,
  onNon,
  onNommer,
}: {
  phrase: string;
  etat: EtatProposition;
  nom?: string;
  /** Story 4.5 (#12) : un « Nommer » est en vol → verrou anti-double-POST. */
  enCours?: boolean;
  /** Story 4.5 (#3) : le dernier « Nommer » a échoué → ligne neutre, retryable. */
  echec?: boolean;
  onOui: () => void;
  onNon: () => void;
  onNommer: (nom: string) => void;
}) {
  const [texte, setTexte] = useState("");
  const champRef = useRef<HTMLInputElement>(null);

  // Quand le champ de nommage paraît, y placer le focus (jamais au montage de la proposition — la réponse
  // Oui/Non ne vole pas le focus au composeur ; c'est le geste « Oui » qui amène ici).
  useEffect(() => {
    if (etat === "nomme") champRef.current?.focus();
  }, [etat]);

  // Refus (AC4) : « Ok. » et rien d'autre.
  if (etat === "refuse") {
    return (
      <article className={`${s.bloc} fondu-texte`}>
        <p className="t-anam">{REPONSE_REFUS}</p>
      </article>
    );
  }

  // Née (AC3) : confirmation SOBRE, sans célébration — le nom, dans la police de l'utilisatrice.
  if (etat === "nee") {
    return (
      <article className={`${s.bloc} fondu-texte`} aria-label="Une branche est née">
        <p className="t-corps">« {nom} »</p>
        <p className="t-meta">{CONFIRME_NAISSANCE}</p>
      </article>
    );
  }

  // Proposée / en cours de nommage : la question d'Anam, puis Oui/Non ou le champ.
  return (
    <article className={`${s.bloc} fondu-texte`} aria-label="Proposition de branche">
      <p className="t-anam">{phrase}</p>

      {etat === "propose" && (
        <div className={s.carteActions}>
          <button type="button" onClick={onOui} className={`${s.carteAction} ${s.carteActionPrimaire} t-bouton`}>
            Oui
          </button>
          <button type="button" onClick={onNon} className={`${s.carteAction} t-bouton`}>
            Non
          </button>
        </div>
      )}

      {etat === "nomme" && (
        <form
          className={s.propositionNommage}
          onSubmit={(e) => {
            e.preventDefault();
            if (nomDonne(texte)) onNommer(texte);
          }}
        >
          <label htmlFor="branche-nom" className="t-corps">
            {INVITE_NOMMAGE}
          </label>
          <p className="t-meta">{SOUS_TITRE_NOMMAGE}</p>
          <input
            id="branche-nom"
            ref={champRef}
            type="text"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            className={s.champ}
            autoComplete="off"
            aria-describedby={echec ? "branche-echec" : undefined}
          />
          {echec && (
            <p id="branche-echec" className="t-meta" role="alert">
              {ECHEC_NAISSANCE}
            </p>
          )}
          <div className={s.carteActions}>
            <button
              type="submit"
              disabled={!nomDonne(texte) || enCours}
              className={`${s.carteAction} ${s.carteActionPrimaire} t-bouton`}
            >
              {ACTION_NOMMER}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
