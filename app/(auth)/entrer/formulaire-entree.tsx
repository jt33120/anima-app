"use client";

import { useActionState } from "react";
import { envoyerLien, verifierCode, type EtatEntree, type EtatCode } from "./actions";
import s from "./entrer.module.css";

const initial: EtatEntree = { ok: false };
const initialCode: EtatCode = {};

/**
 * DEUX PORTES DANS LE MÊME COURRIEL, ET C'EST DÉLIBÉRÉ.
 *
 * Le lien est la porte courte : un clic, rien à recopier. Mais il est PKCE — il n'ouvre que dans le
 * navigateur qui l'a demandé. Demander sur l'ordinateur et ouvrir le courriel sur le téléphone, et
 * il ne marche pas. C'est le cas le plus banal du monde.
 *
 * Le code est la porte qui traverse : il voyage par les yeux. On l'annonce donc SANS le présenter
 * comme un repli honteux — pour beaucoup de gens, ce sera le chemin normal.
 */
export default function FormulaireEntree() {
  const [etat, action, enCours] = useActionState(envoyerLien, initial);
  const [etatCode, actionCode, verifEnCours] = useActionState(verifierCode, initialCode);

  if (etat.ok) {
    return (
      <div className={s.form}>
        <p className="t-anam" role="status">
          C&apos;est parti{etat.adresse ? <> vers {etat.adresse}</> : null}. Le message contient un
          lien — il n&apos;ouvre que dans ce navigateur-ci — et un code à six chiffres, qui marche
          depuis n&apos;importe où.
        </p>
        {/* ⚠️ L'ADRESSE EST AFFICHÉE, ET CE N'EST PAS DE L'ORNEMENT. L'adresse vérifiée vient d'un
            cookie posé à la demande, jamais de ce formulaire. L'écrire ici est ce qui permet à
            quelqu'un de voir, AVANT de taper, que le code demandé ne concerne pas son adresse. */}
        <form action={actionCode} className={s.form} noValidate>
          <label htmlFor="code" className={s.etiquette}>
            <span className="t-meta">Le code reçu</span>
            {/* `maxLength` à 8 et non 6 : la production a un jour envoyé des codes à HUIT
                chiffres, et un champ tronqué à six les aurait rendus intapables sans rien
                afficher. Le serveur décide de la plage ; ce champ ne coupe jamais ce qu'il reçoit. */}
            <input
              id="code"
              name="code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="123456"
              className={s.champ}
            />
          </label>
          {etatCode.message ? <p className={s.erreur}>{etatCode.message}</p> : null}
          <button type="submit" className={s.bouton} disabled={verifEnCours}>
            <span className="t-bouton">{verifEnCours ? "Vérification…" : "Entrer avec ce code"}</span>
          </button>
        </form>
      </div>
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
