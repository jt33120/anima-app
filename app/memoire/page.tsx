import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { lireFaitsRetenus } from "@/lib/data/lire-memoire";
import * as copie from "@/lib/domain/copie-memoire";
import Memoire from "@/render/memoire/Memoire";
import s from "@/render/memoire/memoire.module.css";
import { annulerSuppression, corrigerFait, supprimerFait } from "./actions";

// NFR-015 / identité de route — « Anam » partout, jamais un titre qui dit l'intimité de la page.
export const metadata = { title: "Anam" };

/** Contenu art. 9 : jamais mis en cache, jamais pré-rendu. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /memoire — LA HALTE « CE QU'ANAM RETIENT » (Story 6.5, FR-063/FR-064).
 *
 * Comme les cinq autres haltes, elle n'est atteignable que par URL tant que le menu de compte
 * n'existe pas : dette déjà inscrite, commune à toutes.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ `revoque` N'EST PAS REDIRIGÉ, ET C'EST LA DÉCISION LA PLUS IMPORTANTE DE CETTE PAGE (D2)
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Toutes les autres haltes renvoient une personne qui a révoqué vers `/consentement/revoque`. Celle-ci
 * ne le fait pas, et ce n'est pas un oubli.
 *
 * La Story 4.2 a délibérément construit la base pour qu'une SUPPRESSION survive à la révocation
 * (« droit à l'effacement RGPD art. 17 ») et qu'une CORRECTION soit refusée (« déposer un contenu
 * art. 9 exige un consentement valide »). Cette construction serait sans effet si l'écran redirigeait :
 * ON NE PEUT PAS SUPPRIMER CE QU'ON NE VOIT PAS. Tout le soin pris en 4.2 deviendrait inatteignable
 * exactement au moment où il sert.
 *
 * ⚠️ Et ce n'est PAS la même décision que pour le fil de conversation. `lib/data/depot-fil.ts` refuse
 * de servir le verbatim à quelqu'un qui a révoqué, et il a raison : c'est le PRODUIT QUI FONCTIONNE.
 * Ici, c'est l'EXERCICE D'UN DROIT — l'accès (art. 15) et l'effacement (art. 17), qui survivent tous
 * les deux à la révocation. La ligne entre les deux passe par la FINALITÉ, pas par la donnée ; qui
 * « harmonise » les deux pages casse l'une des deux.
 *
 * Les trois autres gardes, elles, s'appliquent pleinement : une mineure barrée ne voit rien, et
 * quelqu'un qui n'a pas encore consenti n'a de toute façon aucun fait à voir.
 */
export default async function PageMemoire() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "barre") redirect("/barriere");
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");
  // `revoque` passe. Voir l'encadré ci-dessus — c'est une décision, pas une omission.

  const faits = await lireFaitsRetenus(supabase);

  return (
    <main className={s.halte}>
      <h1 className={s.titreHalte}>{copie.TITRE_HALTE}</h1>
      <p className={s.introduction}>{copie.INTRODUCTION}</p>
      <Memoire
        // La copie descend d'ici : `render/` est un adaptateur muet et n'importe pas `lib/domain`
        // (AD-7, gardé par `tests/arc-architecture.test.ts`). Même geste qu'en `/reglages`.
        copie={{
          etatVide: copie.ETAT_VIDE,
          corriger: copie.ACTION_CORRIGER,
          supprimer: copie.ACTION_SUPPRIMER,
          enregistrer: copie.ACTION_ENREGISTRER,
          renoncer: copie.ACTION_RENONCER,
          annuler: copie.ACTION_ANNULER,
          voirSource: copie.VOIR_SOURCE,
          sourceAbsente: copie.SOURCE_ABSENTE,
          mentionCorrige: copie.MENTION_CORRIGE,
          supprimeAnnonce: copie.SUPPRIME_ANNONCE,
          correctionRefusee: copie.CORRECTION_APRES_REVOCATION,
        }}
        faits={faits.map((f) => ({
          cle: f.cle,
          contenu: f.contenu,
          corrige: f.statut === "corrige",
          jour: f.jour,
          source: f.source,
        }))}
        // D2 — annoncé D'AVANCE plutôt que refusé après coup. Laisser quelqu'un composer une phrase
        // pour se la voir rejeter à l'envoi serait lui faire écrire dans le vide ; masquer le bouton
        // sans rien dire laisserait croire à une panne.
        correctionPossible={etape !== "revoque"}
        corriger={corrigerFait}
        supprimer={supprimerFait}
        annuler={annulerSuppression}
      />
    </main>
  );
}
