import s from "./cgu.module.css";

export const metadata = { title: "Anam" }; // NFR-015 / AC7 — identité uniforme « Anam »

/**
 * CGU — page minimale (ouverte dans un nouvel onglet depuis la halte de consentement).
 * Contenu PLACEHOLDER : le texte définitif sera rédigé/validé par un juriste avant lancement.
 */
export default function PageCGU() {
  return (
    <main className={s.page}>
      <article className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-titre">Conditions d&rsquo;utilisation</h1>
        <p className="t-meta">Version provisoire — à finaliser avant le lancement.</p>

        <h2 className="t-titre-sm">Ce qu&rsquo;est Anam</h2>
        <p className="t-corps">
          Anam est un accompagnement par intelligence artificielle. Ce n&rsquo;est ni un
          service médical, ni psychologique, ni un avis professionnel. En cas de détresse,
          adresse-toi à un professionnel ou à un service d&rsquo;urgence.
        </p>

        <h2 className="t-titre-sm">Âge requis</h2>
        <p className="t-corps">Anam est réservée aux personnes de 18 ans ou plus.</p>

        <h2 className="t-titre-sm">Tes données</h2>
        <p className="t-corps">
          Tu gardes la main sur tes données : tu peux les exporter et les effacer à tout
          moment. Le détail du traitement figure sur l&rsquo;écran de consentement.
        </p>

        {/*
          Information art. 13 — les DESTINATAIRES (revue 4.9, T5-3). La 4.9 ajoute un
          sous-traitant (Resend) et une finalité nouvelle (l'adresse du compte, jusqu'ici
          réservée à la connexion, sert à une notification produit) : ni l'un ni l'autre
          n'était annoncé nulle part. Ce qui est écrit ici est vérifiable dans le code, ligne
          à ligne — c'est le minimum honnête, pas la politique de confidentialité complète,
          qui reste une porte pré-lancement.
        */}
        <h2 className="t-titre-sm">Qui d&rsquo;autre voit quoi</h2>
        <p className="t-corps">
          Trois prestataires interviennent, et chacun ne voit que ce dont il a besoin :
          l&rsquo;hébergeur de la base de données et de l&rsquo;application ; le fournisseur du
          modèle d&rsquo;intelligence artificielle, qui reçoit ce qui est nécessaire à la
          conversation et s&rsquo;engage à ne pas s&rsquo;en servir pour entraîner ses modèles
          ni à le conserver ; et un service d&rsquo;envoi de courriels, établi aux États-Unis,
          qui reçoit <strong>ton adresse et la raison de l&rsquo;envoi — jamais un mot de ce
          que tu écris ni de ce qui est écrit pour toi</strong>.
        </p>
        <p className="t-corps">
          Ton adresse sert à te connecter, et à te prévenir quand une synthèse est prête. Tu
          peux arrêter ces courriels à tout moment, par le lien qu&rsquo;ils contiennent, sans
          rien changer d&rsquo;autre à ton compte.
        </p>
      </article>
    </main>
  );
}
