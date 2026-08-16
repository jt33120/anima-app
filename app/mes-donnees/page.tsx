import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import * as copie from "@/lib/domain/copie-mes-donnees";
import s from "@/render/mes-donnees/mes-donnees.module.css";

// NFR-015 / identité de route — « Anam » partout, jamais un titre qui dit l'intimité de la page.
export const metadata = { title: "Anam" };

/** État de compte : jamais mis en cache, jamais pré-rendu. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /mes-donnees — LA HALTE « MES DONNÉES » (Story 6.6, AC1/AC2).
 *
 * ══ TOUT CE QUE CETTE PAGE NE FAIT PAS ══════════════════════════════════════════════════════════
 *
 * Elle ne demande pas pourquoi. Elle n'annonce pas de délai. Elle ne propose rien d'autre. Elle ne
 * parle pas de fermer un compte. L'AC1 interdit la friction dissuasive et l'AC2 exige que l'export
 * soit AUTONOME — « jamais conditionné à une fermeture de compte ou à une suppression ». La forme
 * la plus sûre de tenir les deux est celle-ci : un titre, une phrase, un lien.
 *
 * ⚠️ ET IL N'Y A PAS D'ÎLOT CLIENT. Le téléchargement est un `<a href>` : aucun JavaScript, donc
 * aucun état, donc aucune façon d'échouer en silence. Un bouton qui `fetch` puis fabrique un Blob
 * aurait ajouté trois manières de perdre le fichier sans le dire, sur la seule page où perdre le
 * fichier ressemble à perdre les données.
 *
 * ⚠️ `revoque` N'EST PAS REDIRIGÉ — même décision que `/memoire` et pour la même raison : l'accès
 * (art. 15) survit à la révocation, exactement comme l'effacement (art. 17). L'enfermer sur l'écran
 * de révocation ferait de l'exercice d'un droit une impasse.
 *
 * `barre` L'EST, en revanche, et c'est cohérent : `/barriere` porte déjà le même lien d'export, et
 * c'est la page qui lui explique où elle en est.
 */
export default async function PageMesDonnees({
  searchParams,
}: {
  searchParams: Promise<{ echec?: string }>;
}) {
  const { echec } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "barre") redirect("/barriere");
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");

  return (
    <main className={s.halte}>
      <h1 className={s.titreHalte}>{copie.TITRE_HALTE}</h1>
      <p className={s.introduction}>{copie.INTRODUCTION}</p>

      {/* Un seul geste, et il part tout de suite : la route sert le fichier en attachement. */}
      <a className={s.telecharger} href="/api/export">
        {copie.ACTION_EXPORTER}
      </a>

      <p className={s.precision}>{copie.CE_QUE_TU_EMPORTES}</p>
      <p className={s.precision}>{copie.RIEN_NE_CHANGE}</p>

      {/* La route renvoie ici quand la fabrication a échoué : elle ne sert JAMAIS un fichier vide. */}
      {echec && (
        <p className={s.echec} role="status">
          {copie.ECHEC}
        </p>
      )}
    </main>
  );
}
