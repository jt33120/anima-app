import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { lireAbonnement } from "@/lib/data/depot-resiliation";
import { resilierEnFinDePeriode, annulerResiliation } from "@/lib/stripe/resiliation";

/**
 * Route de RÉSILIATION (Story 3.5, AC1/AC3/AC7/AC8).
 *
 * ═══ LA GARDE AD-9 N'EST PAS ICI, ET C'EST LE POINT LE PLUS IMPORTANT DE CE FICHIER ═══════════════════
 *
 * `app/api/stripe/checkout/route.ts` refuse en 409 quand `limitesCommercialesLevees` est vrai — aucune
 * sollicitation commerciale pendant un épisode de détresse ouvert. La symétrie est tentante, et elle
 * serait une faute grave : appliquer la même garde ici EMPÊCHERAIT DE RÉSILIER quelqu'un en crise. Le
 * dark pattern maximal, appliqué à la personne la plus vulnérable du produit, au nom d'une garde de
 * sécurité.
 *
 * AD-9 protège contre le commerce ENTRANT. Sortir n'est pas du commerce. La garde n'a donc rien à faire
 * ici, ni dans la route de remboursement, ni sur le point d'entrée qui mène à `/abonnement`.
 *
 * C'est la TROISIÈME direction de doute du projet, et elles ne sont pas interchangeables :
 *   • `limitesCommercialesLevees` → défaut `true`  : le doute SUSPEND le commerce ;
 *   • `premiumSousJwt`            → défaut `false` : le doute FERME l'écriture ;
 *   • ici                         → aucune garde   : rien ne ferme la sortie, jamais.
 *
 * ═══ RÉVERSIBLE ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `DELETE` résilie, `POST` annule la résiliation. Sans ce second chemin, un clic serait irréversible côté
 * produit alors qu'il ne l'est pas côté Stripe : il faudrait se réabonner — donc repayer — pour défaire
 * un geste. Même règle que le désabonnement courriel de la 4.9, qui rouvre le canal avec le même jeton.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

async function abonnementDe() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erreur: NextResponse.json({ code: "non_authentifie" }, { status: 401 }) } as const;

  const abonnement = await lireAbonnement();
  if (!abonnement?.subscriptionId) {
    // Rien à résilier : compte gratuit, ou abonnement jamais projeté. On répond 404 plutôt que 400 —
    // il n'y a pas d'erreur de la part de l'appelante, il n'y a simplement pas d'objet.
    return { erreur: NextResponse.json({ code: "aucun_abonnement" }, { status: 404 }) } as const;
  }
  return { subscriptionId: abonnement.subscriptionId } as const;
}

/**
 * POST seul, et le sens vient de l'URL (`?reprendre=1`), jamais d'un corps.
 *
 * Deux raisons, et la seconde est celle qui compte. D'abord un formulaire HTML ne sait faire que GET et
 * POST : un `DELETE` obligerait à du JavaScript, donc à ce que résilier dépende d'un script chargé — la
 * porte de sortie ne dépend de rien. Ensuite, et surtout : ne lire AUCUN corps de requête rend le
 * questionnaire de départ INÉCRIVABLE (AC2). Il n'existe pas de paramètre où loger « pourquoi
 * partez-vous ? ». C'est la stratégie de `PortCourriel` appliquée ici — on ne demande pas à l'appelant
 * d'être discipliné, on lui retire le moyen de ne pas l'être, et `tests/sortie-abonnement.test.ts` le
 * vérifie sur la source.
 */
export async function POST(request: Request) {
  const r = await abonnementDe();
  if ("erreur" in r) return r.erreur;

  const reprendre = new URL(request.url).searchParams.get("reprendre") === "1";

  try {
    if (reprendre) {
      await annulerResiliation(r.subscriptionId);
      return NextResponse.redirect(new URL("/abonnement?etat=reprise", request.url), 303);
    }
    await resilierEnFinDePeriode(r.subscriptionId);
    // L'ÉTAT ne bouge pas, et c'est voulu : Stripe garde `status = active` jusqu'à l'échéance, donc
    // `etat` reste `actif` et l'accès court jusqu'à la fin payée (AC8). Ce qui change est la DATE
    // (`resiliation_demandee_le`), projetée par le webhook et relue par la page.
    return NextResponse.redirect(new URL("/abonnement?etat=resilie", request.url), 303);
  } catch (e) {
    console.error("[abonnement/resilier] échec", { nom: e instanceof Error ? e.name : "inconnu" });
    return NextResponse.redirect(new URL("/abonnement?etat=echec", request.url), 303);
  }
}
