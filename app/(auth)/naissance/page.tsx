import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
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
    .select("date_naissance")
    .eq("id", user.id)
    .maybeSingle();

  // Saisie unique (AC4) : si la date est déjà posée, on n'en redemande jamais.
  if (u?.date_naissance) redirect("/consentement");

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
