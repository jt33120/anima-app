"use client";

import { useState } from "react";
import EchangeSource from "../conversation/EchangeSource";

/**
 * LienEchangeSource.tsx — « VOIR DANS LA CONVERSATION » (Story 5.8, AC6 · FR-021).
 *
 * FR-021 exige que la restitution porte « un lien vers l'échange source ». Ce lien mène au moment
 * précis où la lecture s'est faite — et ce moment n'est pas dans le fil de session (éphémère) : il
 * vit dans le journal brut (4.1). C'est exactement le problème que la Story 4.6 a résolu pour les
 * branches, et `EchangeSource` en est la solution déjà écrite et déjà revue.
 *
 * ⚠️ ON NE RÉÉCRIT PAS `EchangeSource`. Il lit `/api/anam/echange`, positionne sur le message exact,
 * le surligne, et porte un repère TEXTUEL pour les lecteurs d'écran (le surlignage par la teinte
 * seule était un défaut trouvé en revue 4.6). Réécrire une variante « pour la halte » referait ce
 * chemin, et le referait moins bien. Ce composant n'ajoute que le repli : ici, `onRetour` REFERME au
 * lieu de renvoyer à l'arbre — on est dans un document, pas dans une région du monde.
 */

export default function LienEchangeSource({ extraitSourceId }: { readonly extraitSourceId: string }) {
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <button type="button" className="t-meta" onClick={() => setOuvert(true)}>
        Voir dans la conversation
      </button>
    );
  }
  return <EchangeSource extraitSourceId={extraitSourceId} onRetour={() => setOuvert(false)} />;
}
