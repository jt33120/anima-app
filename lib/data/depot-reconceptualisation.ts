import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import type { DepotSignalReconcept } from "@/lib/safety/reconceptualisation-pipeline";

/**
 * La proposition EN ATTENTE lue « le lendemain » (Story 4.5). POINTEUR : `signalId` + l'horodatage de
 * création (pour choisir « hier soir » / « l'autre jour »). Le verbatim source (art. 9) n'est PAS remonté
 * en v1 (proposition générique) → surface art. 9 minimale côté app.
 */
export interface PropositionEnAttente {
  readonly signalId: string;
  readonly signalCreeLe: Date;
}

/** Les deux chemins 4.5 posés sur le dépôt du signal : lire la proposition du lendemain, écarter (« Non »). */
export interface DepotProposition45 {
  chargerProposition(): Promise<PropositionEnAttente | null>;
  ecarter(args: { signalId: string }): Promise<void>;
}

/**
 * Dépôt du SIGNAL DE RECONCEPTUALISATION (Story 4.4) sous JWT utilisatrice : la RLS + le write-gate + la
 * garde AD-17 (au point d'écriture) font respecter l'isolation, le consentement et « aucun signal né d'une
 * détresse ». JAMAIS `service_role` (contraste avec `depot-episode`, server-authoritative) — le signal est
 * POSSÉDÉ par l'utilisatrice, et la RPC est `security invoker` (elle a BESOIN de `auth.uid()` pour résoudre
 * l'entrée exacte ET pour `branche_bloquee_par_detresse()`).
 *
 * `client` OPTIONNEL : la détection tourne dans `after()` (post-réponse) — on RÉUTILISE le client JWT déjà
 * authentifié de la route (jeton en mémoire) plutôt que d'en reconstruire un qui devrait relire les cookies
 * d'une requête terminée. Hors route (tests/appels directs), il retombe sur `createSupabaseServerClient()`.
 *
 * NFR-022 : `cle_tour` (idempotence) et tout contenu ne sont JAMAIS loggés ni portés par une erreur en
 * clair — l'erreur ne porte que le code Postgres.
 */
export function creerDepotSignalReconcept(client?: SupabaseClient): DepotSignalReconcept & DepotProposition45 {
  return {
    async enregistrer({ cleTour }: { cleTour: string }): Promise<void> {
      const supabase = client ?? (await createSupabaseServerClient());
      const { error } = await supabase.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour: cleTour });
      if (error) throw new Error(`signal_reconceptualisation.enregistrer: ${error.code ?? "echec"}`);
    },

    // Story 4.5 — la proposition du lendemain (RPC possédée : « le lendemain » + garde détresse côté serveur).
    async chargerProposition(): Promise<PropositionEnAttente | null> {
      const supabase = client ?? (await createSupabaseServerClient());
      const { data, error } = await supabase.rpc("charger_proposition_branche");
      if (error) throw new Error(`signal_reconceptualisation.chargerProposition: ${error.code ?? "echec"}`);
      const ligne = (data as { signal_id: string; signal_cree_le: string }[] | null)?.[0];
      if (!ligne) return null; // aucune proposition (jamais sur l'instant / fenêtre détresse)
      return { signalId: ligne.signal_id, signalCreeLe: new Date(ligne.signal_cree_le) };
    },

    // Story 4.5 — chemin « Non » (en_attente → ecarte, jamais rejoué).
    async ecarter({ signalId }: { signalId: string }): Promise<void> {
      const supabase = client ?? (await createSupabaseServerClient());
      const { error } = await supabase.rpc("ecarter_signal_reconceptualisation", { p_signal_id: signalId });
      if (error) throw new Error(`signal_reconceptualisation.ecarter: ${error.code ?? "echec"}`);
    },
  };
}
