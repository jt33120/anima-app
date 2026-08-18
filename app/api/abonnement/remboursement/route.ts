import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { reserverRemboursement } from "@/lib/data/depot-resiliation";
import { rembourserIntegralement } from "@/lib/stripe/resiliation";

/**
 * Route de REMBOURSEMENT au titre de la garantie (Story 3.5, AC5/AC7).
 *
 * ── SANS QUESTIONNAIRE, SANS JUSTIFICATION ──────────────────────────────────────────────────────────────
 *
 * La route ne prend AUCUN corps de requête. Ce n'est pas une simplification : c'est l'AC5 rendu
 * structurel. Un champ « pourquoi partez-vous ? », même facultatif, même bien intentionné, est le premier
 * étage du parcours de rétention que l'AC2 interdit — et il n'y a ici aucun paramètre où le loger.
 *
 * ── AUCUNE GARDE AD-9, POUR LA MÊME RAISON QU'À LA RÉSILIATION ──────────────────────────────────────────
 *
 * Voir l'en-tête de `app/api/abonnement/resilier/route.ts`. Refuser de rendre son argent à quelqu'un
 * parce qu'il traverse un épisode de détresse serait l'exact inverse de ce que la garde protège.
 *
 * ── L'ORDRE : RÉSERVER EN BASE, PUIS APPELER STRIPE ─────────────────────────────────────────────────────
 *
 * La clé d'idempotence vient de la base et lui survit. Au retry — réseau coupé, lambda tuée, double-clic —
 * la réservation rend LA MÊME clé, et Stripe reconnaît la même opération au lieu d'en ouvrir une seconde.
 * L'inverse (appeler Stripe puis enregistrer) rembourserait autant de fois qu'il y a de tentatives, et le
 * bogue ne se verrait qu'en relevé bancaire.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const vers = (etat: string) => NextResponse.redirect(new URL(`/abonnement?etat=${etat}`, request.url), 303);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "non_authentifie" }, { status: 401 });

  let reservation;
  try {
    reservation = await reserverRemboursement(user.id, "garantie");
  } catch (e) {
    console.error("[abonnement/remboursement] échec réservation", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
    return vers("echec");
  }

  // « Pas éligible » n'est PAS une panne, c'est une réponse. Les distinguer permet à l'écran de dire
  // quelque chose de vrai plutôt que « réessaie », qui serait faux et l'enverrait se heurter au mur —
  // le patron `REFUS_RAYONNEMENT` de la 4.7.
  if (reservation === "non_eligible") return vers("non_eligible");

  // ⚠️ NE COURT-CIRCUITE QUE SI STRIPE A CONFIRMÉ (revue du 2026-08-11, M3).
  //
  // La version d'origine rendait « remboursée » dès que la réservation existait. Un premier appel
  // Stripe échoué — timeout, 5xx, lambda tuée — devenait donc DÉFINITIF : chaque nouvelle tentative
  // répondait « le remboursement arrive » sans jamais rappeler Stripe, et `confirme_le` n'était lue
  // nulle part, donc personne ne pouvait s'en apercevoir.
  //
  // C'est pourtant ce que la RPC de 0038 disait déjà en toutes lettres : « on rend la MÊME clé,
  // c'est ce qui fait qu'un retry de la route REPARLE À STRIPE de la même opération ». Reparler,
  // pas répondre. L'`idempotencyKey` existe exactement pour que ce rejeu ne rembourse pas deux fois.
  //
  // ⚠️ CE COURT-CIRCUIT N'EST JUSTE QUE PARCE QUE LA RÉSERVATION VISE LE CONTRAT COURANT
  // (revue adversariale du 2026-08-18, R3 · migration 0075). Tant que `remboursement` avait
  // `utilisatrice_id` en clé primaire, `dejaDemande` pouvait désigner un remboursement d'un contrat
  // CLOS : quelqu'un qui s'était réabonnée, avait repayé 69 € et rouvrait légitimement la garantie
  // lisait « le remboursement arrive sur ton moyen de paiement » sans que Stripe soit jamais appelé.
  // Une fausse confirmation, sans journal ni trace — et une confirmation ferme la question, là où un
  // refus aurait laissé une prise. Cette ligne n'a pas changé ; ce qu'elle interroge, si.
  if (reservation.dejaDemande && reservation.confirmeLe) return vers("rembourse");

  if (!reservation.subscriptionId) {
    console.error("[abonnement/remboursement] réservation sans subscriptionId");
    return vers("echec");
  }

  try {
    const issue = await rembourserIntegralement(reservation.subscriptionId, user.id, reservation.cle);
    // AUCUN PAIEMENT RETROUVÉ. Le cas est LÉGITIME sur le chemin minorité (FR-071 s'applique même à
    // un compte qui n'a jamais payé) et ANORMAL sur le chemin garantie, qui exige un abonnement
    // actif. On le dit à l'écran au lieu d'annoncer un virement, et on le journalise — sans PII.
    if (issue === "rien_a_rembourser") {
      console.error("[abonnement/remboursement] aucun paiement retrouvé — résilié sans remboursement");
      return vers("sans_paiement");
    }
    // La CONFIRMATION viendra du webhook `refund.created` (l'événement fait autorité, convention
    // « Événements externes ») — pas de cette réponse, qui dit seulement que la demande est partie.
    return vers("rembourse");
  } catch (e) {
    // La réservation RESTE en base, volontairement : elle porte la clé d'idempotence. Une nouvelle
    // tentative reprendra la même et Stripe ne remboursera pas deux fois. L'effacer « pour réessayer
    // proprement » est exactement ce qu'il ne faut pas faire.
    console.error("[abonnement/remboursement] échec Stripe", { nom: e instanceof Error ? e.name : "inconnu" });
    return vers("echec");
  }
}
