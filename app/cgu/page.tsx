import s from "./cgu.module.css";

export const metadata = { title: "Conditions d'utilisation" };

/**
 * CGU — page minimale (ouverte dans un nouvel onglet depuis la halte de consentement).
 * Contenu PLACEHOLDER : le texte définitif sera rédigé/validé par un juriste avant lancement.
 */
export default function PageCGU() {
  return (
    <main className={s.page}>
      <article className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-titre">Conditions d&apos;utilisation</h1>
        <p className="t-meta">Version provisoire — à finaliser avant le lancement.</p>

        <h2 className="t-titre-sm">Ce qu&apos;est Anam</h2>
        <p className="t-corps">
          Anam est un accompagnement par intelligence artificielle. Ce n&apos;est ni un
          service médical, ni psychologique, ni un avis professionnel. En cas de détresse,
          adresse-toi à un professionnel ou à un service d&apos;urgence.
        </p>

        <h2 className="t-titre-sm">Âge requis</h2>
        <p className="t-corps">Anam est réservée aux personnes de 18 ans ou plus.</p>

        <h2 className="t-titre-sm">Tes données</h2>
        <p className="t-corps">
          Tu gardes la main sur tes données : tu peux les exporter et les effacer à tout
          moment. Le détail du traitement figure sur l&apos;écran de consentement.
        </p>
      </article>
    </main>
  );
}
