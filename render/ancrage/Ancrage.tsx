"use client";

import { useState } from "react";
import type { AncrageVue, MotsAncrage } from "./types";
import s from "./ancrage.module.css";

/**
 * Ancrage.tsx — L'EXERCICE GUIDÉ, PAS À PAS (Story 5.9, T5 · FR-081).
 *
 * ── UN SEUL TEMPS À L'ÉCRAN, ET C'EST CE QUI EN FAIT UN EXERCICE ──────────────────────────────
 *
 * Les cinq temps rendus ensemble ne seraient pas un exercice guidé : ce serait un texte long, donc
 * une chose à LIRE — exactement le format dont FR-080 exige qu'il reste distinct. La progression
 * n'est pas une commodité d'affichage, elle est la nature du format.
 *
 * ── LE RENDU NE DÉCIDE RIEN (AD-7) ────────────────────────────────────────────────────────────
 *
 * Il porte un indice, rien d'autre. Les bornes de la progression vivent dans `lib/domain/ancrage.ts`
 * (`etapeSuivante`, `estDernier`) et s'y testent sans DOM. Ici on ne fait qu'appliquer.
 *
 * ── CE QU'IL N'Y A PAS, ET QUI NE DOIT PAS APPARAÎTRE ─────────────────────────────────────────
 *
 *   • aucune minuterie, aucun compte à rebours, aucun verrou d'étape : le produit n'impose jamais
 *     un rythme (constante de ce produit, cf. le geste de pause 6.4) ;
 *   • aucun retour en arrière interdit : on peut revenir sur ses pas ;
 *   • aucune félicitation, aucun score, aucune série (« 3 jours d'affilée ») — ce serait une boucle
 *     d'engagement, ce que ce produit refuse ;
 *   • aucun élément audio, aucune amorce, aucun bouton inerte : la variante audio est déférée en
 *     v1.1 (AC7) et un report ne se met pas à l'écran ;
 *   • aucun compteur d'inventaire. Le repère « où j'en suis » porte sur CE parcours ouvert, pas sur
 *     ce que le compte possède (FR-031).
 */

export interface ProprietesAncrage {
  readonly ancrage: AncrageVue;
  readonly mots: MotsAncrage;
}

export default function Ancrage({ ancrage, mots }: ProprietesAncrage) {
  const total = ancrage.temps.length;
  // `total` = fin traversée. On n'y arrive que par le dernier bouton, jamais par une borne dépassée.
  const [indice, setIndice] = useState(0);
  const traverse = indice >= total;

  return (
    <section className={s.ancrage} aria-labelledby={`ancrage-${ancrage.cle}`}>
      <h2 id={`ancrage-${ancrage.cle}`} className="t-titre-sm">
        {ancrage.titre}
      </h2>

      {traverse ? (
        // ⚠️ `aria-live` ET PAS `role="alert"` : la fin d'un ancrage n'est pas une alerte, et le
        // registre sonore d'un lecteur d'écran fait partie du registre du produit.
        <p className="t-anam" aria-live="polite">
          {mots.traverse}
        </p>
      ) : (
        <>
          {/* Le repère de parcours. Il est ANNONCÉ plutôt que seulement dessiné : sans ça,
              l'information n'existerait pas pour qui ne voit pas les points. */}
          <p className={`t-meta ${s.repere}`} aria-live="polite">
            {indice + 1} / {total}
          </p>

          <p className={`t-anam ${s.temps}`}>{ancrage.temps[indice].texte}</p>

          <div className={s.commandes}>
            {indice > 0 && (
              <button type="button" className={s.retour} onClick={() => setIndice(indice - 1)}>
                Revenir
              </button>
            )}
            <button type="button" className={s.avancer} onClick={() => setIndice(indice + 1)}>
              {indice >= total - 1 ? mots.terminer : mots.avancer}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
