import "server-only";
import { creerPortResend } from "@/lib/courriel/adaptateurs/resend";
import type { PortCourriel } from "@/lib/courriel/port";

/**
 * Story 4.9 — LA FABRIQUE du port courriel, et son BOOT-GUARD. Patron de `lib/ai/fabrique.ts`.
 *
 * Le point délicat : que faire quand la configuration manque ?
 *
 * Retomber sur l'adaptateur factice serait le pire des choix — en production, les courriels seraient
 * silencieusement avalés, le job les compterait comme envoyés, la réservation serait consommée, et
 * personne ne saurait rien. Une panne muette est plus coûteuse qu'une panne bruyante, et bien plus
 * coûteuse encore quand elle se déguise en succès.
 *
 * On rend donc un port qui dit `estConfigure() === false` et qui LÈVE si on l'appelle quand même. Le job
 * interroge `estConfigure()` AVANT de réserver : sans clé, la synthèse est produite et consultable, et
 * aucune réservation n'est consommée. Le jour où la clé arrive, le courriel de la semaine part.
 */

const NON_CONFIGURE: PortCourriel = {
  estConfigure: () => false,
  async envoyer(): Promise<void> {
    throw new Error("courriel_non_configure");
  },
};

export function creerPortCourriel(): PortCourriel {
  // ── SOUS VITEST, JAMAIS L'ADAPTATEUR RÉEL (revue 4.9, T4-3) ──────────────────────────────────────────
  //
  // La revue a montré qu'une suite de tests pouvait envoyer du VRAI courrier : `ordonnanceur-endpoint`
  // appelait la vraie route, donc le vrai registre, donc cette fabrique — et `synthese-sql`, exécuté en
  // parallèle contre la même base, y créait des candidates éligibles. Le fichier a été corrigé (il double
  // désormais le registre), mais ce correctif-là demande à un test d'être discipliné.
  //
  // Ceci ne le demande pas. C'est la même stratégie que la signature de `PortCourriel` : on ne prie pas
  // l'appelant de ne pas faire la bêtise, on lui retire le moyen de la faire. Le prix est une ligne qui
  // connaît l'existence des tests dans du code de production — payé volontiers, parce que la chose qu'on
  // achète est « aucune suite de tests, présente ou future, n'écrira jamais à une vraie personne ».
  //
  // Les tests de l'adaptateur lui-même (Resend) construisent `creerPortResend` directement et doublent
  // `fetch` : ils n'ont pas besoin de cette fabrique, et ne sont donc pas gênés.
  if (process.env.VITEST) return NON_CONFIGURE;

  const cle = process.env.RESEND_API_KEY?.trim();
  const expediteur = process.env.ANIMA_COURRIEL_EXPEDITEUR?.trim();
  if (!cle || !expediteur) return NON_CONFIGURE;
  return creerPortResend(cle, expediteur);
}
