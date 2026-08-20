import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerDepotBranche } from "@/lib/data/depot-branche";
import { lireFaitsRetenus } from "@/lib/data/lire-memoire";
import type { FaitRetenu } from "@/lib/domain/memoire-retenue";
import { lireEnneagramme } from "@/lib/data/lire-enneagramme";
import { lireThemeNatal } from "@/lib/data/depot-theme-natal";
import { SIGNES } from "@/lib/astro/theme-natal";
import {
  CONTEXTE_BRANCHES_MAX,
  CONTEXTE_RETENU_MAX,
  type MatiereContexte,
} from "@/lib/domain/contexte-anam";

/**
 * lire-contexte-anam.ts — LA MATIÈRE DU CONTEXTE, LUE SOUS LE JWT (QA manuelle du 2026-08-20).
 *
 * L'autre moitié de `lib/domain/contexte-anam.ts`, qui, lui, ne lit rien. Ce partage n'est pas
 * cosmétique : la COMPOSITION du contexte est ce qu'on veut tester sans base, et c'est aussi ce
 * qu'un jour on voudra faire relire à Anima. La LECTURE, elle, doit passer par les fonctions
 * possédées et la RLS (AD-12), qui sont ce qui garantit qu'on ne lit que les siennes.
 *
 * ⚠️ CINQ LECTURES, CINQ REPLIS, ET AUCUNE N'EST CRITIQUE. Une panne de socle ou de mémoire ne doit
 * PAS empêcher quelqu'un de parler à Anam : chaque source tombe sur « je ne sais pas », et le
 * module pur sait dire l'ignorance mieux que le silence. C'est la même politique que la page de
 * scène, pour la même raison.
 *
 * ⚠️ LE THÈME EST LU, JAMAIS RECALCULÉ ICI — ET C'EST UNE PRÉCAUTION MESURABLE. `lireThemeNatal`
 * peut ÉCRIRE : premier calcul, ou recalcul après l'ajout de l'heure, et dans le cas dégradé ce
 * calcul coûte ~663 lectures d'éphéméride. Le mettre sur le chemin d'un tour de conversation
 * ajouterait ce coût à chaque message. On ne l'appelle donc que si un thème EXISTE déjà — la page
 * de scène l'a calculé au chargement —, et sur le chemin du tour on se contente de sa lecture.
 */

/** Ce qu'on met en mots du socle : ce qui se dit, jamais des degrés. */
const CORPS_DITS = ["soleil", "lune"] as const;

const signeDeLongitude = (longitude: number): string | null => {
  const i = Math.floor(((longitude % 360) + 360) % 360 / 30);
  return SIGNES[i] ?? null;
};

const capitale = (mot: string) => mot.charAt(0).toUpperCase() + mot.slice(1);

async function lireSocle(supabase: SupabaseClient, utilisatriceId: string): Promise<readonly string[]> {
  const resultat = await lireThemeNatal(supabase, utilisatriceId);
  if (resultat.statut !== "calcule") return [];
  const dits: string[] = [];
  for (const nom of CORPS_DITS) {
    const p = resultat.theme.positions.find((x) => x.corps === nom);
    if (p) dits.push(`${capitale(nom)} en ${p.signe}`);
  }
  if (resultat.theme.angles.statut === "calcule") {
    const signe = signeDeLongitude(resultat.theme.angles.ascendant);
    if (signe) dits.push(`Ascendant ${signe}`);
  }
  return dits;
}

/**
 * Toute la matière, en parallèle. `premiereFois` est dérivé de l'ABSENCE de tout : aucune branche,
 * aucun fait retenu. Ce n'est pas exactement « aucune séance » — quelqu'un peut avoir parlé sans
 * que rien ne soit retenu —, et c'est pourquoi le module pur distingue les deux cas au lieu de les
 * confondre dans un seul message.
 */
export async function lireContexteAnam(
  supabase: SupabaseClient,
  utilisatriceId: string,
): Promise<MatiereContexte> {
  const [prenom, socle, branches, retenu, type] = await Promise.all([
    Promise.resolve(
      supabase
        .from("utilisatrice")
        .select("prenom")
        .eq("id", utilisatriceId)
        .maybeSingle<{ prenom: string | null }>(),
    )
      .then((r) => r.data?.prenom ?? null)
      .catch(() => null),
    lireSocle(supabase, utilisatriceId).catch(() => [] as readonly string[]),
    creerDepotBranche(supabase)
      .chargerBranches()
      .catch(() => []),
    lireFaitsRetenus(supabase).catch(() => [] as readonly FaitRetenu[]),
    lireEnneagramme(supabase, utilisatriceId).catch(() => ({ statut: "indisponible" as const, raison: "lecture_impossible" as const })),
  ]);

  return {
    prenom,
    socle,
    // Les plus RÉCENTES d'abord : ce qui vient d'être nommé est ce qui a le plus de chances de
    // revenir dans le tour en cours.
    branches: [...branches]
      .sort((a, b) => b.dateNaissance.localeCompare(a.dateNaissance))
      .slice(0, CONTEXTE_BRANCHES_MAX)
      .map((b) => ({ nom: b.nom, enPleineLumiere: b.etat === "rayonnement" })),
    retenu: retenu.slice(0, CONTEXTE_RETENU_MAX).map((f) => f.contenu),
    /* ⚠️ LE NUMÉRO DU TYPE, PAS SON TEXTE DE CORPUS. `texteDuTypeRetenu` rend un `TexteCorpus`,
       qui est `non_ecrit` tant qu'Anima n'a pas écrit les neuf textes — et le sera longtemps. Le
       numéro, lui, est un fait de la base. On dit aussi d'où il vient : un type PASSÉ par le test
       et un type PRESSENTI par Anam n'ont pas le même poids, et les confondre ferait traiter une
       hypothèse comme un résultat. */
    typePressenti:
      type.statut === "calcule"
        ? `type ${type.type}${type.origine === "hypothese" ? " (hypothèse d’Anam, non confirmée par le test)" : " (issu du test)"}`
        : null,
    premiereFois: branches.length === 0 && retenu.length === 0,
  };
}
