import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, MessageIa, NiveauSecurite } from "@/lib/ai/port";
import type { RaisonRefus } from "@/lib/ai/egress-guard";
import { detecterDetresse } from "./detecteur-detresse";
import { classerDetresse, type DecisionSecurite, type VerdictSecurite } from "./classer-detresse";

/**
 * Pipeline serveur SÉCURITÉ-D'ABORD (Story 2.3, AC1/AC3 ; AD-16). Un unique point ordonné :
 *   1. la DÉTECTION s'exécute EN PREMIER (au modèle fort, sous egress) ;
 *   2. le niveau EFFECTIF = max(détecté, épisode ouvert) — le forçage vaut pour TOUT l'épisode ;
 *   3. l'AUDIT sans art.9 est émis pour chaque classification (FR-078) ;
 *   4. l'épisode est signalé (persisté en Story 2.4 ; placeholder no-op ici).
 * Le verdict peut ANNULER le travail de schéma du tour (`doitExecuterTravailSchema`, FR-037).
 *
 * **Ce module est le SEUL appelant de `detecteur-detresse`** (garde d'architecture, AD-16) : aucun
 * détecteur n'est invoqué hors de ce pipeline.
 */

/**
 * Couture vers Story 2.4 : l'état d'épisode CROSS-TOUR (`episode_detresse`). En 2.3, cette entité
 * n'existe pas encore → `depotEpisodePlaceholder` (honnête : aucun état persistant). En construisant
 * `max(niveau, episodeOuvert ? 1 : 0)` dès maintenant, la 2.4 n'aura qu'à rendre `episodeOuvert()`
 * réel — le forçage « fort pour tout l'épisode » marchera sans refactor.
 */
export interface DepotEpisode {
  episodeOuvert(): Promise<boolean>;
  signaler(niveau: NiveauSecurite): Promise<void>;
}

export const depotEpisodePlaceholder: DepotEpisode = {
  async episodeOuvert() {
    return false; // Story 2.4 : dérive de `episode_detresse.fin IS NULL`
  },
  async signaler() {
    /* Story 2.4 : ouvrir / mettre à jour `episode_detresse` (début, niveau_max, fenêtre 72 h) */
  },
};

/** Enregistrement d'audit SANS art.9 (FR-078, SPINE Opérations) : niveau, décision, tier, (horodaté en base). */
export interface AuditDetresse {
  niveau: NiveauSecurite;
  decision: DecisionSecurite;
  tier: "fort"; // la détection est TOUJOURS au fort (AD-5) — jamais autre chose ici
}

export interface DepsPipeline {
  supabase: SupabaseClient;
  adaptateur: AiPort;
  /** Émet l'audit (l'implémentation route capture utilisatrice_id + clé d'idempotence). */
  emettreAudit: (audit: AuditDetresse) => Promise<void>;
  /** État d'épisode cross-tour (Story 2.4). Défaut : placeholder no-op. */
  depotEpisode?: DepotEpisode;
}

export type ResultatSecurite =
  | { bloque: false; verdict: VerdictSecurite }
  | { bloque: true; raison: RaisonRefus };

export async function evaluerSecuriteDuTour(
  deps: DepsPipeline,
  messages: MessageIa[],
): Promise<ResultatSecurite> {
  // 1. SÉCURITÉ D'ABORD — la détection au modèle fort, avant toute autre écriture du tour (AD-16).
  const detection = await detecterDetresse(
    { supabase: deps.supabase, adaptateur: deps.adaptateur },
    messages,
  );
  if (detection.bloque) {
    // Egress bloqué (consentement / minorité / ZDR) → tour arrêté en amont. Rien classé, pas d'audit.
    return detection;
  }

  // 2. niveauEffectif : le forçage vaut pour TOUT l'épisode (couture 2.4), pas seulement ce tour.
  const depot = deps.depotEpisode ?? depotEpisodePlaceholder;
  const ouvert = await depot.episodeOuvert();
  const niveauEffectif = Math.max(detection.verdict.niveau, ouvert ? 1 : 0) as NiveauSecurite;
  // Niveau inchangé → on préserve le verdict tel quel (dont la décision `repli_sur`). Bumped par un
  // épisode ouvert → on re-dérive un verdict cohérent au niveau effectif.
  const verdict: VerdictSecurite =
    niveauEffectif === detection.verdict.niveau ? detection.verdict : classerDetresse(niveauEffectif);

  // 3. Audit sans art.9, juste après la classification (pas conditionné à la fin du stream).
  await deps.emettreAudit({ niveau: verdict.niveau, decision: verdict.decision, tier: "fort" });

  // 4. Signaler l'épisode (persisté en 2.4 ; placeholder no-op en 2.3).
  if (verdict.niveau >= 1) await depot.signaler(verdict.niveau);

  return { bloque: false, verdict };
}

/**
 * Le VETO (FR-037) : le travail de schéma / contradiction / reconceptualisation ne s'exécute que si
 * le verdict ne l'a pas supprimé. Aucun writer de schéma n'existe encore (Epic 4) — ce prédicat EST
 * le point d'extension : l'écriture de reconceptualisation devra le consulter avant d'écrire.
 */
export function doitExecuterTravailSchema(verdict: VerdictSecurite): boolean {
  return !verdict.supprimerTravailSchema;
}
