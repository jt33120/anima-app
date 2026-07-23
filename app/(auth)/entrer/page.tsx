import FormulaireEntree from "./formulaire-entree";
import s from "./entrer.module.css";

// Titre discret — ne trahit ni spiritualité ni intimité (NFR-015).
export const metadata = { title: "Entrer" };

export default function PageEntrer() {
  return (
    <main className={s.page}>
      <div className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-display">Entrer</h1>
        <p className="t-anam">
          Laisse-moi ton adresse. Je t&apos;enverrai un lien — pas de mot de passe
          à retenir, rien à perdre.
        </p>
        <FormulaireEntree />
      </div>
    </main>
  );
}
