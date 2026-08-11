"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { chercherLieux, enregistrerHeureEtLieu, type EtatHeure } from "./actions";
import type { LieuNaissance } from "@/lib/astro/lieux";
import s from "./heure-naissance.module.css";

/**
 * formulaire-heure.tsx — LA SAISIE (Story 5.3, T7 — AC4/AC7/AC8).
 *
 * ── POURQUOI L'HEURE ET LE LIEU SONT DEMANDÉS ENSEMBLE ─────────────────────────────────────────
 *
 * « 07:15 » ne désigne aucun instant sans le lieu, et l'ascendant a besoin des deux. Un formulaire
 * qui ne demanderait que l'heure tiendrait la promesse de la story mot à mot — « ton heure est
 * enregistrée » — et produirait exactement le même thème qu'avant. Le libellé de la porte d'entrée
 * reste « Ajouter mon heure » parce que c'est ce qu'elle cherche ; ici on lui dit pourquoi le lieu
 * vient avec.
 *
 * ── LA CONFIRMATION N'EST PAS UNE FORMALITÉ (AC8) ──────────────────────────────────────────────
 *
 * Ces colonnes sont WRITE-ONCE (migration 0039). Quelqu'un qui tape 07:15 au lieu de 19:15 a un
 * ascendant faux POUR TOUJOURS — et un ascendant faux a l'air juste. Le produit sait déjà traiter
 * un geste irréversible : la déclaration de rayonnement demande une confirmation solennelle. Même
 * patron ici, et on le dit AVANT, pas après.
 */

const initial: EtatHeure = { statut: "saisie" };

export default function FormulaireHeure() {
  const [etat, action, enCours] = useActionState(enregistrerHeureEtLieu, initial);

  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<readonly LieuNaissance[]>([]);
  const [choisi, setChoisi] = useState<LieuNaissance | null>(null);
  const idListe = useId();

  // Recherche différée : on n'interroge pas le serveur à chaque frappe. 250 ms est le seuil
  // au-delà duquel une frappe est finie sans que l'attente se sente.
  useEffect(() => {
    const q = requete.trim();
    if (choisi || q.length < 2) {
      setResultats([]);
      return;
    }
    let vivant = true;
    const t = setTimeout(() => {
      chercherLieux(q)
        .then((r) => {
          if (vivant) setResultats(r);
        })
        // Une recherche qui échoue ne casse rien : la liste reste vide, et rien ne prétend le contraire.
        .catch(() => {
          if (vivant) setResultats([]);
        });
    }, 250);
    return () => {
      vivant = false;
      clearTimeout(t);
    };
  }, [requete, choisi]);

  if (etat.statut === "enregistre") {
    return (
      <div>
        <p className="t-anam" role="status">
          C'est enregistré. Ton thème se recalcule tout seul — tu le verras à ton prochain passage.
        </p>
        {/* Un chemin de retour, jamais un cul-de-sac. */}
        <a className={s.bouton} href="/">
          <span className="t-bouton">Revenir</span>
        </a>
      </div>
    );
  }

  return (
    <form action={action} className={s.form}>
      <label htmlFor="heure_naissance" className={s.etiquette}>
        <span className="t-meta">L'heure de ta naissance</span>
        <input
          id="heure_naissance"
          name="heure_naissance"
          type="time"
          required
          className={s.champ}
          aria-describedby="heure_aide"
        />
        <span id="heure_aide" className="t-meta">
          Telle qu'elle est écrite sur ta copie intégrale d'acte de naissance.
        </span>
      </label>

      <label htmlFor="recherche_lieu" className={s.etiquette}>
        <span className="t-meta">Ta commune de naissance</span>
        <input
          id="recherche_lieu"
          type="text"
          autoComplete="off"
          className={s.champ}
          value={choisi ? choisi.nom : requete}
          role="combobox"
          aria-expanded={resultats.length > 0}
          aria-controls={idListe}
          aria-describedby="lieu_aide"
          onChange={(e) => {
            setChoisi(null);
            setRequete(e.target.value);
          }}
        />
        <span id="lieu_aide" className="t-meta">
          Sans le lieu, l'heure seule ne permet pas de calculer l'ascendant : c'est le lieu qui dit à
          quel instant « {"07:15"} » correspond. Le référentiel couvre la France.
        </span>
      </label>

      {/* Le CODE seul est posté : le serveur re-résout les coordonnées lui-même (voir `actions.ts`). */}
      <input type="hidden" name="code_lieu" value={choisi?.code ?? ""} />

      {resultats.length > 0 && (
        <ul id={idListe} className={s.resultats}>
          {resultats.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                className={s.resultat}
                onClick={() => {
                  setChoisi(l);
                  setResultats([]);
                }}
              >
                {l.nom}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* AC8 — l'irréversibilité, dite AVANT le geste. Le patron est celui de la confirmation
          solennelle du rayonnement (Story 4.7) : on ne découvre pas après coup qu'on s'est engagé. */}
      <label htmlFor="confirmation" className={s.case}>
        <input
          id="confirmation"
          name="confirmation"
          type="checkbox"
          value="oui"
          required
          className={s.checkbox}
        />
        <span className="t-corps">
          J'ai vérifié : cette heure et ce lieu s'enregistrent une seule fois et ne pourront plus
          être modifiés.
        </span>
      </label>

      {etat.statut === "erreur" && etat.message ? (
        <p className={s.erreur} role="alert">
          {etat.message}
        </p>
      ) : null}

      <button type="submit" className={s.bouton} disabled={enCours || !choisi}>
        <span className="t-bouton">{enCours ? "…" : "Enregistrer"}</span>
      </button>
    </form>
  );
}
