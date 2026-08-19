"use client";

import { ACTION_VOIR_HYPOTHESE } from "./copie-hypothese";
import s from "./conversation.module.css";

/**
 * HypotheseEnneagramme — l'hypothèse d'Anam DANS LE FIL (Story 5.5, AC2). Composant CLIENT
 * présentationnel, MUET (AD-7) : il ne décide RIEN et ne calcule RIEN.
 *
 * ── CE QU'IL NE PEUT PAS FAIRE, ET C'EST LE POINT ─────────────────────────────────────────────
 *
 * Il ne peut pas afficher « tu es un 4 » : il n'a jamais reçu de 4. Le contrat d'ouverture ne porte
 * qu'une phrase constante et un identifiant (`lib/domain/arbitrage-ouverture.ts`). « Jamais
 * assénée » (FR-006) n'est donc pas une consigne de rédaction qu'un futur contributeur pourrait
 * oublier — c'est une propriété du type qu'il reçoit. Il n'y a pas de champ où mettre le numéro.
 *
 * ── EN CONVERSATION, JAMAIS EN BANDEAU ────────────────────────────────────────────────────────
 *
 * Un tour du fil, au même rang que tout ce qu'Anam dit. Pas de surimpression, pas d'encart, pas de
 * badge : une hypothèse qui s'impose visuellement cesse d'être une hypothèse.
 *
 * ── ET ELLE MÈNE QUELQUE PART ─────────────────────────────────────────────────────────────────
 *
 * Un seul geste, doux, qui ouvre la halte où le type est nommé et où les trois réponses — accepter,
 * refuser, corriger — ont la même lisibilité. Sans lui, la question serait sans issue.
 *
 * Ni « Non », ni « Plus tard », ni croix : refuser une hypothèse, c'est ne pas aller la voir. Un
 * bouton pour la décliner obligerait à trancher sur un numéro qu'elle n'a même pas lu.
 */
export default function HypotheseEnneagramme({
  phrase,
  onVoir,
}: {
  phrase: string;
  onVoir?: () => void;
}) {
  return (
    <article className={`${s.bloc} fondu-texte`} aria-label="Une idée d’Anam">
      <p className="t-anam">{phrase}</p>
      {onVoir && (
        <div className={s.carteActions}>
          <button type="button" onClick={onVoir} className={`${s.carteAction} t-bouton`}>
            {ACTION_VOIR_HYPOTHESE}
          </button>
        </div>
      )}
    </article>
  );
}
