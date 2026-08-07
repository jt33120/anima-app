import "server-only";
import type Stripe from "stripe";
import { clientStripe } from "./client";

/**
 * Story 3.5 — LES DEUX GESTES DE SORTIE, côté Stripe. Vit dans `lib/stripe/` parce que c'est le seul
 * endroit du dépôt autorisé à importer le SDK (AD-2/AD-3, gardé par `tests/frontiere-stripe.test.ts`).
 *
 * ── CE MODULE NE DÉCIDE RIEN ────────────────────────────────────────────────────────────────────────────
 *
 * Ni l'éligibilité (elle vit en SQL, `eligible_au_remboursement`), ni l'idempotence (elle vit en base,
 * `remboursement.cle_idempotence`). Il EXÉCUTE, avec la clé qu'on lui donne. C'est délibéré : une
 * seconde source de vérité sur « a-t-elle droit au remboursement » finirait par diverger de la première,
 * et celle qui divergerait serait celle qui rend de l'argent.
 */

/**
 * RÉSILIER EN FIN DE PÉRIODE — jamais immédiatement.
 *
 * `cancel_at_period_end` plutôt que `subscriptions.cancel()` : elle a payé l'année, elle garde l'accès
 * jusqu'au bout (AC8, FR-029). Une résiliation immédiate lui retirerait un service déjà réglé — ce que
 * ni la loi ni la charte ne demandent, et que personne ne réclame en cliquant « résilier ».
 *
 * NATURELLEMENT IDEMPOTENT : poser un drapeau déjà posé laisse le même état. Aucune réservation en base
 * n'est donc nécessaire ici, contrairement au remboursement — un double-clic est inoffensif.
 *
 * Rend la date d'effet (ISO) pour que l'écran puisse dire « actif jusqu'au … » sans attendre le webhook.
 * L'état projeté, lui, reste `actif` et le restera : Stripe garde `status = active` jusqu'à l'échéance.
 */
export async function resilierEnFinDePeriode(subscriptionId: string): Promise<string | null> {
  const sub = await clientStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  return typeof sub.cancel_at === "number" ? new Date(sub.cancel_at * 1000).toISOString() : null;
}

/**
 * ANNULER une résiliation demandée — elle revient sur sa décision.
 *
 * Sans ce chemin, « résilier » serait irréversible côté produit alors qu'il ne l'est pas côté Stripe :
 * il faudrait se réabonner (donc repayer) pour défaire un clic. C'est la même règle que le désabonnement
 * courriel de la 4.9, qui rouvre le canal avec le même jeton.
 */
export async function annulerResiliation(subscriptionId: string): Promise<void> {
  await clientStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: false });
}

/**
 * Le PaymentIntent qui a réellement encaissé l'abonnement.
 *
 * ⚠️ PIÈGE DAHLIA, DEUXIÈME DU NOM. `Invoice.payment_intent` N'EXISTE PLUS sur l'objet facture (vérifié
 * dans `stripe@22.3.2` : le champ ne subsiste que dans des types de PARAMÈTRES). Il a été remplacé par
 * `invoice.payments`, une liste d'`InvoicePayment` dont le paiement est porté par `p.payment.payment_intent`.
 *
 * C'est exactement la même famille de piège que `current_period_end`, qui a migré vers l'item en basil et
 * que la 3.1 documente. Et c'est un piège SILENCIEUX : lire `invoice.payment_intent` en TypeScript sur un
 * type qui ne le déclare plus casse à la compilation — mais un `as any` ou un `?? null` rendrait
 * `undefined`, et le remboursement échouerait avec un message générique au pire moment.
 */
function paymentIntentDe(facture: Stripe.Invoice): string | null {
  const paiements = facture.payments?.data ?? [];
  for (const p of paiements) {
    // `status` vaut `open` | `paid` | `canceled` : seul un paiement RÉELLEMENT encaissé se rembourse.
    if (p.status !== "paid") continue;
    const pi = p.payment?.payment_intent;
    if (typeof pi === "string") return pi;
    if (pi && typeof pi === "object") return pi.id;
  }
  return null;
}

/** Ce que l'exécution du remboursement peut rapporter à l'appelant, sans jamais de PII. */
export type IssueRemboursement = "rembourse" | "rien_a_rembourser";

/**
 * REMBOURSER INTÉGRALEMENT — et résilier dans la foulée.
 *
 * LES DEUX, TOUJOURS. Rembourser sans résilier rend l'argent et laisse la souscription courir : elle
 * serait re-facturée à l'échéance suivante, après avoir été remboursée. C'est le genre de moitié de geste
 * qui transforme une garantie en incident de facturation.
 *
 * MONTANT INTÉGRAL, jamais au prorata. FR-089 dit « remboursée » ; et l'éligibilité elle-même établit que
 * le produit n'a rien produit (aucune branche posée) — facturer un prorata d'un service dont on vient de
 * constater qu'il n'a rien livré serait une contradiction dans les termes. Le chemin minorité (FR-071)
 * est intégral pour une autre raison : ce contrat n'aurait jamais dû exister.
 *
 * `cleIdempotence` vient de la BASE (`remboursement.cle_idempotence`), jamais d'ici. Au retry, la route
 * relit la même clé et Stripe reconnaît la même opération au lieu d'en ouvrir une seconde. Une clé
 * fabriquée localement — horodatage, aléa, uuid tiré à l'appel — rembourserait autant de fois qu'il y a
 * de tentatives, et le bogue ne se verrait qu'en relevé bancaire.
 *
 * `metadata.utilisatriceId` sur le REMBOURSEMENT : c'est ce qui permet à l'événement `refund.created` de
 * dire de qui il s'agit sans remonter la chaîne charge → facture → abonnement. Patron exact de
 * `subscription_data.metadata` posé par la 3.1 sur le Checkout, et pour la même raison : aucune
 * dépendance à l'ordre de livraison ni à un aller-retour supplémentaire.
 */
export async function rembourserIntegralement(
  subscriptionId: string,
  utilisatriceId: string,
  cleIdempotence: string,
): Promise<IssueRemboursement> {
  const stripe = clientStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
  const facture = sub.latest_invoice;

  const paymentIntent = facture && typeof facture !== "string" ? paymentIntentDe(facture) : null;

  // Aucun encaissement retrouvé : on résilie quand même, et on le dit. Le cas existe réellement —
  // barrière de minorité posée sur un compte qui n'a jamais payé (FR-071 s'applique à tout compte
  // détecté mineur, abonné ou non). Lever ici ferait échouer la barrière de sécurité à cause de
  // l'absence d'un paiement : la sécurité ne dépend jamais du commerce (AD-9).
  if (!paymentIntent) {
    await resilierEnFinDePeriode(subscriptionId);
    return "rien_a_rembourser";
  }

  await stripe.refunds.create(
    {
      payment_intent: paymentIntent,
      // Pas d'`amount` : l'omettre rembourse la TOTALITÉ. Le calculer nous-mêmes rouvrirait la question
      // du prorata et introduirait un centime d'écart entre notre arithmétique et celle de Stripe.
      metadata: { utilisatriceId },
    },
    { idempotencyKey: cleIdempotence },
  );

  await resilierEnFinDePeriode(subscriptionId);
  return "rembourse";
}
