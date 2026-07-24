import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { supprimerCompteRevoque } from "../actions";
import s from "../consentement.module.css";

// Titre discret (NFR-015) — identique partout.
export const metadata = { title: "Anam" };

/**
 * Écran « traitement art. 9 suspendu » (Story 1.6, AC4). Accessible seulement à une utilisatrice
 * révoquée (étape "revoque"). Registre produit, JAMAIS signé Anam : on énonce les faits, on
 * propose l'export (différé, epic données) PUIS la suppression — sans rétention ni reconquête.
 */
export default async function PageRevoque({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");
  if (etape === "suite") redirect("/"); // pas (ou plus) révoquée → rien à faire ici
  // etape === "revoque" : traitement suspendu.

  return (
    <main className={s.page}>
      <div className={s.contenu}>
        <p className="t-surtitre">Traitement suspendu</p>
        <h1 className="t-display">Ton consentement est retiré</h1>

        {erreur === "suppression" ? (
          <p className={s.erreur} role="alert">
            La suppression n&apos;a pas pu aboutir. Ton compte est toujours là — tu peux
            réessayer.
          </p>
        ) : null}

        <p className="t-anam">
          Le traitement de tes données sensibles est suspendu. Plus rien n&apos;est analysé ni
          ajouté.
        </p>
        <p className="t-corps">
          Il te reste deux choses à portée : récupérer ce qui t&apos;appartient, puis effacer ton
          compte. Aucune donnée n&apos;est exploitée entre-temps.
        </p>

        <div className={s.actions}>
          <button
            className={s.boutonSecondaire}
            type="button"
            disabled
            style={{ opacity: 0.6 }}
          >
            <span className="t-bouton">Exporter mes données</span>
          </button>
          <p className={s.motif}>L&apos;export sera disponible avant le lancement.</p>

          <form action={supprimerCompteRevoque} style={{ display: "flex" }}>
            <button className={s.boutonDanger} type="submit" style={{ flex: 1 }}>
              <span className="t-bouton">Supprimer mon compte</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
