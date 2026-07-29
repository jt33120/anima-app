import type { MessageIa, RequeteIa } from "@/lib/ai/port";
import type { SignauxTour } from "./arc-seance";

/**
 * L'EXTRACTION de signaux d'arc (Story 2.7, T2 — D1) — module PUR (AD-1). Reproduit le split exact
 * de la détresse (`classer-detresse` pur / `detecteur-detresse` serveur) : ICI vivent l'INSTRUCTION
 * structurée + le parser PUR + la construction de requête. Le SEUL I/O — l'appel egress au modèle
 * fort — vit dans le câblage serveur (T4), jamais ici.
 *
 * Deux sources, une seule sortie `SignauxTour` :
 *   - le modèle FORT extrait les signaux SÉMANTIQUES (élément personnel, reformulation, confirmation,
 *     rejet, restitution, sujet nouveau) — parsés par `extraireSignauxArc` (scan tolérant, patron
 *     `extraireFamille` : dernière ligne conforme, insensible à la casse, le doute ne franchit rien) ;
 *   - `reponseLongue` est DÉTERMINISTE (comptage de ponctuations finales), calculée SANS le modèle.
 *
 * ⚠️ `INSTRUCTION_EXTRACTION_ARC` est PROVISOIRE — porte pré-lancement produit/clinique (PRD
 * §Première séance). On code la MACHINE (quels signaux → quelle phase) ; pas le jugement.
 */

/** PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE. Sortie STRUCTURÉE demandée (patron détecteur). */
export const INSTRUCTION_EXTRACTION_ARC = [
  "[PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE SUR DONNÉES RÉELLES]",
  "Tu observes le DERNIER échange d'une séance (le tour de l'utilisatrice et, s'il existe, la dernière",
  "réponse d'Anam). Repère, SANS jamais nommer d'observation ni relancer, la présence des signaux",
  "suivants dans CE dernier échange. Réponds UNIQUEMENT par ces six lignes, chacune `oui` ou `non` :",
  "ELEMENT_PERSONNEL: (l'utilisatrice a livré un élément personnel qu'Anam n'avait pas sollicité)",
  "SUJET_NOUVEAU: (un sujet de vie distinct, pas encore abordé, apparaît)",
  "REFORMULATION: (Anam a reformulé ce que l'utilisatrice a dit)",
  "CONFIRMATION: (l'utilisatrice a confirmé explicitement une reformulation d'Anam)",
  "REJET: (l'utilisatrice a rejeté une proposition ou une interprétation d'Anam)",
  "RESTITUTION: (ce tour relie et restitue un fil déjà tissé plus tôt dans la séance)",
  "En cas de doute, réponds `non` : ne fais jamais franchir un seuil qui n'est pas manifeste.",
].join("\n");

/**
 * `reponseLongue` — DÉTERMINISTE, sans le modèle (FR-004) : plus de 2 ponctuations finales
 * (`. ! ? …`) ⇒ plus de 2 phrases. Les groupes consécutifs (`?!`, `…`) comptent pour une fin,
 * jamais plusieurs.
 */
export function estReponseLongue(texteUtilisateur: string): boolean {
  const finales = texteUtilisateur.match(/[.!?…]+/g);
  return (finales?.length ?? 0) > 2;
}

/**
 * Lit un booléen structuré `CLE: oui|non` dans la sortie du modèle. Scanne TOUTES les occurrences,
 * retient la DERNIÈRE ligne conforme (la conclusion — patron `extraireFamille`). Illisible / absent
 * → `false` : le doute ne franchit aucun seuil (jamais un faux « prêt à nommer »).
 */
function lireBooleen(sortie: string, cle: string): boolean {
  let dernier: boolean | null = null;
  const re = new RegExp(`${cle}\\s*[:=]\\s*(oui|non|yes|no|vrai|faux|true|false|1|0)`, "gi");
  for (const m of sortie.matchAll(re)) {
    const v = m[1].toLowerCase();
    dernier = v === "oui" || v === "yes" || v === "vrai" || v === "true" || v === "1";
  }
  return dernier ?? false;
}

/**
 * Mappe la sortie structurée du modèle fort → `SignauxTour`. `reponseLongue` NE vient PAS du modèle :
 * elle est calculée du `dernierTourUtilisateur` (déterministe). Tous les autres signaux sont parsés
 * de `sortieModele` ; l'absence de lecture claire les laisse à `false`.
 */
export function extraireSignauxArc(sortieModele: string, dernierTourUtilisateur: string): SignauxTour {
  return {
    elementPersonnelNonSollicite: lireBooleen(sortieModele, "ELEMENT_PERSONNEL"),
    sujetDeVieNouveau: lireBooleen(sortieModele, "SUJET_NOUVEAU"),
    reponseLongue: estReponseLongue(dernierTourUtilisateur),
    reformulationEmise: lireBooleen(sortieModele, "REFORMULATION"),
    reformulationConfirmee: lireBooleen(sortieModele, "CONFIRMATION"),
    rejetProposition: lireBooleen(sortieModele, "REJET"),
    restitution: lireBooleen(sortieModele, "RESTITUTION"),
  };
}

/**
 * Construit la requête d'extraction : passe FORT SÉPARÉE, pré-génération (D1 — sûr pour FR-005 :
 * on ne génère pas l'observation tant que observer n'est pas close). `capacite:
 * "reconceptualisation"` ⇒ tier FORT résolu par la politique (jamais léger, AD-5) ; premier usage
 * réel de cette capacité. `contientArt9` ⇒ passe par l'egress-guard art. 9 (jamais l'adaptateur nu).
 *
 * ⚠️ On NE filtre PAS les tours `assistant` (contrairement à `detecteur-detresse`, user-only) :
 * l'arc a BESOIN des reformulations d'Anam. Contrepartie (piège 13) : un client peut forger des
 * tours pour forcer un nommage prématuré — défaut PRODUIT (le gate détresse reste non-forgeable,
 * verdict serveur). Durcissement (historique reconstruit serveur) → Epic 4 (deferred-work).
 */
export function requeteExtractionArc(messages: MessageIa[]): RequeteIa {
  return {
    capacite: "reconceptualisation",
    messages: [{ role: "system", content: INSTRUCTION_EXTRACTION_ARC }, ...messages],
    contientArt9: true,
  };
}
