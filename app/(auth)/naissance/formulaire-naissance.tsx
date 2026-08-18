"use client";

import { useActionState } from "react";
import { declarerAge, type EtatAge } from "./actions";
import s from "./naissance.module.css";

const initial: EtatAge = { statut: "saisie" };

/**
 * Story 5.2 (T4) — deux champs ajoutés au formulaire EXISTANT, jamais un écran de plus.
 *
 * FR-048 déclare le prénom OBLIGATOIRE et le nom complet optionnel ; les colonnes existent depuis la
 * migration 0039 et personne ne les écrivait. Sans capture, trois des six nombres numérologiques
 * seraient absents pour toujours, et la « numérologie complète » de FR-055 serait à moitié creuse.
 *
 * Le choix de rester dans ce formulaire est délibéré : l'entrée est notée comme à refondre, et un
 * champ survit à une refonte de style là où un écran serait à jeter.
 *
 * ⚠️ Le nom complet est le nom DE NAISSANCE, **prénoms compris** — c'est ce que la numérologie
 * appelle le nom de naissance. L'étiquette le dit explicitement, faute de quoi la moitié des saisies
 * ne porteraient que le patronyme et le nombre d'expression serait faux sans que rien ne le signale.
 */
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
    /* QA tour 1 (T19) — CE QUI A ÉTÉ TAPÉ REVIENT APRÈS UN REFUS. `useActionState` réinitialise un
       formulaire non contrôlé après chaque action : une date au futur effaçait aussi le prénom, et
       tout était à ressaisir. L'action renvoie la saisie, ces `defaultValue` la remettent. */
    <form action={action} className={s.form}>
      <label htmlFor="prenom" className={s.etiquette}>
        {/* Étiquette VISIBLE (jamais un placeholder en guise d'étiquette) */}
        <span className="t-meta">Ton prénom</span>
        <input
          id="prenom"
          name="prenom"
          type="text"
          autoComplete="given-name"
          maxLength={100}
          defaultValue={etat.saisie?.prenom ?? ""}
          required
          className={s.champ}
        />
      </label>
      <label htmlFor="date_naissance" className={s.etiquette}>
        <span className="t-meta">Ta date de naissance</span>
        <input
          id="date_naissance"
          name="date_naissance"
          type="date"
          defaultValue={etat.saisie?.date ?? ""}
          required
          className={s.champ}
        />
      </label>
      <label htmlFor="nom_complet" className={s.etiquette}>
        <span className="t-meta">Ton nom complet de naissance, prénoms compris</span>
        <input
          id="nom_complet"
          name="nom_complet"
          type="text"
          autoComplete="name"
          maxLength={200}
          defaultValue={etat.saisie?.nomComplet ?? ""}
          aria-describedby="nom_complet_aide"
          className={s.champ}
        />
        {/* Le « pourquoi » est dit, et l'optionnalité aussi : rien n'est extorqué par le flou. */}
        <span id="nom_complet_aide" className="t-meta">
          Facultatif. Il sert à ta numérologie — sans lui, le reste se calcule quand même.
        </span>
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
