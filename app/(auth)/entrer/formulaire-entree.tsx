"use client";

import { useActionState } from "react";
import { envoyerLien, type EtatEntree } from "./actions";
import s from "./entrer.module.css";

const initial: EtatEntree = { ok: false };

export default function FormulaireEntree() {
  const [etat, action, enCours] = useActionState(envoyerLien, initial);

  if (etat.ok) {
    return (
      <p className="t-anam" role="status">
        Regarde ta boîte mail. Un lien t&apos;y attend — il t&apos;ouvrira la porte,
        sans mot de passe.
      </p>
    );
  }

  return (
    <form action={action} className={s.form}>
      <label htmlFor="email" className={s.etiquette}>
        {/* Étiquette VISIBLE (jamais un placeholder en guise d'étiquette) */}
        <span className="t-meta">Ton adresse e-mail</span>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="toi@exemple.fr"
          className={s.champ}
        />
      </label>
      {etat.message ? <p className={s.erreur}>{etat.message}</p> : null}
      <button type="submit" className={s.bouton} disabled={enCours}>
        <span className="t-bouton">{enCours ? "Envoi…" : "Recevoir mon lien"}</span>
      </button>
    </form>
  );
}
