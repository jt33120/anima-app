import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { limitesCommercialesLevees } from "@/lib/safety/limites-commerciales";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { origineDuSite } from "@/lib/courriel/origine";
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

  // ⚠️ ON NE VEND PAS À UN COMPTE QUE LE PRODUIT VIENT DE SUSPENDRE (revue du 2026-08-13).
  //
  // La seule garde d'état ici était `limitesCommercialesLevees`, qui ne dérive QUE de
  // `episode_detresse.fin IS NULL`. Ni `barriere_minorite_le`, ni `mineur_detecte`, ni
  // `revoked_at` n'y entraient. Un compte suspendu pour minorité soupçonnée — donc à trente jours
  // de sa suppression, et à qui l'application n'affiche plus que l'écran /barriere — pouvait
  // POSTer cette route et être débité de 69 €. La session survit délibérément à la suspension
  // (l'export en a besoin, 1.9), donc le cookie est valide : rien ne s'y opposait.
  //
  // Encaisser l'argent de quelqu'un qu'on soupçonne d'être mineure, la veille de lui supprimer son
  // compte, est le pire moment possible pour une demande de remboursement.
  //
  // La garde réutilise `etapeOnboardingPour` — la MÊME machine d'état que toutes les pages — au
  // lieu d'ajouter ici une troisième lecture des mêmes colonnes. C'est la leçon 1.4, écrite dans
  // son en-tête : « une barrière oubliée dans un seul chemin suffit à laisser passer un mineur ».
  //
  // Ne borne QUE l'ENTRÉE dans le paiement. La SORTIE (résilier, rembourser) reste ouverte sans
  // condition — la fermer serait la faute grave, et `app/api/abonnement/resilier/route.ts` le dit.
  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape !== "suite") {
    return NextResponse.json(
      { code: "compte_non_eligible", message: "Indisponible pour le moment." },
      { status: 409 },
    );
  }

  // ⚠️ DÉJÀ ABONNÉE — ON NE MONTE PAS UNE SECONDE SOUSCRIPTION (revue du 2026-08-11, M9).
  //
  // La projection est UNE LIGNE PAR UTILISATRICE : `abonnement` ne peut porter qu'un seul
  // `stripe_subscription_id`. Deux souscriptions vivantes chez Stripe, et la ligne bascule de l'une
  // à l'autre au gré des `source_maj_le` — la cliente est débitée deux fois pendant que le bouton
  // « résilier » ne sait viser qu'un seul abonnement, parfois le mort. Le scénario n'est pas
  // théorique : double-clic sur deux onglets, ou seconde carte servie pendant que le webhook du
  // premier paiement n'est pas encore arrivé, ou simple POST sur cette route (c'est un formulaire).
  //
  // La garde vit ICI plutôt que dans le SQL, et c'est délibéré : rendre la projection
  // multi-abonnements serait une refonte pour un cas qu'on peut simplement ne plus créer.
  //
  // Lecture sous JWT (la RLS propriétaire est la garde). Une panne de lecture NE BLOQUE PAS le
  // Checkout : refuser de vendre à cause d'un timeout serait pire que le cas qu'on évite, et le
  // premier abonnement reste protégé par le fait qu'elle voit déjà sa carte d'abonnement.
  const { data: dejaAbonnee } = await supabase
    .from("abonnement")
    .select("etat, stripe_subscription_id")
    .maybeSingle<{ etat: string; stripe_subscription_id: string | null }>();
  if (dejaAbonnee?.etat === "actif" && dejaAbonnee.stripe_subscription_id) {
    return NextResponse.json(
      { code: "deja_abonnee", message: "Ton abonnement est déjà actif." },
      { status: 409 },
    );
  }

  // ⚠️ LA GARDE D'ORIGINE ÉTAIT MORTE (revue du 2026-08-13).
  //
  // La ligne lisait `process.env.NEXT_PUBLIC_SITE_URL` — un nom qui n'existe NULLE PART ailleurs dans
  // le dépôt : `.env.example` documente `ANIMA_SITE_URL`, et c'est cette variable-là que lit
  // `lib/courriel/origine.ts`. La variable étant toujours absente, c'était TOUJOURS le repli sur
  // `request.nextUrl.origin` — c'est-à-dire l'en-tête Host — qui servait, pendant que le commentaire
  // affirmait le contraire. Un garde qui se déclare actif en étant mort est pire qu'un garde absent :
  // il fait cesser de chercher.
  //
  // `origineDuSite()` est la MÊME base de confiance que les courriels (une seule variable à poser au
  // déploiement, pas deux), et elle VALIDE : `https` obligatoire hors localhost, aucun identifiant
  // dans l'URL, ni chemin ni requête ni fragment. Une origine douteuse rend `null`, jamais une valeur
  // approximative.
  //
  // Le repli sur l'origine de la requête est réservé au DÉVELOPPEMENT. En production, une origine non
  // configurée fait REFUSER la vente : c'est la doctrine déjà écrite dans `origine.ts` — « un lien
  // mort vaut mieux qu'un lien vers un domaine qu'on ne possède pas ». Un déploiement sans
  // `ANIMA_SITE_URL` n'envoie déjà plus aucun courriel ; encaisser 69 € en étant incapable de lui
  // écrire est le mauvais côté de la panne.
  const origine =
    origineDuSite() ?? (process.env.NODE_ENV === "development" ? request.nextUrl.origin : null);
  if (!origine) {
    return NextResponse.json(
      { code: "origine_non_configuree", message: "Indisponible pour le moment." },
      { status: 503 },
    );
  }
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
