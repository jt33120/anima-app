import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { lireAncrages } from "@/lib/data/lire-ancrage";
import { estTraversable } from "@/lib/domain/ancrage";
import {
  AUCUN_ECRIT,
  AVANCER,
  INDISPONIBLE,
  REFUS_OFFRE,
  TERMINER,
  TITRE_HALTE,
  TRAVERSE,
} from "@/lib/domain/copie-ancrage";
import Ancrage from "@/render/ancrage/Ancrage";
import s from "@/render/ancrage/ancrage.module.css";
import PiedHalte from "@/render/PiedHalte";
import { piedPour, MENTION_IA, URL_AIDE, URL_TRANSPARENCE } from "@/lib/domain/pied-halte";

// NFR-015 / identité de route — « Anam » partout, jamais un titre qui dit l'intimité de la page.
export const metadata = { title: "Anam" };

/** Contenu réservé à l'offre : jamais mis en cache, jamais pré-rendu. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /ancrages — LA HALTE DES ANCRAGES (Story 5.9 · FR-056, FR-080, FR-081).
 *
 * Une HALTE, pas une région du monde : elle se pose par-dessus la scène (EXPERIENCE.md §62), au même
 * titre que `/lectures` et `/synthese`. Elle n'est atteignable que par URL tant que le menu de compte
 * n'existe pas — dette déjà inscrite, commune aux quatre haltes.
 *
 * ── POURQUOI L'ANCRAGE N'EST PAS UNE CARTE DE L'ACCUEIL ───────────────────────────────────────
 *
 * `lib/domain/bibliotheque.ts` invite pourtant une sixième carte, et `cartesDisponibles` la
 * retirerait gratuitement d'un compte sans l'offre. On refuse quand même, et la raison est FR-080
 * lui-même : une carte d'accueil est une VIGNETTE DE TEXTE STATIQUE. Un ancrage rendu par ce
 * composant serait, à l'écran, exactement le format court et non interactif dont FR-080 exige qu'il
 * reste distinct — la confusion obtenue par la porte de la réutilisation de composant.
 *
 * ── LA GARDE, ET OÙ ELLE VIT ──────────────────────────────────────────────────────────────────
 *
 * L'entitlement est lu par `lireAncrages` (`server-only`), et les textes ne sont ASSEMBLÉS qu'après
 * la décision. Cette page ne connaît donc jamais le contenu d'un ancrage qu'elle n'a pas le droit de
 * servir : il n'y a rien à filtrer au rendu, parce qu'il n'y a rien à filtrer tout court.
 *
 * ── LA GARDE D'ÉTAT, REPRISE MOT POUR MOT DE `/lectures` ──────────────────────────────────────
 *
 * Un compte barré, mineur, ou dont le consentement est révoqué n'a rien à faire ici — même si son
 * abonnement est actif. L'ordre est le même partout : l'état d'abord, l'offre ensuite.
 */
export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrer");

  const etape = await etapeOnboardingPour(supabase, auth.user.id);
  if (etape === "barre") redirect("/barriere");
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");
  if (etape === "revoque") redirect("/consentement/revoque");

  // ⚠️ TROIS ISSUES, ET AUCUNE NE DOIT PRENDRE L'APPARENCE D'UNE AUTRE.
  //   « je n'arrive pas à lire »  ≠  « tu n'as pas l'offre »  ≠  « Anima n'a rien écrit ».
  // `estPremiumCourante` RELANCE sur une vraie panne (3.1, « le doute suspend le commerce ») : sans
  // ce `try`, la panne remonterait en 500 ; avec un `?? false`, elle se lirait comme un refus d'offre
  // à une abonnée active. C'est le défaut corrigé en 4.6 puis en 4.9, transposé au commerce.
  let acces: Awaited<ReturnType<typeof lireAncrages>> | null = null;
  try {
    acces = await lireAncrages();
  } catch {
    acces = null;
  }

  if (acces === null) {
    return (
      <main className={s.halte}>
        <h1 className="t-titre">{TITRE_HALTE}</h1>
        <p className="t-corps">{INDISPONIBLE}</p>
      </main>
    );
  }

  if (acces.statut === "refuse") {
    return (
      <main className={s.halte}>
        <h1 className="t-titre">{TITRE_HALTE}</h1>
        {/* Un LIEN, pas une vitrine : on ne teaser pas ce qu'on n'a pas (FR-057), et il n'y a ni
            cadenas, ni compteur de ce qui manque (FR-031). */}
        <p className="t-corps">
          {REFUS_OFFRE} <Link href="/abonnement">Mon abonnement</Link>
        </p>
      </main>
    );
  }

  // Un exercice à trous n'est pas un exercice court, c'est un exercice cassé : `estTraversable`
  // écarte l'ancrage incomplet AVANT le rendu. En v1 il les écarte tous — les 24 créneaux attendent
  // Anima, et la halte le dit honnêtement plutôt que de fabriquer un repli (FR-054 + FR-086).
  const traversables = acces.ancrages.filter(estTraversable);

  return (
    <main className={s.halte}>
      <h1 className="t-titre">{TITRE_HALTE}</h1>

      {traversables.length === 0 && <p className="t-corps">{AUCUN_ECRIT}</p>}

      {traversables.map((a) => (
        <Ancrage
          key={a.cle}
          ancrage={{
            cle: a.cle,
            // Les deux `statut` sont déjà tranchés par `estTraversable` ; les narrower ici évite un
            // `as` et garde la garde visible.
            titre: a.titre.statut === "ecrit" ? a.titre.texte : "",
            temps: a.temps.map((t) => ({ texte: t.texte.statut === "ecrit" ? t.texte.texte : "" })),
          }}
          mots={{ avancer: AVANCER, terminer: TERMINER, traverse: TRAVERSE }}
        />
      ))}
      {/* Story 6.9 (QA T7) — la porte de secours (FR-077) et, là où elle est due, la mention
          IA (art. 50). Le MODÈLE décide ; ce composant dessine. */}
      <PiedHalte
        mentionIA={piedPour("ancrages").mentionIA}
        texteMention={MENTION_IA}
        urlTransparence={URL_TRANSPARENCE}
        urlAide={URL_AIDE}
      />
    </main>
  );
}
