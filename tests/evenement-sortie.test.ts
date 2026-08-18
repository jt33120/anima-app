import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { interpreterRemboursement, interpreterReconduction } from "@/lib/stripe/evenement-sortie";
import { interpreterEvenementAbonnement } from "@/lib/stripe/evenement-abonnement";

/**
 * Story 3.5 (T2) — L'INTERPRÉTATION DES ÉVÉNEMENTS DE SORTIE.
 *
 * Le test central de ce fichier n'est pas qu'elle marche : c'est qu'elle soit SÉPARÉE. Le geste évident
 * était d'élargir `TYPES_ETAT` dans `evenement-abonnement.ts` — deux lignes, aucune erreur de
 * compilation, et un remboursement jamais confirmé. On le prouve en faisant passer un `Refund` à
 * l'interpréteur d'abonnement et en constatant qu'il rend `null` SANS RIEN DIRE.
 */

const evt = (type: string, objet: unknown, id = "evt_1"): Stripe.Event =>
  ({ id, type, created: 1_700_000_000, data: { object: objet } }) as unknown as Stripe.Event;

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LE PIÈGE QU'ON A ÉVITÉ — et il faut le montrer, sinon la séparation ressemble à du zèle
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[P5] pourquoi les événements de sortie ne peuvent PAS rejoindre TYPES_ETAT", () => {
  it("l'interpréteur d'ABONNEMENT rend `null` sur un Refund — silencieusement, sans lever", () => {
    // `event.data.object as Stripe.Subscription` appliqué à un `Refund` : `metadata.utilisatriceId`
    // n'existe pas, `items` non plus. Aucune exception. Si `refund.created` avait été ajouté à
    // `TYPES_ETAT`, la route aurait répondu 200 et le remboursement n'aurait jamais été confirmé.
    const refund = { id: "re_1", status: "succeeded", metadata: { utilisatriceId: "u1" } };
    expect(interpreterEvenementAbonnement(evt("refund.created", refund))).toBeNull();
  });

  it("… alors que l'interpréteur de SORTIE, lui, le lit correctement (contrôle positif)", () => {
    const refund = { id: "re_1", status: "succeeded", metadata: { utilisatriceId: "u1" } };
    expect(interpreterRemboursement(evt("refund.created", refund))).toMatchObject({ utilisatriceId: "u1" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LE REMBOURSEMENT
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC7] interpreterRemboursement", () => {
  const refund = (status: string, metadata: Record<string, string> = { utilisatriceId: "u1" }) =>
    ({ id: "re_1", status, metadata }) as unknown as Stripe.Refund;

  it("porte l'identité depuis NOTRE metadata, sans aucun aller-retour", () => {
    const r = interpreterRemboursement(evt("refund.created", refund("succeeded"), "evt_42"));
    expect(r).toEqual({
      providerEventId: "evt_42",
      type: "refund.created",
      utilisatriceId: "u1",
      issue: "confirme",
      // Revue adversariale (R3) : la clé d'idempotence fait l'aller-retour, parce qu'un compte peut
      // désormais porter plusieurs remboursements — un par contrat. Sans elle, le webhook écrirait
      // la confirmation sur toutes ses lignes, dont celle d'un contrat qui n'a rien reçu.
      cle: null,
    });
  });

  it("[R3] quand Stripe rapporte NOTRE clé, elle est portée — c'est le discriminant de la ligne", () => {
    // Depuis la 0075, un compte peut porter plusieurs remboursements (un par contrat). Sans ce
    // champ, le webhook écrirait la confirmation sur la plus récente — pas forcément la bonne.
    const r = refund("succeeded", { utilisatriceId: "u1", remboursementCle: "cle-42" });
    expect(interpreterRemboursement(evt("refund.created", r, "evt_43"))?.cle).toBe("cle-42");
  });

  it("[DUR] un remboursement `pending` ne dit RIEN — ni fin, ni échec", () => {
    // `pending` reste un `null` légitime : c'est un état transitoire, pas une issue. Le marquer en
    // échec ferait paraître un démenti à l'écran pendant que l'argent est en route.
    expect(interpreterRemboursement(evt("refund.created", refund("pending")))).toBeNull();
  });

  it("⚠️ un remboursement `failed` ne CONFIRME rien — mais il n'est plus jeté (revue 1-4, #4)", () => {
    // ══ CE QUI ÉTAIT EN JEU ═══════════════════════════════════════════════════════════════════
    // Un remboursement peut échouer APRÈS coup (compte fermé, carte expirée) — c'est la raison
    // d'être de `refund.updated`, et l'en-tête de ce module le disait déjà. Il rendait pourtant
    // `null` : le webhook répondait 200 et rien n'était écrit nulle part, pendant que l'écran avait
    // annoncé « le remboursement arrive sur ton moyen de paiement ». Elle attendait un virement qui
    // ne viendrait pas, et personne — ni elle, ni nous — n'avait de quoi s'en apercevoir.
    //
    // LES DEUX MOITIÉS DE LA RÈGLE, ensemble, sinon aucune ne tient : l'échec REMONTE, et il ne
    // remonte SURTOUT PAS comme une confirmation.
    const echec = interpreterRemboursement(evt("refund.updated", refund("failed")));
    expect(echec, "un échec de remboursement est jeté sans trace").not.toBeNull();
    expect(echec?.issue, "un échec marqué comme confirmation : le pire des deux mondes").toBe("echec");

    expect(interpreterRemboursement(evt("refund.updated", refund("succeeded")))?.issue).toBe("confirme");
  });

  it("sans metadata, rien — jamais de confirmation attribuée au hasard", () => {
    expect(interpreterRemboursement(evt("refund.created", refund("succeeded", {})))).toBeNull();
  });

  it("ignore les types qui ne sont pas les siens", () => {
    const sub = { id: "sub_1", status: "active", metadata: { utilisatriceId: "u1" } };
    expect(interpreterRemboursement(evt("customer.subscription.updated", sub))).toBeNull();
    expect(interpreterRemboursement(evt("charge.refunded", { id: "ch_1" }))).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LA RECONDUCTION
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4] interpreterReconduction", () => {
  const facture = (o: {
    metadata?: Record<string, string> | null;
    next?: number | null;
    debut?: number;
  }) =>
    ({
      // ⚠️ Une facture À VENIR n'a PAS d'`id` : c'est une projection, pas un objet persisté. Toute
      // idempotence qui reposerait dessus serait creuse. On la construit donc sans, exprès.
      parent: { subscription_details: o.metadata === null ? null : { metadata: o.metadata ?? { utilisatriceId: "u1" } } },
      next_payment_attempt: o.next === undefined ? 1_800_000_000 : o.next,
      period_start: o.debut ?? 1_800_000_500,
    }) as unknown as Stripe.Invoice;

  it("porte l'identité et l'échéance (contrôle positif)", () => {
    const r = interpreterReconduction(evt("invoice.upcoming", facture({}), "evt_rc"));
    expect(r).toEqual({
      providerEventId: "evt_rc",
      utilisatriceId: "u1",
      echeance: new Date(1_800_000_000 * 1000).toISOString(),
    });
  });

  it("`next_payment_attempt` PRIME sur `period_start` — c'est la date du débit", () => {
    const r = interpreterReconduction(evt("invoice.upcoming", facture({ next: 1_700_000_111 })));
    expect(r?.echeance).toBe(new Date(1_700_000_111 * 1000).toISOString());
  });

  it("… et `period_start` sert de repli quand la première est absente", () => {
    const r = interpreterReconduction(evt("invoice.upcoming", facture({ next: null, debut: 1_900_000_000 })));
    expect(r?.echeance).toBe(new Date(1_900_000_000 * 1000).toISOString());
  });

  it("[DUR] sans AUCUNE date, rien — annoncer une reconduction sans dire quand serait pire que se taire", () => {
    const sansDate = { parent: { subscription_details: { metadata: { utilisatriceId: "u1" } } } };
    expect(interpreterReconduction(evt("invoice.upcoming", sansDate))).toBeNull();
  });

  it("sans metadata d'abonnement, rien — on ne devine pas à qui écrire", () => {
    expect(interpreterReconduction(evt("invoice.upcoming", facture({ metadata: null })))).toBeNull();
  });

  it("ignore les autres types de facture (une facture PAYÉE n'est pas une reconduction à venir)", () => {
    expect(interpreterReconduction(evt("invoice.paid", facture({})))).toBeNull();
    expect(interpreterReconduction(evt("invoice.payment_failed", facture({})))).toBeNull();
  });
});
