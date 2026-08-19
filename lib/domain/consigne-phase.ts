import type { MessageIa } from "@/lib/ai/port";
import type { BeatArc, Phase } from "./arc-seance";

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
    "[Consigne de phase — PROVISOIRE] Tu es en phase d’OBSERVATION : tu reformules et tu relies ce que " +
    "dit l’utilisatrice. NE DÉLIVRE PAS encore d’observation nommée ni d’interprétation tranchée — ce " +
    "serait prématuré. Tu poursuis et tu tisses ; tu ne nommes pas.",
  nommer:
    "[Consigne de phase — PROVISOIRE] C’est le moment de NOMMER : délivre une observation juste et " +
    "légèrement inconfortable, ce que la personne est prête à entendre. (La forme complète — hypothèse " +
    "réfutable, brièveté — relève de la voix, Story 2.8.)",
  clore:
    "[Consigne de phase — PROVISOIRE] C’est TOI qui clos la séance, en un seul tour, dans ton registre " +
    "normal — l’utilisatrice n’a jamais à s’extraire (FR-008). Pas de récapitulatif, pas de conclusion " +
    "enveloppante : tu proposes simplement d’en rester là, sans dramatiser. Repère de ton : « on en a " +
    "assez fait pour ce soir ». Le bilan est posé séparément, comme un document — ne le rédige pas ici.",
};

/** Dérive la consigne système de la phase, ou `null` s'il n'y a rien à contraindre (construire). */
export function consignePhaseArc(phase: Phase): MessageIa | null {
  const contenu = CONSIGNES[phase];
  return contenu ? { role: "system", content: contenu } : null;
}

/**
 * LA CONSIGNE DE PHASE DE **CE** TOUR — et la raison pour laquelle ce n'est pas `consignePhaseArc`
 * seule (revue des Epics 1 à 4).
 *
 * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
 *
 * `clore` est TERMINAL : « aucune transition sortante — l'arc ne rouvre jamais » (AC1). La phase vaut
 * donc `clore` pour toujours, et la route injectait la consigne dérivée de la phase à CHAQUE tour.
 * Une fois la première séance close, Anam recevait l'ordre de clore la séance à tous les tours
 * suivants — un mois plus tard, pour un premier message de la journée, elle répondait « on en a
 * assez fait pour ce soir ».
 *
 * Les tours d'après la première séance existent pourtant : c'est l'allocation résiduelle (3.4). Ce
 * ne sont pas des séances, et rien ne doit y ordonner de clore.
 *
 * ══ LA RÈGLE ════════════════════════════════════════════════════════════════════════════════════
 *
 * La consigne `clore` vaut pour LE tour qui clôt, pas pour tous ceux d'après. Le tour qui clôt est
 * celui qui porte le beat `cloture` — émis UNE seule fois, sur la transition `nommer → clore`. C'est
 * exactement la condition qui décide déjà du bilan : une seule horloge pour « ce tour EST la clôture »
 * (AD-17), au lieu de deux lectures qui finiraient par diverger.
 *
 * `clotureAutorisee` reste la garde de détresse (AD-9) : en détresse, la séance CESSE d'être une
 * séance — aucune consigne de clôture, le protocole prend le relais.
 */
export function consignePhaseDuTour(
  arc: { readonly etat: { readonly phase: Phase }; readonly beat: BeatArc } | null,
  clotureAutorisee: boolean,
): MessageIa | null {
  if (!arc) return null;
  if (arc.etat.phase !== "clore") return consignePhaseArc(arc.etat.phase);
  return arc.beat === "cloture" && clotureAutorisee ? consignePhaseArc("clore") : null;
}

