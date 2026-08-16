import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import * as copie from "@/lib/domain/copie-mes-donnees";
import { fenetreDepuisTexte } from "@/lib/domain/effacement";
import s from "@/render/mes-donnees/mes-donnees.module.css";
import { effacerTout } from "./actions";

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
  // AD-14 : l'échéance est lue à l'exécution, jamais codée en dur — et ce qu'on lui annonce est
  // exactement ce que le moteur inscrira sur la trace.
  const fenetre = fenetreDepuisTexte(process.env.EFFACEMENT_FENETRE_PITR_JOURS);

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
      {echec === "1" && (
        <p className={s.echec} role="status">
          {copie.ECHEC}
        </p>
      )}

      {/* ══ L'EFFACEMENT TOTAL (Story 6.7) ═══════════════════════════════════════════════════════
          ⚠️ IL VIENT APRÈS L'EXPORT, ET CE N'EST PAS UNE QUESTION DE MISE EN PAGE. L'AC3 exige
          qu'« un export soit proposé avant la suppression » : le lien est au-dessus, et la copie
          y renvoie. Une garde de test vérifie cet ordre dans la source — c'est la seule façon
          qu'un remaniement ne le retourne pas sans qu'on le voie. */}
      <section className={s.effacement}>
        <h2 className={s.titreSection}>{copie.SECTION_EFFACEMENT}</h2>
        <p className={s.precision}>{copie.EFFACEMENT_CE_QUI_PART}</p>

        {/* Ce qui ne peut pas partir, DÉRIVÉ du registre des sous-traitants : le jour où la liste
            change, l'écran change avec elle. Le taire serait le mensonge le plus facile de la page.
            ⚠️ AUCUNE CONDITION ICI — un mutant a montré qu'une condition dans le JSX se neutralise
            sans faire rougir personne. La phrase est fabriquée dans `lib/domain`, où elle s'éprouve. */}
        <p className={s.precision}>{copie.phraseCeQuiReste()}</p>

        <p className={s.precision}>{copie.effacementFenetre(fenetre)}</p>
        <p className={s.precision}>{copie.EFFACEMENT_EXPORT_DABORD}</p>

        {/* UNE seule confirmation, dans le MÊME formulaire : aucun écran ne s'interpose (AC3). */}
        <form className={s.formulaire} action={effacerTout}>
          <label className={s.confirmation}>
            <input type="checkbox" name="compris" value="oui" required />
            <span>{copie.EFFACEMENT_CONFIRMATION}</span>
          </label>
          <button type="submit" className={s.effacer}>
            {copie.ACTION_EFFACER}
          </button>
        </form>

        {echec === "effacement" && (
          <p className={s.echec} role="status">
            {copie.EFFACEMENT_ECHEC}
          </p>
        )}
        {echec === "confirmation" && (
          <p className={s.echec} role="status">
            {copie.EFFACEMENT_SANS_CONFIRMATION}
          </p>
        )}
      </section>
    </main>
  );
}
