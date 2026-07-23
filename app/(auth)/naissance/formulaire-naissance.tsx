"use client";

import { useActionState } from "react";
import { declarerAge, type EtatAge } from "./actions";
import s from "./naissance.module.css";

const initial: EtatAge = { statut: "saisie" };

export default function FormulaireNaissance() {
  const [etat, action, enCours] = useActionState(declarerAge, initial);

  if (etat.statut === "mineur") {
    return (
      <p className="t-anam" role="status">
        Ce lieu est réservé aux adultes. Reviens quand tu auras 18 ans — la porte
        restera là.
      </p>
    );
  }

  return (
    <form action={action} className={s.form}>
      <label htmlFor="date_naissance" className={s.etiquette}>
        {/* Étiquette VISIBLE (jamais un placeholder en guise d'étiquette) */}
        <span className="t-meta">Ta date de naissance</span>
        <input
          id="date_naissance"
          name="date_naissance"
          type="date"
          required
          className={s.champ}
        />
      </label>
      {etat.statut === "erreur" && etat.message ? (
        <p className={s.erreur}>{etat.message}</p>
      ) : null}
      <button type="submit" className={s.bouton} disabled={enCours}>
        <span className="t-bouton">{enCours ? "…" : "Continuer"}</span>
      </button>
    </form>
  );
}
