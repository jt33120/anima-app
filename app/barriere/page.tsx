import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import s from "./barriere.module.css";

// Identité de route discrète (NFR-015) — « Anam » partout, ne trahit rien.
export const metadata = { title: "Anam" };

/**
 * Écran « Minorité détectée » (Story 1.9, FR-071). Accessible SEULEMENT à un compte suspendu
 * (étape "barre"). Registre PRODUIT, JAMAIS signé d'Anam : on énonce des faits calmes, ce
 * n'est pas une sanction. Il oriente vers des ressources ADAPTÉES À L'ÂGE (le 3018 en tête),
 * dit sans détour ce qui arrive aux données (suppression sous 30 j, sans exploitation) et
 * propose l'export en une action. AUCUNE modale, AUCUN rouge/alerte, AUCUN pictogramme de
 * danger (AD-9). Aucun traceur (NFR-002).
 *
 * SCOPE 1.9 : la présentation « fiche » formalisée (surface-elevee + bordure-forte, date
 * « vérifié le … », revue FR-044) et la SORTIE RAPIDE (FR-074) relèvent de la Story 2.5. Ici,
 * la présentation minimale des ressources reprend celle de /aide (Story 1.8).
 */

// Ressources ADAPTÉES À L'ÂGE — le 3018 en tête (epics AC L529). `aria` = numéro énoncé chiffre
// par chiffre ; `service` = nom lu AVANT les chiffres (mode « liste des liens » du lecteur d'écran).
// (À confirmer avec le professionnel avant lancement — porte pré-lancement, comme /aide.)
const RESSOURCES: ReadonlyArray<{
  numero: string;
  tel: string;
  aria: string;
  service: string;
  desc: string;
}> = [
  { numero: "3018", tel: "3018", aria: "3 0 1 8", service: "Violences numériques", desc: "Harcèlement en ligne — gratuit, pour les jeunes, tous les jours." },
  { numero: "119", tel: "119", aria: "1 1 9", service: "Enfance en danger", desc: "Enfance en danger — à toute heure." },
  { numero: "0 800 235 236", tel: "0800235236", aria: "0 8 0 0 2 3 5 2 3 6", service: "Fil Santé Jeunes", desc: "Fil Santé Jeunes — anonyme et gratuit." },
  { numero: "3114", tel: "3114", aria: "3 1 1 4", service: "Souffrance psychique", desc: "Prévention du suicide — gratuit, à toute heure, tous âges." },
];

export default async function PageBarriere() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  // Garde propre à l'écran : rendu SEULEMENT si suspendue. Sinon, on renvoie à la racine, qui
  // re-route selon l'état (jamais vers /barriere) — pas de boucle, pas de branche dupliquée.
  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape !== "barre") redirect("/");

  return (
    <main className={s.page}>
      <article className={s.contenu}>
        <p className="t-surtitre">Anam</p>
        <h1 className="t-titre">Une pause</h1>

        <p className="t-corps">
          Anam est réservée aux personnes majeures. Ce n&apos;est pas une sanction : c&apos;est
          une limite qu&apos;on tient pour de bonnes raisons. Ton compte est suspendu.
        </p>

        <section className={s.section} aria-label="Ressources">
          <p className="t-corps">
            Si tu as besoin de parler ou d&apos;aide, ces lignes sont faites pour toi et
            joignables directement.
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

        <section className={s.section} aria-label="Tes données">
          <p className="t-corps">
            Tes données seront supprimées sous 30 jours. D&apos;ici là, elles ne sont exploitées
            à aucune fin. Tu peux en récupérer une copie avant leur suppression.
          </p>
          <a className={s.exporter} href="/api/export">
            <span className="t-bouton">Exporter mes données</span>
          </a>
        </section>
      </article>
    </main>
  );
}
