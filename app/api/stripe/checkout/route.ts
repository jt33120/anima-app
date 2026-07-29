import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { limitesCommercialesLevees } from "@/lib/safety/limites-commerciales";
import { clientStripe } from "@/lib/stripe/client";
import { PRIX_ABONNEMENT_ANNUEL_CENTIMES, DEVISE_ABONNEMENT, libelleReleveBancaire } from "@/lib/stripe/config";

/**
 * Route Checkout (Story 3.1, AC1/AC6). Crée une session Stripe Checkout HÉBERGÉE en mode
 * `subscription` (69 €/an = 6900 centimes EUR) et redirige vers `session.url`. La clé secrète vit
 * uniquement dans `lib/stripe/client` (jamais côté client). Runtime Node (crypto/SDK), jamais Edge.
 *
 * Garde AD-9 (défense en profondeur) : aucune sollicitation commerciale pendant un épisode de détresse
 * ouvert (`limites_levees`). La garde de MONTAGE de la carte (3.2) est la 1re couche ; cette vérif
 * serveur en est la 2de — une route API n'est pas de l'UI, elle applique la garde côté serveur.
 *
 * L'identité de la cliente est transportée dans `metadata` ET `subscription_data.metadata` : les
 * events `customer.subscription.*` (webhook) résolvent ainsi l'utilisatrice SANS dépendance à l'ordre
 * de livraison Stripe.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ code: "non_authentifie", message: "Session requise." }, { status: 401 });
  }

  // AD-9 : le commerce refuse de se monter tant que les limites sont levées (épisode ouvert).
  if (await limitesCommercialesLevees(user.id)) {
    return NextResponse.json(
      { code: "commerce_suspendu", message: "Indisponible pour le moment." },
      { status: 409 },
    );
  }

  // Origine de redirection depuis une base de confiance CONFIGURÉE (jamais l'en-tête Host entrant,
  // spoofable) ; repli sur l'origine de la requête en dev.
  const origine = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? request.nextUrl.origin;
  const libelle = libelleReleveBancaire();

  // Pas de clé d'idempotence STATIQUE par utilisatrice : Stripe met la réponse en cache 24 h → un
  // réabonnement légitime dans la fenêtre recevrait la MÊME session (déjà réglée). Chaque appel crée
  // une session neuve ; le double-clic est inoffensif (le webhook est idempotent par event.id, et
  // l'utilisatrice n'aboutit qu'un seul Checkout). Cf. deferred-work (jeton par tentative, Story 3.2).
  const session = await clientStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: DEVISE_ABONNEMENT,
          unit_amount: PRIX_ABONNEMENT_ANNUEL_CENTIMES,
          recurring: { interval: "year", interval_count: 1 },
          product_data: { name: "Abonnement Anima annuel" },
        },
      },
    ],
    success_url: `${origine}/?paiement=succes`,
    cancel_url: `${origine}/?paiement=annule`,
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: { utilisatriceId: user.id, ...(libelle ? { libelle_releve: libelle } : {}) },
    subscription_data: { metadata: { utilisatriceId: user.id } },
  });

  if (!session.url) {
    return NextResponse.json(
      { code: "checkout_indisponible", message: "Indisponible pour le moment." },
      { status: 502 },
    );
  }
  return NextResponse.redirect(session.url, 303);
}
