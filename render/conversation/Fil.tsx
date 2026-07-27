"use client";

import { useEffect, useRef } from "react";
import TourAnam from "./TourAnam";
import TourUtilisatrice from "./TourUtilisatrice";
import { estAncreEnBas } from "./composeur-clavier";
import type { Tour } from "./types";
import s from "./conversation.module.css";

/**
 * Fil — le flux vertical unique de la conversation (Story 2.2, B2 ; AC1). SANS bulles opposées :
 * mêmes marges, distinction par la typographie + le filet (voir TourAnam/TourUtilisatrice).
 *
 * Suivi du bas NON CAPTIF (AC3) : on ne recolle au bas QUE si l'utilisatrice y était déjà (mesuré
 * au scroll). Dès qu'elle remonte, on cesse de la ramener — et on ne reprend pas seul.
 *
 * Annonce lecteur d'écran UNIQUE et à la FIN (AC3) : la région `aria-live="polite"` +
 * `aria-atomic="true"` reçoit le message COMPLET en une fois (jamais mot à mot). On NE se repose
 * PAS sur `aria-busy` (cassé sur NVDA, bug #1682063) : le texte qui « tape » vit hors de cette
 * région (dans le fil visuel), et seule la fin y écrit.
 */
export default function Fil({
  tours,
  annonce,
  onReessayer,
}: {
  tours: Tour[];
  annonce: string;
  onReessayer?: (idAnam: string) => void;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const etaitEnBas = useRef(true);

  useEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const surScroll = () => {
      etaitEnBas.current = estAncreEnBas(el);
    };
    el.addEventListener("scroll", surScroll, { passive: true });
    return () => el.removeEventListener("scroll", surScroll);
  }, []);

  // À chaque nouveau contenu : recoller au bas UNIQUEMENT si on y était (défilement instantané,
  // jamais « smooth » → cohérent reduced-motion, et non captif).
  useEffect(() => {
    const el = conteneur.current;
    if (el && etaitEnBas.current) el.scrollTop = el.scrollHeight;
  }, [tours]);

  return (
    <div className={s.fil} ref={conteneur}>
      {tours.map((t) =>
        t.role === "anam" ? (
          <TourAnam
            key={t.id}
            texte={t.texte}
            etat={t.etat}
            onReessayer={t.etat === "echec" && onReessayer ? () => onReessayer(t.id) : undefined}
          />
        ) : (
          <TourUtilisatrice key={t.id} texte={t.texte} />
        ),
      )}
      {/* Région d'annonce a11y — hors flux visuel, remplie UNE fois à la fin (message complet). */}
      <p className={s.annonce} aria-live="polite" aria-atomic="true">
        {annonce}
      </p>
    </div>
  );
}
