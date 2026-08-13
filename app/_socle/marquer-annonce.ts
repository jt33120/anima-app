"use server";

import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotArbitrage } from "@/lib/data/depot-arbitrage";

/**
 * marquer-annonce.ts — LA MENTION DE COMPLÉTION A ATTEINT L'ÉCRAN (revue du 2026-08-12, B3).
 *
 * ── POURQUOI UNE SERVER ACTION, ET PAS UN RENDU ───────────────────────────────────────────────
 *
 * Parce que « rendu » et « lu » ne sont pas la même chose, et que la migration 0040 avait confondu
 * les deux : la mention se dépensait dans `app/page.tsx`, y compris quand la conversation était
 * rendue dans une région `inert` que personne ne voit. Une seule chance dans la vie d'un compte,
 * dépensée par un rendu.
 *
 * Le client sait ce que le serveur ne saura jamais : que la région portant la phrase est ACTIVE.
 * C'est donc lui qui déclenche la dépense — et il ne peut le faire que par ici, sous sa propre
 * session (AD-12, jamais `service_role`).
 *
 * ── CE QU'ELLE NE FAIT PAS ────────────────────────────────────────────────────────────────────
 *
 * Elle ne décide rien. Toutes les conditions (heure présente, thème recalculé, hors épisode de
 * détresse, jamais dite) sont RÉAFFIRMÉES dans `marquer_annonce_socle_dite()` — c'est la leçon
 * centrale de cette revue : `authenticated` a le grant d'exécution, donc une garde qui vivrait
 * seulement ici serait contournable par un POST direct sur `/rest/v1/rpc/`.
 *
 * ── ET SI ELLE ÉCHOUE ? ───────────────────────────────────────────────────────────────────────
 *
 * On avale. La mention reste due, elle sera redite au prochain chargement. C'est l'arbitrage écrit
 * dans 0045 : entendre deux fois une phrase chaleureuse est un accroc ; ne jamais l'entendre après
 * être allée chercher son acte de naissance à la mairie, c'est la story qui ne tient pas.
 */
export async function marquerAnnonceSocleDite(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await creerDepotArbitrage(supabase).marquerAnnonceSocleDite();
  } catch (e) {
    console.error("[socle] marquage de la mention impossible — elle reste due", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
  }
}
