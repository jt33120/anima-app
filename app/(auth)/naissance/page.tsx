import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboarding } from "@/app/(auth)/onboarding";
import FormulaireNaissance from "./formulaire-naissance";
import s from "./naissance.module.css";

export const metadata = { title: "Bienvenue" };

export default async function PageNaissance() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const { data: u } = await supabase
    .from("utilisatrice")
    .select("date_naissance, mineur_detecte")
    .eq("id", user.id)
    .maybeSingle();

  const etape = etapeOnboarding(u);
  // Mineur signalé : refusé même avec une session (barrière persistante).
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  // Saisie unique (AC4) : date déjà posée → on ne la redemande jamais.
  if (etape === "suite") redirect("/consentement");

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
