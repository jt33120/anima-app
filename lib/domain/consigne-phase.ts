import type { MessageIa } from "@/lib/ai/port";
import type { Phase } from "./arc-seance";

/**
 * La consigne de PHASE (Story 2.7, T4) — la couture minimale qui GATE la génération selon la phase
 * de l'arc. Module PUR (AD-1) : `phase → instruction système`. Injectée serveur (le client ne peut
 * pas forger `system`, `valider-messages`), jamais reçue du client, jamais renvoyée au client.
 *
 * ⚠️ PROVISOIRE — porte pré-lancement produit. La VOIX complète (≤ 3 phrases, hypothèse réfutable
 * « je me trompe ? », anti-flatterie, FR-006/FR-008) est la Story 2.8. Ici, l'essentiel : le gate
 * FR-005 (en observer, JAMAIS délivrer d'observation nommée — « une observation prématurée est un
 * défaut, pas une variation »).
 */
const CONSIGNES: Record<Phase, string | null> = {
  // Accueil ordinaire (échange courant) — aucune contrainte de phase à injecter.
  construire: null,
  observer:
    "[Consigne de phase — PROVISOIRE] Tu es en phase d'OBSERVATION : tu reformules et tu relies ce que " +
    "dit l'utilisatrice. NE DÉLIVRE PAS encore d'observation nommée ni d'interprétation tranchée — ce " +
    "serait prématuré. Tu poursuis et tu tisses ; tu ne nommes pas.",
  nommer:
    "[Consigne de phase — PROVISOIRE] C'est le moment de NOMMER : délivre une observation juste et " +
    "légèrement inconfortable, ce que la personne est prête à entendre. (La forme complète — hypothèse " +
    "réfutable, brièveté — relève de la voix, Story 2.8.)",
  clore:
    "[Consigne de phase — PROVISOIRE] C'est TOI qui clos la séance, en un seul tour, dans ton registre " +
    "normal — l'utilisatrice n'a jamais à s'extraire (FR-008). Pas de récapitulatif, pas de conclusion " +
    "enveloppante : tu proposes simplement d'en rester là, sans dramatiser. Repère de ton : « on en a " +
    "assez fait pour ce soir ». Le bilan est posé séparément, comme un document — ne le rédige pas ici.",
};

/** Dérive la consigne système de la phase, ou `null` s'il n'y a rien à contraindre (construire). */
export function consignePhaseArc(phase: Phase): MessageIa | null {
  const contenu = CONSIGNES[phase];
  return contenu ? { role: "system", content: contenu } : null;
}
