"use server";

import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotSeuil } from "@/lib/data/depot-seuil";

/**
 * marquer-franchissement.ts — LE SEUIL VIENT D'ÊTRE FRANCHI (H4, migration 0078).
 *
 * ── POURQUOI UNE SERVER ACTION, ET PAS LE RENDU DE LA PAGE ────────────────────────────────────
 *
 * Parce que « rendu » et « franchi » ne sont pas la même chose. Le seuil est rendu à CHAQUE
 * chargement — c'est la région d'entrée de la scène. Poser la date au rendu la poserait à la
 * première ouverture, y compris pour quelqu'un qui referme l'onglet sans avoir rien lu : le texte
 * d'orientation serait perdu sans avoir jamais été vu. C'est exactement le défaut que la 0045 a
 * corrigé pour la mention du socle, et il se serait reproduit ici à l'identique.
 *
 * Le client sait ce que le serveur ne saura jamais : que le bouton a été poussé. C'est donc lui qui
 * déclenche, et il ne peut le faire que par ici, sous sa propre session (AD-12, jamais
 * `service_role`).
 *
 * ── CE QU'ELLE NE DÉCIDE PAS ──────────────────────────────────────────────────────────────────
 *
 * Rien. L'unicité (« la date du PREMIER passage ») est RÉAFFIRMÉE dans `marquer_seuil_franchi()`
 * par un `where seuil_franchi_le is null` sous verrou : `authenticated` a le grant d'exécution,
 * donc une garde qui vivrait seulement ici serait contournable par un POST sur `/rest/v1/rpc/`.
 *
 * ── ET SI ELLE ÉCHOUE ? ───────────────────────────────────────────────────────────────────────
 *
 * On avale, et on entre quand même. Le pire cas est de relire une présentation déjà lue ; refuser
 * d'ouvrir la porte parce qu'on n'a pas su écrire une date serait hors de proportion.
 */
export async function marquerSeuilFranchi(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await creerDepotSeuil(supabase).marquerFranchi();
  } catch (e) {
    console.error("[seuil] la date de franchissement n’a pas pu être posée — le texte sera redit", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
  }
}
