import "server-only";
import Stripe from "stripe";
import { estProduction, estCleStripeDeTest } from "@/lib/domain/environnement";

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
  // ⚠️ ON N'ENCAISSE PAS AVEC UNE CLÉ DE TEST SUR LE DÉPLOIEMENT QUE VOIENT DE VRAIES PERSONNES
  // (porte pré-lancement §4, requalifiée BLOQUANTE le 2026-08-16).
  //
  // Le mode test ne prévient de rien : Stripe rend une session parfaitement valide, la personne
  // parcourt un Checkout complet, le webhook projette un abonnement en base — et pas un centime
  // n'est encaissé. Elle croit avoir payé, le produit croit être payé, et la seule façon de s'en
  // apercevoir est de regarder un tableau de bord. C'est la panne SILENCIEUSE la plus chère du
  // produit, et l'URL de production est publique et indexable depuis toujours.
  //
  // Ce n'était pas atteignable tant qu'aucune surface ne vendait — aucune branche n'est proposée à
  // un compte gratuit (3.3, D2-A), donc aucun paywall, donc aucun chemin. La Story 3.6 a ouvert ce
  // chemin à tout le monde depuis `/abonnement`, et c'est ce qui a fait passer la porte au rouge.
  //
  // MÊME DOCTRINE QUE `creerAiPort` (AD-4 : pas de repli factice en production) et que
  // `origineDuSite()` (« un lien mort vaut mieux qu'un lien vers un domaine qu'on ne possède pas ») :
  // refuser de vendre vaut mieux que faire semblant de vendre. La route traduit ce refus en message
  // lisible ; ici on ne construit simplement pas le client.
  if (estProduction(process.env) && estCleStripeDeTest(cle)) {
    throw new Error(
      "STRIPE_SECRET_KEY est une clé de TEST sur un déploiement de production : " +
        "un Checkout y aboutirait sans qu'un centime soit encaissé (porte §4).",
    );
  }
  instance = new Stripe(cle, { apiVersion: VERSION_API, typescript: true });
  return instance;
}
