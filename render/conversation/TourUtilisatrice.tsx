import s from "./conversation.module.css";

/**
 * TourUtilisatrice — les mots de l'utilisatrice (Story 2.2, B2 ; AC1, FR-021). PLEINE VALEUR
 * (`t-corps` Inter, couleur `--texte`, JAMAIS `texte-doux`) : ses mots ne sont pas « éteints ».
 * Distingués de la voix d'Anam par la TYPOGRAPHIE (Inter vs Fraunces) et un FILET vertical gauche
 * + retrait — PAS par une bulle opposée, PAS par l'extinction. Aucun horodatage / coche / emoji.
 */
export default function TourUtilisatrice({ texte }: { texte: string }) {
  return (
    <div className={s.tourUtilisatrice}>
      <p className="t-corps">{texte}</p>
    </div>
  );
}
