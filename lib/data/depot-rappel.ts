import "server-only";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { assemblerRappel, type DepotRappel, type FaitDate, type Rappel } from "@/lib/domain/rappel";

/**
 * Dépôt du RAPPEL OPPORTUN (AD-8, côté lecture) sous JWT utilisatrice : la RLS fait respecter l'isolation
 * (AD-12). JAMAIS `service_role` — le résumé glissant et les faits sont POSSÉDÉS par l'utilisatrice (comme
 * le journal/les faits). `contenu` est art. 9 → jamais loggé ni porté par une erreur en clair (NFR-022) :
 * l'erreur ne porte que le code Postgres.
 *
 * Lecture des faits via l'unique fonction possédée `charger_faits_rappelables` (security invoker → RLS +
 * prédicat `public.fait_est_vivant` s'appliquent — le MÊME que l'écran et la synthèse, revue Epic 6 R1) : le littéral de table `fait_extrait` reste banni côté applicatif
 * (garde 4.2 préservée). Le résumé glissant est lu/écrit sur SA table (patron `depot-journal`), confiné ici.
 * L'assemblage (tri, sélection, non-invention) vit dans le domaine PUR `assemblerRappel`.
 */
export function creerDepotRappel(utilisatriceId: string): DepotRappel {
  return {
    async assembler(limite?: number): Promise<Rappel> {
      const supabase = await createSupabaseServerClient();
      const [resumeRes, faitsRes] = await Promise.all([
        supabase.from("resume_glissant").select("contenu").maybeSingle(),
        supabase.rpc("charger_faits_rappelables"),
      ]);
      if (resumeRes.error) throw new Error(`resume_glissant.lire: ${resumeRes.error.code ?? "echec"}`);
      if (faitsRes.error) throw new Error(`charger_faits_rappelables: ${faitsRes.error.code ?? "echec"}`);
      const faits: FaitDate[] = (faitsRes.data ?? []).map(
        (f: { cle_dedoublonnage: string; contenu: string; statut: string; cree_le: string; maj_le: string }) => ({
          cleDedoublonnage: f.cle_dedoublonnage,
          contenu: f.contenu,
          // ⚠️ LE STATUT DESCEND, IL N'EST PLUS TAMPONNÉ (revue Epic 6, R1). Cette ligne disait
          // `statut: "actif" as const` parce que la RPC ne rendait pas la colonne — ce qui rendait
          // le filtre du domaine INATTEIGNABLE : deux défenses qui se couvraient l'une l'autre, et
          // dont aucun test ne pouvait distinguer laquelle travaillait.
          statut: f.statut as FaitDate["statut"],
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
