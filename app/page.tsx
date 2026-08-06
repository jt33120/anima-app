import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { chargerOuverture } from "@/lib/safety/ouverture-branche";
import { chargerProjectionArbre } from "@/lib/safety/projection-arbre";
import SceneDom from "@/render/scene-dom";

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
  const [ouverture, projection] = await Promise.all([
    chargerOuverture(supabase),
    chargerProjectionArbre(supabase),
  ]);
  return <SceneDom projection={projection} ouverture={ouverture} />;
}
