import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { lireAbonnement } from "@/lib/data/depot-resiliation";
import { resilierEnFinDePeriode, annulerResiliation } from "@/lib/stripe/resiliation";
import { creerDepotAbonnement } from "@/lib/data/depot-abonnement";
import { situationAbonnement, type EtatAbonnement } from "@/lib/domain/abonnement";

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

/**
 * PROJETER TOUT DE SUITE CE QUE STRIPE VIENT DE CONFIRMER (revue des Epics 1 à 4, #15).
 *
 * ══ LA CONTRADICTION QU'ON RETIRE ═════════════════════════════════════════════════════════════
 *
 * La route posait le drapeau chez Stripe puis redirigeait vers `/abonnement?etat=resilie`. La page se
 * rendait AVANT l'arrivée du webhook `customer.subscription.updated`, donc sur une projection qui
 * portait encore `resiliation_demandee_le = null`. Elle lisait, dans le même document :
 *
 *     « C'est fait. Tu gardes ton accès jusqu'à la fin de la période payée. »
 *     « Ton abonnement est actif. Il se renouvellera le 1 janvier 2027. »   [ Résilier mon abonnement ]
 *
 * Une confirmation, son démenti, une date de renouvellement qui n'aura pas lieu, et le bouton qu'elle
 * vient d'actionner. Le doute produit a une issue évidente et fausse : recliquer.
 *
 * ══ POURQUOI PAR LA MÊME RPC QUE LE WEBHOOK, ET PAS PAR L'URL ═════════════════════════════════
 *
 * `?jusqu=2027-01-01` aurait suffi à l'affichage — et aurait fait d'une date à portée juridique une
 * donnée dont la source est la barre d'adresse. On passe donc par `traiter_evenement_abonnement`,
 * l'écrivain unique : même dédup (`provider_event_id`), même horloge d'ordre (`source_maj_le`), même
 * anti-régression. La clé porte le préfixe `local:` — une collision avec un vrai `evt_…` ferait taire
 * le webhook correspondant.
 *
 * L'ÉTAT N'EST PAS INVENTÉ : on reprojette celui qu'on vient de lire. Écrire `actif` en dur serait
 * juste dans le cas nominal et faux pour un abonnement `past_due` (projeté `expire`) — résilier un
 * contrat en échec de paiement aurait alors RÉTABLI son accès à l'écran. Une résiliation ne change
 * pas l'état d'accès, elle ne change que la date.
 *
 * Les champs absents passent à `null` : la RPC les CONSERVE par coalesce. Inventer `debut_le`
 * remettrait à zéro le compteur des trois mois de la garantie FR-089.
 *
 * ⚠️ ET C'EST UN CONFORT, JAMAIS L'ENGAGEMENT. Le geste est déjà acquis chez Stripe quand cette
 * écriture a lieu : une panne de base ne doit pas faire dire « je n'ai pas pu enregistrer ça » à
 * quelqu'un dont le contrat EST résilié, ni l'inviter à recommencer un geste accompli. On journalise
 * et on tient la confirmation ; le webhook réparera la projection.
 */
async function projeterResiliation(
  utilisatriceId: string,
  subscriptionId: string,
  etat: EtatAbonnement,
  resiliationDemandeeLe: string | null,
): Promise<void> {
  const maintenant = new Date().toISOString();
  try {
    await creerDepotAbonnement().traiterEvenement({
      providerEventId: `local:resiliation:${subscriptionId}:${resiliationDemandeeLe ?? "reprise"}`,
      type: "local.resiliation",
      utilisatriceId,
      etat,
      customerId: null,
      subscriptionId,
      periodeFin: null,
      sourceMajLe: maintenant,
      debutLe: null,
      resiliationDemandeeLe,
    });
  } catch (e) {
    console.error("[abonnement/resilier] projection locale impossible — le webhook réparera", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
  }
}

/**
 * ⚠️ UNION DISCRIMINÉE EXPLICITE, ET CE N'EST PAS DE LA COSMÉTIQUE. Sans le champ `erreur: undefined`
 * sur la branche de succès, le rétrécissement par `"erreur" in r` produisait
 * `NextResponse | undefined` chez l'appelant : le compilateur ne savait plus que cette route rend
 * TOUJOURS une réponse. Un test qui lit `res.status` le découvrait ; la route, elle, n'avait aucune
 * garantie de type que ses deux chemins de refus étaient bien des réponses.
 */
type Abonnement =
  | { readonly erreur: NextResponse; readonly subscriptionId?: undefined }
  | {
      readonly erreur?: undefined;
      readonly subscriptionId: string;
      readonly utilisatriceId: string;
      readonly etat: EtatAbonnement;
    };

/**
 * ══ AUCUNE SORTIE DE CETTE ROUTE NE REND UN CORPS MACHINE (revue adversariale, R2 · revue 1-4 #16)
 *
 * Les deux refus ci-dessous rendaient un `NextResponse.json(...)`. Ce POST vient d'un `<form>` HTML
 * SANS JavaScript — c'est l'exigence même de la porte de sortie, écrite dans l'en-tête de la page —
 * donc le navigateur REMPLACE la page par le texte du corps, plein écran, sans mise en forme :
 *
 *     {"code":"aucun_abonnement"}
 *
 * Et les deux cas s'atteignent sans rien forger : une page laissée ouverte dans un second onglet
 * pendant qu'on résilie dans le premier, une session expirée entre l'affichage et le clic, un
 * signet. C'est le défaut #16, sur la route jumelle de celle où il a été trouvé.
 */
async function abonnementDe(request: Request): Promise<Abonnement> {
  const vers = (chemin: string) =>
    ({ erreur: NextResponse.redirect(new URL(chemin, request.url), 303) }) as const;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sans session : la porte, comme la page elle-même. Elle n'a rien à lire d'un 401 nu.
  if (!user) return vers("/entrer");

  const abonnement = await lireAbonnement();
  if (!abonnement?.subscriptionId) {
    // Rien à résilier : compte gratuit, ou abonnement jamais projeté. On la renvoie SANS `etat` :
    // la page dit alors « Tu n'as pas d'abonnement » et montre l'offre — ce qui est exactement vrai.
    return vers("/abonnement");
  }

  // ⚠️ LE CONTRAT EST-IL ENCORE VIVANT ? (revue adversariale du 2026-08-18, R2)
  //
  // Sur `etat = 'resilie'` — la résiliation ABOUTIE, `canceled` chez Stripe — les deux gestes de
  // cette route échouent chez le prestataire : « a canceled subscription can only update its
  // metadata ». La route tombait alors dans son `catch` et redirigeait vers `?etat=echec`, dont la
  // phrase est « Je n'ai pas pu enregistrer ça. Tu peux réessayer. » — et réessayer se heurtait au
  // même mur, indéfiniment. Le patron `REFUS_RAYONNEMENT` (4.7) : on ne promet pas un geste qu'on
  // sait impossible.
  //
  // La garde lit `situationAbonnement`, LA MÊME que la page : les deux surfaces ne peuvent plus
  // diverger sur ce qu'est un contrat mort. C'est aussi une vraie garde, pas un doublon d'affichage
  // — la page ne montre plus le bouton, mais un onglet resté ouvert POSTe encore.
  if (situationAbonnement(abonnement) === "termine") {
    return vers("/abonnement?etat=contrat_clos");
  }

  // ⚠️ UN ACCÈS OFFERT N'A RIEN À RÉSILIER, ET L'APPEL PARTIRAIT AVEC UN IDENTIFIANT NUL.
  //
  // La page ne montre pas le geste (`contratAResilier` l'exclut), et ce n'est PAS une raison de
  // l'omettre ici : un onglet resté ouvert POSTe encore, et la leçon est déjà écrite six lignes plus
  // haut pour le contrat clos. Sans cette garde, `subscriptions.update(null)` partirait chez Stripe
  // — au mieux une erreur, au pire une action sur un contrat qui n'est pas le nôtre.
  //
  // Elle tombe sur Anima, qui a l'accès offert : c'est exactement la personne à qui le produit ne
  // doit pas rendre une page d'erreur.
  if (situationAbonnement(abonnement) === "offert") {
    return vers("/abonnement?etat=rien_a_resilier");
  }

  // `etat` remonte avec l'identifiant : la projection locale le REPROJETTE tel quel (voir ci-dessus).
  return {
    subscriptionId: abonnement.subscriptionId,
    utilisatriceId: user.id,
    etat: abonnement.etat as EtatAbonnement,
  };
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
export async function POST(request: Request): Promise<NextResponse> {
  const r = await abonnementDe(request);
  if (r.erreur) return r.erreur;

  const reprendre = new URL(request.url).searchParams.get("reprendre") === "1";

  try {
    if (reprendre) {
      await annulerResiliation(r.subscriptionId);
      // `null` est une VALEUR ici, pas une absence : la RPC écrit `resiliation_demandee_le` en
      // écrasement FRANC pour ce champ, sinon l'écran dirait éternellement « résilié » à quelqu'un
      // qui est revenu.
      await projeterResiliation(r.utilisatriceId, r.subscriptionId, r.etat, null);
      return NextResponse.redirect(new URL("/abonnement?etat=reprise", request.url), 303);
    }
    // L'ÉTAT ne bouge pas, et c'est voulu : Stripe garde `status = active` jusqu'à l'échéance, donc
    // `etat` reste ce qu'il était et l'accès court jusqu'à la fin payée (AC8). Ce qui change est la
    // DATE (`resiliation_demandee_le`) — que Stripe vient de nous rendre, et qu'on projette
    // maintenant plutôt que d'attendre le webhook (revue des Epics 1 à 4, #15).
    const finAcces = await resilierEnFinDePeriode(r.subscriptionId);
    await projeterResiliation(r.utilisatriceId, r.subscriptionId, r.etat, finAcces);
    return NextResponse.redirect(new URL("/abonnement?etat=resilie", request.url), 303);
  } catch (e) {
    console.error("[abonnement/resilier] échec", { nom: e instanceof Error ? e.name : "inconnu" });
    return NextResponse.redirect(new URL("/abonnement?etat=echec", request.url), 303);
  }
}
