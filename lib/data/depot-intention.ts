import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import type { Intention } from "@/lib/domain/intention";

/**
 * Story 4.10 (T3) — le dépôt du PLAN D'ÉTAPES sous JWT utilisatrice. Patron `depot-branche.ts`.
 *
 * JAMAIS `service_role`, JAMAIS `.from("intention")` direct : tout passe par des RPC possédées
 * (`security invoker`), donc sous RLS. Les gardes — premium, consentement art. 9, barrière de minorité,
 * AD-17, appartenance de la branche — vivent dans le WITH CHECK des policies (migration 0036) ; ce
 * dépôt n'est qu'un adaptateur, et il ne re-décide rien.
 *
 * ⚠️ CE QUE CE DÉPÔT NE FAIT PAS, ET QUI EST UNE DÉCISION :
 *
 *   • IL NE TRIE PAS. `charger_plan` rend le plan dans son ordre total et stable (rang puis id) ; retrier
 *     ici ferait un SECOND ordre, et deux ordres finissent toujours par diverger — le défaut corrigé
 *     en 0033. On recopie la liste telle qu'elle vient.
 *
 *   • IL NE CONFOND PAS LE REFUS ET LA PANNE. Une UPDATE ou un DELETE bloqués par la RLS NE LÈVENT
 *     RIEN : ils renvoient zéro ligne. `reviser` et `retirer` rendent donc un booléen — « quelque chose
 *     a-t-il bougé ? » — et une erreur Postgres reste une erreur. Confondre les deux ferait annoncer
 *     « c'est enregistré » à quelqu'un dont rien n'a été enregistré (leçon 4.9/T5).
 *
 * NFR-022 : le `declencheur` et l'`action` (art. 9) ne sont JAMAIS loggés ni portés par une erreur —
 * l'erreur ne porte que le code Postgres. Ils REMONTENT en donnée (le plan s'affiche à la propriétaire),
 * ce qui est l'affichage légitime, distinct de NFR-022.
 */

export interface DepotIntention {
  /** Le plan d'une branche, dans l'ordre que la BASE donne. Jamais retrié ici. */
  chargerPlan(args: { brancheId: string }): Promise<Intention[]>;
  /** Ajoute une étape ; rend son identifiant. Lève si la garde d'écriture a refusé (la RPC lève). */
  ajouter(args: {
    brancheId: string;
    declencheur: string;
    action: string;
    echeance: string | null;
  }): Promise<string>;
  /** `false` = refusée ou introuvable (zéro ligne touchée), jamais une panne. */
  reviser(args: {
    intentionId: string;
    declencheur: string;
    action: string;
    echeance: string | null;
  }): Promise<boolean>;
  /** `false` = introuvable ou non possédée. Suppression FRANCHE : aucun tombstone (AD-18 ne s'applique pas). */
  retirer(args: { intentionId: string }): Promise<boolean>;
}

export function creerDepotIntention(client?: SupabaseClient): DepotIntention {
  const clientOu = async () => client ?? (await createSupabaseServerClient());

  return {
    async chargerPlan({ brancheId }): Promise<Intention[]> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("charger_plan", { p_branche: brancheId });
      if (error) throw new Error(`intention.chargerPlan: ${error.code ?? "echec"}`);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        declencheur: r.declencheur as string,
        action: r.action as string,
        // `null` et pas `undefined` : c'est ce que la base rend, et le rendu distingue « pas d'échéance »
        // d'un champ absent.
        echeance: (r.echeance as string) ?? null,
        rang: Number(r.rang),
      }));
    },

    async ajouter({ brancheId, declencheur, action, echeance }): Promise<string> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("ajouter_intention", {
        p_branche: brancheId,
        p_declencheur: declencheur,
        p_action: action,
        p_echeance: echeance,
      });
      if (error) throw new Error(`intention.ajouter: ${error.code ?? "echec"}`);
      // Une RPC qui rend un identifiant vide alors qu'elle n'a pas levé serait un succès fantôme : on
      // refuse de le propager comme un succès.
      if (typeof data !== "string" || data.length === 0) throw new Error("intention.ajouter: sans_identifiant");
      return data;
    },

    async reviser({ intentionId, declencheur, action, echeance }): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("reviser_intention", {
        p_intention: intentionId,
        p_declencheur: declencheur,
        p_action: action,
        p_echeance: echeance,
      });
      if (error) throw new Error(`intention.reviser: ${error.code ?? "echec"}`);
      return data === true;
    },

    async retirer({ intentionId }): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("retirer_intention", { p_intention: intentionId });
      if (error) throw new Error(`intention.retirer: ${error.code ?? "echec"}`);
      return data === true;
    },
  };
}
