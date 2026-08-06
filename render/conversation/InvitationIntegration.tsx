"use client";

import { ACTION_ALLER_VERS_BRANCHE } from "./copie-proposition";
import s from "./conversation.module.css";

/**
 * InvitationIntegration — l'arbitrage d'ouverture DANS LE FIL (Story 4.10, FR-030, AC4/AC5). Composant
 * CLIENT présentationnel, MUET (AD-7) : il ne décide RIEN. Le serveur a compté, le serveur a choisi, et
 * il n'a envoyé ici qu'une phrase et un identifiant.
 *
 * ── CE QUE CE COMPOSANT NE PEUT PAS FAIRE, ET C'EST LE POINT (AC5 [DUR]) ──────────────────────────────
 *
 * Il ne peut pas afficher « 3 branches en cours », ni « plusieurs », ni une jauge, ni une liste — parce
 * qu'il n'a reçu AUCUN nombre et AUCUNE collection. FR-031 n'est pas ici une consigne de rédaction qu'un
 * futur contributeur pourrait oublier : c'est une propriété du type qu'il reçoit. Il n'y a pas de champ
 * où mettre le chiffre.
 *
 * ── EN CONVERSATION, JAMAIS EN BANDEAU (AC4, littéralement) ──────────────────────────────────────────
 *
 * C'est un tour du fil, au même rang que tout ce qu'Anam dit. Pas de surimpression, pas d'encart en haut
 * d'écran, pas de badge : une invitation qui s'impose visuellement cesse d'être une invitation.
 *
 * ── ET ELLE MÈNE QUELQUE PART ────────────────────────────────────────────────────────────────────────
 *
 * Un seul geste, doux, qui ouvre la fiche de la branche visée — là où vivent les trois façons de la faire
 * vivre (le plan d'étapes, le retour sur le thème, la déclaration de pleine lumière). Sans ce geste,
 * l'invitation serait un constat sur ce qu'elle n'a pas fait, c'est-à-dire un reproche.
 *
 * Ni « Non », ni « Plus tard », ni croix de fermeture : refuser une invitation, c'est ne pas la suivre.
 * Ajouter un bouton pour la décliner obligerait à répondre à quelque chose qui ne demandait rien.
 */
export default function InvitationIntegration({
  phrase,
  onAller,
}: {
  phrase: string;
  onAller?: () => void;
}) {
  return (
    <article className={`${s.bloc} fondu-texte`} aria-label="Une branche attend">
      <p className="t-anam">{phrase}</p>
      {onAller && (
        <div className={s.carteActions}>
          <button type="button" onClick={onAller} className={`${s.carteAction} t-bouton`}>
            {ACTION_ALLER_VERS_BRANCHE}
          </button>
        </div>
      )}
    </article>
  );
}
