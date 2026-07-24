import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import SceneImmersive from "./_scene/scene-immersive";

export const metadata = { title: "Anam" };

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
  // Mineur signalé : refusé même avec une session (barrière persistante, FR-070).
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");
  if (etape === "revoque") redirect("/consentement/revoque"); // consentement retiré → écran suspendu

  // etape === "suite" : le seuil est franchi → la scène.
  return <SceneImmersive />;
}
