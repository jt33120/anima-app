import s from "./synthese.module.css";

/**
 * Story 4.9 (AC2) — LA SYNTHÈSE, dessinée. Rendu MUET (AD-7) : il ne décide rien, il ne parse rien.
 *
 * ── POURQUOI AUCUN PARSEUR ICI ─────────────────────────────────────────────────────────────────────────
 *
 * La tentation est forte : lire le texte du modèle, en extraire le titre, transformer les lignes en
 * « - » en `<li>`, deviner les niveaux. C'est exactement le piège payé en 4.7, où un parseur trop
 * confiant faisait feuiller tout l'arbre. Un parseur d'un texte produit par un modèle a deux issues :
 * il est trop strict et perd la structure, ou trop souple et invente la sienne — et dans les deux cas
 * l'utilisatrice lit autre chose que ce qui a été écrit pour elle.
 *
 * On préserve donc la mise en forme telle quelle (`white-space: pre-wrap`). Les titres et les listes que
 * le modèle a écrits apparaissent tels qu'il les a écrits. Le registre DOCUMENT (titres et listes
 * autorisés, à l'inverse de la voix d'Anam — FR-084) est porté par la CONSIGNE, côté serveur, où il est
 * une instruction ; pas ici, où il ne pourrait être qu'une devinette.
 *
 * `tronquee` est affiché parce que le taire serait mentir : une synthèse qui s'arrête avant la fin de la
 * période doit le dire, sinon son silence se lit comme « il ne s'est rien passé ».
 *
 * ── LA PÉRIODE ARRIVE DÉJÀ ÉCRITE ──────────────────────────────────────────────────────────────────────
 *
 * `periode` est une CHAÎNE, pas deux dates. La revue 4.9 a d'abord corrigé le fuseau ici même (les dates
 * étaient rendues dans le fuseau du SERVEUR — Paris en développement, UTC en production, donc une entrée
 * de 00 h 30 affichée la veille une fois déployée), puis la garde d'architecture a refusé le correctif :
 * `render/` n'a pas le droit d'importer `lib/domain`, où vit `FUSEAU`. Elle avait raison. Choisir un
 * fuseau est une DÉCISION, et le rendu ne décide pas (AD-10, AD-7) — il reçoit du texte et le dessine.
 */
export default function FicheSynthese({
  contenu,
  periode,
  tronquee,
}: {
  contenu: string;
  periode: string;
  tronquee: boolean;
}) {
  return (
    <article className={`${s.fiche} fondu-texte`}>
      <p className={`${s.periode} t-meta`}>{periode}</p>
      {tronquee && (
        <p className={`${s.periode} t-meta`}>
          Cette synthèse s’arrête avant la fin de la période. La suite viendra.
        </p>
      )}
      <div className={`${s.corps} t-corps`}>{contenu}</div>
    </article>
  );
}

