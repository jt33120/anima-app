import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import { rpcAvecRepli } from "./rpc-repli";

/**
 * episode-lecture.ts — La lecture PROTÉGÉE « épisode de détresse ouvert ? » (= `fin IS NULL`),
 * SOURCE UNIQUE partagée (Story 2.5, AD-9/AD-15/AD-17). Le forçage du pipeline (dépôt 2.4,
 * `episodeOuvert`) ET la garde de montage commerciale (`limitesCommercialesLevees`) doivent
 * TOUJOURS lire le MÊME booléen avec le MÊME repli sûr — une seule fonction empêche toute
 * désynchronisation (le pire cas : un fail-open de la garde pendant qu'un épisode est ouvert).
 *
 * Repli sûr → `true` : le DOUTE protège (force le fort côté pipeline ; suspend le commerce côté
 * garde). `motif` distingue l'appelant dans les incidents journalisés (sans art. 9).
 */
export function episodeDetresseOuvert(utilisatriceId: string, motif: string): Promise<boolean> {
  return rpcAvecRepli(
    "episode_detresse_ouvert",
    { cible: utilisatriceId },
    (data) => data === true, // `fin IS NULL` ⇒ ouvert (booléen strict)
    true, // repli sûr : le doute protège
    motif,
  );
}
