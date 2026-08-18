import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import type { NiveauSecurite } from "@/lib/ai/port";
import type { DepotEpisode, EtatLimites } from "./pipeline";
import { DUREE_MIN_EPISODE_MS, FENETRE_POST_EPISODE_MS, SEUIL_TOURS_SURS } from "./episode-detresse";
import { rpcAvecRepli } from "./rpc-repli";
import { niveauPlancherEpisode } from "./episode-lecture";

/**
 * Dépôt RÉEL d'épisode de détresse (Story 2.4) — rend concrète la couture `DepotEpisode` laissée par
 * la 2.3. Écrit/lit `episode_detresse` UNIQUEMENT via les fonctions security definer (service_role,
 * tâche système AD-12 : l'épisode n'est jamais écrit par la cliente). Les SEUILS viennent du pur
 * `episode-detresse` (jamais figés dans le SQL). Le repli sûr partagé vit dans `rpc-repli` (2.5).
 *
 * Repli sûr (AD-15) : une panne RPC ne plante JAMAIS le tour (Anam ne quitte jamais, FR-039) et
 * penche vers la PROTECTION — incident journalisé sans art. 9 (code d'erreur seul, NFR-022) :
 *   • `enregistrerTour` en échec → `limitesLevees = true` (le doute lève les limites : jamais de
 *     paywall sur un possible épisode, FR-043) ;
 *   • `plancherEpisode` en échec → `1` (suppose un épisode ouvert → force le fort, AD-5).
 */

/** Seuils d'extinction en unités SQL (secondes entières — un seuil clinique non-multiple de 1000 ms
 *  ne doit jamais produire un float pour un paramètre Postgres `int`). */
const P_SEUIL_TOURS = SEUIL_TOURS_SURS;
const P_DUREE_MIN_S = Math.round(DUREE_MIN_EPISODE_MS / 1000);
const P_FENETRE_S = Math.round(FENETRE_POST_EPISODE_MS / 1000);

/**
 * `cleTour` = jeton de tour LOGIQUE (`cleIdempotence`, 3.4), baqué à la construction (patron
 * `emettreAudit`/`creerDepotJournal` de la route). Rend `enregistrer_tour_detresse` idempotente au
 * « Réessayer » (Story 2-4b) : un rejeu du même tour SÛR ne re-compte pas → jamais d'extinction
 * prématurée (AD-16/AD-17). L'interface `DepotEpisode` du pipeline reste inchangée — l'idempotence est
 * un détail de la couche data (AD-1).
 */
export function creerDepotEpisode(utilisatriceId: string, cleTour: string): DepotEpisode {
  return {
    // Le niveau ATTEINT par l'épisode ouvert (0 sinon) — repli 1, le doute protège. MÊME lecture
    // que la garde de montage commerciale (source unique `episode-lecture`, jamais deux dérivations
    // divergentes : le booléen commercial DÉRIVE de ce même plancher).
    plancherEpisode: () =>
      niveauPlancherEpisode(utilisatriceId, "plancher_episode") as Promise<NiveauSecurite>,

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
          p_cle_tour: cleTour, // idempotence au retry (2-4b) : rejeu du même tour sûr → no-op
        },
        (data) => ({ limitesLevees: data === true }),
        { limitesLevees: true },
        "enregistrer_tour",
      ),
  };
}
