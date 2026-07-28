import s from "./aide.module.css";
import SortieRapide from "./SortieRapide";
import {
  RESSOURCES_AIDE,
  FAMILLES_ORDRE,
  LIBELLE_FAMILLE,
  verifieLeLibelle,
} from "@/lib/safety/ressources-aide";

// NFR-015 / identité de route — « Anam » partout (garde : identite-route.test.ts).
export const metadata = { title: "Anam" };

/**
 * /aide — la halte ressources + transparence (Story 1.8, formalisée en Story 2.5).
 *
 * PAGE STATIQUE et PUBLIQUE : aucun appel d'auth/session, aucun traceur, AUCUNE dépendance au
 * fournisseur IA → atteignable SANS COMPTE, SANS PAYWALL, connectée ou non, indépendamment de
 * toute détection (AD-9, AD-15, FR-077, NFR-002). C'est le filet de sécurité HORS-IA : il ne
 * dépend d'aucun modèle. (Ne JAMAIS y lire la session ni router selon l'état — cela romprait
 * « connectée ou non ».)
 *
 * Story 2.5 : les ressources viennent de la SOURCE UNIQUE `lib/safety/ressources-aide` (jamais
 * inline), groupées par FAMILLE de danger (le danger vital d'abord), mises en forme en FICHE
 * sobre (`surface-elevee` + `bordure-forte`) — JAMAIS rouge, JAMAIS modale, JAMAIS bloquante
 * (le filet rassure, il n'alarme pas). En-tête « Vérifié le … » (gouvernance FR-044 trimestrielle).
 * La sélection DYNAMIQUE de la ressource adaptée au danger DÉTECTÉ en conversation est la Story 2.6.
 *
 * Ordre : les RESSOURCES d'abord (la porte de secours « Aide » atterrit ici — crise d'abord),
 * puis la TRANSPARENCE (ancre #transparence, cible de la mention « Anam est une IA »).
 */
export default function PageAide() {
  return (
    <main className={s.page}>
      <article className={s.contenu}>
        {/* Sortie rapide (FR-074) : en tête, navigue vers un site neutre + remplace l'historique. */}
        <SortieRapide />
        <p className="t-surtitre">Anam</p>
        <h1 className="t-titre">Aide</h1>

        <section className={s.section} aria-label="Ressources">
          <p className="t-corps">
            Si tu es en danger ou en détresse, tu n&apos;as pas à passer par Anam. Ces lignes
            sont tenues par des personnes, joignables directement.
          </p>
          <p className={`t-meta ${s.verifie}`}>Vérifié le {verifieLeLibelle()}</p>

          {FAMILLES_ORDRE.map((famille) => {
            const ressources = RESSOURCES_AIDE.filter((r) => r.famille === famille);
            if (ressources.length === 0) return null;
            // Pas d'aria-label sur la section de groupe : le <h2> nomme déjà le groupe. Un aria-label
            // en ferait un landmark « region » redondant (double annonce au lecteur d'écran).
            return (
              <section key={famille} className={s.groupe}>
                <h2 className="t-titre-sm">{LIBELLE_FAMILLE[famille]}</h2>
                <ul className={s.ressources}>
                  {ressources.map((r) => (
                    <li key={r.tel} className={s.ressource}>
                      <a
                        className={s.numero}
                        href={`tel:${r.tel}`}
                        aria-label={`${r.numero}, ${r.service}, ${r.aria}`}
                      >
                        <span className="t-titre-sm" aria-hidden>
                          {r.numero}
                        </span>
                      </a>
                      <span className={`t-corps ${s.desc}`}>{r.desc}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </section>

        <section className={s.section} id="transparence" aria-label="Transparence">
          <h2 className="t-titre-sm">Anam est une IA</h2>
          <p className="t-anam">
            Tu parles à une <strong>intelligence artificielle</strong>. Pas à un être humain,
            pas à une voyante. Anam lit, relie et te répond — mais elle n&apos;a ni conscience
            ni intuition.
          </p>
          <p className="t-corps">
            Elle s&apos;appuie sur un modèle d&apos;IA opéré par un prestataire technique,
            encadré par contrat : il ne s&apos;entraîne pas sur tes données et ne les conserve
            pas au-delà du traitement de ta demande. Anam n&apos;est ni un service médical, ni
            psychologique, ni un avis professionnel.
          </p>
        </section>
      </article>
    </main>
  );
}
