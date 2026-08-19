"use server";

import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotEnneagramme } from "@/lib/data/depot-enneagramme";

/**
 * marquer-hypothese.ts — L'HYPOTHÈSE D'ANAM A ATTEINT L'ÉCRAN (Story 5.5, AC2).
 *
 * ── POURQUOI UNE SERVER ACTION, ET PAS UN RENDU ───────────────────────────────────────────────
 *
 * Parce que « rendu » et « lu » ne sont pas la même chose. Ce dépôt l'a payé DEUX FOIS — revue 4.10
 * (`reserver_invitation_integration` consommée par un `router.refresh()`), puis migration 0045
 * (`reserver_annonce_socle_complet` dépensée dans une région `inert` que personne ne voyait).
 * `app/page.tsx` se ré-exécute à chaque rafraîchissement, et la scène monte ses trois régions en
 * permanence.
 *
 * Le client sait ce que le serveur ne saura jamais : que la région portant la phrase est ACTIVE.
 * C'est donc lui qui déclenche la marque — et il ne peut le faire que par ici, sous sa propre
 * session (AD-12, jamais `service_role`).
 *
 * ── ELLE NE DÉCIDE RIEN ───────────────────────────────────────────────────────────────────────
 *
 * L'idempotence (`dite_le is null`), l'appartenance et l'anti-réécriture sont dans la policy et le
 * trigger de 0049. `authenticated` détient les sept privilèges DML : une garde qui vivrait
 * seulement ici serait contournable par un PATCH direct sur `/rest/v1/`.
 *
 * ── ET SI ELLE ÉCHOUE ? ON REDIT ──────────────────────────────────────────────────────────────
 *
 * On avale. L'hypothèse reste `en_attente` et non dite : elle repartira au prochain chargement.
 * C'est la direction du doute écrite en tête de 0049, et elle est l'INVERSE de celle de la mention
 * de complétion — redire une hypothèse est un accroc, ne jamais la dire est la story qui ne tient
 * pas. La mention du socle, elle, n'a qu'une seule chance et s'auto-éteint.
 */
export async function marquerHypotheseDite(hypotheseId: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await creerDepotEnneagramme(user.id, supabase).marquerHypotheseDite({
      hypotheseId,
      maintenant: new Date(),
    });
  } catch (e) {
    // NFR-022 : ni le type, ni l'identifiant ne sortent dans le log — seulement le nom de l'erreur.
    console.error("[enneagramme] marquage de l’hypothèse impossible — elle reste à dire", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
  }
}
