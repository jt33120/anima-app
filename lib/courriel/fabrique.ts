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
  const cle = process.env.RESEND_API_KEY?.trim();
  const expediteur = process.env.ANIMA_COURRIEL_EXPEDITEUR?.trim();
  if (!cle || !expediteur) return NON_CONFIGURE;
  return creerPortResend(cle, expediteur);
}
