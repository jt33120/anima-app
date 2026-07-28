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

/** Seuils d'extinction en unités SQL (secondes entières — un seuil clinique non-multiple de 1000 ms
 *  ne doit jamais produire un float pour un paramètre Postgres `int`). */
const P_SEUIL_TOURS = SEUIL_TOURS_SURS;
const P_DUREE_MIN_S = Math.round(DUREE_MIN_EPISODE_MS / 1000);
const P_FENETRE_S = Math.round(FENETRE_POST_EPISODE_MS / 1000);

function journaliserIncidentSecurite(motif: string, e?: unknown): void {
  console.error("securite: indisponibilité du dépôt d'épisode — repli sûr (AD-15)", {
    motif,
    nom: e instanceof Error ? e.name : undefined,
  });
}

/**
 * Appelle une RPC sous le client admin et RETOMBE sur `defautSurEchec` à la moindre panne (erreur
 * Supabase OU exception), en journalisant un incident sans art. 9. Le repli sûr des deux méthodes.
 */
async function rpcAvecRepli<T>(
  nomRpc: string,
  args: Record<string, unknown>,
  interpreter: (data: unknown) => T,
  defautSurEchec: T,
  motif: string,
): Promise<T> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(nomRpc, args);
    if (error) {
      journaliserIncidentSecurite(`${motif}_echoue`);
      return defautSurEchec;
    }
    return interpreter(data);
  } catch (e) {
    journaliserIncidentSecurite(`${motif}_exception`, e);
    return defautSurEchec;
  }
}

export function creerDepotEpisode(utilisatriceId: string): DepotEpisode {
  return {
    // Repli : suppose ouvert → force le fort (le doute protège).
    episodeOuvert: () =>
      rpcAvecRepli(
        "episode_detresse_ouvert",
        { cible: utilisatriceId },
        (data) => data === true,
        true,
        "episode_ouvert",
      ),

    // Repli : le doute lève les limites (jamais de paywall en détresse).
    enregistrerTour: (niveauDetecte: NiveauSecurite): Promise<EtatLimites> =>
      rpcAvecRepli(
        "enregistrer_tour_detresse",
        {
          cible: utilisatriceId,
          p_niveau: niveauDetecte,
          p_seuil_tours: P_SEUIL_TOURS,
          p_duree_min_s: P_DUREE_MIN_S,
          p_fenetre_s: P_FENETRE_S,
        },
        (data) => ({ limitesLevees: data === true }),
        { limitesLevees: true },
        "enregistrer_tour",
      ),
  };
}
