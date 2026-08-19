import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { limitesCommercialesLevees } from "@/lib/safety/limites-commerciales";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { origineDuSite } from "@/lib/courriel/origine";
import { clientStripe } from "@/lib/stripe/client";
import { PRIX_ABONNEMENT_ANNUEL_CENTIMES, DEVISE_ABONNEMENT, libelleReleveBancaire } from "@/lib/stripe/config";
import { contratStripeVivant } from "@/lib/domain/abonnement";

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
 *
 * ══ AUCUNE SORTIE DE CE FICHIER NE REND UN CORPS JSON (revue des Epics 1 à 4, #16) ═══════════════
 *
 * Ce POST vient d'un `<form>` HTML SANS JavaScript — la même exigence que la porte de sortie :
 * acheter ne dépend pas d'un script qui se charge. La conséquence est qu'un `NextResponse.json(...)`
 * n'est pas « une réponse d'API » : le navigateur REMPLACE la page par le texte du corps, plein
 * écran, sans mise en forme. Cinq sorties faisaient ça, dont celle qui accueille un compte que le
 * produit vient de suspendre :
 *
 *     {"code":"compte_non_eligible","message":"Indisponible pour le moment."}
 *
 * Deux autres sorties de cette même route redirigeaient déjà correctement : la route se contredisait
 * elle-même. La garde est désormais ABSOLUE et vérifiée sur la source — `NextResponse.json` n'a plus
 * le droit d'apparaître ici. Énumérer les cinq cas aurait laissé passer le sixième écrit demain.
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
  // Sans session : la porte, pas un 401 nu. Elle n'a rien à lire d'une page d'abonnement.
  if (!user) {
    return NextResponse.redirect(new URL("/entrer", request.url), 303);
  }

  // AD-9 : le commerce refuse de se monter tant que les limites sont levées (épisode ouvert).
  //
  // ⚠️ LE MOTIF N'EST PAS DANS L'URL, ET C'EST LA RAISON DE PARTAGER `vente_fermee` AVEC LE CAS
  // SUIVANT. Un `?etat=commerce_suspendu` écrirait l'épisode de détresse dans la barre d'adresse,
  // puis dans l'historique du navigateur — devant qui regarde par-dessus l'épaule, et pour longtemps.
  if (await limitesCommercialesLevees(user.id)) {
    return NextResponse.redirect(new URL("/abonnement?etat=vente_fermee", request.url), 303);
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
  //
  // La redirection va sur `/abonnement`, et c'est LA MACHINE D'ÉTAT DE LA PAGE qui route ensuite :
  // barrée → `/barriere`, mineure → sortie de session, naissance incomplète → `/naissance`,
  // consentement manquant → `/consentement`. Un compte RÉVOQUÉ, lui, reste sur `/abonnement` —
  // délibérément : il a un abonnement à résilier et des droits à exercer, et l'enfermer ailleurs
  // ferait de la sortie une impasse. Refaire ce routage ici serait une seconde machine d'état à
  // maintenir, et la leçon 1.4 dit ce qu'il en advient.
  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape !== "suite") {
    return NextResponse.redirect(new URL("/abonnement?etat=vente_fermee", request.url), 303);
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
  //
  // ⚠️ LE PRÉDICAT ÉTAIT FAUX, ET LA 3.6 VIENT D'INSTALLER LE BOUTON QUI L'ATTEINT (revue 3.6, R1).
  //
  // `etat === "actif"` ne dit PAS « il existe un contrat » : `past_due`, `unpaid`, `incomplete` et
  // `paused` sont projetés `expire` (défaut de `etatDepuisStatutStripe`), et ce sont exactement les
  // souscriptions que Stripe relance et finira par encaisser. Tant qu'aucune surface ne vendait dans
  // cet état, l'écart était théorique. Depuis la 3.6, `/abonnement` affiche « Ton abonnement n'est
  // plus actif », le bouton « Résilier » du contrat ENCORE OUVERT, et l'offre complète avec
  // « M'abonner » — trois choses contradictoires dans le même document.
  //
  // Ce qui arrivait au clic : nouveau Customer (la session ne pose que `customer_email`), seconde
  // souscription vivante, 69 € débités. Puis, la projection étant une-ligne-par-utilisatrice, le
  // premier événement postérieur de l'ANCIENNE souscription reprend la ligne — et le bouton
  // « Résilier » ne sait plus viser que le contrat mort. Elle paie 69 €/an pour un abonnement
  // qu'aucune surface du produit ne peut plus désigner : FR-060 et la loi du 16 août 2022.
  //
  // ⚠️ NI L'ÉTAT NI L'IDENTIFIANT NE SUFFISENT À TRANCHER, et c'est pour ça qu'on demande à Stripe.
  // Un abonnement RÉSILIÉ garde son `stripe_subscription_id` : refuser sur « identifiant non nul »
  // enfermerait dehors quiconque a résilié une fois. Et `expire` confond `past_due` (vivant) avec
  // `incomplete_expired` (mort) — une première carte refusée doit pouvoir se réabonner.
  // L'appel n'a lieu QUE s'il y a un identifiant à interroger : le cas nominal (compte gratuit) ne
  // paie rien. Une panne de Stripe fait REFUSER : le repli est du côté qui ne débite pas deux fois.
  // ⚠️ LE PAIEMENT EST-IL SEULEMENT CONFIGURÉ ? (porte pré-lancement §4)
  //
  // `clientStripe()` REFUSE de se construire avec une clé de TEST sur un déploiement de production :
  // un Checkout y aboutirait sans qu'un centime soit encaissé, et le webhook projetterait un
  // abonnement en base. On l'appelle ICI, avant toute autre chose, pour que ce refus devienne un
  // message lisible — et non un 500, ni pire : un « contrat déjà ouvert » emprunté au bloc suivant,
  // qui dirait à quelqu'un une chose fausse sur son propre abonnement.
  try {
    clientStripe();
  } catch (e) {
    console.error("[stripe/checkout] paiement non configuré", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
    return NextResponse.redirect(new URL("/abonnement?etat=paiement_indisponible", request.url), 303);
  }

  const { data: dejaAbonnee } = await supabase
    .from("abonnement")
    .select("etat, stripe_subscription_id")
    .maybeSingle<{ etat: string; stripe_subscription_id: string | null }>();
  if (dejaAbonnee?.stripe_subscription_id) {
    let contratCourt: boolean;
    try {
      const sub = await clientStripe().subscriptions.retrieve(dejaAbonnee.stripe_subscription_id);
      contratCourt = contratStripeVivant(sub.status);
    } catch (e) {
      // `resource_missing` = Stripe ne connaît pas cette souscription : il n'y a rien à débiter, on
      // ne l'enferme pas dehors pour une ligne périmée. Tout autre échec est une IGNORANCE, et on
      // n'encaisse pas dans l'ignorance.
      contratCourt = (e as { code?: string })?.code !== "resource_missing";
      if (contratCourt) console.error("[stripe/checkout] statut d’abonnement illisible");
    }
    if (contratCourt) {
      // Redirection, pas JSON : ce POST vient d'un `<form>` sans JavaScript (MontagePaywall), donc un
      // corps JSON REMPLACE la page par du texte machine. La sortie (`resilier`) rendait déjà un
      // retour humain sur son chemin d'échec ; l'entrée n'en avait aucun.
      return NextResponse.redirect(new URL("/abonnement?etat=contrat_ouvert", request.url), 303);
    }
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
  //
  // Même VÉRITÉ que la clé de test ci-dessus, donc même message : quelque chose n'est pas en place
  // de notre côté, rien n'a été débité, et recharger n'y changera rien. Deux `etat` distincts pour
  // une seule phrase auraient prétendu à une distinction que l'utilisatrice ne peut pas exploiter.
  if (!origine) {
    console.error("[stripe/checkout] ANIMA_SITE_URL absente ou invalide en production");
    return NextResponse.redirect(new URL("/abonnement?etat=paiement_indisponible", request.url), 303);
  }
  const libelle = libelleReleveBancaire();

  // Pas de clé d'idempotence STATIQUE par utilisatrice : Stripe met la réponse en cache 24 h → un
  // réabonnement légitime dans la fenêtre recevrait la MÊME session (déjà réglée). Chaque appel crée
  // une session neuve ; le double-clic est inoffensif (le webhook est idempotent par event.id, et
  // l'utilisatrice n'aboutit qu'un seul Checkout). Cf. deferred-work (jeton par tentative, Story 3.2).
  // ⚠️ L'APPEL LUI-MÊME EST ENVELOPPÉ. Sans ce `try`, une panne réseau ou un refus d'API remontait
  // en exception : Next rendait sa page d'erreur — en anglais, non stylée, sur l'écran qui parle
  // d'argent. C'était la SIXIÈME sortie machine de cette route, et la seule qu'aucun `code` ne nommait.
  let session: Awaited<ReturnType<ReturnType<typeof clientStripe>["checkout"]["sessions"]["create"]>>;
  try {
    session = await clientStripe().checkout.sessions.create({
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
  } catch (e) {
    console.error("[stripe/checkout] création de session refusée", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
    return NextResponse.redirect(new URL("/abonnement?etat=paiement_injoignable", request.url), 303);
  }

  // Stripe a répondu, mais sans URL : rien n'a été ouvert, donc rien n'a été débité. Même issue que
  // l'échec d'appel — c'est la même chose du point de vue de celle qui a cliqué.
  if (!session.url) {
    console.error("[stripe/checkout] session créée sans URL");
    return NextResponse.redirect(new URL("/abonnement?etat=paiement_injoignable", request.url), 303);
  }
  return NextResponse.redirect(session.url, 303);
}
