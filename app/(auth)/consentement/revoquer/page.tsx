import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { revoquerConsentement } from "../actions";
import s from "../consentement.module.css";

// Titre discret (NFR-015) — identique partout, ne trahit rien.
export const metadata = { title: "Anam" };

/**
 * Confirmation de révocation du consentement art. 9 (Story 1.6, FR-012). Accessible seulement
 * à une utilisatrice consentante (étape "suite"). Registre neutre, honnête sur les conséquences,
 * sans dissuasion : la révocation est l'action principale, « Annuler » reste offert sans piège.
 * Le point d'entrée définitif (menu de compte / page transparence) viendra avec la scène (1.7+).
 */
export default async function PageRevoquer({
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
  if (etape === "revoque") redirect("/consentement/revoque"); // déjà révoqué → écran suspendu
  // etape === "suite" : consentante → elle peut retirer son consentement.

  return (
    <main className={s.page}>
      <div className={s.contenu}>
        <p className="t-surtitre">Ton consentement</p>
        <h1 className="t-display">Retirer ton consentement</h1>

        {erreur === "revocation" ? (
          <p className={s.erreur} role="alert">
            La révocation n&apos;a pas pu aboutir. Réessaie.
          </p>
        ) : null}

        <p className="t-corps">
          Tu peux retirer ton consentement au traitement de tes données sensibles quand tu
          veux. C&apos;est ton droit, et il n&apos;a pas à se justifier.
        </p>
        <p className="t-corps">
          Si tu le retires, le traitement s&apos;arrête : tu ne pourras plus tenir de séance.
          Tu pourras alors exporter tes données, puis supprimer ton compte.
        </p>

        <div className={s.actions}>
          <form action={revoquerConsentement} style={{ display: "flex" }}>
            <button className={s.boutonDanger} type="submit" style={{ flex: 1 }}>
              <span className="t-bouton">Retirer mon consentement</span>
            </button>
          </form>
          <Link
            href="/"
            className="t-meta"
            style={{ textAlign: "center", color: "var(--texte-doux)" }}
          >
            Annuler
          </Link>
        </div>
      </div>
    </main>
  );
}
