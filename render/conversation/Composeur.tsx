"use client";

import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";
import { decisionEntree, type Palier } from "./composeur-clavier";
import s from "./conversation.module.css";

/**
 * Composeur — la bande de saisie (Story 2.2, B3 ; AC5, AC7, AC8). TEXTE SEUL en v1 : champ
 * multiligne auto-extensible (jusqu'à 6 lignes puis défilement interne) + bouton d'envoi. AUCUN
 * micro, aucune barre d'outils, aucun emoji, aucune pièce jointe (décision produit v1 — l'epic
 * prime sur DESIGN.md). Ne DISPARAÎT jamais (rendu tant que la conversation est montée).
 *
 * Entrée contextuelle (AC7, UX-DR-21) : la décision sm/md est prouvée dans `composeur-clavier`.
 * Anneau de focus visible sur le champ ET le bouton ; cibles ≥ 44px (CSS).
 */

const MAX_LIGNES = 6;

/** Palier de saisie : md dès 768px (Entrée envoie) ; sm en dessous (Entrée = nouvelle ligne). */
function usePalier(): Palier {
  const [palier, setPalier] = useState<Palier>("sm");
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const maj = () => setPalier(mq.matches ? "md" : "sm");
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);
  return palier;
}

export default function Composeur({
  onEnvoyer,
  occupe,
  champRef,
}: {
  onEnvoyer: (texte: string) => void;
  occupe: boolean;
  /** Réf du champ, détenue par le parent → permet de redéplacer le focus (après « Réessayer »). */
  champRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [valeur, setValeur] = useState("");
  const palier = usePalier();

  // Auto-extension : jusqu'à MAX_LIGNES, puis défilement interne (le composeur ne pousse pas le fil
  // hors de l'écran). Recalcul à chaque frappe.
  useEffect(() => {
    const el = champRef.current;
    if (!el) return;
    el.style.height = "auto";
    const ligne = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const max = ligne * MAX_LIGNES;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [valeur]);

  const envoyer = () => {
    const t = valeur.trim();
    if (!t || occupe) return;
    onEnvoyer(t);
    setValeur("");
  };

  const surTouche = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const action = decisionEntree(palier, {
      key: e.key,
      shiftKey: e.shiftKey,
      isComposing: e.nativeEvent.isComposing,
    });
    if (action === "envoyer") {
      e.preventDefault(); // sinon un saut de ligne s'insère avant l'envoi
      envoyer();
    }
    // "nouvelle-ligne" / "ignorer" → comportement natif du textarea (retour à la ligne / frappe).
  };

  return (
    <div className={s.composeur}>
      <textarea
        ref={champRef}
        className={`${s.champ} t-corps`}
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onKeyDown={surTouche}
        rows={1}
        placeholder="Écris à Anam…"
        aria-label="Ton message à Anam"
      />
      <button
        type="button"
        className={s.envoi}
        onClick={envoyer}
        disabled={!valeur.trim() || occupe}
        aria-label="Envoyer"
      >
        <span className="t-bouton">Envoyer</span>
      </button>
    </div>
  );
}
