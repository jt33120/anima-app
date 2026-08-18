import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { chargerOuverture } from "@/lib/safety/ouverture-branche";
import { chargerProjectionArbre } from "@/lib/safety/projection-arbre";
import { lireBibliotheque } from "@/lib/data/lire-bibliotheque";
import { lireFilRecent } from "@/lib/data/depot-fil";
import { lireThemeNatal } from "@/lib/data/depot-theme-natal";
import { estPremiumCourante } from "@/lib/data/lire-abonnement";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import SceneDom from "@/render/scene-dom";
import { marquerAnnonceSocleDite } from "@/app/_socle/marquer-annonce";
import { marquerHypotheseDite } from "@/app/_enneagramme/marquer-hypothese";

/**
 * ⚠️ RENDUE À LA DEMANDE, ET C'EST UNE GARDE (revue adversariale, R5).
 *
 * `proxy.ts` pose un nonce NOUVEAU À CHAQUE REQUÊTE, et `script-src` porte `'strict-dynamic'` — qui,
 * en CSP niveau 3, fait IGNORER `'self'` et toutes les sources d'hôte. Une page PRÉRENDUE porte donc
 * un HTML figé dont aucun `<script>` ne peut être noncé : le navigateur les refuse tous, React ne
 * s'hydrate jamais, et les composants clients de la page sont à l'écran sans réagir.
 *
 * Cette page-ci l'était DÉJÀ par inférence — elle lit la session, donc Next la rend à la demande.
 * C'est précisément l'inférence qui a piégé `/aide`, dont l'en-tête se félicitait de « ne lire aucune
 * session » : le jour où elle a cessé d'en lire une, elle est devenue statique et muette, sans qu'une
 * seule ligne de son code ne change. On le DÉCLARE donc, plutôt que de le déduire d'un détail
 * d'implémentation qu'un correctif peut retirer.
 */
export const dynamic = "force-dynamic";


/*
 * La scène — le cœur du lieu. Accessible SEULEMENT une fois le seuil légal franchi :
 * compte (1.3) + majorité (1.4) + consentement art. 9 (1.5). Garde symétrique des pages
 * d'onboarding, adossée à la source unique `etat-onboarding.ts` : toute étape inachevée
 * renvoie à sa halte, jamais l'inverse. La scène ici est encore un PROTOTYPE 2D (Story 1.2) —
 * la version formalisée (modèle/rendu séparés AD-7, doublage non-spatial, tokens) est la Story 1.7.
 */
export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const etape = await etapeOnboardingPour(supabase, user.id);
  // Minorité DÉTECTÉE après coup (1.9, FR-071) : compte suspendu → /barriere. On NE signOut PAS
  // (l'export a besoin de la session RLS) ; cet état prime sur tout le reste.
  if (etape === "barre") redirect("/barriere");
  // Mineur signalé : refusé même avec une session (barrière persistante, FR-070).
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");
  if (etape === "revoque") redirect("/consentement/revoque"); // consentement retiré → écran suspendu

  // etape === "suite" : le seuil est franchi → la scène (adaptateur DOM/2D, AD-7).
  // Story 4.5 / 4.10 : « le lendemain », y a-t-il un moment à ouvrir ? Et si oui, Anam PROPOSE-t-elle une
  // branche de plus, ou INVITE-t-elle à faire vivre celles qui attendent (FR-030) ? La décision est
  // serveur, et le compte de branches ouvertes ne franchit PAS cette ligne (FR-031). Repli sûr → null.
  // Story 4.6 : la PROJECTION RÉELLE de l'arbre (branches possédées + verbatim, AD-8), repli sûr → arbre vide.
  // Les deux lectures sous JWT, en parallèle ; jamais un 500 qui bloquerait l'ouverture de la scène.
  // Story 5.6 — LE THÈME NATAL EST LU UNE SEULE FOIS POUR TOUTE LA PAGE.
  //
  // Deux consommateurs en ont besoin : le drapeau de tronc incomplet (`chargerProjectionArbre`, 5.3)
  // et la bibliothèque de l'accueil (5.6). Or `lireThemeNatal` fait deux requêtes et peut ÉCRIRE —
  // premier calcul d'un compte, ou recalcul après l'ajout de l'heure —, et dans le cas dégradé ce
  // calcul coûte ~663 lectures d'éphéméride. Les laisser le lire chacun de leur côté DANS LE MÊME
  // `Promise.all` lançait deux calculs concurrents et deux écritures en course.
  //
  // L'éphéméride est composée ici, une fois, et partagée pour la même raison.
  const ephemeride = ephemerideAstronomyEngine();
  const [theme, premium] = await Promise.all([
    lireThemeNatal(supabase, user.id, ephemeride).catch(() => undefined),
    // L'entitlement ne sert QU'À RETIRER des cartes que ce compte n'a pas — jamais à en verrouiller
    // une (FR-057). Repli sur `false` en cas de panne de lecture : « le doute suspend le commerce »
    // (3.1). Aujourd'hui sans effet — aucune carte de la bibliothèque n'est premium avant la 5.8.
    estPremiumCourante().catch(() => false),
  ]);

  // Story 4.5 / 4.10 : « le lendemain », y a-t-il un moment à ouvrir ? Story 4.6 : la PROJECTION
  // RÉELLE de l'arbre. Story 5.6 : la bibliothèque du socle. Les trois sous JWT, en parallèle ;
  // jamais un 500 qui bloquerait l'ouverture de la scène — chacune a son repli sûr.
  const maintenant = new Date();
  const [ouverture, projection, bibliotheque, historique] = await Promise.all([
    chargerOuverture(supabase, user.id),
    chargerProjectionArbre(supabase, user.id, theme),
    // La bibliothèque n'est pas un chemin critique : une panne rend `null`, et la scène s'ouvre
    // quand même (AC7). L'accueil est une région parmi quatre — la conversation et l'arbre ne
    // doivent pas tomber avec elle.
    lireBibliotheque(supabase, user.id, maintenant, premium, ephemeride, theme).catch(() => null),
    // QA tour 1 (T3) — LE FIL DÉJÀ ÉCRIT. Il était en base depuis la 4.1 et n'était jamais relu :
    // un rechargement laissait l'écran vide, alors que l'écran de consentement promet « ce que tu
    // lui confies est CONSERVÉ ». La garde d'état est DÉJÀ POSÉE plus haut (`etapeOnboardingPour`) :
    // un compte révoqué ou barré n'arrive jamais ici, donc ce verbatim art. 9 ne lui est pas servi.
    // Repli sûr → fil vide : mieux vaut un fil qu'on retrouvera au prochain chargement qu'une scène
    // qui ne s'ouvre pas.
    lireFilRecent(supabase, maintenant).catch(() => []),
  ]);
  return (
    <SceneDom
      projection={projection}
      ouverture={ouverture}
      bibliotheque={bibliotheque}
      historique={historique}
      onSocleAnnonce={marquerAnnonceSocleDite}
      onHypotheseDite={marquerHypotheseDite}
    />
  );
}
