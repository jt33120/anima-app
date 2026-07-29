import "server-only";
import type Stripe from "stripe";
import { clientStripe } from "./client";

/**
 * Vérifie la SIGNATURE d'un webhook Stripe (Story 3.1, AC2) — AVANT tout traitement. Le secret de
 * webhook est un secret serveur UNIQUE (jamais `NEXT_PUBLIC_`). Lève si le secret ou l'en-tête de
 * signature manque, ou si la signature est invalide (`constructEvent` jette) — la route répond 400.
 *
 * ⚠️ L'appelant DOIT fournir le CORPS BRUT (`await req.text()`), jamais `req.json()` : Stripe signe
 * les octets bruts ; un re-stringify casserait la vérification HMAC.
 */
export function verifierEvenementStripe(corpsBrut: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET absente (secret serveur unique, jamais NEXT_PUBLIC_).");
  }
  if (!signature) {
    throw new Error("En-tête stripe-signature manquant.");
  }
  return clientStripe().webhooks.constructEvent(corpsBrut, signature, secret);
}
