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
 * PIVOT Story 3.2 : la carte d'abonnement DANS le fil est finalement un composant CLIENT inséré sous
 * le bilan streamé (`render/conversation/CarteAbonnement.tsx`) — un composant SERVEUR ne s'insère pas
 * dans un fil client éphémère. Sa garde AD-9 est le GATE SERVEUR (la route retient la trame `paywall`
 * en détresse/premium), pas cette balise. `MontagePaywall` RESTE donc la couture gardée pour une future
 * surface paywall RENDUE SERVEUR (menu de compte, 3.3+ : « l'abonnement reste atteignable depuis le
 * menu de compte ») — inerte tant que cette surface n'existe pas.
 */
export async function MontagePaywall({ utilisatriceId }: { utilisatriceId: string }) {
  return (
    <GardeCommerciale utilisatriceId={utilisatriceId}>
      {/* Surface paywall rendue serveur (menu de compte, 3.3+) — inerte tant qu'elle n'existe pas. */}
      {null}
    </GardeCommerciale>
  );
}
