import "server-only";
import type Stripe from "stripe";
import { etatDepuisStatutStripe } from "@/lib/domain/abonnement";
import type { EvenementAbonnementProjete } from "@/lib/domain/depot-abonnement";

/**
 * Interprète un événement Stripe → un événement d'abonnement NORMALISÉ (Story 3.1). Vit dans la couche
 * infra (`lib/stripe/`) car elle manipule les TYPES du SDK ; elle isole ces types du reste de l'app
 * (la route et le dépôt ne voient qu'un objet plat). L'état est dérivé par le cœur PUR
 * `etatDepuisStatutStripe` (AD-1) — jamais ici.
 *
 * AUTORITÉ de l'état = `customer.subscription.created|updated|deleted` (champ `subscription.status`).
 * L'utilisatrice est résolue depuis `subscription.metadata.utilisatriceId` (posé par la route
 * Checkout via `subscription_data.metadata`) → AUCUNE dépendance à l'ordre de livraison Stripe.
 * Les autres types (checkout.session.completed, invoice.*, charge.refunded) sont NO-OP en 3.1
 * (historique/relance = hors état ; le remboursement = 3.5) → `null` (la route répond 200 sans projeter).
 */
const TYPES_ETAT = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** Vrai si le type d'événement porte l'état d'abonnement (autorité) — sert à distinguer, côté route,
 * le NO-OP attendu (type non géré) de l'ANOMALIE (type d'état géré mais mapping utilisatrice absent). */
export function estTypeEtatAbonnement(type: string): boolean {
  return TYPES_ETAT.has(type);
}

export function interpreterEvenementAbonnement(event: Stripe.Event): EvenementAbonnementProjete | null {
  if (!TYPES_ETAT.has(event.type)) return null;

  const sub = event.data.object as Stripe.Subscription;
  const utilisatriceId = sub.metadata?.utilisatriceId;
  if (!utilisatriceId) return null; // pas de mapping → rien à projeter (mais pas une erreur)

  const item = sub.items?.data?.[0];
  // Piège dahlia : `current_period_end` vit sur l'ITEM (retiré du Subscription top-level en basil).
  const periodeFin =
    item && typeof item.current_period_end === "number"
      ? new Date(item.current_period_end * 1000).toISOString()
      : null;

  // Story 3.5 — ces deux-là sont restés AU NIVEAU RACINE en dahlia, contrairement à `current_period_end`
  // (vérifié dans `stripe@22.3.2` : `start_date: number`, `cancel_at: number | null`). Ne pas les
  // chercher sur l'item par symétrie avec la ligne ci-dessus : ils n'y sont pas, et la lecture rendrait
  // `undefined` sans erreur — donc une garantie qui ne se déclencherait jamais, en silence.
  const debutLe = typeof sub.start_date === "number" ? new Date(sub.start_date * 1000).toISOString() : null;
  // `cancel_at` plutôt que `cancel_at_period_end` : le booléen dit QU'ELLE a résilié, la date dit JUSQU'À
  // QUAND elle garde l'accès — et c'est cette seconde information que l'écran doit rendre (AC1/AC8).
  const resiliationDemandeeLe =
    typeof sub.cancel_at === "number" ? new Date(sub.cancel_at * 1000).toISOString() : null;

  return {
    providerEventId: event.id,
    type: event.type,
    utilisatriceId,
    etat: etatDepuisStatutStripe(sub.status),
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscriptionId: sub.id,
    periodeFin,
    sourceMajLe: new Date(event.created * 1000).toISOString(), // horloge d'ordre = event.created
    debutLe,
    resiliationDemandeeLe,
  };
}
