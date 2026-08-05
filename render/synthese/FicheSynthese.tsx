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
 * `tronquee` est affiché parce que le taire serait mentir : une synthèse qui ne couvre pas tout son
 * début doit le dire, sinon son silence sur une période se lit comme « il ne s'est rien passé ».
 */
export default function FicheSynthese({
  contenu,
  debut,
  fin,
  tronquee,
}: {
  contenu: string;
  debut: string;
  fin: string;
  tronquee: boolean;
}) {
  return (
    <article className={`${s.fiche} fondu-texte`}>
      <p className={`${s.periode} t-meta`}>
        Du {jourLisible(debut)} au {jourLisible(fin)}
      </p>
      {tronquee && (
        <p className={`${s.periode} t-meta`}>
          Cette synthèse ne reprend pas tout le début de la période.
        </p>
      )}
      <div className={`${s.corps} t-corps`}>{contenu}</div>
    </article>
  );
}

/** Une date lisible, en français, sans heure — la synthèse porte sur des jours, pas sur des instants. */
function jourLisible(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
