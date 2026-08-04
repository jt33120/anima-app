"use client";

/*
 * EchangeSource — « Voir dans la conversation » (AC4). Rejoue l'ÉCHANGE SOURCE PERSISTÉ (le message exact + son
 * voisinage, lu depuis entree_journal via une route serveur), positionné sur le MESSAGE EXACT, surligné (filet
 * accent + fond accent-doux estompé en 2 s ; immédiat en reduced-motion). Le message source d'hier n'est pas
 * dans le fil de session éphémère — d'où cette lecture dédiée. AD-7 : muet, ne parle qu'à `^/api/`. Repli sûr :
 * une panne n'affiche rien de sensible, juste un retour.
 */

import { useEffect, useRef, useState } from "react";
import { ACTION_RETOUR_ARBRE, MENTION_MOMENT } from "../arbre/copie-arbre";
import s from "../arbre/arbre.module.css";

interface Message {
  id: string;
  role: "utilisatrice" | "anam";
  contenu: string;
  estCible: boolean;
}

export interface ProprietesEchangeSource {
  extraitSourceId: string;
  onRetour: () => void;
}

export default function EchangeSource({ extraitSourceId, onRetour }: ProprietesEchangeSource) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [echec, setEchec] = useState(false);
  const cibleRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    let vivant = true;
    // RÉINITIALISER avant de recharger : sinon le verbatim art. 9 de la branche PRÉCÉDENTE restait affiché
    // pendant le chargement de la nouvelle (revue 4.6) — on montrait le mauvais moment intime.
    setMessages(null);
    setEchec(false);
    (async () => {
      try {
        const r = await fetch(`/api/anam/echange?extrait=${encodeURIComponent(extraitSourceId)}`);
        if (!r.ok) throw new Error("echec");
        const data = (await r.json()) as { messages?: Message[] };
        if (vivant) setMessages(data.messages ?? []);
      } catch {
        if (vivant) setEchec(true);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [extraitSourceId]);

  // Positionne sur le message exact une fois rendu (block:center = « au même endroit »).
  useEffect(() => {
    if (messages && cibleRef.current) {
      cibleRef.current.scrollIntoView({ block: "center" });
    }
  }, [messages]);

  return (
    <div className={s.echange}>
      <button type="button" className={s.actionSecondaire} onClick={onRetour}>
        {ACTION_RETOUR_ARBRE}
      </button>

      {echec && <p className={s.echec}>Je n’ai pas pu rouvrir ce moment. Reviens à l’arbre.</p>}

      {messages && (
        <ul className={s.echangeFil}>
          {messages.map((m) => (
            <li
              key={m.id}
              ref={m.estCible ? cibleRef : undefined}
              className={`${m.role === "anam" ? s.tourAnam : s.tourUtilisatrice} ${m.estCible ? s.surligne : ""}`}
            >
              {/* Repère TEXTUEL du message exact : le surlignage était porté par la teinte SEULE, donc
                  invisible aux lecteurs d'écran et sous contraste insuffisant (revue 4.6, UX-DR-25). */}
              {m.estCible && <span className={s.surligneMention}>{MENTION_MOMENT}</span>}
              {m.contenu}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
