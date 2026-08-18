import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { estProduction, estCleStripeDeTest } from "@/lib/domain/environnement";
import { sansCommentaires } from "./_absence";

/**
 * porte-paiement.test.ts — ON N'ENCAISSE PAS AVEC UNE CLÉ DE TEST (porte pré-lancement §4).
 *
 * ══ CE QUI EST EN JEU ═══════════════════════════════════════════════════════════════════════════
 *
 * Le mode test de Stripe ne prévient de rien. Il rend une session parfaitement valide : la personne
 * parcourt un Checkout complet, le webhook projette un abonnement en base, et pas un centime n'est
 * encaissé. Elle croit avoir payé, le produit croit être payé, et la seule façon de s'en apercevoir
 * est de regarder un tableau de bord. C'est la panne SILENCIEUSE la plus chère du produit.
 *
 * Ce n'était pas atteignable tant qu'aucune surface ne vendait — aucune branche n'est proposée à un
 * compte gratuit (3.3, D2-A), donc aucun paywall, donc aucun chemin vers Checkout. La Story 3.6 a
 * ouvert ce chemin à tout le monde depuis `/abonnement`, et l'URL de production est publique et
 * indexable. C'est ce qui a fait passer la porte §4 au rouge le 2026-08-16.
 */

const racine = process.cwd();
const lire = (p: string) => sansCommentaires(readFileSync(resolve(racine, p), "utf-8"));

describe("[porte §4] `estProduction` — la question posée en UN seul endroit", () => {
  it("`VERCEL_ENV` fait autorité quand il existe : une PRÉPRODUCTION n'est pas la production", () => {
    // ⚠️ LE CAS QUI JUSTIFIE CE MODULE. Une préproduction Vercel est bâtie en `NODE_ENV=production`.
    // Une garde écrite sur le seul `NODE_ENV` refuserait donc de vendre en préprod — c'est-à-dire
    // qu'on ne pourrait jamais éprouver le paiement avant de le mettre en ligne.
    expect(estProduction({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe(false);
    expect(estProduction({ VERCEL_ENV: "development", NODE_ENV: "production" })).toBe(false);
    expect(estProduction({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(true);
  });

  it("sans `VERCEL_ENV` — local, conteneur, CI — on retombe sur `NODE_ENV`", () => {
    expect(estProduction({ NODE_ENV: "production" })).toBe(true);
    expect(estProduction({ NODE_ENV: "development" })).toBe(false);
    expect(estProduction({ NODE_ENV: "test" })).toBe(false);
    expect(estProduction({}), "aucune information ⇒ on n'est pas en production").toBe(false);
  });
});

describe("[porte §4] `estCleStripeDeTest` — on reconnaît le TEST, jamais le live", () => {
  it("attrape les deux formes que Stripe émet aujourd'hui", () => {
    expect(estCleStripeDeTest("sk_test_51TVGUrAbCdEf")).toBe(true);
    expect(estCleStripeDeTest("pk_test_51TVGUrAbCdEf")).toBe(true);
  });

  it("laisse passer une clé live — et TOUTE forme que Stripe inventerait", () => {
    // ⚠️ LA GARDE REFUSE CE QU'ELLE SAIT ÊTRE FAUX, PAS TOUT CE QU'ELLE NE RECONNAÎT PAS.
    // Mutation-cible : écrire `!cle.startsWith("sk_live_")`. Ce mutant fermerait le produit à la
    // première évolution de l'API — les clés restreintes commencent déjà par `rk_`.
    expect(estCleStripeDeTest("sk_live_51TVGUrAbCdEf")).toBe(false);
    expect(estCleStripeDeTest("rk_live_51TVGUrAbCdEf")).toBe(false);
    expect(estCleStripeDeTest("un_format_que_stripe_inventera")).toBe(false);
  });

  it("`test` ailleurs que dans le préfixe ne compte pas", () => {
    // Le motif est ancré : `^[a-z]{2}_test_`. Une clé live dont le corps contiendrait « test » —
    // c'est du base62, ça arrive — ne doit pas fermer la vente.
    expect(estCleStripeDeTest("sk_live_51testAbCdEf")).toBe(false);
  });
});

describe("[porte §4] la garde est CÂBLÉE, et son refus est LISIBLE", () => {
  it("le client Stripe refuse de se construire — c'est là que la garde vit", () => {
    // ⚠️ ELLE VIT DANS `clientStripe`, PAS DANS LA ROUTE, et c'est le point. `lib/stripe/client.ts`
    // est le SEUL module autorisé à importer le SDK (frontière gardée en CI) : toute surface de
    // paiement écrite demain passera par lui, et héritera du refus sans qu'on y pense.
    const src = lire("lib/stripe/client.ts");
    expect(src).toMatch(/estProduction\s*\(\s*process\.env\s*\)/);
    expect(src).toMatch(/estCleStripeDeTest\s*\(\s*cle\s*\)/);
    expect(src, "le refus doit LEVER, jamais dégrader en silence").toMatch(/throw new Error\(/);
  });

  it("la route traduit le refus en message lisible, AVANT toute autre garde d'état", () => {
    // Sans cet appel anticipé, le refus tomberait dans le `catch` du bloc « contrat déjà ouvert » et
    // dirait à quelqu'un une chose FAUSSE sur son propre abonnement — un refus qui ment est pire
    // qu'un 500. L'ordre est donc la garde, pas seulement la présence.
    const src = lire("app/api/stripe/checkout/route.ts");
    expect(src).toMatch(/etat=paiement_indisponible/);
    expect(
      src.indexOf("clientStripe();"),
      "la vérification du paiement doit précéder la lecture de l'abonnement",
    ).toBeLessThan(src.indexOf('.from("abonnement")'));
  });

  it("et l'écran REND la phrase — pas seulement l'importe", () => {
    // La famille de défauts la plus fréquente de ce dépôt : la garde vérifie qu'un nom APPARAÎT,
    // pas qu'il SERT. On exige l'interpolation.
    const src = lire("app/abonnement/page.tsx");
    expect(src).toMatch(/\{c\.REFUS_PAIEMENT_INDISPONIBLE\}/);
    expect(src).toMatch(/retour === "paiement_indisponible"/);
  });

  it("la phrase ne propose PAS de réessayer — une clé de test ne se répare pas en rechargeant", () => {
    const copie = readFileSync(resolve(racine, "render/abonnement/copie-abonnement.ts"), "utf-8");
    const m = copie.match(/REFUS_PAIEMENT_INDISPONIBLE\s*=\s*([\s\S]*?);/);
    expect(m, "la constante a disparu").not.toBeNull();
    expect(m![1], "« réessaie » enverrait buter deux fois").not.toMatch(/r[ée]essa/i);
    expect(m![1], "il faut dire que rien n'a été débité").toMatch(/d[ée]bit/i);
  });
});
