import { reglerAction } from "./actions";
import s from "./desabonnement.module.css";

// NFR-015 — « Anam » partout, y compris sur une page atteinte depuis une boîte de réception.
export const metadata = { title: "Anam" };

/**
 * /desabonnement — LA PORTE DE SORTIE DU CANAL COURRIEL (revue 4.9, T5-2).
 *
 * Le courriel promettait « réponds à ce courriel » et rien derrière : aucune boîte, aucun mécanisme,
 * aucun en-tête. Ses seules sorties réelles étaient de résilier son abonnement ou de révoquer son
 * consentement art. 9 — renoncer au produit pour exercer un droit d'opposition.
 *
 * ── TROIS CHOIX QUI SE VOIENT DANS LE CODE ─────────────────────────────────────────────────────────────
 *
 * SANS SESSION. Exiger une connexion pour faire cesser un envoi est le mur que l'article 21 interdit de
 * dresser — et c'est aussi le plus sûr moyen d'obtenir une plainte pour spam à la place. Le jeton est
 * opaque, propre au canal, et ne donne accès à rien d'autre : ni à une synthèse, ni à une adresse, ni au
 * fait de savoir qui est cette personne.
 *
 * UN GESTE, PAS UN LIEN QUI AGIT. La page montre d'abord ce qui va se passer et attend un clic. Un GET
 * qui désabonne se déclenche tout seul — les scanners de sécurité et les prévisualisateurs suivent les
 * liens des courriels. Le chemin automatique existe, mais il est en POST et ailleurs
 * (`/api/desabonnement`, RFC 8058) : c'est celui du bouton « Se désabonner » du client de messagerie,
 * qui est un geste délibéré lui aussi.
 *
 * ELLE PEUT REVENIR. Le même jeton rouvre le canal. Sans ça, le premier clic serait irréversible pour
 * quelqu'un qui n'a, par définition, aucune envie d'écrire à un support pour le défaire.
 *
 * Ce que cette page NE fait PAS : arrêter la synthèse. Le refus porte sur le CANAL. Le récit continue de
 * s'écrire et reste consultable dans l'application — se taire n'est pas la même chose que ne plus rien
 * écrire pour elle.
 */
export default async function PageDesabonnement({
  searchParams,
}: {
  searchParams: Promise<{ j?: string; etat?: string }>;
}) {
  const { j = "", etat } = await searchParams;

  // Jeton inconnu, mal formé, ou compte effacé : UNE seule réponse pour les trois. Les distinguer ferait
  // de cette page un oracle d'existence de compte, interrogeable par n'importe qui.
  if (etat === "inconnu" || j.length === 0) {
    return (
      <main className={s.page}>
        <article className={s.contenu}>
          <p className="t-surtitre">Anam</p>
          <h1 className="t-titre">Ce lien n’est plus valide</h1>
          <p className="t-corps">
            Il a peut-être déjà servi, ou le compte n’existe plus. Si tu reçois encore des messages, le
            lien du courriel le plus récent fonctionnera.
          </p>
        </article>
      </main>
    );
  }

  if (etat === "arrete") {
    return (
      <main className={s.page}>
        <article className={s.contenu}>
          <p className="t-surtitre">Anam</p>
          <h1 className="t-titre">C’est fait</h1>
          <p className="t-corps">
            Tu ne recevras plus de courriel de ma part. Ta synthèse continue d’être écrite et t’attend
            dans l’application quand tu veux la lire.
          </p>
          <form action={reglerAction} className={s.actions}>
            <input type="hidden" name="j" value={j} />
            <input type="hidden" name="refuse" value="0" />
            <button type="submit" className={s.boutonSecondaire}>
              <span className="t-bouton">Les recevoir à nouveau</span>
            </button>
          </form>
        </article>
      </main>
    );
  }

  if (etat === "repris") {
    return (
      <main className={s.page}>
        <article className={s.contenu}>
          <p className="t-surtitre">Anam</p>
          <h1 className="t-titre">C’est fait</h1>
          <p className="t-corps">Tu recevras à nouveau un message quand une synthèse sera prête.</p>
        </article>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <article className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-titre">Ne plus recevoir ces messages</h1>
        <p className="t-corps">
          Tu ne recevras plus de courriel quand une synthèse est prête. Rien d’autre ne change : ta
          synthèse continue d’être écrite, et elle reste consultable dans l’application.
        </p>
        <form action={reglerAction} className={s.actions}>
          <input type="hidden" name="j" value={j} />
          <input type="hidden" name="refuse" value="1" />
          <button type="submit" className={s.bouton}>
            <span className="t-bouton">Ne plus recevoir ces messages</span>
          </button>
        </form>
      </article>
    </main>
  );
}
