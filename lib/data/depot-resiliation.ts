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
  /**
   * Horodatage posé par le webhook `refund.created` (via `confirmer_remboursement`). `null` signifie
   * « réservé, mais Stripe n'a jamais confirmé » — l'appelant DOIT rejouer avec la même clé.
   *
   * Ajouté par 0043 (revue du 2026-08-11, M3). Sans lui, la route répondait « remboursée » dès que la
   * réservation existait : un premier appel Stripe échoué devenait définitif, et personne ne le savait
   * puisque cette colonne n'était lue nulle part dans le dépôt.
   */
  readonly confirmeLe: string | null;
};

/** L'abonnement tel qu'elle a le droit de le lire — aucune donnée de paiement, aucun montant. */
export type AbonnementLu = {
  readonly etat: "actif" | "resilie" | "expire";
  readonly periodeFin: string | null;
  readonly resiliationDemandeeLe: string | null;
  readonly subscriptionId: string | null;
  /** Non nul : accès OFFERT, sans contrat Stripe derrière (migration 0077). */
  readonly offertLe: string | null;
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
    .select("etat, periode_fin, resiliation_demandee_le, stripe_subscription_id, offert_le")
    .maybeSingle();
  if (error) throw new Error(`lecture abonnement a échoué (${error.code ?? "inconnu"}).`);
  if (!data) return null;
  return {
    etat: data.etat as AbonnementLu["etat"],
    periodeFin: data.periode_fin as string | null,
    resiliationDemandeeLe: data.resiliation_demandee_le as string | null,
    subscriptionId: data.stripe_subscription_id as string | null,
    offertLe: data.offert_le as string | null,
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
  const ligne = (
    data as Array<{
      cle: string;
      subscription_id: string | null;
      deja_demande: boolean;
      confirme_le: string | null;
    }>
  )[0];
  if (!ligne) throw new Error("demander_remboursement n’a rien rendu.");
  return {
    cle: ligne.cle,
    subscriptionId: ligne.subscription_id,
    dejaDemande: ligne.deja_demande,
    confirmeLe: ligne.confirme_le,
  };
}

/**
 * Marque le remboursement en ÉCHEC depuis le webhook (`refund.updated` / `failed` — compte fermé,
 * carte expirée). Rend `false` si l'événement a déjà été traité.
 *
 * La demande RESTE en base avec sa clé d'idempotence : un échec n'est pas une annulation, et elle
 * doit pouvoir redemander sans que Stripe rembourse deux fois. L'écran, lui, cesse de promettre.
 */
export async function echouerRemboursement(
  utilisatriceId: string,
  providerEventId: string,
  type: string,
  /**
   * La clé d'idempotence rapportée par l'événement Stripe (revue adversariale, R3). Depuis que la
   * garantie s'exerce PAR CONTRAT, un compte peut porter plusieurs lignes : sans discriminant, la
   * RPC écrirait sur toutes — dont celle d'un contrat qui n'a rien reçu. `null` est LÉGITIME
   * (remboursement fait à la main dans Stripe) et la RPC replie sur la demande la plus récente.
   */
  cle: string | null,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("echouer_remboursement", {
    p_utilisatrice: utilisatriceId,
    p_provider_event_id: providerEventId,
    p_type: type,
    p_cle: cle,
  });
  if (error) throw new Error(`echouer_remboursement a échoué (${error.code ?? "inconnu"}).`);
  return data === true;
}

/** Confirme le remboursement depuis le webhook. Rend `false` si l'événement a déjà été traité. */
export async function confirmerRemboursement(
  utilisatriceId: string,
  providerEventId: string,
  type: string,
  /**
   * La clé d'idempotence rapportée par l'événement Stripe (revue adversariale, R3). Depuis que la
   * garantie s'exerce PAR CONTRAT, un compte peut porter plusieurs lignes : sans discriminant, la
   * RPC écrirait sur toutes — dont celle d'un contrat qui n'a rien reçu. `null` est LÉGITIME
   * (remboursement fait à la main dans Stripe) et la RPC replie sur la demande la plus récente.
   */
  cle: string | null,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("confirmer_remboursement", {
    p_utilisatrice: utilisatriceId,
    p_provider_event_id: providerEventId,
    p_type: type,
    p_cle: cle,
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

/**
 * LIBÈRE la réservation quand l'ENVOI a échoué (revue du 2026-08-11, M11).
 *
 * `envoye_le` était posé à la RÉSERVATION, dans sa propre transaction, avant tout envoi. Un courriel
 * en échec — Resend en 429, adresse introuvable, timeout — laissait donc les deux barrières
 * d'idempotence en place ET une ligne qui atteste d'un envoi qui n'a jamais eu lieu. Aucun rejeu ne
 * pouvait plus rien : la première barrière connaît l'`event.id`, la seconde le couple
 * `(utilisatrice, échéance)`. L'information de l'art. L215-1 était perdue, et la table disait le
 * contraire — la pire position possible en contentieux.
 *
 * ⚠️ N'APPELER QUE DEPUIS LE CHEMIN D'ÉCHEC D'ENVOI. Après un succès, elle rouvrirait la porte à un
 * second courriel, et une information légale envoyée en double est un incident, pas un détail.
 */
export async function libererInformationReconduction(
  utilisatriceId: string,
  providerEventId: string,
  echeance: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("liberer_information_reconduction", {
    p_utilisatrice: utilisatriceId,
    p_provider_event_id: providerEventId,
    p_echeance: echeance,
  });
  if (error) {
    // On ne relance pas : l'appelant est DÉJÀ dans un chemin d'échec et va rendre 500 pour que
    // Stripe rejoue. Masquer sa cause première derrière une erreur de libération n'aiderait personne.
    console.error("[reconduction] libération de la réservation impossible", { code: error.code ?? "inconnu" });
  }
}

/** Ce que l'écran « L'abonnement » a besoin de savoir d'un remboursement en cours. */
export type EtatRemboursement = "confirme" | "echec" | "en_cours";

/**
 * L'état de SON remboursement, sous JWT — ou `null` si elle n'en a jamais demandé.
 *
 * ⚠️ CETTE LECTURE N'EXISTAIT PAS (revue des Epics 1 à 4). `confirme_le` était écrite par le webhook
 * et lue par personne : l'écran annonçait « le remboursement arrive » au moment de la demande, et
 * plus rien ensuite ne pouvait le confirmer NI le démentir. Une promesse sans surface.
 *
 * REPLI : `null`. Une panne de lecture ne doit pas cacher la page de sortie — l'appelant affiche
 * l'écran sans la ligne d'état plutôt que de tomber. Ne rien dire est faux ; ne pas ouvrir la porte
 * de sortie est pire.
 */
export async function lireEtatRemboursement(
  /**
   * ⚠️ LE CONTRAT DONT ON PARLE (revue adversariale, R3). Sans ce paramètre, cette lecture rendait
   * l'état de N'IMPORTE LAQUELLE de ses lignes : après un réabonnement, l'écran affichait donc en
   * permanence « Ton remboursement est parti sur ton moyen de paiement » — celui d'il y a un an, à
   * propos d'un contrat qui n'existe plus. Et depuis que la garantie s'exerce par contrat, un
   * `.maybeSingle()` sur deux lignes ne rend même plus une réponse : il rend une erreur.
   *
   * `null` = aucun contrat courant. On lit alors la ligne SANS souscription — celle du chemin
   * minorité sur un compte qui n'a jamais payé (FR-071), qui existe et dont l'état la concerne.
   */
  subscriptionId: string | null,
): Promise<EtatRemboursement | null> {
  const supabase = await createSupabaseServerClient();
  const requete = supabase.from("remboursement").select("confirme_le, echec_le");
  const { data, error } = await (subscriptionId === null
    ? requete.is("stripe_subscription_id", null)
    : requete.eq("stripe_subscription_id", subscriptionId)
  ).maybeSingle();
  if (error) throw new Error(`lecture remboursement a échoué (${error.code ?? "inconnu"}).`);
  if (!data) return null;
  // L'ordre suit celui de la base : `confirme_le` domine toujours `echec_le` — l'argent rendu est un
  // fait, un échec n'est qu'un état, et les webhooks n'arrivent pas dans l'ordre.
  if (data.confirme_le) return "confirme";
  if (data.echec_le) return "echec";
  return "en_cours";
}
