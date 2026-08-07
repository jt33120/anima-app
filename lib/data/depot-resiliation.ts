import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * Story 3.5 — L'ACCÈS AUX DONNÉES DE LA SORTIE.
 *
 * Deux clients, et le partage n'est pas arbitraire (AD-12) :
 *   • SOUS JWT (`createSupabaseServerClient`) tout ce qu'elle LIT d'elle-même — son abonnement, son
 *     éligibilité. La RLS propriétaire est la garde, et elle est déjà écrite.
 *   • EN service_role (`createSupabaseAdminClient`) tout ce qui ÉCRIT un fait de facturation. Ce sont des
 *     décisions système, jamais des droits qu'une cliente déclare : `abonnement` n'a d'ailleurs aucune
 *     policy d'écriture depuis 0013, et `remboursement` non plus depuis 0038.
 */

export type MotifRemboursement = "garantie" | "minorite";

/** Ce que la base rend quand une demande de remboursement est réservée. */
export type ReservationRemboursement = {
  readonly cle: string;
  readonly subscriptionId: string | null;
  readonly dejaDemande: boolean;
};

/** L'abonnement tel qu'elle a le droit de le lire — aucune donnée de paiement, aucun montant. */
export type AbonnementLu = {
  readonly etat: "actif" | "resilie" | "expire";
  readonly periodeFin: string | null;
  readonly resiliationDemandeeLe: string | null;
  readonly subscriptionId: string | null;
};

/**
 * Lit SON abonnement, sous JWT. Rend `null` s'il n'y en a pas — le cas nominal d'un compte gratuit, pas
 * une anomalie.
 *
 * ⚠️ REPLI OPPOSÉ À CELUI DE `estPremiumCourante`. Là-bas, une panne de lecture RELANCE, pour que
 * l'appelant commercial suspende le commerce (« le doute suspend le commerce », AD-9/AD-15). Ici, la
 * lecture sert la porte de SORTIE : une panne qui masquerait la page « L'abonnement » enfermerait quelqu'un
 * dans un abonnement à cause d'un timeout. On relance donc aussi — mais l'appelant, lui, traite l'erreur
 * en affichant la page en mode dégradé plutôt qu'en la cachant. La différence vit dans la route, et elle
 * y est écrite.
 */
export async function lireAbonnement(): Promise<AbonnementLu | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("abonnement")
    .select("etat, periode_fin, resiliation_demandee_le, stripe_subscription_id")
    .maybeSingle();
  if (error) throw new Error(`lecture abonnement a échoué (${error.code ?? "inconnu"}).`);
  if (!data) return null;
  return {
    etat: data.etat as AbonnementLu["etat"],
    periodeFin: data.periode_fin as string | null,
    resiliationDemandeeLe: data.resiliation_demandee_le as string | null,
    subscriptionId: data.stripe_subscription_id as string | null,
  };
}

/** Son éligibilité à la garantie, sous JWT — un booléen, jamais un décompte (FR-031). */
export async function eligibleAuRemboursement(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("eligible_au_remboursement");
  // Repli sûr côté SORTIE : dans le doute, on n'affiche pas un geste qui échouerait — la RPC de
  // réservation, elle, re-vérifiera de toute façon et c'est ELLE qui décide (leçon R1).
  if (error) return false;
  return data === true;
}

/**
 * Réserve le remboursement. Rend `"non_eligible"` plutôt que de lever : ce n'est pas une panne, c'est une
 * réponse — et la route doit pouvoir la distinguer d'une erreur d'infrastructure pour choisir son code
 * HTTP (403 vs 500).
 */
export async function reserverRemboursement(
  utilisatriceId: string,
  motif: MotifRemboursement,
): Promise<ReservationRemboursement | "non_eligible"> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("demander_remboursement", {
    p_utilisatrice: utilisatriceId,
    p_motif: motif,
  });
  if (error) {
    if ((error.message ?? "").includes("remboursement_non_eligible")) return "non_eligible";
    throw new Error(`demander_remboursement a échoué (${error.code ?? "inconnu"}).`);
  }
  const ligne = (data as Array<{ cle: string; subscription_id: string | null; deja_demande: boolean }>)[0];
  if (!ligne) throw new Error("demander_remboursement n'a rien rendu.");
  return { cle: ligne.cle, subscriptionId: ligne.subscription_id, dejaDemande: ligne.deja_demande };
}

/** Confirme le remboursement depuis le webhook. Rend `false` si l'événement a déjà été traité. */
export async function confirmerRemboursement(
  utilisatriceId: string,
  providerEventId: string,
  type: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("confirmer_remboursement", {
    p_utilisatrice: utilisatriceId,
    p_provider_event_id: providerEventId,
    p_type: type,
  });
  if (error) throw new Error(`confirmer_remboursement a échoué (${error.code ?? "inconnu"}).`);
  return data === true;
}

/**
 * Réserve l'envoi de l'information avant reconduction. Rend `false` si elle a déjà été annoncée.
 *
 * ⚠️ CE CHEMIN NE CONSULTE PAS `preference_courriel`, et ce n'est pas un oubli : un refus du canal
 * (art. 21, Story 4.9) porte sur les notifications produit, pas sur une obligation contractuelle
 * d'information avant reconduction tacite (art. L215-1). Passer par `reserver_notification` — qui est là,
 * qui marche, qui gère déjà l'idempotence — reconduirait pour 69 € quelqu'un qui a cliqué « ne plus
 * recevoir » au bas d'une synthèse, sans l'avoir prévenue. Le test `[LE TEST QUI COMPTE]` de
 * `tests/resiliation-remboursement-sql.test.ts` rougit si quelqu'un « factorise » les deux chemins.
 */
export async function reserverInformationReconduction(
  utilisatriceId: string,
  providerEventId: string,
  echeance: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("reserver_information_reconduction", {
    p_utilisatrice: utilisatriceId,
    p_provider_event_id: providerEventId,
    p_echeance: echeance,
  });
  if (error) throw new Error(`reserver_information_reconduction a échoué (${error.code ?? "inconnu"}).`);
  return data === true;
}
