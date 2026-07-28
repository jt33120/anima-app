import "server-only"; // la décision est serveur (lit episode_detresse via admin) — jamais au client
import type { ReactNode } from "react";
import { limitesCommercialesLevees } from "@/lib/safety/limites-commerciales";

/**
 * GardeCommerciale — la GARDE DE MONTAGE (Story 2.5, AD-9). Enveloppe TOUTE UI commerciale
 * (paywall, bandeau de quota, carte d'abonnement, bilan) : tant que `limites_levees` est vrai
 * (épisode de détresse ouvert, FR-043), elle **refuse de monter** ses enfants — y compris sur un
 * compte gratuit à quota épuisé. Aucun commerce n'atteint une personne en détresse.
 *
 * Vit dans `app/` (composition applicative), PAS dans `render/` : `render/` est l'adaptateur de
 * SCÈNE, muet et sans accès `lib/safety` (AD-7/AD-10). La garde CONSOMME le prédicat serveur
 * `limitesCommercialesLevees` (`lib/safety`), qui dérive de `episode_detresse.fin IS NULL` (source
 * unique, Story 2.4) et penche vers la protection en cas de panne (repli sûr, AD-15). La garde ne
 * décide rien elle-même.
 *
 * `_commerce` = dossier privé (jamais une route). COUTURE (inerte jusqu'à son consommateur) : aucune
 * UI commerciale n'existe encore. Story 2.9 (bilan/paywall sous la clôture) et Epic 3 (Stripe)
 * l'envelopperont — la garde prospective (`tests/garde-commerciale.test.ts`) rejette toute UI
 * commerciale non gardée.
 *
 *   <GardeCommerciale utilisatriceId={user.id}>
 *     <Paywall … />
 *   </GardeCommerciale>
 */
export async function GardeCommerciale({
  utilisatriceId,
  children,
}: {
  utilisatriceId: string;
  children: ReactNode;
}) {
  const levees = await limitesCommercialesLevees(utilisatriceId);
  if (levees) return null; // limites levées → le commerce refuse de se monter (FR-043)
  return <>{children}</>;
}
