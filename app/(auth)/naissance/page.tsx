import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import FormulaireNaissance from "./formulaire-naissance";
import s from "./naissance.module.css";

export const metadata = { title: "Anam" }; // NFR-015 / AC7 — identité uniforme « Anam »

export default async function PageNaissance() {
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
  // Date déjà posée (AC4) : on ne la redemande jamais.
  if (etape === "consentement") redirect("/consentement");
  if (etape === "revoque") redirect("/consentement/revoque"); // consentement retiré → écran suspendu
  if (etape === "suite") redirect("/"); // déjà consenti → la scène

  return (
    <main className={s.page}>
      <div className={s.contenu}>
        <p className="t-surtitre">Une dernière chose</p>
        <h1 className="t-display">Ta date de naissance</h1>
        <p className="t-anam">
          Anam est réservée aux <strong>18 ans ou plus</strong>. Ta date reste
          privée ; elle servira plus tard à dessiner ton socle.
        </p>
        <FormulaireNaissance />
      </div>
    </main>
  );
}
