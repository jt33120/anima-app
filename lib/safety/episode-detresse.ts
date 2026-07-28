import type { NiveauSecurite } from "@/lib/ai/port";

/**
 * L'épisode de détresse — logique PURE (Story 2.4 ; AD-17, FR-042, FR-046). Aucune I/O, aucun import
 * infra (AD-1/AD-10), sur le patron de `barriere-minorite`. Deux choses vivent ici :
 *   1. la MACHINE D'ÉTAT de la transition d'un tour (ouvre / rehausse / compte / éteint) ;
 *   2. les DEUX dérivations distinctes de l'entité — `limitesLevees` (fin IS NULL) et
 *      `ecritureBrancheBloquee` (ouvert OU dans les 72 h après).
 *
 * ⚠️ Les SEUILS d'extinction (`SEUIL_TOURS_SURS`, `DUREE_MIN_EPISODE_MS`) sont un PLACEHOLDER de
 * seuillage de sécurité — porte pré-lancement clinique (PRD §5), à valider par un professionnel
 * qualifié. La STRUCTURE (une transition unique et possédée) est définitive ; les valeurs, non.
 *
 * Les durées vivent ICI, jamais figées dans le SQL (AD-14 / convention SPINE « paramètres lus à
 * l'exécution ») : la fonction SQL `enregistrer_tour_detresse` les REÇOIT en arguments.
 *
 * Piège central : l'extinction se décide sur le niveau DÉTECTÉ BRUT (0), jamais l'effectif forcé —
 * sinon un épisode ouvert (qui force tout à ≥ 1) ne s'éteint jamais et le paywall reste levé à vie.
 */

/** 72 h (FR-042) — la fenêtre pendant laquelle, après extinction, aucune branche ne peut naître. */
export const FENETRE_POST_EPISODE_MS = 72 * 60 * 60 * 1000;

/** ⚠️ PROVISOIRE (porte clinique) — nombre de tours SÛRS consécutifs requis pour éteindre. */
export const SEUIL_TOURS_SURS = 3;
/** ⚠️ PROVISOIRE (porte clinique) — durée minimale d'un épisode avant toute extinction (jamais trop tôt). */
export const DUREE_MIN_EPISODE_MS = 30 * 60 * 1000; // 30 min

export interface ParamsExtinction {
  /** Tours sûrs consécutifs requis pour éteindre. */
  seuilToursSurs: number;
  /** Durée minimale (ms) écoulée depuis `debut` avant toute extinction. */
  dureeMinMs: number;
}

export const PARAMS_EXTINCTION_DEFAUT: ParamsExtinction = {
  seuilToursSurs: SEUIL_TOURS_SURS,
  dureeMinMs: DUREE_MIN_EPISODE_MS,
};

/** État d'un épisode (miroir des colonnes de `episode_detresse`). `fin === null` ⇒ ouvert. */
export interface EtatEpisode {
  debut: Date;
  niveauMax: NiveauSecurite;
  fin: Date | null;
  fenetreExpireAt: Date | null;
  toursSursConsecutifs: number;
}

/** Action décidée pour un tour — miroir de ce que `enregistrer_tour_detresse` applique atomiquement. */
export type ActionEpisode =
  | { type: "aucune" }
  | { type: "ouvrir"; niveau: NiveauSecurite }
  | { type: "rehausser"; niveauMax: NiveauSecurite }
  | { type: "compter"; toursSurs: number }
  | { type: "eteindre"; fin: Date; fenetreExpireAt: Date };

/**
 * Décide la transition d'UN tour. `episode` = l'épisode OUVERT courant, ou `null` s'il n'y en a pas.
 * `niveauDetecte` = le niveau BRUT du détecteur (pas l'effectif forcé). Pur et déterministe.
 */
export function deciderTransition(
  episode: EtatEpisode | null,
  niveauDetecte: NiveauSecurite,
  maintenant: Date,
  params: ParamsExtinction = PARAMS_EXTINCTION_DEFAUT,
): ActionEpisode {
  const ouvert = episode !== null && episode.fin === null ? episode : null;

  if (niveauDetecte >= 1) {
    // Un tour ≥ 1 ouvre (rien d'ouvert) ou rehausse (déjà ouvert) — dans les deux cas la série sûre casse.
    if (ouvert === null) return { type: "ouvrir", niveau: niveauDetecte };
    const niveauMax = Math.max(ouvert.niveauMax, niveauDetecte) as NiveauSecurite;
    return { type: "rehausser", niveauMax };
  }

  // niveauDetecte === 0
  if (ouvert === null) return { type: "aucune" };

  const toursSurs = ouvert.toursSursConsecutifs + 1;
  const delaiEcoule = maintenant.getTime() - ouvert.debut.getTime() >= params.dureeMinMs;
  if (toursSurs >= params.seuilToursSurs && delaiEcoule) {
    return {
      type: "eteindre",
      fin: maintenant,
      fenetreExpireAt: new Date(maintenant.getTime() + FENETRE_POST_EPISODE_MS),
    };
  }
  return { type: "compter", toursSurs };
}

/** `limites_levees` (AC1) : DÉRIVE de `fin IS NULL` — les limites sont levées TANT QUE l'épisode est ouvert. */
export function limitesLevees(episode: EtatEpisode | null): boolean {
  return episode !== null && episode.fin === null;
}

/**
 * Garde de branche (AC2, FR-042) : bloquée si l'épisode est OUVERT **ou** encore dans les 72 h après
 * son extinction. Plus large que `limitesLevees` (qui, elle, s'arrête à la fermeture).
 */
export function ecritureBrancheBloquee(episode: EtatEpisode | null, maintenant: Date): boolean {
  if (episode === null) return false;
  if (episode.fin === null) return true; // ouvert
  return episode.fenetreExpireAt !== null && maintenant.getTime() < episode.fenetreExpireAt.getTime();
}
