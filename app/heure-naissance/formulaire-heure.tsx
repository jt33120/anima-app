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
 * ── MAIS LE LIEU NE DÉPEND PAS DE L'HEURE (revue du 2026-08-12, A2) ────────────────────────────
 *
 * Les deux champs étaient OBLIGATOIRES tous les deux. Quelqu'un qui ne connaît pas son heure de
 * naissance — la majorité des gens — ne pouvait donc pas non plus donner son LIEU, alors que le
 * lieu seul répare déjà beaucoup : il apporte le fuseau, qui ramène la fenêtre d'incertitude de
 * 50 h à 24 h et redonne un signe déterminable à des corps qui n'en avaient plus.
 *
 * Le champ n'est pas devenu « facultatif » pour autant : ne pas connaître son heure se DÉCLARE, par
 * une case. Les colonnes sont write-once — un thème gravé sans heure par distraction ne se
 * rattrape pas d'un clic, alors qu'une absence déclarée est un choix.
 *
 * ── ON NE REDEMANDE PAS CE QUI EST DÉJÀ GRAVÉ ─────────────────────────────────────────────────
 *
 * Le write-once de 0039 est PAR COLONNE : elle peut revenir six mois plus tard avec son heure. Le
 * formulaire n'affiche alors que ce qui manque encore, et rappelle en clair ce qui est déjà posé.
 *
 * ── LA CONFIRMATION N'EST PAS UNE FORMALITÉ (AC8) ──────────────────────────────────────────────
 *
 * Ces colonnes sont WRITE-ONCE (migration 0039). Quelqu'un qui tape 07:15 au lieu de 19:15 a un
 * ascendant faux POUR TOUJOURS — et un ascendant faux a l'air juste. Le produit sait déjà traiter
 * un geste irréversible : la déclaration de rayonnement demande une confirmation solennelle. Même
 * patron ici, et on le dit AVANT, pas après.
 */

const initial: EtatHeure = { statut: "saisie" };

export interface DejaGrave {
  /** `HH:MM:SS` déjà enregistrée, ou `null`. */
  readonly heure: string | null;
  /** Nom de commune déjà enregistré, ou `null`. */
  readonly lieu: string | null;
}

export default function FormulaireHeure({ deja }: { deja: DejaGrave }) {
  const [etat, action, enCours] = useActionState(enregistrerHeureEtLieu, initial);

  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<readonly LieuNaissance[]>([]);
  const [choisi, setChoisi] = useState<LieuNaissance | null>(null);
  const [sansHeure, setSansHeure] = useState(false);
  const idListe = useId();

  const demanderHeure = deja.heure === null;
  const demanderLieu = deja.lieu === null;

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
          {/* ⚠️ PAS DE FUTUR ADRESSÉ (revue du 2026-08-12, B6). La phrase disait « tu le verras à
              ton prochain passage » : un futur adressé à elle, dans la voix d'Anam (`t-anam`), sur
              l'écran même du socle — exactement ce que FR-053 interdit. Et c'était une promesse que
              le code ne peut pas tenir : le recalcul a lieu à la prochaine LECTURE, et il peut
              échouer. Le présent dit la même chose, et il est vrai. */}
          C'est enregistré. Ton thème se recalcule tout seul, la prochaine fois que tu ouvres Anima.
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
      {demanderHeure ? (
        <>
          <label htmlFor="heure_naissance" className={s.etiquette}>
            <span className="t-meta">L'heure de ta naissance</span>
            <input
              id="heure_naissance"
              name="heure_naissance"
              type="time"
              required={!sansHeure}
              disabled={sansHeure}
              className={s.champ}
              aria-describedby="heure_aide"
            />
            <span id="heure_aide" className="t-meta">
              Telle qu'elle est écrite sur ta copie intégrale d'acte de naissance.
            </span>
          </label>

          {/* A2 — l'absence se DÉCLARE. `disabled` sur le champ le vide aussi à l'envoi, ce qui
              évite la contradiction « case cochée + heure remplie » que le serveur refuserait. */}
          <label htmlFor="sans_heure" className={s.case}>
            <input
              id="sans_heure"
              name="sans_heure"
              type="checkbox"
              value="oui"
              className={s.checkbox}
              checked={sansHeure}
              onChange={(e) => setSansHeure(e.target.checked)}
            />
            <span className="t-corps">
              Je ne connais pas mon heure de naissance. Ma commune suffit pour l'instant.
            </span>
          </label>
        </>
      ) : (
        <p className="t-meta">Ton heure de naissance est déjà enregistrée.</p>
      )}

      {demanderLieu ? (
        <>
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
        </>
      ) : (
        <p className="t-meta">Ta commune de naissance est déjà enregistrée : {deja.lieu}.</p>
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
          J'ai vérifié : ce que j'enregistre ici s'enregistre une seule fois et ne pourra plus être
          modifié.
        </span>
      </label>

      {etat.statut === "erreur" && etat.message ? (
        <p className={s.erreur} role="alert">
          {etat.message}
        </p>
      ) : null}

      {/* Le bouton n'ouvre que sur un envoi qui a quelque chose à écrire : la commune si elle
          manque encore, et une heure OU sa déclaration d'absence si l'heure manque encore. */}
      <button
        type="submit"
        className={s.bouton}
        disabled={enCours || (demanderLieu && !choisi) || (!demanderLieu && !demanderHeure)}
      >
        <span className="t-bouton">{enCours ? "…" : "Enregistrer"}</span>
      </button>
    </form>
  );
}
