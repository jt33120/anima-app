import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import FormulaireNaissance from "./formulaire-naissance";
import s from "./naissance.module.css";

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


export const metadata = { title: "Anam" }; // NFR-015 / AC7 — identité uniforme « Anam »

export default async function PageNaissance() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const etape = await etapeOnboardingPour(supabase, user.id);
  // Minorité DÉTECTÉE après coup (1.9, FR-071) : compte suspendu → /barriere, sans signOut. Prime.
  if (etape === "barre") redirect("/barriere");
  // Mineur signalé : refusé même avec une session (barrière persistante, FR-070).
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  // Date déjà posée (AC4) : on ne la redemande jamais.
  if (etape === "consentement") redirect("/consentement");
  if (etape === "revoque") redirect("/consentement/revoque"); // consentement retiré → écran suspendu
  if (etape === "suite") redirect("/"); // déjà consenti → la scène

  return (
    <main className={s.page}>
      <div className={s.contenu}>
        <p className="t-surtitre">Une dernière chose</p>
        <h1 className="t-display">Ta date de naissance</h1>
        <p className="t-anam">
          Anam est réservée aux <strong>18 ans ou plus</strong>. Ta date reste
          privée ; elle servira plus tard à dessiner ton socle.
        </p>
        <FormulaireNaissance />
      </div>
    </main>
  );
}
