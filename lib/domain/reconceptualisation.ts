import type { MessageIa, RequeteIa } from "@/lib/ai/port";

/**
 * La DÉTECTION de reconceptualisation (Story 4.4, T3) — module PUR (AD-1). Reproduit le split exact de
 * l'extraction d'arc (`signaux-arc`) et de la détresse (`classer-detresse` pur / `detecteur-detresse`
 * serveur) : ICI vivent l'INSTRUCTION structurée + le parser PUR + la construction de requête. Le SEUL
 * I/O — l'appel egress au modèle fort — vit dans l'orchestrateur serveur (`reconceptualisation-pipeline`),
 * jamais ici.
 *
 * Un « moment de reconceptualisation » = l'utilisatrice change de regard sur elle-même (« avant je
 * pensais X, maintenant Y », prise de distance, rupture d'un récit répété). Détecté → un SIGNAL EN
 * ATTENTE (germe de branche, Story 4.5) ; RIEN à l'écran sur l'instant.
 *
 * AC5 — reconceptualisation ≠ détresse : ce module N'IMPORTE et NE référence AUCUN module de détresse.
 * Ce sont deux évaluations distinctes du pipeline (la sécurité PRODUIT le verdict ; la reconceptualisation
 * le CONSOMME en amont, côté orchestrateur).
 *
 * ⚠️ `INSTRUCTION_RECONCEPTUALISATION` est un PLACEHOLDER — porte pré-lancement produit/clinique. On code
 * la MACHINE (sortie structurée → décision → persistance gardée) ; pas le JUGEMENT (quels marqueurs, quelle
 * finesse). À valider sur données réelles avant mise en ligne.
 */

/** PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE SUR DONNÉES RÉELLES. Sortie STRUCTURÉE (patron détecteur). */
export const INSTRUCTION_RECONCEPTUALISATION = [
  "[PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE SUR DONNÉES RÉELLES]",
  "Tu observes le DERNIER échange d’une conversation. Repère, SANS jamais le nommer ni relancer, si",
  "l’utilisatrice vit dans CE dernier échange un moment de RECONCEPTUALISATION — un changement de regard",
  "sur elle-même : « avant je pensais X, maintenant Y », une prise de distance vis-à-vis d’un récit qu’elle",
  "se répétait, la rupture manifeste d’une croyance ancienne sur elle-même.",
  "Ce N’EST PAS un simple sujet nouveau, une émotion, ni une détresse (ça, c’est une autre évaluation).",
  "Réponds UNIQUEMENT par cette ligne, `oui` ou `non` :",
  "RECONCEPTUALISATION: (l’utilisatrice manifeste un tel changement de regard sur elle-même dans ce tour)",
  "En cas de doute, réponds `non` : ne retiens un marqueur que s’il est MANIFESTE — jamais inféré.",
].join("\n");

export interface DecisionReconcept {
  /** Un marqueur de reconceptualisation est-il MANIFESTE dans ce tour ? Le doute → `false`. */
  detecte: boolean;
}

/**
 * Lit le booléen structuré `RECONCEPTUALISATION: oui|non` dans la sortie du modèle. Scanne TOUTES les
 * occurrences, retient la DERNIÈRE ligne conforme (la conclusion — patron `extraireFamille`/`lireBooleen`).
 * Illisible / absent → `false` : le doute ne retient AUCUN marqueur (jamais un faux « moment retenu »).
 */
export function detecterReconceptualisation(sortieModele: string): DecisionReconcept {
  let dernier: boolean | null = null;
  const re = /RECONCEPTUALISATION\s*[:=]\s*(oui|non|yes|no|vrai|faux|true|false|1|0)/gi;
  for (const m of sortieModele.matchAll(re)) {
    const v = m[1].toLowerCase();
    dernier = v === "oui" || v === "yes" || v === "vrai" || v === "true" || v === "1";
  }
  return { detecte: dernier ?? false };
}

/**
 * Construit la requête de détection : passe FORT SÉPARÉE, sous egress art. 9. `capacite:
 * "reconceptualisation"` ⇒ tier FORT résolu par la politique unique (jamais léger, AD-5, AC2).
 * `contientArt9` ⇒ passe par l'egress-guard art. 9 (jamais l'adaptateur nu). On passe le DERNIER échange
 * (l'observation porte sur le tour courant de l'utilisatrice, rattaché ensuite à son entrée de journal exacte).
 */
export function requeteReconceptualisation(messages: MessageIa[]): RequeteIa {
  return {
    capacite: "reconceptualisation",
    messages: [{ role: "system", content: INSTRUCTION_RECONCEPTUALISATION }, ...messages],
    contientArt9: true,
  };
}
