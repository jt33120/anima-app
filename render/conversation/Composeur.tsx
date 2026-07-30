"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
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
  motifDesactive,
}: {
  onEnvoyer: (texte: string) => void;
  occupe: boolean;
  /** Réf du champ, détenue par le parent → permet de redéplacer le focus (après « Réessayer »). */
  champRef: RefObject<HTMLTextAreaElement | null>;
  /**
   * Story 3.4 (AC4) : allocation résiduelle épuisée → le composeur reste VISIBLE mais DÉSACTIVÉ, avec
   * ce motif (registre système) affiché à côté. Distinct d'`occupe` (transitoire, pendant un flux) :
   * `motifDesactive` est un arrêt persistant. Jamais « Passe au premium » — le socle reste ouvert.
   */
  motifDesactive?: string;
}) {
  const [valeur, setValeur] = useState("");
  const palier = usePalier();
  const bloque = !!motifDesactive; // arrêt persistant (quota épuisé) — indépendant de `occupe`
  const motifRef = useRef<HTMLParagraphElement>(null);

  // Story 3.4 (revue F8) : quand le quota épuise et que le champ passe `disabled`, le navigateur ferait
  // retomber le focus sur <body> (perte de contexte, WCAG 2.4.3). On le redirige vers le motif visible
  // (registre système) — jamais un appât commercial. Le `<p>` est ciblable par script (tabIndex=-1).
  useEffect(() => {
    if (bloque) motifRef.current?.focus();
  }, [bloque]);

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
    if (!t || occupe || bloque) return; // quota épuisé → aucun envoi (le champ est désactivé)
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
    <div className={s.composeurZone}>
      {/* Story 3.4 (AC4) : motif d'arrêt affiché À CÔTÉ du composeur (au-dessus de la bande de saisie),
          registre système. `role="status"` → annoncé poliment au lecteur d'écran (le champ désactivé
          ne recevant pas le focus, `aria-describedby` seul ne suffirait pas). */}
      {bloque ? (
        <p id="motif-composeur" ref={motifRef} tabIndex={-1} className={`${s.motifDesactive} t-meta`} role="status">
          {motifDesactive}
        </p>
      ) : null}
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
          disabled={bloque}
          aria-describedby={bloque ? "motif-composeur" : undefined}
        />
        <button
          type="button"
          className={s.envoi}
          onClick={envoyer}
          disabled={!valeur.trim() || occupe || bloque}
          aria-label="Envoyer"
        >
          <span className="t-bouton">Envoyer</span>
        </button>
      </div>
    </div>
  );
}
