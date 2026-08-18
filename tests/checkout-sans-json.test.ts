import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sansCommentaires } from "./_absence";
import * as c from "@/render/abonnement/copie-abonnement";

/**
 * checkout-sans-json.test.ts — AUCUNE SORTIE DE LA VENTE NE RÉPOND EN LANGAGE MACHINE
 * (revue des Epics 1 à 4, trouvaille #16 · balayage QA).
 *
 * ══ CE QUI SE PASSAIT ═════════════════════════════════════════════════════════════════════════
 *
 * `/api/stripe/checkout` est POSTée par un `<form>` HTML SANS JavaScript — c'est délibéré, la même
 * exigence que la porte de sortie : acheter ne dépend pas d'un script qui se charge. La conséquence
 * est qu'un `NextResponse.json(...)` n'est pas « une réponse d'API » : le navigateur REMPLACE la page
 * par le texte du corps. Plein écran, sans mise en forme, sans retour possible autre que « Précédent » :
 *
 *     {"code":"compte_non_eligible","message":"Indisponible pour le moment."}
 *
 * Cinq sorties faisaient ça — dont celle qui accueille un compte RÉVOQUÉ ou soupçonné mineur, c'est-à-dire
 * quelqu'un que le produit vient de suspendre. Deux autres sorties de la même route redirigeaient
 * correctement (`paiement_indisponible`, `contrat_ouvert`) : la route se contredisait elle-même.
 *
 * ══ LA GARDE ══════════════════════════════════════════════════════════════════════════════════
 *
 * Elle est ABSOLUE et porte sur la SOURCE : ce fichier ne contient aucun `NextResponse.json`. Une garde
 * qui énumérerait les cinq cas laisserait passer le sixième qu'on écrira demain. C'est le patron
 * `PortCourriel` : on ne demande pas à l'appelant d'être discipliné, on lui retire le moyen de ne pas l'être.
 */

const racine = process.cwd();
const lire = (p: string) => sansCommentaires(readFileSync(resolve(racine, p), "utf-8"));
const route = lire("app/api/stripe/checkout/route.ts");

describe("[revue 1-4, #16] la route de vente ne répond JAMAIS en JSON", () => {
  it("[LE CŒUR] aucun `NextResponse.json` dans la route — le POST vient d'un formulaire sans JS", () => {
    expect(
      route,
      "un corps JSON REMPLACE la page par du texte machine, plein écran",
    ).not.toMatch(/NextResponse\.json/);
  });

  it("chaque sortie est une redirection 303 vers une page qui parle français", () => {
    // 303 et non 302 : le POST ne doit PAS être rejoué en suivant la redirection.
    const redirections = route.match(/NextResponse\.redirect\(/g) ?? [];
    expect(redirections.length, "toutes les sorties passent par une redirection").toBeGreaterThanOrEqual(6);
    // Aucune redirection sans son 303 : on refuse la forme à deux arguments manquants.
    expect(route.match(/NextResponse\.redirect\(/g)?.length).toBe(
      route.match(/,\s*303\s*\)/g)?.length,
    );
  });

  it("la sortie qui refuse la VENTE renvoie vers `/abonnement`, pas vers une impasse", () => {
    // ⚠️ ET C'EST LA MACHINE D'ÉTAT DE LA PAGE QUI ROUTE ENSUITE, pas la route de vente.
    // `/abonnement` redirige déjà elle-même : barrée → /barriere, mineure → sortie, naissance
    // incomplète → /naissance, consentement manquant → /consentement. Un compte RÉVOQUÉ, lui, reste
    // sur /abonnement — délibérément (il a un abonnement à résilier et des droits à exercer).
    // Dupliquer ce routage ici serait une seconde machine d'état à maintenir, et la leçon 1.4 dit
    // exactement ce qu'il en advient : « une barrière oubliée dans un seul chemin suffit ».
    expect(route).toMatch(/etat=vente_fermee/);
  });

  it("une session Stripe injoignable ne rend pas un 502 nu", () => {
    expect(route).toMatch(/etat=paiement_injoignable/);
    // L'appel à Stripe lui-même est enveloppé : une panne réseau faisait un 500 de Next, donc la
    // page d'erreur du framework — en anglais, sur l'écran qui parle d'argent.
    expect(route).toMatch(/checkout\.sessions\.create/);
    const avant = route.indexOf("checkout.sessions.create");
    expect(route.lastIndexOf("try {", avant), "l'appel Stripe vit dans un try").toBeGreaterThan(
      route.indexOf("const libelle"),
    );
  });

  it("une session absente n'est jamais confondue avec une panne d'appel", () => {
    // Deux pannes distinctes, deux messages distincts : Stripe qui ne répond pas, et Stripe qui
    // répond sans URL. Les confondre dirait « réessaie » à quelqu'un que réessayer ne sauvera pas.
    expect(route).toMatch(/session\.url/);
  });
});

describe("[revue 1-4, #16] la page a une phrase pour chaque refus", () => {
  it("les trois refus d'entrée existent, en français, et disent que rien n'a été débité", () => {
    for (const [nom, texte] of [
      ["REFUS_VENTE_FERMEE", c.REFUS_VENTE_FERMEE],
      ["REFUS_PAIEMENT_INDISPONIBLE", c.REFUS_PAIEMENT_INDISPONIBLE],
      ["REFUS_PAIEMENT_INJOIGNABLE", c.REFUS_PAIEMENT_INJOIGNABLE],
    ] as const) {
      expect(typeof texte, `${nom} doit exister`).toBe("string");
      expect(texte.length, `${nom} ne doit pas être un libellé machine`).toBeGreaterThan(40);
      expect(texte, `${nom} doit dire que rien n'a été débité`).toMatch(/débité/i);
    }
  });

  it("[AD-9] le refus pendant un épisode de détresse n'explique RIEN et ne vend RIEN", () => {
    // ⚠️ CE TEXTE EST LU PAR QUELQU'UN EN CRISE. Il sert AUSSI le compte révoqué, et c'est délibéré :
    // nommer le motif exposerait l'épisode de détresse dans une phrase — et dans l'historique du
    // navigateur, par le paramètre d'URL. Le refus dit ce qui est, et s'arrête.
    expect(c.REFUS_VENTE_FERMEE).not.toMatch(/détresse|crise|épisode|suspend|révoqu|mineur/i);
    // Aucune relance commerciale : ni « reviens », ni « plus tard tu pourras », ni prix, ni geste.
    //
    // ⚠️ LE MOT « ABONNEMENT » EST AUTORISÉ, ET L'EXCLURE ÉTAIT UNE ERREUR DE MA PART. C'est le nom
    // de la chose qu'elle vient de cliquer : ne pas la nommer rendrait le refus obscur (« je ne peux
    // pas prendre ça maintenant » — prendre quoi ?). Ce qu'on interdit est la RELANCE : un verbe
    // d'achat, un prix, une offre, un rendez-vous.
    expect(c.REFUS_VENTE_FERMEE).not.toMatch(
      /m'abonner|souscri|offre|€|euros|premium|réessaie|reviens|plus tard/i,
    );
  });

  it("la page rend chacun de ces trois états", () => {
    const page = lire("app/abonnement/page.tsx");
    for (const etat of ["vente_fermee", "paiement_indisponible", "paiement_injoignable"]) {
      expect(page, `la page doit rendre \`?etat=${etat}\``).toMatch(
        new RegExp(`retour === "${etat}"`),
      );
    }
  });
});
