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
  if (etape === "barre") redirect("/barriere"); // minorité détectée (1.9) : suspendu, sans signOut. Prime.
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

        <p className="t-corps">
          Le traitement de tes données sensibles est suspendu. Plus rien n&apos;est analysé ni
          ajouté.
        </p>
        <p className="t-corps">
          Il te reste deux choses à portée : récupérer ce qui t&apos;appartient, puis effacer ton
          compte. Aucune donnée n&apos;est exploitée entre-temps.
        </p>

        <div className={s.actions}>
          {/* ⚠️ CE BOUTON ÉTAIT DÉSACTIVÉ, AVEC « L'export sera disponible avant le lancement. »
              (revue adversariale du 2026-08-18, R11). Le texte datait de la 1.6 et n'avait jamais
              été repris après la 6.6, qui a LIVRÉ `/api/export` — deux autres écrans y pointaient
              déjà. Le seul geste actif de cette page était donc « Supprimer mon compte ».

              Quelqu'un qui exerce l'article 17 perdait définitivement ses données parce que le
              produit lui affirmait que l'article 15 n'existait pas encore. C'est le geste le plus
              irréversible du produit, et il était offert seul.

              Un `<a>` et non un `<form>` : la route sert le fichier en attachement, comme sur
              `/mes-donnees`. Rien à soumettre, rien qui dépende d'un script chargé. */}
          <a className={s.boutonSecondaire} href="/api/export">
            <span className="t-bouton">Exporter mes données</span>
          </a>
          <p className={s.motif}>
            Tu emportes tout : ce que tu as écrit, ce qu&apos;Anam a retenu, ton arbre. Le
            traitement reste suspendu pendant ce temps.
          </p>

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
