import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import { createSupabaseAdminClient } from "./supabase/admin";
import { etatArcInitial, type EtatArc, type Phase } from "@/lib/domain/arc-seance";
import type { DepotSeance } from "@/lib/domain/depot-seance";

/**
 * Dépôt RÉEL de la trace `seance` (Story 2.7, T3) — implémente le port `DepotSeance` défini par le
 * domaine (inversion de dépendance : l'infra dépend de l'abstraction pure, AD-10). Écrit/lit `seance`
 * UNIQUEMENT via les fonctions security definer (service_role, AD-12 : la trace n'est jamais écrite
 * par la cliente). La table n'est qu'un STORE ; toute la logique de phase vit dans `lib/domain`.
 *
 * Repli sûr (AD-15) : une panne RPC ne plante JAMAIS le tour (Anam ne quitte jamais) et penche vers
 * NE PAS franchir un seuil — incident journalisé sans art. 9 (code d'erreur seul, NFR-022) :
 *   • `charger` en échec → état INITIAL (repartir de construire ; jamais fabriquer une progression) ;
 *   • `ecrire` en échec → no-op (l'écriture est perdue ; le prochain tour relira un état antérieur →
 *     l'arc sous-compte, jamais ne sur-avance). Les deux directions protègent : jamais un faux nommer.
 */

interface LigneSeance {
  phase: string;
  sujets_abordes: number;
  a_reponse_longue: boolean;
  reformulations: number;
  confirmations: number;
  elements_personnels: number;
  restitutions: number;
  deux_dernieres_propositions: boolean[] | null;
  observation_delivree: boolean;
  fin_proposee: boolean;
  debut: string;
}

function journaliserIncident(motif: string, detail?: unknown): void {
  const d = detail as { code?: unknown } | undefined;
  const code =
    d && typeof d.code === "string" ? d.code : detail instanceof Error ? detail.name : undefined;
  console.error("seance: indisponibilité du dépôt de trace — repli sûr (AD-15)", { motif, code });
}

function depuisLigne(l: LigneSeance): EtatArc {
  const props = l.deux_dernieres_propositions ?? [false, false];
  return {
    phase: l.phase as Phase,
    sujetsAbordes: l.sujets_abordes,
    aReponseLongue: l.a_reponse_longue,
    reformulationsEmises: l.reformulations,
    confirmations: l.confirmations,
    elementsPersonnels: l.elements_personnels,
    restitutions: l.restitutions,
    deuxDernieresPropositions: [props[0] ?? false, props[1] ?? false],
    observationDelivree: l.observation_delivree,
    finProposee: l.fin_proposee,
    debutMs: new Date(l.debut).getTime(),
  };
}

function versParams(cible: string, etat: EtatArc): Record<string, unknown> {
  return {
    cible,
    p_phase: etat.phase,
    p_sujets_abordes: etat.sujetsAbordes,
    p_a_reponse_longue: etat.aReponseLongue,
    p_reformulations: etat.reformulationsEmises,
    p_confirmations: etat.confirmations,
    p_elements_personnels: etat.elementsPersonnels,
    p_restitutions: etat.restitutions,
    p_deux_dernieres_propositions: etat.deuxDernieresPropositions,
    p_observation_delivree: etat.observationDelivree,
    p_fin_proposee: etat.finProposee,
    p_debut: new Date(etat.debutMs).toISOString(),
  };
}

export function creerDepotSeance(utilisatriceId: string): DepotSeance {
  return {
    async charger() {
      try {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin.rpc("charger_seance", { cible: utilisatriceId });
        if (error) {
          journaliserIncident("charger_seance_echoue", error);
          return etatArcInitial();
        }
        // `setof` → tableau. Vide = aucune trace encore : repartir de construire.
        const lignes = data as LigneSeance[] | null;
        if (!lignes || lignes.length === 0) return etatArcInitial();
        return depuisLigne(lignes[0]);
      } catch (e) {
        journaliserIncident("charger_seance_exception", e);
        return etatArcInitial();
      }
    },

    async ecrire(etat: EtatArc) {
      try {
        const admin = createSupabaseAdminClient();
        const { error } = await admin.rpc("ecrire_seance", versParams(utilisatriceId, etat));
        if (error) journaliserIncident("ecrire_seance_echoue", error);
      } catch (e) {
        journaliserIncident("ecrire_seance_exception", e);
      }
    },
  };
}
