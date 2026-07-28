import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import type { NiveauSecurite } from "@/lib/ai/port";
import type { DepotEpisode, EtatLimites } from "./pipeline";
import { DUREE_MIN_EPISODE_MS, FENETRE_POST_EPISODE_MS, SEUIL_TOURS_SURS } from "./episode-detresse";

/**
 * Dépôt RÉEL d'épisode de détresse (Story 2.4) — rend concrète la couture `DepotEpisode` laissée par
 * la 2.3. Écrit/lit `episode_detresse` UNIQUEMENT via les fonctions security definer (service_role,
 * tâche système AD-12 : l'épisode n'est jamais écrit par la cliente). Les SEUILS viennent du pur
 * `episode-detresse` (jamais figés dans le SQL).
 *
 * Repli sûr (AD-15) : une panne RPC ne plante JAMAIS le tour (Anam ne quitte jamais, FR-039) et
 * penche vers la PROTECTION — incident journalisé sans art. 9 (code d'erreur seul, NFR-022) :
 *   • `enregistrerTour` en échec → `limitesLevees = true` (le doute lève les limites : jamais de
 *     paywall sur un possible épisode, FR-043) ;
 *   • `episodeOuvert` en échec → `true` (suppose ouvert → force le fort, AD-5).
 */

/** Seuils d'extinction en unités SQL (secondes), lus une fois depuis le pur. */
const P_SEUIL_TOURS = SEUIL_TOURS_SURS;
const P_DUREE_MIN_S = DUREE_MIN_EPISODE_MS / 1000;
const P_FENETRE_S = FENETRE_POST_EPISODE_MS / 1000;

function journaliserIncidentSecurite(motif: string, e?: unknown): void {
  console.error("securite: indisponibilité du dépôt d'épisode — repli sûr (AD-15)", {
    motif,
    nom: e instanceof Error ? e.name : undefined,
  });
}

export function creerDepotEpisode(utilisatriceId: string): DepotEpisode {
  return {
    async episodeOuvert(): Promise<boolean> {
      try {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin.rpc("episode_detresse_ouvert", { cible: utilisatriceId });
        if (error) {
          journaliserIncidentSecurite("episode_ouvert_echoue");
          return true; // repli : suppose ouvert → force le fort
        }
        return data === true;
      } catch (e) {
        journaliserIncidentSecurite("episode_ouvert_exception", e);
        return true;
      }
    },

    async enregistrerTour(niveauDetecte: NiveauSecurite): Promise<EtatLimites> {
      try {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin.rpc("enregistrer_tour_detresse", {
          cible: utilisatriceId,
          p_niveau: niveauDetecte,
          p_seuil_tours: P_SEUIL_TOURS,
          p_duree_min_s: P_DUREE_MIN_S,
          p_fenetre_s: P_FENETRE_S,
        });
        if (error) {
          journaliserIncidentSecurite("enregistrer_tour_echoue");
          return { limitesLevees: true }; // le doute lève les limites (jamais de paywall en détresse)
        }
        return { limitesLevees: data === true };
      } catch (e) {
        journaliserIncidentSecurite("enregistrer_tour_exception", e);
        return { limitesLevees: true };
      }
    },
  };
}
