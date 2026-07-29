import type { NiveauSecurite } from "@/lib/ai/port";
import {
  NIVEAU_DETRESSE_BLOQUANT,
  SEUIL_CONFIRMATIONS,
  SEUIL_ELEMENTS_PERSONNELS,
  SEUIL_REFORMULATIONS,
  SEUIL_RESTITUTIONS,
  SEUIL_SUJETS,
} from "./seuils-arc";

/**
 * La MACHINE d'arc de séance (Story 2.7 — FR-002/003/004/005/007) — logique PURE (AD-1 : 0 I/O,
 * aucune dépendance Next/Supabase/SDK/rendu). PREMIÈRE logique de la couche `lib/domain/`.
 *
 * Elle est le PROPRIÉTAIRE UNIQUE des transitions de phase (AD-8, « fonction de transition unique
 * possédée ») : `render/` et `app/` ne décident jamais d'une phase — la route ne fait que l'appeler
 * et persister la trace (T4). Elle NE peut PAS appeler le modèle (AD-1) : les signaux sémantiques
 * lui sont FOURNIS déjà extraits (`signaux-arc`, à la frontière serveur), et le niveau de détresse
 * lui est FOURNI déjà classé (`securite.verdict.niveau` — une seule horloge, AD-16/AD-17).
 *
 * Invariants durs encodés ici :
 *   - FR-005 : `observationDelivree` ne vaut vrai QUE si la phase est nommer ou clore — toute
 *     tentative de la poser en amont est refusée (« une observation prématurée est un défaut ») ;
 *   - FR-007 : `peutNommer` est une CONJONCTION — un seul manque et Anam diffère (reste observer) ;
 *   - FR-002 : `maintenantMs` ne pilote AUCUNE transition (aucun minuteur) — il n'horodate que le
 *     début de séance (télémétrie), jamais une coupure.
 */

export type Phase = "construire" | "observer" | "nommer" | "clore";

/**
 * Signaux d'UN tour (extraits par le modèle fort + le parser pur `signaux-arc`). Booléens : le doute
 * penche vers NE PAS franchir un seuil (jamais un faux « prêt à nommer »).
 */
export interface SignauxTour {
  /** Un élément personnel non sollicité a été livré (FR-007). */
  elementPersonnelNonSollicite: boolean;
  /** Un sujet de vie distinct, nouveau (FR-004, sortie construire). */
  sujetDeVieNouveau: boolean;
  /** Réponse de plus de 2 phrases (FR-004, déterministe, calculée sans le modèle). */
  reponseLongue: boolean;
  /** Anam a ÉMIS une reformulation (FR-004, sortie observer). */
  reformulationEmise: boolean;
  /** Une reformulation a été CONFIRMÉE explicitement par l'utilisatrice (FR-004 / FR-007). */
  reformulationConfirmee: boolean;
  /** L'utilisatrice a rejeté une proposition d'Anam (FR-007). */
  rejetProposition: boolean;
  /** Ce tour est un moment de RESTITUTION (FR-003). Vit dans la trace, jamais à l'écran. */
  restitution: boolean;
}

/**
 * L'état CROSS-TOUR de l'arc (persisté dans la trace `seance`, T3). Les compteurs ACCUMULENT sur
 * toute la séance (l'arc est stateful). Aucune donnée de profil (prénom/heure) ne l'habite : l'arc
 * n'a AUCUNE précondition de profil (AC1, FR-010).
 */
export interface EtatArc {
  phase: Phase;
  /** Sujets de vie distincts abordés (← `sujetDeVieNouveau`). */
  sujetsAbordes: number;
  /** Au moins une réponse longue est déjà venue (← `reponseLongue`, monotone). */
  aReponseLongue: boolean;
  /** Reformulations émises par Anam (← `reformulationEmise`). */
  reformulationsEmises: number;
  /** Confirmations explicites (← `reformulationConfirmee`, JAMAIS `reformulationEmise`). */
  confirmations: number;
  /** Éléments personnels non sollicités (← `elementPersonnelNonSollicite`). */
  elementsPersonnels: number;
  /** Moments de restitution (← `restitution`). */
  restitutions: number;
  /** Fenêtre glissante [avant-dernier, dernier] du signal `rejetProposition` (FR-007). */
  deuxDernieresPropositions: [boolean, boolean];
  /** L'observation A ÉTÉ délivrée (fait POST-livraison posé par le serveur, T4). FR-005 la garde. */
  observationDelivree: boolean;
  /** Anam a proposé la fin (posé par le serveur en phase clore ; la clôture rendue est la 2.9). */
  finProposee: boolean;
  /** Horodatage de début de séance (télémétrie) — JAMAIS lu pour décider d'une transition (FR-002). */
  debutMs: number;
}

export interface Transition {
  de: Phase;
  vers: Phase;
}

export interface ResultatArc {
  /** Le nouvel état, à persister dans la trace (jamais une mutation de l'entrée). */
  etat: EtatArc;
  /** La transition de phase de CE tour, ou `null` si la phase n'a pas changé. */
  transition: Transition | null;
  /** FR-007 : la conjonction est-elle réunie pour nommer ? (gate de la sortie observer). */
  peutNommer: boolean;
  /** Le beat à faire paraître (2.7 n'émet que « nommer », sur la transition observer → nommer). */
  beat: "nommer" | null;
}

/** Signaux neutres (tous faux) — repli quand aucun signal n'est extractible : l'arc n'avance pas. */
export const SIGNAUX_NEUTRES: SignauxTour = Object.freeze({
  elementPersonnelNonSollicite: false,
  sujetDeVieNouveau: false,
  reponseLongue: false,
  reformulationEmise: false,
  reformulationConfirmee: false,
  rejetProposition: false,
  restitution: false,
});

/** L'état de départ d'une séance : construire, tous compteurs à zéro, aucune donnée de profil. */
export function etatArcInitial(): EtatArc {
  return {
    phase: "construire",
    sujetsAbordes: 0,
    aReponseLongue: false,
    reformulationsEmises: 0,
    confirmations: 0,
    elementsPersonnels: 0,
    restitutions: 0,
    deuxDernieresPropositions: [false, false],
    observationDelivree: false,
    finProposee: false,
    debutMs: 0,
  };
}

/**
 * Avance l'arc d'UN tour. Pur : ne mute pas `etat`, renvoie un nouvel état. Au plus UNE transition
 * de phase par tour (un tour avance au plus d'une phase). `niveauSecurite` est LU du verdict de
 * sécurité (jamais re-détecté). `maintenantMs` n'horodate que le début — il ne pilote rien (FR-002).
 */
export function avancerArc(
  etat: EtatArc,
  signaux: SignauxTour,
  niveauSecurite: NiveauSecurite,
  maintenantMs: number,
): ResultatArc {
  // 1. INGESTION — les compteurs ACCUMULENT sur toute la séance (l'arc est stateful).
  const compteurs = {
    sujetsAbordes: etat.sujetsAbordes + (signaux.sujetDeVieNouveau ? 1 : 0),
    aReponseLongue: etat.aReponseLongue || signaux.reponseLongue,
    reformulationsEmises: etat.reformulationsEmises + (signaux.reformulationEmise ? 1 : 0),
    confirmations: etat.confirmations + (signaux.reformulationConfirmee ? 1 : 0), // ⚠ confirmee, jamais emise
    elementsPersonnels: etat.elementsPersonnels + (signaux.elementPersonnelNonSollicite ? 1 : 0),
    restitutions: etat.restitutions + (signaux.restitution ? 1 : 0),
    // Fenêtre glissante des deux derniers tours : un tour sans rejet pousse `false` → un rejet
    // isolé vieillit tout seul ; DEUX rejets consécutifs bloquent nommer (FR-007). La granularité
    // fine « proposition-ancrée » relève de la voix (2.8), pas de la machine.
    deuxDernieresPropositions: [
      etat.deuxDernieresPropositions[1],
      signaux.rejetProposition,
    ] as [boolean, boolean],
  };

  // 2. peutNommer (FR-007) — la CONJONCTION : un seul manque → false → Anam diffère (reste observer).
  const deuxRejets = compteurs.deuxDernieresPropositions[0] && compteurs.deuxDernieresPropositions[1];
  const peutNommer =
    compteurs.elementsPersonnels >= SEUIL_ELEMENTS_PERSONNELS &&
    compteurs.confirmations >= SEUIL_CONFIRMATIONS &&
    niveauSecurite < NIVEAU_DETRESSE_BLOQUANT &&
    !deuxRejets;

  // 3. TRANSITION — au plus une par tour. Aucune forcée par le TEMPS (FR-002).
  let phase: Phase = etat.phase;
  let transition: Transition | null = null;
  let beat: "nommer" | null = null;

  if (etat.phase === "construire") {
    // FR-004 : ≥ 3 sujets de vie distincts ET ≥ 1 réponse longue.
    if (compteurs.sujetsAbordes >= SEUIL_SUJETS && compteurs.aReponseLongue) {
      phase = "observer";
      transition = { de: "construire", vers: "observer" };
    }
  } else if (etat.phase === "observer") {
    // FR-004 (sortie observer : ≥ 2 reformulations ET ≥ 1 confirmation) ET FR-007 (peutNommer).
    // Le beat « nommer » naît sur CETTE transition, décidée AVANT la génération : l'apparition en
    // Présence encadre la livraison de l'observation, jamais un tour trop tard (AC5).
    const sortieObserver =
      compteurs.reformulationsEmises >= SEUIL_REFORMULATIONS && compteurs.confirmations >= SEUIL_CONFIRMATIONS;
    if (sortieObserver && peutNommer) {
      phase = "nommer";
      transition = { de: "observer", vers: "nommer" };
      beat = "nommer";
    }
  } else if (etat.phase === "nommer") {
    // FR-004 (observation délivrée ET l'utilisatrice y a répondu) ET FR-003 (≥ 3 restitutions avant
    // clore). « observation délivrée ET répondu » = observationDelivree vrai à l'ENTRÉE de ce tour
    // (posée par le serveur au tour précédent, après livraison) + un nouveau tour arrive ici.
    if (etat.observationDelivree && compteurs.restitutions >= SEUIL_RESTITUTIONS) {
      phase = "clore";
      transition = { de: "nommer", vers: "clore" };
    }
  }
  // clore : aucune transition en 2.7 — la clôture RENDUE (bilan, beat Veille, paywall) est la 2.9.

  // 4. FR-005 (INVARIANT DUR) : `observationDelivree` ne vaut vrai QUE si la phase est nommer/clore.
  //    Toute tentative de la poser en amont (construire/observer) est REFUSÉE (forcée à false).
  const observationDelivree = phase === "nommer" || phase === "clore" ? etat.observationDelivree : false;
  //    `finProposee` ne vit que dans clore (Anam propose la fin — clôture rendue en 2.9).
  const finProposee = phase === "clore" ? etat.finProposee : false;

  const etatSuivant: EtatArc = {
    phase,
    ...compteurs,
    observationDelivree,
    finProposee,
    // Horodate le début au 1er tour (télémétrie de durée) ; JAMAIS lu pour une transition (FR-002).
    debutMs: etat.debutMs || maintenantMs,
  };

  return { etat: etatSuivant, transition, peutNommer, beat };
}
