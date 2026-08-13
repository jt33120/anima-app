import { describe, it, expect, vi } from "vitest";
import Stripe from "stripe";

/**
 * REVUE DE CODE du 2026-08-11, lot 2 (M5) — LA SIGNATURE DU WEBHOOK, RÉELLEMENT EXERCÉE.
 *
 * ══ CE QUE CE FICHIER RÉPARE ════════════════════════════════════════════════════════════════════
 *
 * `verifierEvenementStripe` n'était appelée par AUCUN test. `tests/stripe-webhook.test.ts` lit le
 * TEXTE SOURCE de la route et vérifie que la chaîne « verifierEvenementStripe » apparaît avant
 * « creerDepotAbonnement » ; `tests/stripe-boot-guard.test.ts` couvre les deux ABSENCES (secret
 * manquant, en-tête manquant). Personne ne vérifiait qu'une signature FAUSSE était refusée.
 *
 * Mutant appliqué pendant la revue — remplacer `webhooks.constructEvent(...)` par
 * `JSON.parse(corpsBrut)` — : **179 fichiers / 2659 tests, tous verts.**
 *
 * ⚠️ LA NATURE DU DÉFAUT, ET ELLE COMPTE : le code de production était CORRECT. Il n'y avait aucun
 * chemin d'exploitation. Ce qui manquait, c'est ce qui empêche la régression — et sur cette route-ci,
 * la régression donne le premium à vie à qui connaît l'URL du webhook, gratuitement, pour tout le
 * monde. C'est la garde la moins chère et la plus rentable du dépôt.
 *
 * ══ POURQUOI CE TEST N'A BESOIN D'AUCUNE CLÉ ════════════════════════════════════════════════════
 *
 * `webhooks.constructEvent` est de la CRYPTOGRAPHIE PURE (HMAC-SHA256 sur les octets bruts) : elle
 * ne parle jamais au réseau et se moque de la validité de la clé d'API. On construit donc un vrai
 * client Stripe avec une clé factice, et on signe avec `generateTestHeaderString`, l'utilitaire que
 * le SDK fournit exactement pour ça. Le contrôle positif est donc une VRAIE signature valide, pas
 * un doublage — c'est ce qui rend les contrôles négatifs concluants.
 */

const stripeReel = new Stripe("sk_test_cle_factice_pour_hmac_uniquement", {
  apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
});

vi.mock("@/lib/stripe/client", () => ({ clientStripe: () => stripeReel }));

const { verifierEvenementStripe } = await import("@/lib/stripe/webhook");

const SECRET = "whsec_test_secret_de_revue";
const CORPS = JSON.stringify({
  id: "evt_test_1",
  type: "customer.subscription.created",
  data: { object: { id: "sub_1", status: "active", metadata: { utilisatriceId: "u1" } } },
});

/** Une signature Stripe authentique pour ce corps — même algorithme qu'en production. */
const signer = (corps: string, secret = SECRET) =>
  stripeReel.webhooks.generateTestHeaderString({ payload: corps, secret });

describe("[M5] la signature du webhook Stripe est vraiment vérifiée", () => {
  it("[CONTRÔLE POSITIF] une signature VALIDE rend l'événement — sans ça, tout le reste est vacu", () => {
    // Si ce test tombait, les quatre suivants passeraient en prouvant seulement que la fonction
    // refuse tout, y compris ce qu'elle doit accepter.
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    const evenement = verifierEvenementStripe(CORPS, signer(CORPS));
    expect(evenement.id).toBe("evt_test_1");
    expect(evenement.type).toBe("customer.subscription.created");
    vi.unstubAllEnvs();
  });

  it("[LE MUTANT] un corps FORGÉ, non signé, est REFUSÉ", () => {
    // C'est la requête qu'un attaquant enverrait : le bon JSON, l'URL publique, aucune signature
    // valide. Avec `JSON.parse` à la place de `constructEvent`, elle passait et posait
    // `etat = 'actif'` sur le compte de son choix.
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    expect(() => verifierEvenementStripe(CORPS, "t=1,v1=signature_inventee")).toThrow();
    vi.unstubAllEnvs();
  });

  it("[LE MUTANT] un corps ALTÉRÉ après signature est REFUSÉ (un seul octet suffit)", () => {
    // Le scénario le plus vicieux : intercepter un vrai événement Stripe et changer l'utilisatrice
    // ciblée. La signature porte sur les OCTETS ; elle doit tomber au premier caractère modifié.
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    const signature = signer(CORPS);
    const altere = CORPS.replace('"u1"', '"u-attaquante"');
    expect(altere).not.toBe(CORPS);
    expect(() => verifierEvenementStripe(altere, signature)).toThrow();
    vi.unstubAllEnvs();
  });

  it("une signature valide pour un AUTRE secret est refusée", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    expect(() => verifierEvenementStripe(CORPS, signer(CORPS, "whsec_un_autre_secret"))).toThrow();
    vi.unstubAllEnvs();
  });

  it("secret absent → lève (jamais de traitement en clair)", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(() => verifierEvenementStripe(CORPS, signer(CORPS))).toThrow(/STRIPE_WEBHOOK_SECRET/);
    vi.unstubAllEnvs();
  });

  it("en-tête de signature absent → lève", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    expect(() => verifierEvenementStripe(CORPS, null)).toThrow(/stripe-signature/);
    vi.unstubAllEnvs();
  });
});
