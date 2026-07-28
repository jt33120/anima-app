import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import { episodeDetresseOuvert } from "./episode-lecture";

/**
 * limites-commerciales.ts — La garde de MONTAGE `limites_levees` (Story 2.5, AD-9/AD-17).
 *
 * `limites_levees` DÉRIVE de `episode_detresse.fin IS NULL` (source unique, Story 2.4) : un épisode
 * OUVERT lève les limites. Tant qu'elles sont levées, le paywall, le bandeau de quota, la carte
 * d'abonnement et le bilan REFUSENT de se monter (garde technique, FR-043) — y compris sur un compte
 * gratuit à quota épuisé. Lu côté serveur via `episode_detresse_ouvert` (service_role, admin).
 *
 * ⚠️ NE PAS confondre avec la fenêtre 72 h (`fenetre_expire_at`) : `limites_levees` = épisode OUVERT
 * SEULEMENT (s'arrête à l'extinction) ; la fenêtre 72 h ne gouverne QUE la garde de branche (2.4).
 * Une seule horloge par concern (AD-17).
 *
 * Repli sûr (AD-15) : panne RPC → `true` (le DOUTE suspend le commerce — jamais de paywall sur un
 * possible épisode invisible). Fail-safe PROTECTEUR, l'exact contraire d'un fail-open. `render/`
 * consomme ce booléen sans le dériver : la décision vit ICI, jamais dans le rendu (AD-7).
 */
export function limitesCommercialesLevees(utilisatriceId: string): Promise<boolean> {
  // `limites_levees` = épisode ouvert (`fin IS NULL`) — MÊME lecture que le forçage du pipeline
  // (source unique `episode-lecture`, jamais deux dérivations qui pourraient diverger en fail-open).
  return episodeDetresseOuvert(utilisatriceId, "limites_commerciales");
}
