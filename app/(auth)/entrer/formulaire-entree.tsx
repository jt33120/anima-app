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

  /* QA tour 1 (T28) — LE PRODUIT PORTE SES PROPRES MESSAGES, EN FRANÇAIS.
     Sans `noValidate`, le navigateur affiche sa bulle native — « Please fill in this field. » pour
     quiconque n'a pas un navigateur en français, sur le tout premier écran d'un produit qui, lui,
     ne parle que français. Le serveur valide déjà et répond dans la voix du produit ; il n'y avait
     qu'à cesser de laisser le navigateur parler à sa place.
     `required` RESTE : il est annoncé par les lecteurs d'écran, et c'est sa vraie fonction. */
  return (
    <form action={action} className={s.form} noValidate>
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
