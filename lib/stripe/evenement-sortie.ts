import "server-only";
import type Stripe from "stripe";

/**
 * Story 3.5 — L'INTERPRÉTATION DES ÉVÉNEMENTS DE SORTIE, séparée de celle de l'abonnement.
 *
 * ── POURQUOI UN MODULE À PART, ET PAS DEUX TYPES DE PLUS DANS `evenement-abonnement.ts` ──────────────────
 *
 * Parce que ce fichier-là fait, en toute première ligne utile :
 *
 *     const sub = event.data.object as Stripe.Subscription;
 *
 * Ce cast est correct pour les trois `customer.subscription.*` qu'il déclare, et FAUX pour tout le reste.
 * Sur un `refund.created`, l'objet est un `Refund` : `sub.metadata?.utilisatriceId` rendrait `undefined`,
 * `sub.items` aussi, et l'interprétation rendrait `null` — c'est-à-dire un NO-OP silencieux, avec un 200
 * renvoyé à Stripe et un remboursement jamais confirmé. Aucune exception, aucun journal, rien.
 *
 * Élargir `TYPES_ETAT` était donc le geste évident et c'était le mauvais. La 3.1 l'avait d'ailleurs écrit
 * noir sur blanc : « les autres types sont NO-OP en 3.1 […] le remboursement = 3.5 ».
 *
 * ── LES DEUX ÉVÉNEMENTS PORTENT EUX-MÊMES DE QUI IL S'AGIT ──────────────────────────────────────────────
 *
 * Aucun aller-retour supplémentaire, aucune remontée charge → facture → abonnement. C'est le patron de la
 * 3.1 (`subscription_data.metadata` posé au Checkout) appliqué deux fois de plus.
 */

/** Un remboursement confirmé par Stripe, normalisé. */
/** Ce qu'un événement `refund.*` peut dire de définitif. `pending` n'en fait pas partie. */
export type IssueRemboursementStripe = "confirme" | "echec";

export type SortieRemboursement = {
  readonly providerEventId: string;
  readonly type: string;
  readonly utilisatriceId: string;
  readonly issue: IssueRemboursementStripe;
};

/** Une reconduction tacite à venir, normalisée. */
export type ReconductionAVenir = {
  readonly providerEventId: string;
  readonly utilisatriceId: string;
  /** L'échéance ANNONCÉE (ISO 8601 UTC) — la date à laquelle elle sera débitée. */
  readonly echeance: string;
};

/**
 * `refund.created` — et surtout PAS `charge.refunded`.
 *
 * Les deux disent la même chose. La différence est que `refund.created` porte l'objet `Refund`, sur lequel
 * NOUS avons posé `metadata.utilisatriceId` en créant le remboursement (`lib/stripe/resiliation.ts`),
 * tandis que `charge.refunded` porte une `Charge` — un objet que nous n'avons jamais écrit, et dont
 * retrouver la propriétaire demanderait charge → facture → abonnement → metadata, soit deux appels API
 * de plus et deux occasions de plus d'échouer au moment où l'on doit confirmer qu'on a rendu l'argent.
 */
export function interpreterRemboursement(event: Stripe.Event): SortieRemboursement | null {
  if (event.type !== "refund.created" && event.type !== "refund.updated") return null;

  const refund = event.data.object as Stripe.Refund;

  // ⚠️ L'ÉCHEC EST UNE SORTIE, PAS UN `null` (revue des Epics 1 à 4, trouvaille #4).
  //
  // Cette fonction ne retenait que `succeeded`, et son commentaire disait pourtant l'essentiel :
  // « `refund.updated` existe précisément parce qu'un remboursement peut ÉCHOUER après coup (compte
  // fermé, carte expirée) ». Le raisonnement était juste, sa conclusion s'arrêtait à mi-chemin — un
  // échec rendait `null`, le webhook répondait 200, et rien n'était écrit nulle part.
  //
  // Pendant ce temps l'écran lui avait dit : « C'est demandé. Le remboursement arrive sur ton moyen
  // de paiement. » Elle attendait un virement qui ne viendrait pas, et personne n'avait de quoi s'en
  // apercevoir. `pending` reste un `null` légitime : ce n'est ni une fin, ni un échec.
  const issue: IssueRemboursementStripe | null =
    refund.status === "succeeded" ? "confirme" : refund.status === "failed" ? "echec" : null;
  if (!issue) return null;

  const utilisatriceId = refund.metadata?.utilisatriceId;
  if (!utilisatriceId) return null;

  return { providerEventId: event.id, type: event.type, utilisatriceId, issue };
}

/**
 * `invoice.upcoming` — l'information avant reconduction tacite (FR-060, art. L215-1).
 *
 * ⚠️ CE QUI REMPLACE UN JOB, ET POURQUOI. Le réflexe était un quatrième pensionnaire au registre de
 * l'ordonnanceur, balayant chaque jour les abonnements qui approchent de leur échéance. Deux raisons de ne
 * pas le faire : le budget de temps du registre est plein (6 + 36 + 8 = 50 s pour 60, marge 8 — un 4ᵉ job
 * ne rentre pas sans un troisième rééquilibrage que l'en-tête de `registre.ts` interdit explicitement), et
 * surtout un tel job reconstruirait, moins bien, une date que Stripe connaît déjà : la sienne, celle de la
 * facturation. Le délai d'émission se règle au niveau du compte Stripe — porte ops, pas du code.
 *
 * L'identité vient de `parent.subscription_details.metadata`, l'instantané des métadonnées d'abonnement
 * — donc du `utilisatriceId` posé au Checkout par la 3.1. La facture à venir n'a PAS d'`id` (c'est une
 * projection, pas un objet persisté) : l'idempotence repose sur `event.id` et sur l'échéance, jamais sur
 * un identifiant de facture qui n'existe pas.
 */
export function interpreterReconduction(event: Stripe.Event): ReconductionAVenir | null {
  if (event.type !== "invoice.upcoming") return null;

  const facture = event.data.object as Stripe.Invoice;
  const utilisatriceId = facture.parent?.subscription_details?.metadata?.utilisatriceId;
  if (!utilisatriceId) return null;

  // `next_payment_attempt` d'abord : c'est LA date du débit, celle qui intéresse quelqu'un qu'on prévient
  // avant de le débiter. `period_start` en repli — début de la période reconduite, la même date dans le
  // cas nominal. Sans l'une ni l'autre, on ne réserve rien : la RPC lève sur une échéance absente, et
  // annoncer une reconduction sans dire quand serait pire que ne rien annoncer.
  const quand = facture.next_payment_attempt ?? facture.period_start;
  if (typeof quand !== "number") return null;

  return { providerEventId: event.id, utilisatriceId, echeance: new Date(quand * 1000).toISOString() };
}
