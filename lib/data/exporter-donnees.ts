import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentExport } from "@/lib/domain/export-lisible";

/**
 * exporter-donnees.ts — LA LECTURE DE L'EXPORT (Story 6.6, AC1).
 *
 * ── SOUS LE JWT, ET UNE SEULE PORTE ────────────────────────────────────────────────────────────
 *
 * L'appel part du client PORTEUR DU JWT (AD-12) : c'est `auth.uid()` — donc la session, donc le
 * cookie — qui décide de quel export il s'agit, jamais un identifiant passé en argument. La RPC
 * n'accepte d'ailleurs aucun paramètre : il n'existe aucune façon d'en demander un autre que le sien.
 *
 * ── ⚠️ TROIS REFUS, ET AUCUN NE REND UN DOCUMENT ───────────────────────────────────────────────
 *
 * C'est la leçon payée trois fois dans ce dépôt (4.6, 4.9, puis 6.5) et elle est ici à son maximum
 * de gravité : sur cet écran-là, un document vide ne se lit pas « la lecture a échoué », il se lit
 * « le produit n'a rien de moi » — ou pire, « mes données ont déjà disparu ». On LÈVE, toujours, et
 * la halte affiche un échec franc.
 *
 * NFR-022 : seul le CODE remonte. Le message de Postgres citerait la valeur fautive, c'est-à-dire
 * potentiellement du contenu art. 9 affiché par la porte du diagnostic.
 */
export async function chargerExport(supabase: SupabaseClient): Promise<DocumentExport> {
  const { data, error } = await supabase.rpc("exporter_mes_donnees");

  if (error) throw new Error(`export: ${error.code ?? "echec"}`);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("export: document_absent");
  }

  // Un document sans horodatage n'est pas un document : il ne pourrait ni être daté ni être nommé,
  // et il signalerait que ce qu'on tient n'est pas ce que la RPC construit.
  const doc = data as Record<string, unknown>;
  if (typeof doc.genere_le !== "string") throw new Error("export: document_sans_date");

  return doc as unknown as DocumentExport;
}
