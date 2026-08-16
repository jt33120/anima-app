import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { periodeLisible } from "@/lib/domain/synthese";
import FicheSynthese from "@/render/synthese/FicheSynthese";
import s from "@/render/synthese/synthese.module.css";
import PiedHalte from "@/render/PiedHalte";
import { piedPour, MENTION_IA, URL_AIDE, URL_TRANSPARENCE } from "@/lib/domain/pied-halte";

/** Combien de synthèses passées la halte transporte. Voir la note sur `<details>` plus bas. */
const PRECEDENTES_MAX = 12;

// NFR-015 / identité de route — « Anam » partout, jamais un titre qui dit l'intimité de la page.
export const metadata = { title: "Anam" };

/**
 * /synthese — LA HALTE (Story 4.9, AC2 « conservée et consultable »).
 *
 * Une HALTE, pas une région du monde : elle se pose par-dessus la scène et y renvoie (EXPERIENCE.md §62).
 * C'est aussi l'adresse que porte le courriel — d'où l'ordre des choses : le lien mène ICI, pas au
 * contenu. Ouvrir demande d'être connectée. Un lien qui afficherait la synthèse sans authentification
 * serait une fuite d'art. 9 par URL, et les URL se transfèrent, se journalisent et se prévisualisent.
 *
 * LA LECTURE PASSE PAR LA SESSION, jamais par `service_role` (AD-12). La policy propriétaire de
 * `synthese` est donc ce qui garantit qu'on ne lit que les siennes — et pas une condition écrite ici,
 * qu'un refactor pourrait perdre. C'est la règle du projet pour tout contenu applicatif : l'ordonnanceur
 * ÉCRIT sous `service_role`, l'utilisatrice LIT sous sa session.
 *
 * FR-031 : aucun compte, aucun chiffre, aucune progression. On montre la dernière synthèse et on donne
 * accès aux précédentes par leur période — jamais « ta 7ᵉ synthèse » ni « 3 synthèses en attente ».
 */
export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrer");

  // LA GARDE D'ÉTAT (revue 4.9, T1-3). Elle manquait, et c'était le SEUL écran authentifié du produit
  // sans elle — sur la page qui affiche de l'art. 9, et qui est précisément conçue pour être atteinte
  // par un lien de courriel, donc en accès direct, hors du chemin gardé. La RLS ne rattrape rien : la
  // policy propriétaire de `synthese` autorise la lecture de SES lignes, sans regarder ni la barrière de
  // minorité ni le consentement. Une adolescente barrée après coup, ou une femme ayant révoqué son
  // consentement art. 9, lisaient leur récit intact pendant que tout le reste du produit les renvoyait
  // ailleurs. `etat-onboarding.ts` le dit dans son propre en-tête : « une barrière oubliée dans un seul
  // chemin suffit à laisser passer un mineur ».
  const etape = await etapeOnboardingPour(supabase, auth.user.id);
  if (etape === "barre") redirect("/barriere");
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");
  if (etape === "revoque") redirect("/consentement/revoque");

  // `error` DÉSTRUCTURÉ, et c'est tout l'objet de la correction (T1-6). Sans lui, `data` valait `null`
  // sur une 5xx PostgREST et le vide s'affichait : « Il n'y en a pas encore » à quelqu'un qui en a trente,
  // dans la minute même où un courriel venait de lui annoncer le contraire. C'est le défaut corrigé en
  // 4.6, dont le correctif est écrit à trois fichiers d'ici (`lib/safety/projection-arbre.ts`) : ne jamais
  // confondre « je n'arrive pas à lire » avec « tu n'as rien ».
  //
  // La borne (T6-2) : un `<details>` fermé transporte quand même son contenu. Sans limite, deux ans
  // d'usage faisaient descendre une centaine de récits art. 9 dans une seule réponse, souvent en 4G.
  const { data, error } = await supabase
    .from("synthese")
    .select("id, periode_debut, periode_fin, contenu, tronquee")
    .order("periode_fin", { ascending: false })
    .limit(PRECEDENTES_MAX + 1);

  const indisponible = error !== null;
  const syntheses = data ?? [];
  const derniere = syntheses[0];

  return (
    <main className={s.halte}>
      <h1 className="t-titre">La synthèse</h1>

      {indisponible && (
        // La panne se dit comme une panne. Elle n'efface pas son histoire, et elle n'invente pas de date
        // de retour — elle dit seulement que le défaut est de notre côté.
        <p className="t-corps">
          Je n’arrive pas à relire tes synthèses en ce moment. Elles sont là ; reviens un peu plus tard.
        </p>
      )}

      {!indisponible && !derniere && (
        // Le vide se dit sobrement, sans promesse de date. « Elle arrivera lundi » serait un engagement
        // que ni le cron, ni le modèle, ni le contenu de sa semaine ne permettent de tenir.
        <p className="t-corps">
          Il n’y en a pas encore. Elle paraîtra quand il y aura quelque chose à relire.
        </p>
      )}

      {derniere && (
        <FicheSynthese
          contenu={derniere.contenu}
          periode={periodeLisible(derniere.periode_debut, derniere.periode_fin)}
          tronquee={derniere.tronquee}
        />
      )}

      {syntheses.length > 1 && (
        <section>
          <h2 className="t-titre-sm">Les précédentes</h2>
          {syntheses.slice(1, PRECEDENTES_MAX + 1).map((precedente) => (
            <details key={precedente.id} className={s.precedente}>
              <summary className="t-meta">{periodeLisible(precedente.periode_debut, precedente.periode_fin)}</summary>
              <FicheSynthese
                contenu={precedente.contenu}
                periode={periodeLisible(precedente.periode_debut, precedente.periode_fin)}
                tronquee={precedente.tronquee}
              />
            </details>
          ))}
        </section>
      )}
      {/* Story 6.9 (QA T7) — la porte de secours (FR-077) et, là où elle est due, la mention
          IA (art. 50). Le MODÈLE décide ; ce composant dessine. */}
      <PiedHalte
        mentionIA={piedPour("synthese").mentionIA}
        texteMention={MENTION_IA}
        urlTransparence={URL_TRANSPARENCE}
        urlAide={URL_AIDE}
      />
    </main>
  );
}

