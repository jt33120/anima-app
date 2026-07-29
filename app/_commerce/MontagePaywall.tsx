import "server-only"; // décision serveur (via GardeCommerciale → lib/safety) — jamais au client
import { GardeCommerciale } from "./GardeCommerciale";

/**
 * MontagePaywall — le POINT DE MONTAGE GARDÉ du paywall (Story 2.9, AC4). Le paywall se monte
 * UNIQUEMENT sous le bilan de clôture et UNIQUEMENT hors détresse. Ici on POSE le placement gardé :
 * la carte (future) est enveloppée dans `<GardeCommerciale>` (AD-9 — refuse de se monter tant que
 * `limites_levees` est vrai, FR-043).
 *
 * DÉFENSE EN PROFONDEUR : le VERROU principal est déjà côté SERVEUR — la route ne produit AUCUN
 * bilan en détresse (`clotureAutorisee = niveauSecurite === 0 && !securite.limitesLevees`) → pas de
 * bilan, donc pas de paywall (AC5). `<GardeCommerciale>` est la seconde couche.
 *
 * ⚠️ VIDE en 2.9 : la CARTE d'abonnement (le prix, « M'abonner »/« Pas maintenant », la garantie
 * FR-089) et Stripe Checkout relèvent de l'Epic 3 / Story 3.2, qui remplit ce point de montage et
 * finalise son positionnement DANS le fil, sous le tour bilan. 2.9 ne pose QUE le placement gardé.
 */
export async function MontagePaywall({ utilisatriceId }: { utilisatriceId: string }) {
  return (
    <GardeCommerciale utilisatriceId={utilisatriceId}>
      {/* Carte d'abonnement (prix, boutons, garantie) — Epic 3 / Story 3.2 remplit ce point de montage. */}
      {null}
    </GardeCommerciale>
  );
}
