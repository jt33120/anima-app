"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { accepterHypothese, refuserHypothese } from "./actions";
import s from "./enneagramme.module.css";

/**
 * hypothese.tsx — LES TROIS RÉPONSES, D'ÉGALE LISIBILITÉ (Story 5.5, AC2).
 *
 * ── « ACCEPTER, REFUSER OU CORRIGER, AVEC UNE LISIBILITÉ STRICTEMENT ÉGALE » ───────────────────
 *
 * C'est l'AC2, au mot près, et c'est la seule chose que ce composant a de particulier. Les trois
 * boutons partagent la MÊME classe, la même hauteur, le même poids typographique : aucun n'est
 * l'action principale. Faire de « Oui » un bouton plein et des deux autres des liens gris serait
 * une réponse suggérée — et une hypothèse dont la réponse est suggérée n'est plus une hypothèse.
 *
 * Une garde de rendu monte ce composant et compare les trois classes (`tests/rendu/`), parce que la
 * dérive est une ligne de CSS et qu'aucune lecture de type ne la verrait.
 *
 * ── LA PHRASE VIENT DU SERVEUR, TOUJOURS ──────────────────────────────────────────────────────
 *
 * Elle est une constante de `lib/domain/enneagramme-hypothese.ts`, jamais le texte du modèle : le
 * modèle n'a rendu qu'un numéro. C'est ce qui rend « jamais assénée » testable plutôt que promis.
 *
 * ── LE VERROU EST SYNCHRONE ───────────────────────────────────────────────────────────────────
 *
 * `useRef` posé avant tout `await` : sans lui, deux clics rapides sur « Oui » enverraient deux
 * acceptations, et la seconde rendrait `false` — un état correct annoncé comme un échec.
 */

export default function Hypothese({
  hypotheseId,
  phrase,
}: {
  hypotheseId: string;
  /** La constante du domaine, servie par la page. Jamais composée ici. */
  phrase: string;
}) {
  const router = useRouter();
  const verrou = useRef(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /**
   * ⚠️ LES TROIS RÉPONSES NE FONT PAS DEUX CHOSES DÉGUISÉES EN TROIS. « Refuser » et « corriger »
   * écrivent la même chose en base — l'hypothèse est écartée — mais elles n'emmènent pas au même
   * endroit, et c'est CELA qui les distingue :
   *
   *   • refuser  → on la ramène à la scène. On ne lui demande rien de plus ; elle a dit non.
   *   • corriger → elle reste ici, et le test commence. C'est le seul chemin par lequel elle donne
   *                SA réponse au lieu d'écarter la mienne.
   *
   * Sans cette différence de destination, le troisième bouton serait un doublon — et un doublon
   * présenté comme un choix est une fausse liberté.
   */
  async function repondre(quoi: "accepter" | "refuser" | "corriger") {
    if (verrou.current) return;
    verrou.current = true;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = quoi === "accepter"
        ? await accepterHypothese(hypotheseId)
        : await refuserHypothese(hypotheseId);
      if (r.statut === "repondu") {
        // On RELIT l'état serveur plutôt que d'afficher une confirmation locale : accepter sans
        // consentement valide échoue au point d'écriture, et l'écran doit dire la vérité.
        if (quoi === "refuser") router.push("/");
        else router.refresh();
        return;
      }
      setErreur(r.message);
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  }

  return (
    <section className={`${s.bloc} fondu-texte`} aria-label="Une idée d'Anam">
      <p className="t-anam">{phrase}</p>
      <ul className={s.reponses}>
        <li>
          <button type="button" className={s.reponse} disabled={envoi} onClick={() => repondre("accepter")}>
            <span className="t-corps">Oui, ça me parle</span>
          </button>
        </li>
        <li>
          <button type="button" className={s.reponse} disabled={envoi} onClick={() => repondre("refuser")}>
            <span className="t-corps">Non, ce n'est pas moi</span>
          </button>
        </li>
        <li>
          {/* CORRIGER — la troisième réponse de l'AC2. Même écriture que « refuser », autre
              destination : elle reste ici et le test commence. Même classe que les deux autres —
              la correction n'est ni un repli ni une faveur. */}
          <button type="button" className={s.reponse} disabled={envoi} onClick={() => repondre("corriger")}>
            <span className="t-corps">Je préfère répondre au test</span>
          </button>
        </li>
      </ul>
      {erreur ? (
        <p className={s.erreur} role="alert">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}
