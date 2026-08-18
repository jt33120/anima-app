import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { listerLectures, type Lecture } from "@/lib/data/depot-lecture";
import { lireDescriptionCarteArchivee } from "@/lib/corpus/description-cartes";
import CarteTiree from "@/render/lecture/CarteTiree";
import Restitution from "@/render/lecture/Restitution";
import LienEchangeSource from "@/render/lecture/LienEchangeSource";
import s from "@/render/lecture/lecture.module.css";
import PiedHalte from "@/render/PiedHalte";
import { piedPour, MENTION_IA, URL_AIDE, URL_TRANSPARENCE } from "@/lib/domain/pied-halte";

/** Combien de lectures la halte transporte. Même raison qu'en 4.9 : un document art. 9 pèse. */
const LECTURES_MAX = 30;

// NFR-015 / identité de route — « Anam » partout, jamais un titre qui dit l'intimité de la page.
export const metadata = { title: "Anam" };

/** Route art. 9 : jamais mise en cache, jamais pré-rendue. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /lectures — « MES LECTURES » (Story 5.8, AC1/AC6 · FR-021).
 *
 * Une HALTE, pas une région du monde : elle se pose par-dessus la scène (EXPERIENCE.md §62), et sa
 * place dans le menu de compte est fixée par l'ordre invariable — Aide et ressources, Ce qu'Anam
 * retient, La synthèse, **Mes lectures**, L'abonnement, Mes données, Ce que j'ai accepté, Réglages.
 *
 * ── CE QU'ELLE NE FAIT PAS ────────────────────────────────────────────────────────────────────
 *
 * Elle ne DÉCLENCHE rien. L'état vide renvoie à la conversation par un lien, jamais par un bouton
 * « tirer une carte » : « le rituel se demande, il ne se déclenche pas » (UX). Un bouton ici serait
 * la même faute que dans le composeur, déplacée d'un écran.
 *
 * Et elle ne PARTAGE rien — l'UX l'interdit nommément (« ne jamais faire … partager une lecture »).
 * Il n'y a donc aucun bouton de partage, aucune URL publique, aucun export d'une lecture seule.
 *
 * ── LA GARDE D'ÉTAT, ET POURQUOI ELLE N'EST PAS FACULTATIVE ───────────────────────────────────
 *
 * Reprise mot pour mot de `/synthese` (revue 4.9, T1-3). La RLS de `lecture` autorise le SELECT au
 * propriétaire sans regarder ni la barrière de minorité ni le consentement — c'est voulu, l'export
 * FR-067 en dépend. Mais SERVIR de l'art. 9 dans l'app à quelqu'un qui a révoqué son consentement,
 * ou dont le compte est barré, n'est pas de l'export : c'est de l'usage produit.
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

  // ⚠️ « JE N'ARRIVE PAS À LIRE » N'EST PAS « TU N'AS RIEN ». Le défaut corrigé en 4.6 puis en 4.9 :
  // sur une 5xx PostgREST, `data` vaut `null` et le vide s'affiche — « Aucune lecture pour l'instant »
  // à quelqu'un qui en a trente. La panne se dit comme une panne.
  let lectures: readonly Lecture[];
  let indisponible = false;
  try {
    lectures = (await listerLectures(supabase)).slice(0, LECTURES_MAX);
  } catch {
    indisponible = true;
    lectures = [];
  }

  // Les clés de tour → les entrées de journal correspondantes, en UNE requête. C'est ce qui donne le
  // « lien vers l'échange source » (FR-021) : `cle_tour_source` désigne le tour logique, et
  // `EchangeSource` a besoin de l'identifiant de l'ENTRÉE. Une panne ici retire le lien, jamais le
  // document — un lien manquant est un manque, un document manquant est une perte.
  const cles = lectures.map((l) => l.cleTourSource).filter((c): c is string => c !== null);
  const entreeParCle = new Map<string, string>();
  if (cles.length > 0) {
    const { data: entrees } = await supabase
      .from("entree_journal")
      .select("id, cle_tour")
      .eq("role", "utilisatrice")
      .in("cle_tour", cles);
    for (const e of entrees ?? []) entreeParCle.set(e.cle_tour as string, e.id as string);
  }

  const dateLisible = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className={s.halte}>
      <h1 className="t-titre">Mes lectures</h1>

      {indisponible && (
        <p className="t-corps">
          Je n’arrive pas à relire tes lectures en ce moment. Elles sont là ; reviens un peu plus tard.
        </p>
      )}

      {!indisponible && lectures.length === 0 && (
        // La copie exacte de l'UX, et un LIEN — jamais un déclencheur.
        <p className="t-corps">
          {/* ⚠️ CETTE PHRASE ENVOYAIT VERS UNE FONCTION QUI N'EXISTE PAS (QA tour 1, T8).
              Mesuré : la page disait « Tu peux en demander une à Anam », et Anam répondait « Je ne
              tire pas de cartes. » Une application qui donne une consigne que son propre personnage
              refuse fait douter la lectrice d'elle-même avant de la faire douter du produit —
              exactement ce que la 4.9 avait déjà corrigé sur « dans le menu de compte ».

              Le tirage ne se demande pas en conversation : il s'ouvre depuis ici. Tant que le geste
              n'est pas posé, la page dit ce qui est, sans envoyer nulle part. */}
          Aucune lecture pour l’instant.
        </p>
      )}

      {lectures.map((l) => {
        // ⚠️ LECTURE TOLÉRANTE, PAS STRICTE (revue Epic 5, R1). `lireDescriptionCarte` jette sur une
        // clé hors du jeu COURANT — juste au dépôt, faux ici : la 5.10 a retiré des cartes, et une
        // archive porte la carte de son jour. Le `as CleCarteJeu` d'avant affirmait au compilateur
        // exactement ce qui était faux, et une seule ligne d'archive faisait tomber TOUTE la halte.
        const description = lireDescriptionCarteArchivee(l.carte);
        const entreeId = l.cleTourSource ? entreeParCle.get(l.cleTourSource) : undefined;
        return (
          <Restitution
            key={l.id}
            texte={l.restitution ?? ""}
            // Ici SES MOTS sont portés, contrairement au fil : il n'y a plus de conversation autour
            // pour les tenir. Sans eux, on lirait une interprétation sans savoir de quoi (FR-021).
            sesMots={l.reponse ?? undefined}
            date={dateLisible(l.ouverteA)}
            visuel={<CarteTiree carte={{ cle: l.carte, description }} />}
            echangeSource={entreeId ? <LienEchangeSource extraitSourceId={entreeId} /> : undefined}
          />
        );
      })}
      {/* Story 6.9 (QA T7) — la porte de secours (FR-077) et, là où elle est due, la mention
          IA (art. 50). Le MODÈLE décide ; ce composant dessine. */}
      <PiedHalte
        mentionIA={piedPour("lectures").mentionIA}
        texteMention={MENTION_IA}
        urlTransparence={URL_TRANSPARENCE}
        urlAide={URL_AIDE}
      />
    </main>
  );
}
