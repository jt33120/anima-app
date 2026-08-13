"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  donnerConsentement,
  refuser,
  type EtatConsentement,
} from "./actions";
import s from "./consentement.module.css";

const initial: EtatConsentement = { statut: "saisie" };

// Bouton de suppression : désactivé pendant l'action (évite le double-clic qui, sur un
// compte déjà supprimé, ferait échouer le 2e appel et afficherait une erreur trompeuse).
function BoutonSupprimer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={s.boutonDanger} disabled={pending}>
      <span className="t-bouton">
        {pending ? "Suppression…" : "Confirmer et supprimer mon compte"}
      </span>
    </button>
  );
}

export default function FormulaireConsentement() {
  const [etat, action, enCours] = useActionState(donnerConsentement, initial);
  const [art9, setArt9] = useState(false);
  const [cgu, setCgu] = useState(false);
  const [refus, setRefus] = useState(false);
  const pret = art9 && cgu;

  // Refus (AC6) : UNE confirmation franche, registre factuel — aucune culpabilisation ni reconquête.
  if (refus) {
    return (
      <section className={s.refus} aria-labelledby="refus-titre">
        <h2 id="refus-titre" className="t-titre-sm">
          Ces accords sont nécessaires pour utiliser Anam
        </h2>
        <p className="t-corps">
          Sans eux, il n&apos;y a pas de séance possible. Si tu confirmes, ton compte et
          tout ce qui s&apos;y rattache sont supprimés maintenant.
        </p>
        <div className={s.actions}>
          <form action={refuser}>
            <BoutonSupprimer />
          </form>
          <button
            type="button"
            className={s.boutonSecondaire}
            onClick={() => setRefus(false)}
          >
            <span className="t-bouton">Revenir</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <form action={action} className={s.form}>
      {/* Deux cases DISTINCTES, non pré-cochées, jamais groupées (FR-012 / NFR-006) */}
      <fieldset className={s.cases}>
        <legend className="t-meta">Tes deux accords, séparément</legend>

        <label className={s.case}>
          <input
            type="checkbox"
            name="art9"
            checked={art9}
            onChange={(e) => setArt9(e.target.checked)}
            className={s.checkbox}
          />
          {/* ⚠️ « ET CE QU'ELLE EN DÉDUIT » A ÉTÉ AJOUTÉ PAR LA STORY 5.5 (décision D12), ET CE
              N'EST PAS UN ENRICHISSEMENT DE STYLE.

              Jusque-là, la phrase ne couvrait que ce qu'elle PARTAGE. Or un type d'ennéagramme
              n'est pas partagé : il est PRODUIT par un score, ou INFÉRÉ par un modèle à partir de
              ses paroles. L'amont l'a qualifié en toutes lettres — « profil psychologique …
              catégories de données sensibles » (addendum.md:133).

              Et la garde technique ne l'aurait jamais dit : `a_consenti_art9()` ne vérifie qu'un
              booléen. Elle serait restée VERTE en laissant écrire une catégorie que le libellé ne
              nommait pas — une conformité d'apparence, exactement ce que FR-072 refuse. C'est donc
              le LIBELLÉ qui doit rattraper ce que la 5.5 ajoute, et avant toute écriture. */}
          <span className="t-corps">
            Je consens à ce qu&apos;Anam traite mes <strong>données sensibles</strong> —
            ce que je partage sur mon intériorité, mes croyances, mon vécu, et{" "}
            <strong>ce qu&apos;elle en déduit</strong> sur ma façon de fonctionner — pour
            m&apos;accompagner. C&apos;est le consentement « article&nbsp;9 » du RGPD.
          </span>
        </label>

        <label className={s.case}>
          <input
            type="checkbox"
            name="cgu"
            checked={cgu}
            onChange={(e) => setCgu(e.target.checked)}
            className={s.checkbox}
          />
          <span className="t-corps">
            J&apos;accepte les{" "}
            <a
              href="/cgu"
              target="_blank"
              rel="noopener noreferrer"
              className={s.lienTexte}
            >
              conditions d&apos;utilisation
            </a>{" "}
            et je confirme avoir <strong>18&nbsp;ans ou plus</strong>.
          </span>
        </label>
      </fieldset>

      {etat.statut === "erreur" && etat.message ? (
        <p className={s.erreur} role="alert">
          {etat.message}
        </p>
      ) : null}

      <div className={s.actions}>
        <button
          type="submit"
          className={s.bouton}
          disabled={!pret || enCours}
          aria-describedby={!pret ? "motif-blocage" : undefined}
        >
          <span className="t-bouton">{enCours ? "…" : "Je commence"}</span>
        </button>

        {/* AC3 : le MOTIF du blocage est écrit en toutes lettres (pas seulement l'état désactivé) */}
        {!pret ? (
          <p id="motif-blocage" className={s.motif} aria-live="polite">
            Coche les deux accords ci-dessus pour commencer.
          </p>
        ) : null}

        {/* AC3 : le refus est de lisibilité STRICTEMENT ÉGALE, jamais minoré */}
        <button
          type="button"
          className={s.boutonSecondaire}
          onClick={() => setRefus(true)}
        >
          <span className="t-bouton">Je ne veux pas</span>
        </button>
      </div>
    </form>
  );
}
