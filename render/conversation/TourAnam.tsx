import s from "./conversation.module.css";
import type { EtatAnam } from "./types";

/**
 * TourAnam — la voix d'Anam (Story 2.2, B2 ; AC1). `t-anam` (Fraunces), SANS fond / bulle /
 * bordure, apparition en `fondu-texte`. Le fil est un flux vertical unique, jamais des bulles
 * opposées.
 *
 * Échec (flux coupé sans `fin`, ou trame `erreur`) : le texte partiel est CONSERVÉ, jamais retiré
 * du fil (AC3, B4), suivi d'un message de registre SYSTÈME (jamais signé Anam) + « Réessayer ».
 */
export default function TourAnam({
  texte,
  etat,
  onReessayer,
}: {
  texte: string;
  etat: EtatAnam;
  onReessayer?: () => void;
}) {
  return (
    <div className={s.tourAnam}>
      {texte && <p className="t-anam fondu-texte">{texte}</p>}
      {etat === "echec" && (
        <div className={s.echec}>
          <span className="t-meta">Je n’ai pas pu répondre. Ton message est gardé.</span>
          {onReessayer && (
            <button type="button" className={s.reessayer} onClick={onReessayer}>
              <span className="t-bouton">Réessayer</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
