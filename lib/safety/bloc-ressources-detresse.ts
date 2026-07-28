import type { VerdictSecurite } from "./classer-detresse";
import type { FamilleDanger, RessourceAide } from "./ressources-aide";
import { RESSOURCES_AIDE } from "./ressources-aide";

/**
 * bloc-ressources-detresse.ts — le SÉLECTEUR PUR du bloc ressources inséré dans le fil (Story 2.6,
 * AC4). Traduit un `VerdictSecurite` en un bloc ordonné, ou `null` (niveaux 0-1 : rien ajouté au DOM).
 *
 * Consomme la SOURCE UNIQUE `ressources-aide` (2.5) — JAMAIS de liste inline. Placement (UX-DR) :
 *   • niveau 2 → APRÈS le tour d'Anam (elle nomme, puis le bloc se pose) ;
 *   • niveau 3 → AVANT le tour d'Anam ; danger VITAL ⇒ `15/112` EN TÊTE (l'urgence prime), puis la
 *     ressource correspondante (FR-074). Suicide au niveau 3 ⇒ `3114` en tête (« 3114 immédiatement »).
 *
 * Défaut protecteur : niveau ≥ 2 sans famille lisible → `suicide` (l'idéation est le cas majoritaire),
 * jamais un danger fabriqué. ⚠️ L'adéquation des ressources par danger est PROVISOIRE (porte clinique).
 */

export interface BlocRessources {
  /** Où insérer le bloc relativement au tour d'Anam. */
  readonly position: "avant" | "apres";
  /** Famille effective (après défaut protecteur) — pour l'étiquette du bloc. */
  readonly familleAffichee: FamilleDanger;
  /** Ressources ordonnées (références de `RESSOURCES_AIDE`, jamais copiées). */
  readonly ressources: ReadonlyArray<RessourceAide>;
}

/** Ressources correspondantes par famille (par `tel`), dans l'ordre de pertinence (FR-074). */
const PLAN: Record<FamilleDanger, readonly string[]> = {
  suicide: ["3114", "0972394050"], // 3114 d'abord, SOS Amitié en écoute
  urgence_vitale: ["15", "112"],
  violences_femmes: ["3919", "15", "112"],
  enfance: ["119", "15", "112"],
  ecoute: ["0972394050", "3114"],
};

/** Numéros d'urgence vitale (SAMU / urgence européenne). */
const TEL_URGENCE = ["15", "112"] as const;

/** Résout des `tel` vers les objets de la source unique, en préservant l'ordre et sans doublon. */
function resoudre(tels: readonly string[]): RessourceAide[] {
  const vus = new Set<string>();
  const out: RessourceAide[] = [];
  for (const tel of tels) {
    if (vus.has(tel)) continue;
    const r = RESSOURCES_AIDE.find((x) => x.tel === tel);
    if (r) {
      vus.add(tel);
      out.push(r);
    }
  }
  return out;
}

export function blocRessourcesDetresse(verdict: VerdictSecurite): BlocRessources | null {
  if (verdict.niveau < 2) return null; // niveaux 0-1 : bascule non annoncée, aucun élément (AC1)

  const famille: FamilleDanger = verdict.famille ?? "suicide"; // défaut protecteur (jamais fabriqué)
  const position = verdict.niveau >= 3 ? "avant" : "apres";

  let tels: readonly string[] = PLAN[famille];
  // Niveau 3 = danger ACTIF : `15/112` en tête pour TOUTE famille, SAUF suicide (« 3114 immédiatement »,
  // PRD). Couvre urgence_vitale/violences/enfance ET ecoute ; dédoublonné ci-dessous (`resoudre`).
  if (verdict.niveau >= 3 && famille !== "suicide") {
    tels = [...TEL_URGENCE, ...tels];
  }

  return { position, familleAffichee: famille, ressources: resoudre(tels) };
}

/**
 * Le numéro en TÊTE du bloc pour un verdict (ou `null` si aucun bloc). SOURCE UNIQUE partagée avec la
 * consigne (`consigne-detresse`) : la voix d'Anam et la carte citent ainsi TOUJOURS le même numéro
 * (jamais « le 3114 » à l'oral pendant que la carte mène par le 3919 — revue 2.6, R1).
 */
export function numeroEnTete(verdict: VerdictSecurite): string | null {
  return blocRessourcesDetresse(verdict)?.ressources[0]?.numero ?? null;
}
