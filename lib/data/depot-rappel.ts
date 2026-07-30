import "server-only";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { assemblerRappel, type DepotRappel, type FaitDate, type Rappel } from "@/lib/domain/rappel";

/**
 * Dépôt du RAPPEL OPPORTUN (AD-8, côté lecture) sous JWT utilisatrice : la RLS fait respecter l'isolation
 * (AD-12). JAMAIS `service_role` — le résumé glissant et les faits sont POSSÉDÉS par l'utilisatrice (comme
 * le journal/les faits). `contenu` est art. 9 → jamais loggé ni porté par une erreur en clair (NFR-022) :
 * l'erreur ne porte que le code Postgres.
 *
 * Lecture des faits via l'unique fonction possédée `charger_faits_actifs` (security invoker → RLS + filtre
 * tombstone `statut='actif'` s'appliquent) : le littéral de table `fait_extrait` reste banni côté applicatif
 * (garde 4.2 préservée). Le résumé glissant est lu/écrit sur SA table (patron `depot-journal`), confiné ici.
 * L'assemblage (tri, sélection, non-invention) vit dans le domaine PUR `assemblerRappel`.
 */
export function creerDepotRappel(utilisatriceId: string): DepotRappel {
  return {
    async assembler(limite?: number): Promise<Rappel> {
      const supabase = await createSupabaseServerClient();
      const [resumeRes, faitsRes] = await Promise.all([
        supabase.from("resume_glissant").select("contenu").maybeSingle(),
        supabase.rpc("charger_faits_actifs"),
      ]);
      if (resumeRes.error) throw new Error(`resume_glissant.lire: ${resumeRes.error.code ?? "echec"}`);
      if (faitsRes.error) throw new Error(`charger_faits_actifs: ${faitsRes.error.code ?? "echec"}`);
      const faits: FaitDate[] = (faitsRes.data ?? []).map(
        (f: { cle_dedoublonnage: string; contenu: string; cree_le: string; maj_le: string }) => ({
          cleDedoublonnage: f.cle_dedoublonnage,
          contenu: f.contenu,
          statut: "actif" as const, // `charger_faits_actifs` ne renvoie QUE des actif (le filtre pur reste le 2e niveau)
          creeLe: f.cree_le,
          majLe: f.maj_le,
        }),
      );
      return assemblerRappel({ resume: resumeRes.data?.contenu ?? null, faits, limite });
    },

    async enregistrerResume(contenu: string): Promise<void> {
      const supabase = await createSupabaseServerClient();
      // Upsert (un résumé par utilisatrice, patron `depot-journal`). L'id est passé à la construction ;
      // backstop RLS : `auth.uid() = utilisatrice_id` rejette tout mismatch. `maj_le` est tenu par la BASE
      // (trigger `resume_glissant_touch_maj`, revue 4.3 D) — jamais l'horloge cliente (monotonie, maj_le>=cree_le).
      const { error } = await supabase
        .from("resume_glissant")
        .upsert({ utilisatrice_id: utilisatriceId, contenu }, { onConflict: "utilisatrice_id" });
      if (error) throw new Error(`resume_glissant.enregistrer: ${error.code ?? "echec"}`);
    },
  };
}
