import Link from "next/link";
import s from "./cgu/cgu.module.css";

export const metadata = { title: "Anam" };

/**
 * La page 404 (QA tour 1, T12).
 *
 * ── CE QU'ELLE REMPLACE ─────────────────────────────────────────────────────────────────────────
 *
 * Le défaut de Next.js : fond noir, « 404 | This page could not be found. », et un titre d'onglet
 * « 404: This page could not be found. » — en anglais, sans identité, sans issue, sans accès à
 * l'aide. Mesuré sur huit adresses, dont `/mentions-legales` et `/confidentialite`, c'est-à-dire
 * précisément celles qu'une personne inquiète va chercher.
 *
 * ── POURQUOI ELLE NE DIT PAS « ERREUR » ─────────────────────────────────────────────────────────
 *
 * Parce qu'il n'y en a pas. Une adresse qui n'existe pas n'est pas une panne, et le dire en ferait
 * porter la responsabilité à celle qui a cliqué. Le registre est celui du refus d'âge — « Reviens
 * quand tu y seras, la porte restera là » —, que la QA a relevé comme réussi : fermer sans humilier.
 *
 * ── LE LIEN D'AIDE EST LÀ, ET C'EST LE POINT ────────────────────────────────────────────────────
 *
 * La QA a compté le lien « Aide » présent sur toute la scène et ABSENT de tout le reste, 404
 * compris. Un écran d'erreur est le dernier endroit où l'on peut se permettre de retirer la sortie
 * de secours : quelqu'un qui atterrit ici est déjà perdu.
 *
 * ⚠️ `not-found.tsx` est rendu par le routeur SANS session : il ne peut donc RIEN dire du compte, et
 * il ne doit rien tenter de lire. Aucun appel à Supabase ici — un 404 qui plante devient un 500.
 */
export default function PageIntrouvable() {
  return (
    <main className={s.page}>
      <article className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-titre">Il n&rsquo;y a rien ici</h1>
        <p className="t-corps">
          Cette adresse ne mène nulle part. Ce n&rsquo;est pas toi&nbsp;: la page n&rsquo;existe pas,
          ou elle a changé de place.
        </p>
        <p className="t-corps">
          <Link href="/">Revenir à l&rsquo;accueil</Link>
          {" · "}
          <Link href="/aide">Aide et ressources</Link>
        </p>
      </article>
    </main>
  );
}
