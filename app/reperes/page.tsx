import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import * as copie from "@/lib/domain/copie-reperes";
import Reperes from "@/render/reperes/Reperes";
import PiedHalte from "@/render/PiedHalte";
import { piedPour, MENTION_IA, URL_AIDE, URL_TRANSPARENCE } from "@/lib/domain/pied-halte";

// NFR-015 / identité de route — « Anam » partout, jamais un titre qui dit l'intimité de la page.
export const metadata = { title: "Anam" };

/**
 * ⚠️ RENDUE À LA DEMANDE, comme toutes les pages qui lisent la session : `proxy.ts` pose un nonce
 * NOUVEAU À CHAQUE REQUÊTE et `'strict-dynamic'` fait ignorer `'self'`. Un HTML figé au build ne
 * porte aucun nonce valide, donc aucun de ses scripts n'est chargé. On le DÉCLARE plutôt que de le
 * déduire d'un détail d'implémentation qu'un correctif peut retirer — c'est l'inférence qui a piégé
 * `/aide`.
 */
export const dynamic = "force-dynamic";

/**
 * /reperes — LA HALTE « REPÈRES » (QA manuelle du 2026-08-19).
 *
 * « Là on est lancé dans le grand bain, on comprend rien. » Le seuil disait une phrase, l'accueil
 * présentait trois noms UNE fois, et rien ne se relisait. Cette page est l'endroit où l'on relit.
 *
 * ⚠️ ELLE EST DERRIÈRE LA MÊME GARDE QUE LES AUTRES HALTES, ET CE N'EST PAS UN OUBLI DE PORTÉE.
 * Elle décrit un compte : sa mémoire, son arbre, ce qu'il peut effacer. La rendre publique
 * n'aiderait personne qui n'a pas encore de compte — le seuil et `/entrer` disent déjà ce qu'il
 * faut savoir avant d'entrer — et la ferait ressembler à `/aide`, qui est publique pour une raison
 * précise et non transposable : on peut avoir besoin d'un numéro d'urgence sans avoir de compte.
 */
export default async function PageReperes() {
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
  if (etape === "revoque") redirect("/consentement/revoque");

  return (
    <>
      <Reperes
        titre={copie.TITRE_HALTE}
        ouverture={copie.OUVERTURE}
        places={copie.PLACES}
        sections={copie.SECTIONS}
        siCaNeVaPas={copie.SI_CA_NE_VA_PAS}
        parOuCommencer={copie.PAR_OU_COMMENCER}
        urlRetour="/"
      />
      {/* Story 6.9 (QA T7) — la porte de secours (FR-077) et, là où elle est due, la mention IA
          (art. 50). Le MODÈLE décide ; ce composant dessine. Elle n'est PAS due ici : rien sur
          cette page n'a été produit par un modèle. */}
      <PiedHalte
        mentionIA={piedPour("reperes").mentionIA}
        texteMention={MENTION_IA}
        urlTransparence={URL_TRANSPARENCE}
        urlAide={URL_AIDE}
      />
    </>
  );
}
