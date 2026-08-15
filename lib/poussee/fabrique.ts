import "server-only";
import { creerAdaptateurWebPush } from "@/lib/poussee/adaptateurs/web-push";
import { clesValides, type ClesVapid } from "@/lib/poussee/vapid";
import type { PortPoussee } from "@/lib/poussee/port";

/**
 * LA FABRIQUE du port de poussée, et son boot-guard. Patron de `lib/courriel/fabrique.ts`.
 *
 * Sans clés VAPID, on ne retombe PAS sur un adaptateur factice : les poussées seraient silencieusement
 * avalées, le job les compterait comme parties, la réservation du jour serait consommée, et personne ne
 * saurait rien. Une panne muette coûte plus cher qu'une panne bruyante — et bien plus encore quand elle
 * se déguise en succès. On rend donc un port qui dit `estConfigure() === false` et qui LÈVE si on
 * l'appelle quand même ; le job interroge `estConfigure()` avant toute réservation.
 */

const NON_CONFIGURE: PortPoussee = {
  estConfigure: () => false,
  async reveiller(): Promise<never> {
    throw new Error("poussee_non_configuree");
  },
};

/**
 * Les clés telles que l'environnement les déclare. Séparé de la fabrique parce que la ROUTE
 * d'abonnement a besoin de la clé PUBLIQUE seule (l'abonnée en a besoin pour souscrire) sans construire
 * d'adaptateur.
 */
export function clesVapidDeclarees(): ClesVapid | null {
  const cles = {
    publique: process.env.VAPID_CLE_PUBLIQUE?.trim(),
    privee: process.env.VAPID_CLE_PRIVEE?.trim(),
    sujet: process.env.VAPID_SUJET?.trim(),
  };
  return clesValides(cles) ? cles : null;
}

export function creerPortPoussee(): PortPoussee {
  // ── SOUS VITEST, JAMAIS L'ADAPTATEUR RÉEL (leçon de la revue 4.9, T4-3) ────────────────────────────
  //
  // Là-bas, une suite de tests avait envoyé du VRAI courrier : la route de l'ordonnanceur appelait le
  // vrai registre, donc la vraie fabrique, pendant qu'un test SQL créait des candidates éligibles dans
  // la même base. Le risque est identique ici, et son effet est pire : un courriel se supprime, une
  // notification déjà affichée sur un écran verrouillé ne se rappelle pas.
  //
  // On ne prie donc pas les tests d'être disciplinés — on leur retire le moyen de ne pas l'être. Les
  // tests de l'adaptateur construisent `creerAdaptateurWebPush` directement et doublent `fetch` : ils
  // ne passent pas par ici et ne sont pas gênés.
  if (process.env.VITEST) return NON_CONFIGURE;

  const cles = clesVapidDeclarees();
  if (!cles) return NON_CONFIGURE;
  return creerAdaptateurWebPush(cles);
}
