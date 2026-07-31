import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";
import { phraseProposition } from "@/lib/domain/branche";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";

/**
 * Story 4.5 (T4) — l'orchestrateur d'OUVERTURE : « y a-t-il, le lendemain, un moment à proposer en branche ? ».
 * Compose la LECTURE possédée (`chargerProposition`, qui applique « le lendemain » + la garde détresse côté
 * serveur) et la VOIX pure (`phraseProposition`). Appelé par `app/page.tsx` (Server Component sous JWT) au
 * franchissement du seuil, APRÈS la garde onboarding.
 *
 * REPLI SÛR : toute panne → `null`. La proposition est un bonus ; jamais elle ne bloque l'ouverture de la
 * scène (aucun 500). L'incident est journalisé sans art. 9 (NFR-022). La prop passée au client ne porte que
 * le `signalId` + une phrase GÉNÉRIQUE — aucun verbatim art. 9.
 */
export interface PropositionOuverture {
  readonly signalId: string;
  readonly phrase: string;
}

export async function chargerPropositionOuverture(
  supabase: SupabaseClient,
  maintenant: Date = new Date(),
): Promise<PropositionOuverture | null> {
  try {
    const p = await creerDepotSignalReconcept(supabase).chargerProposition();
    if (!p) return null;
    return { signalId: p.signalId, phrase: phraseProposition({ signalCreeLe: p.signalCreeLe, maintenant }) };
  } catch (e) {
    journaliserIncidentSecurite("ouverture_proposition_branche", e);
    return null;
  }
}
