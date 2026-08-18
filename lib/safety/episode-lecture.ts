import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import { rpcAvecRepli } from "./rpc-repli";

/**
 * episode-lecture.ts — LA LECTURE PROTÉGÉE DE L'ÉTAT D'ÉPISODE, source unique partagée
 * (Story 2.5, AD-9/AD-15/AD-17). Le forçage du pipeline (dépôt 2.4) ET la garde de montage
 * commerciale (`limitesCommercialesLevees`) doivent TOUJOURS lire le MÊME état avec le MÊME repli
 * sûr — une seule fonction empêche toute désynchronisation (le pire cas : un fail-open de la garde
 * pendant qu'un épisode est ouvert).
 *
 * Depuis la revue des Epics 1 à 4, cet état n'est plus un booléen mais un NIVEAU : `niveau_max` de
 * l'épisode ouvert, 0 sinon. Le booléen historique en DÉRIVE (`> 0`), il n'interroge plus la table
 * de son côté — deux lectures de la même question finissent par ne plus dire la même chose (R1).
 *
 * Repli sûr : le DOUTE protège (force le fort côté pipeline ; suspend le commerce côté garde).
 * `motif` distingue l'appelant dans les incidents journalisés (sans art. 9).
 */
export function episodeDetresseOuvert(utilisatriceId: string, motif: string): Promise<boolean> {
  return niveauPlancherEpisode(utilisatriceId, motif).then((n) => n > 0);
}

/**
 * Le PLANCHER de niveau d'un épisode ouvert = le niveau qu'il a ATTEINT (0 si aucun épisode).
 * Le pipeline force `max(détecté, plancher)` : un repli de fournisseur qui rend niveau 1 ne peut
 * plus faire retomber une idéation active sous le seuil du bloc de numéros d'urgence (revue 1-4).
 *
 * ⚠️ LE REPLI VAUT 1, PAS 3, ET C'EST DÉLIBÉRÉ. Une panne de RPC ne dit rien du niveau ; inventer
 * 3 mettrait en protocole de crise quelqu'un qui va bien, sur un incident réseau. 1 est exactement
 * ce que le booléen donnait avant ce correctif : le repli ne régresse sur rien, et n'invente rien.
 */
export function niveauPlancherEpisode(utilisatriceId: string, motif: string): Promise<number> {
  return rpcAvecRepli(
    "niveau_plancher_episode",
    { cible: utilisatriceId },
    (data) => (typeof data === "number" && data > 0 ? data : 0),
    1, // repli sûr : le doute protège, au niveau que garantissait l'ancien booléen
    motif,
  );
}
