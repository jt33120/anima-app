import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import FormulaireConsentement from "./formulaire-consentement";
import s from "./consentement.module.css";

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

/**
 * Halte de consentement art. 9 + déclaration IA (Story 1.5).
 * NB : le texte juridique exact (CGU, formulation art. 9, durées) sera validé par un
 * juriste avant lancement — ici, un texte clair et honnête, non définitif.
 */
export default async function PageConsentement({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "barre") redirect("/barriere"); // minorité détectée (1.9) : suspendu, sans signOut. Prime.
  if (etape === "mineur") {
    // Barrière persistante : un mineur signalé est refusé à chaque connexion (FR-070).
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance"); // date pas encore posée
  if (etape === "revoque") redirect("/consentement/revoque"); // déjà révoqué → jamais re-cocher
  if (etape === "suite") redirect("/"); // déjà consenti → la scène

  return (
    <main className={s.page}>
      <div className={s.contenu}>
        <p className="t-surtitre">Avant de commencer</p>
        <h1 className="t-display">Ce que tu acceptes</h1>

        {/* Échec de suppression (AC6) : jamais silencieux — la session est restée ouverte. */}
        {erreur === "suppression" ? (
          <p className={s.erreur} role="alert">
            La suppression n&rsquo;a pas pu aboutir. Ton compte est toujours là — tu peux
            réessayer.
          </p>
        ) : null}

        {/* Déclaration IA — FR-013 / AI Act art. 50, en français courant */}
        <p className="t-anam">
          Tu vas parler à une <strong>intelligence artificielle</strong>. Pas à un être
          humain, pas à une voyante. Anam lit, relie et te répond — mais elle n&rsquo;a ni
          conscience ni intuition.
        </p>
        {/* ⚠️ « ET GARDÉ CHIFFRÉ » A ÉTÉ RETIRÉ D'ICI (revue Epic 6, R9).
            Aucune migration ne chiffre quoi que ce soit — `pgcrypto`/`pgsodium` sont absents des
            soixante fichiers. Ce que la phrase désignait était le chiffrement disque de l'hébergeur,
            et c'est réel. Mais « gardé chiffré », lu juste avant de confier ses convictions, se
            comprend spontanément comme « même vous ne pouvez pas le lire » — ce qui est faux.
            La revue de sécurité l'avait inscrit (M-2) et l'architecture le liste comme non tranché.
            On dit donc ce qui EST, y compris la partie inconfortable : c'est la même règle que
            « les notifications ne partent pas encore » de la 6.2. */}
        <p className="t-corps">
          Ce que tu lui confies est <strong>conservé</strong>, pour qu&rsquo;elle se
          souvienne d&rsquo;une fois sur l&rsquo;autre. C&rsquo;est protégé quand ça circule et
          quand c&rsquo;est rangé — mais pas au point que personne chez Anima ne puisse
          jamais le lire. Tu peux tout <strong>effacer</strong> quand tu veux : alors tout
          disparaît, chez elle comme chez ses prestataires techniques.
        </p>

        {/* « Lire le détail » — accordéon déplié EN PLACE (AC4), version courte principale */}
        <details className={s.details}>
          <summary className={s.summary}>
            <span className="t-meta">Lire le détail</span>
          </summary>
          <div className={s.detailsCorps}>
            <p className="t-corps">
              Anam s&rsquo;appuie sur un modèle d&rsquo;IA opéré par un prestataire
              technique, encadré par contrat : il ne s&rsquo;entraîne pas sur tes données
              et ne les conserve pas au-delà du traitement de ta demande.
            </p>
            <p className="t-corps">
              Les confidences que tu partages relèvent de tes{" "}
              <strong>données sensibles</strong> au sens de l&rsquo;article&nbsp;9 du RGPD
              (ta vie intérieure, tes croyances). Elles ne sont traitées qu&rsquo;avec ton
              consentement explicite, que tu peux retirer à tout moment.
            </p>
            {/* Story 5.5 (décision D12) — le détail de ce que « déduire » veut dire. La case dit
                le principe ; ici on dit la chose concrète, et surtout qu'elle reste défaisable. Une
                déduction qu'on ne peut pas corriger n'est plus une hypothèse, c'est un verdict. */}
            <p className="t-corps">
              Anam ne conserve pas seulement ce que tu lui dis : elle en <strong>déduit</strong>{" "}
              aussi des choses — les thèmes qui reviennent chez toi, et une lecture de ta façon de
              fonctionner. Ces déductions sont elles aussi des données sensibles. Tu peux les{" "}
              <strong>corriger</strong> ou les <strong>effacer</strong> à tout moment, sans perdre
              le reste.
            </p>
            <p className="t-corps">
              À ta demande de suppression, ton compte et tes contenus sont effacés, et la
              consigne d&rsquo;effacement est propagée aux prestataires concernés.
            </p>
          </div>
        </details>

        <FormulaireConsentement />
      </div>
    </main>
  );
}
