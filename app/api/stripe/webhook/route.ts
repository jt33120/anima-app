import { type NextRequest, NextResponse } from "next/server";
import { verifierEvenementStripe } from "@/lib/stripe/webhook";
import { interpreterEvenementAbonnement, estTypeEtatAbonnement } from "@/lib/stripe/evenement-abonnement";
import { interpreterRemboursement, interpreterReconduction } from "@/lib/stripe/evenement-sortie";
import { creerDepotAbonnement } from "@/lib/data/depot-abonnement";
import { confirmerRemboursement, reserverInformationReconduction } from "@/lib/data/depot-resiliation";
import { annoncerReconduction } from "@/lib/courriel/reconduction";

/**
 * Route Webhook Stripe (Story 3.1, AC2/AC3). Ordre STRICT :
 *   1. corps BRUT (`req.text()`, jamais `req.json()`) + en-tête `stripe-signature` ;
 *   2. vérification de SIGNATURE avant TOUT accès DB (400 si invalide) ;
 *   3. interprétation → si type non géré / mapping absent : 200 sans projeter ;
 *   4. projection écrivain-unique idempotente (RPC) → 200 ; erreur DB → 500 (Stripe REJOUE, sûr).
 *
 * Runtime Node OBLIGATOIRE (crypto de `constructEvent`). Aucune donnée art. 9 ne transite ici.
 * Logs sans PII (code/nom seuls). Pas de garde `limites_levees` : un webhook n'est pas une
 * sollicitation commerciale — un `subscription.deleted` doit être enregistré même en détresse.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const corpsBrut = await request.text();
  const signature = request.headers.get("stripe-signature");

  let evenement;
  try {
    evenement = verifierEvenementStripe(corpsBrut, signature);
  } catch (e) {
    console.error("[stripe/webhook] signature invalide", { nom: e instanceof Error ? e.name : "inconnu" });
    return new NextResponse("Signature invalide.", { status: 400 });
  }

  // ── Story 3.5 — LES DEUX FAMILLES DE SORTIE, interprétées AVANT l'abonnement et par des modules
  //    DISTINCTS. `interpreterEvenementAbonnement` fait `event.data.object as Stripe.Subscription` :
  //    ce cast est faux pour un `Refund` comme pour une `Invoice`, et il échouerait en SILENCE (un
  //    `metadata` absent, un `null` rendu, un 200 renvoyé, et rien de fait). Voir l'en-tête de
  //    `lib/stripe/evenement-sortie.ts`.
  const remboursement = interpreterRemboursement(evenement);
  if (remboursement) {
    try {
      await confirmerRemboursement(remboursement.utilisatriceId, remboursement.providerEventId, remboursement.type);
      return new NextResponse(null, { status: 200 });
    } catch (e) {
      console.error("[stripe/webhook] échec confirmation remboursement", {
        nom: e instanceof Error ? e.name : "inconnu",
      });
      return new NextResponse("Erreur de traitement.", { status: 500 }); // Stripe rejouera (idempotent)
    }
  }

  const reconduction = interpreterReconduction(evenement);
  if (reconduction) {
    try {
      // Réserver AVANT d'envoyer : envoyer puis réserver enverrait deux fois au moindre rejeu, et une
      // information légale envoyée en double est un incident, pas un détail. Patron `reserver_notification`
      // (0034) — sauf que ce chemin-ci ne consulte PAS le refus de canal, délibérément (AC4).
      if (await reserverInformationReconduction(
        reconduction.utilisatriceId,
        reconduction.providerEventId,
        reconduction.echeance,
      )) {
        await annoncerReconduction(reconduction.utilisatriceId);
      }
      return new NextResponse(null, { status: 200 });
    } catch (e) {
      console.error("[stripe/webhook] échec information reconduction", {
        nom: e instanceof Error ? e.name : "inconnu",
      });
      return new NextResponse("Erreur de traitement.", { status: 500 });
    }
  }

  const normalise = interpreterEvenementAbonnement(evenement);
  if (!normalise) {
    // Anomalie vs no-op : un type d'ÉTAT géré sans mapping utilisatriceId = abonnement possiblement
    // payé mais jamais projeté → signaler aux ops (ids Stripe non-art. 9, sûrs à logger). Le rejeu
    // Stripe ne servirait à rien (metadata resterait absente) → on garde le 200.
    if (estTypeEtatAbonnement(evenement.type)) {
      console.error("[stripe/webhook] événement d'état sans mapping utilisatriceId", {
        type: evenement.type,
        eventId: evenement.id,
      });
    }
    return new NextResponse(null, { status: 200 }); // type non géré / mapping absent : rien à projeter
  }

  try {
    await creerDepotAbonnement().traiterEvenement(normalise);
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("[stripe/webhook] échec projection", { nom: e instanceof Error ? e.name : "inconnu" });
    return new NextResponse("Erreur de traitement.", { status: 500 }); // Stripe rejouera (idempotent)
  }
}
