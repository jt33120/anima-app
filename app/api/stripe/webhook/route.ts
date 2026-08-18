import { type NextRequest, NextResponse } from "next/server";
import { verifierEvenementStripe } from "@/lib/stripe/webhook";
import { interpreterEvenementAbonnement, estTypeEtatAbonnement } from "@/lib/stripe/evenement-abonnement";
import { interpreterRemboursement, interpreterReconduction } from "@/lib/stripe/evenement-sortie";
import { creerDepotAbonnement } from "@/lib/data/depot-abonnement";
import {
  confirmerRemboursement,
  echouerRemboursement,
  reserverInformationReconduction,
  libererInformationReconduction,
} from "@/lib/data/depot-resiliation";
import { annoncerReconduction } from "@/lib/courriel/reconduction";
import {
  fenetreInformationReconduction,
  joursAvantEcheance,
  L215_JOURS_MIN,
  L215_JOURS_MAX,
} from "@/lib/domain/abonnement";

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
      // ⚠️ DEUX ISSUES, PAS UNE (revue des Epics 1 à 4). Un `refund.updated` en `failed` rendait
      // `null` : le webhook tombait dans la branche suivante, répondait 200, et rien n'était écrit —
      // pendant que l'écran avait annoncé « le remboursement arrive sur ton moyen de paiement ».
      if (remboursement.issue === "echec") {
        await echouerRemboursement(
          remboursement.utilisatriceId,
          remboursement.providerEventId,
          remboursement.type,
          remboursement.cle,
        );
        // Un remboursement refusé par la banque est un incident d'exploitation, pas un aléa : il
        // demande une reprise humaine. On le crie, sans PII (patron des logs de cette route).
        console.error("[stripe/webhook] remboursement en ÉCHEC chez Stripe — reprise nécessaire");
        return new NextResponse(null, { status: 200 });
      }
      await confirmerRemboursement(
        remboursement.utilisatriceId,
        remboursement.providerEventId,
        remboursement.type,
        remboursement.cle,
      );
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
    // ⚠️ LA FENÊTRE LÉGALE N'EST PAS UN RÉGLAGE DE CODE — MAIS SON ABSENCE DOIT SE VOIR (M10).
    //
    // L'art. L215-1 exige d'informer AU PLUS TÔT trois mois et AU PLUS TARD un mois avant le terme.
    // La date d'émission d'`invoice.upcoming` est un réglage du tableau de bord Stripe (« Événements
    // de renouvellement à venir »), dont le défaut documenté est de l'ordre de quinze jours — donc
    // HORS FENÊTRE. Le code ne peut pas le corriger ; ce qu'il peut, c'est cesser d'être aveugle.
    //
    // Sans ce contrôle, un délai mal réglé produit un courriel parti, une ligne
    // `information_reconduction` écrite, un webhook en 200 — et une obligation manquée, sans un seul
    // signal. On ENVOIE quand même (informer hors délai vaut mieux que ne pas informer), et on crie.
    //
    // Le verdict vit dans `lib/domain/abonnement` (revue du 2026-08-12) : les deux comparaisons
    // écrites ici en ligne étaient inatteignables par un test, et se taisaient sur une échéance
    // illisible — `NaN < 30` et `NaN > 92` sont tous deux faux.
    const verdict = fenetreInformationReconduction(reconduction.echeance, new Date());
    if (verdict !== "dans_la_fenetre") {
      console.error("[stripe/webhook] information de reconduction HORS FENÊTRE art. L215-1", {
        verdict,
        joursAvant: Math.round(joursAvantEcheance(reconduction.echeance, new Date()) ?? Number.NaN),
        attendu: `entre ${L215_JOURS_MIN} et ${L215_JOURS_MAX} jours — régler « Upcoming renewal events » dans Stripe`,
      });
    }
    try {
      // Réserver AVANT d'envoyer : envoyer puis réserver enverrait deux fois au moindre rejeu, et une
      // information légale envoyée en double est un incident, pas un détail. Patron `reserver_notification`
      // (0034) — sauf que ce chemin-ci ne consulte PAS le refus de canal, délibérément (AC4).
      if (await reserverInformationReconduction(
        reconduction.utilisatriceId,
        reconduction.providerEventId,
        reconduction.echeance,
      )) {
        try {
          await annoncerReconduction(reconduction.utilisatriceId, reconduction.echeance);
        } catch (envoi) {
          // ⚠️ L'ENVOI A ÉCHOUÉ — ON REND SON DROIT AU REJEU (revue du 2026-08-11, M11).
          //
          // La réservation est committée dans sa propre transaction, AVANT l'envoi. Sans cette
          // libération, les deux barrières d'idempotence refusent tout rattrapage : ni le même
          // `event.id`, ni un autre événement portant la même échéance. Le courriel de l'art.
          // L215-1 ne partirait JAMAIS, et `information_reconduction.envoye_le` attesterait qu'il
          // est parti.
          //
          // Le commentaire de `lib/courriel/reconduction.ts` justifiait l'inverse en affirmant que
          // « `invoice.upcoming` est réémis par Stripe tant que la facture n'est pas réglée ».
          // C'est faux : il est émis UNE FOIS par cycle, avant que la facture n'existe.
          await libererInformationReconduction(
            reconduction.utilisatriceId,
            reconduction.providerEventId,
            reconduction.echeance,
          );
          throw envoi; // → 500, donc rejeu Stripe, qui trouvera cette fois la place libre
        }
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
