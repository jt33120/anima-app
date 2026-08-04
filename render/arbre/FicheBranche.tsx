"use client";

/*
 * FicheBranche — l'ÉTIQUETTE d'une branche (jamais une modale : pas de rôle dialog, pas de piège au focus ;
 * un tap à côté ferme, Échap ferme, le focus revient à l'accroche). Nom donné par elle + date + extrait exact
 * rendu COMME UN TOUR D'UTILISATRICE (voix utilisatrice, JAMAIS la police d'Anam — le mettre en voix d'Anam
 * attribuerait la prise de conscience à Anam). Deux actions : « Voir dans la conversation » et « Renommer »
 * (champ VIDE, aucune suggestion — UX-DR-27). AD-7 : muet, ne parle qu'à app/api via les callbacks.
 *
 * Revue 4.6 : le composant est monté avec une `key={branche.id}` par l'appelant (sans quoi le texte saisi
 * pour une branche fuyait vers une autre) ; le focus entre dans la fiche à l'ouverture ; le champ de
 * renommage est le composant PARTAGÉ avec la vue liste.
 */

import { useEffect, useRef } from "react";
import type { BrancheProjetee } from "@/lib/scene/projection";
import ChampRenommage from "./ChampRenommage";
import { useState } from "react";
import {
  ACTION_VOIR_CONVERSATION,
  ACTION_RENOMMER,
  ACTION_CENTRER,
  ACTION_FERMER,
  FICHE_EXTRAIT_INTRO,
} from "./copie-arbre";
import s from "./arbre.module.css";

function dateLisible(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export interface ProprietesFiche {
  branche: BrancheProjetee;
  onFermer: () => void;
  onVoirDansConversation: (extraitSourceId: string) => void;
  onRenommer: (brancheId: string, nom: string) => Promise<boolean>;
  /** Dépose une annonce a11y dans la région live PERSISTANTE de la région arbre. */
  onAnnoncer?: (texte: string) => void;
  /** Ferme la fiche et ramène cette branche au centre. Remplace le double-clic, qui était mort (re-revue). */
  onCentrer?: () => void;
}

export default function FicheBranche({
  branche,
  onFermer,
  onVoirDansConversation,
  onRenommer,
  onAnnoncer,
  onCentrer,
}: ProprietesFiche) {
  const [renomme, setRenomme] = useState(false);
  const titreRef = useRef<HTMLParagraphElement>(null);
  // Le focus revient au bouton d'ouverture quand le champ se referme (sinon il retombe sur <body>).
  const boutonRenommerRef = useRef<HTMLButtonElement>(null);
  const fermerRenommage = () => {
    setRenomme(false);
    requestAnimationFrame(() => boutonRenommerRef.current?.focus());
  };

  // Le focus ENTRE dans la fiche à l'ouverture (sinon elle était inatteignable au clavier : le focus
  // restait sur l'accroche et la fiche n'était jamais annoncée — revue 4.6).
  useEffect(() => {
    requestAnimationFrame(() => titreRef.current?.focus());
  }, []);

  return (
    <div className={s.fiche} role="group" aria-label="Fiche de branche">
      <p className={s.ficheNom} tabIndex={-1} ref={titreRef}>
        {branche.nom ?? ""}
      </p>
      {branche.dateNaissance && <p className={s.ficheDate}>{dateLisible(branche.dateNaissance)}</p>}

      {branche.extraitContenu && (
        <div className={s.ficheExtrait}>
          <p className={s.ficheExtraitIntro}>{FICHE_EXTRAIT_INTRO}</p>
          <blockquote className={s.tourUtilisatrice}>{branche.extraitContenu}</blockquote>
        </div>
      )}

      <div className={s.ficheActions}>
        <button
          type="button"
          className={s.actionSecondaire}
          onClick={() => onVoirDansConversation(branche.extraitSourceId)}
        >
          {ACTION_VOIR_CONVERSATION}
        </button>
        {!renomme && (
          <button
            type="button"
            className={s.actionSecondaire}
            ref={boutonRenommerRef}
            onClick={() => setRenomme(true)}
          >
            {ACTION_RENOMMER}
          </button>
        )}
        {onCentrer && (
          <button type="button" className={s.actionSecondaire} onClick={onCentrer}>
            {ACTION_CENTRER}
          </button>
        )}
      </div>

      {renomme && (
        <ChampRenommage
          brancheId={branche.id}
          onRenommer={onRenommer}
          onTermine={fermerRenommage}
          onAnnoncer={onAnnoncer}
          autoFocus
        />
      )}

      <button type="button" className={s.ficheFermer} onClick={onFermer} aria-label={ACTION_FERMER}>
        <span aria-hidden>×</span>
      </button>
    </div>
  );
}
