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
  FICHE_DEPUIS_FEUILLAISON,
  FICHE_DEPUIS_RAYONNEMENT,
  ACTION_DECLARER_RAYONNEMENT,
  CONFIRMER_RAYONNEMENT,
  CONFIRMER_OUI,
  CONFIRMER_NON,
  SUCCES_RAYONNEMENT,
  ECHEC_RAYONNEMENT,
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
  /**
   * Story 4.7 (AC3) — LE GESTE : elle déclare que cette branche est devenue vraie en elle. Le rendu ne
   * DÉCIDE rien (AD-7) : il transmet une intention, le serveur écrit. `false` = refusé (fenêtre détresse,
   * panne) → on le dit sans mentir, et sans expliquer ce qu'elle n'a pas à savoir.
   */
  onDeclarerRayonnement?: (brancheId: string) => Promise<boolean>;
}

export default function FicheBranche({
  branche,
  onFermer,
  onVoirDansConversation,
  onRenommer,
  onAnnoncer,
  onCentrer,
  onDeclarerRayonnement,
}: ProprietesFiche) {
  const [renomme, setRenomme] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);
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

      {/* AC5 — ce qui a changé, ET QUAND. On ne montre QUE l'état atteint : empiler « elle s'étoffe » et
          « en pleine lumière » raconterait un historique que personne n'a demandé. Le saut direct
          naissance → rayonnement laisse `dateFeuillaison` vide, et la phrase ne l'invente pas. */}
      {branche.etat === "rayonnement" && branche.dateRayonnement && (
        <p className={s.ficheTransition}>{FICHE_DEPUIS_RAYONNEMENT(dateLisible(branche.dateRayonnement))}</p>
      )}
      {branche.etat === "feuillaison" && branche.dateFeuillaison && (
        <p className={s.ficheTransition}>{FICHE_DEPUIS_FEUILLAISON(dateLisible(branche.dateFeuillaison))}</p>
      )}

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
        {/* AC3 — le geste. Absent si la branche rayonne déjà : proposer d'atteindre ce qui est atteint
            serait au mieux du bruit, au pire une invitation à re-faire ce qui ne se refait pas. */}
        {onDeclarerRayonnement && branche.etat !== "rayonnement" && !confirme && (
          <button type="button" className={s.actionSecondaire} onClick={() => setConfirme(true)}>
            {ACTION_DECLARER_RAYONNEMENT}
          </button>
        )}
      </div>

      {/* Le geste est IRRÉVERSIBLE : rien ne peut retirer la pleine lumière, sauf l'effacement. On le dit
          AVANT, en une phrase, sans dramatiser — et « Pas encore » est une sortie sans conséquence. */}
      {confirme && onDeclarerRayonnement && (
        <div className={s.ficheConfirmation}>
          <p>{CONFIRMER_RAYONNEMENT}</p>
          <div className={s.ficheActions}>
            <button
              type="button"
              className={s.actionSecondaire}
              disabled={enCours}
              onClick={async () => {
                setEnCours(true);
                const ok = await onDeclarerRayonnement(branche.id);
                setEnCours(false);
                setConfirme(false);
                onAnnoncer?.(ok ? SUCCES_RAYONNEMENT : ECHEC_RAYONNEMENT);
              }}
            >
              {CONFIRMER_OUI}
            </button>
            <button type="button" className={s.actionSecondaire} disabled={enCours} onClick={() => setConfirme(false)}>
              {CONFIRMER_NON}
            </button>
          </div>
        </div>
      )}

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
