import FormulaireEntree from "./formulaire-entree";
import { entreeDemo, entreeDemoSuspendue } from "./actions";
import { ADIEU } from "@/lib/domain/copie-mes-donnees";
import { SESSION_FERMEE } from "@/lib/domain/copie-reglages";
import s from "./entrer.module.css";

/**
 * ⚠️ RENDUE À LA DEMANDE, ET C'EST UNE GARDE (revue adversariale, R5).
 *
 * `proxy.ts` pose un nonce NOUVEAU À CHAQUE REQUÊTE, et `script-src` porte `'strict-dynamic'` — qui,
 * en CSP niveau 3, fait IGNORER `'self'` et toutes les sources d'hôte. Une page PRÉRENDUE porte donc
 * un HTML figé dont aucun `<script>` ne peut être noncé : le navigateur les refuse tous, React ne
 * s'hydrate jamais, et les composants clients de la page sont à l'écran sans réagir.
 *
 * Cette page-ci l'était DÉJÀ par inférence — elle lit la session, donc Next la rend à la demande.
 * C'est précisément l'inférence qui a piégé `/aide`, dont l'en-tête se félicitait de « ne lire aucune
 * session » : le jour où elle a cessé d'en lire une, elle est devenue statique et muette, sans qu'une
 * seule ligne de son code ne change. On le DÉCLARE donc, plutôt que de le déduire d'un détail
 * d'implémentation qu'un correctif peut retirer.
 */
export const dynamic = "force-dynamic";


// NFR-015 / AC7 (1.7) — identité uniforme : « Anam » sur toutes les routes.
export const metadata = { title: "Anam" };

export default async function PageEntrer({
  searchParams,
}: {
  searchParams: Promise<{ refus?: string; efface?: string; deconnexion?: string }>;
}) {
  const { refus, efface, deconnexion } = await searchParams;

  return (
    <main className={s.page}>
      <div className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-display">Entrer</h1>
        {refus === "age" ? (
          <p className="t-anam" role="status">
            Ce lieu est réservé aux 18 ans ou plus. Reviens quand tu y seras — la
            porte restera là.
          </p>
        ) : (
          <>
            {/* Story 6.7 — le retour après l'effacement. Registre PRODUIT : `t-anam` serait la voix
                d'Anam, et Anam n'a plus rien à lui dire — elle vient de tout effacer. Le formulaire
                reste dessous : rien ne la retient, et rien ne l'empêche non plus de revenir. */}
            {efface === "1" && (
              <p className="t-meta" role="status">
                {ADIEU}
              </p>
            )}
            {/* QA tour 1 (T22) — le retour après une déconnexion demandée. Même registre PRODUIT
                que l'adieu ci-dessus, et pour la même raison : c'est un fait de session, et Anam
                n'a rien à dire sur une porte qu'on vient de tirer derrière soi. */}
            {deconnexion === "1" && (
              <p className="t-meta" role="status">
                {SESSION_FERMEE}
              </p>
            )}
            <p className="t-anam">
              Laisse-moi ton adresse. Je t&apos;enverrai un lien — pas de mot de
              passe à retenir, rien à perdre.
            </p>
            <FormulaireEntree />
            {/* ── QA tour 2 — L'INFORMATION DUE AVANT LA COLLECTE (RGPD art. 13) ──────────────
                Mesuré : cet écran ne contenait AUCUN `href`. Pas un lien, pas une ligne sur ce
                qu'on fait des données — et c'est ici qu'on demande une adresse e-mail.

                ⚠️ CE N'EST PAS ROUVRIR LA DÉCISION DE `HORS_HALTE`. Elle écarte `PiedHalte` de cet
                écran pour DEUX raisons — la mention IA (art. 50) n'est pas due avant qu'un modèle
                ait produit quoi que ce soit, et la porte de secours (FR-077) n'a pas d'interlocuteur
                à secourir. Les deux tiennent. L'article 13 est une TROISIÈME question, à laquelle
                personne n'avait répondu : il exige d'informer AU MOMENT où la donnée est obtenue.

                Deux liens nus, pas un pied de site. Le reste — dire ce qu'est Anam avant de
                demander une adresse — demande la voix d'Anima, et elle relit toute la copie. */}
            <p className={s.mentions}>
              <a href="/cgu">Conditions d&apos;utilisation</a>
              <span aria-hidden="true"> · </span>
              <a href="/aide">Aide</a>
            </p>
          </>
        )}
        {process.env.NODE_ENV === "development" && (
          <div style={{ marginTop: "var(--esp-7)" }}>
            <p className="t-meta" style={{ marginBottom: "var(--esp-2)" }}>
              Dev — accès sans email (n&apos;existe pas en production)
            </p>
            <form action={entreeDemo}>
              <button type="submit" className={s.bouton}>
                <span className="t-bouton">Entrer directement (démo)</span>
              </button>
            </form>
            <form action={entreeDemoSuspendue} style={{ marginTop: "var(--esp-2)" }}>
              <button type="submit" className={s.bouton}>
                <span className="t-bouton">Entrer en compte suspendu (démo minorité)</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
