import FormulaireEntree from "./formulaire-entree";
import { entreeDemo, entreeDemoSuspendue } from "./actions";
import { ADIEU } from "@/lib/domain/copie-mes-donnees";
import s from "./entrer.module.css";

// NFR-015 / AC7 (1.7) — identité uniforme : « Anam » sur toutes les routes.
export const metadata = { title: "Anam" };

export default async function PageEntrer({
  searchParams,
}: {
  searchParams: Promise<{ refus?: string; efface?: string }>;
}) {
  const { refus, efface } = await searchParams;

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
            {/* Story 6.7 — le retour après l'effacement. Registre PRODUIT : `t-anam` serait la voix
                d'Anam, et Anam n'a plus rien à lui dire — elle vient de tout effacer. Le formulaire
                reste dessous : rien ne la retient, et rien ne l'empêche non plus de revenir. */}
            {efface === "1" && (
              <p className="t-meta" role="status">
                {ADIEU}
              </p>
            )}
            <p className="t-anam">
              Laisse-moi ton adresse. Je t&apos;enverrai un lien — pas de mot de
              passe à retenir, rien à perdre.
            </p>
            <FormulaireEntree />
          </>
        )}
        {process.env.NODE_ENV === "development" && (
          <div style={{ marginTop: "var(--esp-7)" }}>
            <p className="t-meta" style={{ marginBottom: "var(--esp-2)" }}>
              Dev — accès sans email (n&apos;existe pas en production)
            </p>
            <form action={entreeDemo}>
              <button type="submit" className={s.bouton}>
                <span className="t-bouton">Entrer directement (démo)</span>
              </button>
            </form>
            <form action={entreeDemoSuspendue} style={{ marginTop: "var(--esp-2)" }}>
              <button type="submit" className={s.bouton}>
                <span className="t-bouton">Entrer en compte suspendu (démo minorité)</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
