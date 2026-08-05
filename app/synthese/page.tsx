import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import FicheSynthese from "@/render/synthese/FicheSynthese";
import s from "@/render/synthese/synthese.module.css";

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

  const { data } = await supabase
    .from("synthese")
    .select("id, periode_debut, periode_fin, contenu, tronquee")
    .order("periode_fin", { ascending: false });

  const syntheses = data ?? [];
  const derniere = syntheses[0];

  return (
    <main className={s.halte}>
      <h1 className="t-titre">La synthèse</h1>

      {!derniere && (
        // Le vide se dit sobrement, sans promesse de date. « Elle arrivera lundi » serait un engagement
        // que ni le cron, ni le modèle, ni le contenu de sa semaine ne permettent de tenir.
        <p className="t-corps">
          Il n’y en a pas encore. Elle paraîtra quand il y aura quelque chose à relire.
        </p>
      )}

      {derniere && (
        <FicheSynthese
          contenu={derniere.contenu}
          debut={derniere.periode_debut}
          fin={derniere.periode_fin}
          tronquee={derniere.tronquee}
        />
      )}

      {syntheses.length > 1 && (
        <section>
          <h2 className="t-titre-sm">Les précédentes</h2>
          {syntheses.slice(1).map((precedente) => (
            <details key={precedente.id} className={s.precedente}>
              <summary className="t-meta">
                Du {jourLisible(precedente.periode_debut)} au {jourLisible(precedente.periode_fin)}
              </summary>
              <FicheSynthese
                contenu={precedente.contenu}
                debut={precedente.periode_debut}
                fin={precedente.periode_fin}
                tronquee={precedente.tronquee}
              />
            </details>
          ))}
        </section>
      )}
    </main>
  );
}

function jourLisible(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
