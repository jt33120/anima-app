import s from "./aide.module.css";

// NFR-015 / identité de route — « Anam » partout (garde : identite-route.test.ts).
export const metadata = { title: "Anam" };

/**
 * /aide — la halte ressources + transparence (Story 1.8).
 *
 * PAGE STATIQUE et PUBLIQUE : aucun appel d'auth/session, aucun traceur → atteignable
 * SANS COMPTE, SANS PAYWALL, connectée ou non, indépendamment de toute détection
 * (AD-15, FR-077, NFR-002). C'est le filet de sécurité HORS-IA : il ne dépend d'aucun modèle.
 * (Ne JAMAIS y lire la session ni router selon l'état — cela romprait « connectée ou non ».)
 *
 * Ordre : les RESSOURCES d'abord (la porte de secours « Aide » atterrit ici — crise d'abord),
 * puis la TRANSPARENCE (ancre #transparence, cible de la mention « Anam est une IA »).
 *
 * SCOPE 1.8 : la page existe, réelle et joignable, avec la transparence (art. 50) et les
 * numéros essentiels en tel: (doublage vocal chiffre par chiffre). La mise en forme « fiche »
 * (surface-elevee + bordure-forte), la date « vérifié le … », la revue périodique (FR-044),
 * l'adaptation aux niveaux 2-3, la SORTIE RAPIDE (FR-074) et la garde limites_levees → Story 2.5.
 */

// `aria` = le numéro énoncé chiffre par chiffre ; `service` = le nom lu AVANT les chiffres, pour
// que le lecteur d'écran en mode « liste des liens » annonce « Prévention du suicide, 3 1 1 4 »
// et pas seulement des chiffres nus (revue 1.8, trouvaille [11]).
const RESSOURCES: ReadonlyArray<{
  numero: string;
  tel: string;
  aria: string;
  service: string;
  desc: string;
}> = [
  { numero: "3114", tel: "3114", aria: "3 1 1 4", service: "Prévention du suicide", desc: "Prévention du suicide — gratuit, à toute heure, tous les jours." },
  { numero: "15", tel: "15", aria: "1 5", service: "SAMU", desc: "SAMU — urgence vitale immédiate." },
  { numero: "112", tel: "112", aria: "1 1 2", service: "Urgence européenne", desc: "Numéro d'urgence européen." },
  { numero: "3919", tel: "3919", aria: "3 9 1 9", service: "Violences faites aux femmes", desc: "Violences faites aux femmes — anonyme et gratuit." },
  { numero: "119", tel: "119", aria: "1 1 9", service: "Enfance en danger", desc: "Enfance en danger." },
  { numero: "09 72 39 40 50", tel: "0972394050", aria: "0 9 7 2 3 9 4 0 5 0", service: "SOS Amitié", desc: "SOS Amitié — une écoute, tous les jours." },
];

export default function PageAide() {
  return (
    <main className={s.page}>
      <article className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-titre">Aide</h1>

        <section className={s.section} aria-label="Ressources">
          <p className="t-corps">
            Si tu es en danger ou en détresse, tu n&apos;as pas à passer par Anam. Ces lignes
            sont tenues par des personnes, joignables directement.
          </p>
          <ul className={s.ressources}>
            {RESSOURCES.map((r) => (
              <li key={r.tel} className={s.ressource}>
                <a className={s.numero} href={`tel:${r.tel}`} aria-label={`${r.service}, ${r.aria}`}>
                  <span className="t-titre-sm" aria-hidden>
                    {r.numero}
                  </span>
                </a>
                <span className={`t-corps ${s.desc}`}>{r.desc}</span>
              </li>
            ))}
          </ul>
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
