import "server-only";
import Stripe from "stripe";

/**
 * Client Stripe — le SEUL module autorisé à importer le SDK `stripe` (miroir de l'adaptateur Mistral,
 * AD-2/AD-3). Gardé en CI : `tests/frontiere-stripe.test.ts` échoue si `stripe` ou `STRIPE_SECRET_KEY`
 * apparaît hors de `lib/stripe/`.
 *
 * Boot-guard : échec DUR si la clé secrète est absente — jamais de dégradation silencieuse. La clé est
 * un secret serveur UNIQUE (env Vercel, marqué « Sensitive »), jamais `NEXT_PUBLIC_`, jamais côté client.
 *
 * apiVersion épinglée explicitement (recommandation Stripe) : le typage TS et le comportement API
 * restent figés lors des montées de SDK.
 */
const VERSION_API = "2026-06-24.dahlia";

let instance: Stripe | null = null;

export function clientStripe(): Stripe {
  if (instance) return instance;
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) {
    throw new Error("STRIPE_SECRET_KEY absente (secret serveur unique, jamais NEXT_PUBLIC_).");
  }
  instance = new Stripe(cle, { apiVersion: VERSION_API, typescript: true });
  return instance;
}
