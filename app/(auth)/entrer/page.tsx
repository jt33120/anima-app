import FormulaireEntree from "./formulaire-entree";
import s from "./entrer.module.css";

// Titre discret — ne trahit ni spiritualité ni intimité (NFR-015).
export const metadata = { title: "Entrer" };

export default async function PageEntrer({
  searchParams,
}: {
  searchParams: Promise<{ refus?: string }>;
}) {
  const { refus } = await searchParams;

  return (
    <main className={s.page}>
      <div className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-display">Entrer</h1>
        {refus === "age" ? (
          <p className="t-anam" role="status">
            Ce lieu est réservé aux 18 ans ou plus. Reviens quand tu y seras — la
            porte restera là.
          </p>
        ) : (
          <>
            <p className="t-anam">
              Laisse-moi ton adresse. Je t&apos;enverrai un lien — pas de mot de
              passe à retenir, rien à perdre.
            </p>
            <FormulaireEntree />
          </>
        )}
      </div>
    </main>
  );
}
