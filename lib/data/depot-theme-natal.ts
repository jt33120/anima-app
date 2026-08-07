import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import type { EphemerisPort } from "@/lib/astro/port";
import {
  calculerThemeNatal,
  chaineEmpreinte,
  type EntreesNaissance,
  type ThemeNatal,
} from "@/lib/astro/theme-natal";

/**
 * depot-theme-natal.ts — LIRE LE THÈME NATAL, LE CALCULER S'IL N'EXISTE PAS (Story 5.1, AD-6).
 *
 * ── SOUS LE JWT DE L'UTILISATRICE, JAMAIS `service_role` ───────────────────────────────────────
 *
 * Le réflexe, pour « écrire quelque chose de calculé », est de passer par `service_role` — c'est ce
 * que fait `depot-seance` (trace server-authoritative) et `depot-synthese` (écrit par un job). Ici
 * ce serait une faute : le thème natal est un contenu art. 9 POSSÉDÉ par l'utilisatrice, comme
 * `entree_journal`. `service_role` contournerait la RLS **et** le write-gate de consentement,
 * c'est-à-dire exactement les deux gardes que la migration 0039 met en place (AD-12, AD-13).
 *
 * Le patron copié est `depot-journal.ts`, pas `depot-seance.ts`.
 *
 * ── PARESSEUX ET IDEMPOTENT, PAS « CALCULÉ À L'INSCRIPTION » (décision D4) ─────────────────────
 *
 * AD-6 dit « calculé UNE FOIS à l'inscription ». Câbler un appel après l'écran de consentement
 * serait la lecture littérale — et un piège : si cet appel échoue (réseau, déploiement en cours),
 * aucune ligne n'est écrite, RIEN NE RÉESSAIE, et l'utilisatrice reste durablement sans socle sans
 * que personne le sache.
 *
 * Ici : on lit ; s'il n'y a rien, on calcule, on insère en ignorant le conflit, on relit. L'unicité
 * vient de la CLÉ PRIMAIRE (0039), pas de la discipline de l'appelant — deux requêtes concurrentes
 * au premier affichage ne peuvent pas produire deux thèmes, et une panne se répare toute seule à la
 * lecture suivante. C'est « une seule fois » rendu plus fort que sa formulation littérale.
 *
 * ── POURQUOI CETTE COUCHE IMPORTE `lib/astro` (et pourquoi c'est le bon sens) ──────────────────
 *
 * `lib/data` est sous `lib/astro` dans les couches (SPINE L31/L33) — l'import remonte donc. Il est
 * néanmoins sûr, et c'est le seul sens qui l'est : `lib/astro` est PUR (aucune I/O, aucun
 * `server-only`, aucun Supabase), donc en dépendre n'introduit ni cycle ni couplage à l'infra. La
 * règle qui compte vraiment est l'inverse, et elle est gardée : **`lib/astro/**` n'importe JAMAIS
 * `lib/data`** (`tests/astro-architecture.test.ts`). Sans cette garde, le socle déterministe
 * deviendrait dépendant d'une base, et ne serait plus testable sans elle.
 *
 * ── ART. 9 DANS LES ERREURS : JAMAIS (NFR-022) ────────────────────────────────────────────────
 *
 * Les longitudes, la date et l'heure de naissance ne sortent jamais dans un message d'erreur ni
 * dans un log. Comme `depot-journal.ts:25`, on ne remonte que le code Postgres.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════

export type RaisonIndisponible =
  /** Pas de date de naissance en base — le parcours d'entrée n'est pas allé au bout (FR-048). */
  | "naissance_absente"
  /** Lecture en base impossible (panne). DISTINCT de « pas encore calculé » : c'est un incident. */
  | "lecture_impossible"
  /** Écriture refusée : pas de consentement art. 9 valide, ou compte barré-minorité (AD-13). */
  | "ecriture_refusee";

export type ResultatThemeNatal =
  | { readonly statut: "calcule"; readonly theme: ThemeNatal; readonly version: number }
  | { readonly statut: "indisponible"; readonly raison: RaisonIndisponible };

/** Empreinte des entrées : hachage de la chaîne canonique produite par le domaine (pur). */
export function empreinteDe(entrees: EntreesNaissance, identifiantAdaptateur: string): string {
  return createHash("sha256").update(chaineEmpreinte(entrees, identifiantAdaptateur)).digest("hex");
}

interface LigneNaissance {
  date_naissance: string | null;
  heure_naissance: string | null;
  lieu_fuseau: string | null;
  lieu_latitude: number | null;
  lieu_longitude: number | null;
}

interface LigneTheme {
  version: number;
  contenu: unknown;
}

/**
 * Un thème stocké est-il exploitable tel quel ?
 *
 * On ne fait PAS confiance au JSONB relu : la colonne accepte n'importe quelle forme, et une ligne
 * écrite par une version antérieure du schéma se relirait en `ThemeNatal` sans broncher jusqu'au
 * premier accès à un champ absent — c'est-à-dire dans le rendu, chez l'utilisatrice. Le contrôle
 * porte sur le NUMÉRO DE SCHÉMA et sur la présence des deux collections, pas sur chaque champ :
 * l'objectif est d'attraper une forme étrangère, pas de re-valider un calcul qu'on a produit.
 */
function themeExploitable(contenu: unknown): contenu is ThemeNatal {
  if (typeof contenu !== "object" || contenu === null) return false;
  const c = contenu as Partial<ThemeNatal>;
  return c.schema === 1 && Array.isArray(c.positions) && Array.isArray(c.absents);
}

/**
 * Le thème natal de l'utilisatrice courante : relu s'il existe, calculé et gravé sinon.
 *
 * COÛT MARGINAL NUL (FR-047, AC4) : sur un thème déjà stocké, `ephemeride` n'est **pas appelé une
 * seule fois**. C'est la propriété que teste `tests/theme-natal-sql.test.ts` avec un port doublé
 * qui compte ses appels — pas une intention, une mesure.
 *
 * `ephemeride` est injectable pour cette raison précise ; en production, l'adaptateur par défaut.
 */
export async function lireThemeNatal(
  supabase: SupabaseClient,
  utilisatriceId: string,
  ephemeride: EphemerisPort = ephemerideAstronomyEngine(),
): Promise<ResultatThemeNatal> {
  // 1. Le thème existe-t-il déjà ? C'est le chemin de très loin le plus fréquent : une lecture,
  //    rien d'autre. Aucun calcul, aucune écriture.
  const { data: existant, error: erreurLecture } = await supabase
    .from("theme_natal")
    .select("version, contenu")
    .eq("utilisatrice_id", utilisatriceId)
    .maybeSingle<LigneTheme>();
  if (erreurLecture) return { statut: "indisponible", raison: "lecture_impossible" };
  if (existant && themeExploitable(existant.contenu)) {
    return { statut: "calcule", theme: existant.contenu, version: existant.version };
  }

  // 2. Rien de stocké : il faut les entrées de naissance.
  const { data: naissance, error: erreurNaissance } = await supabase
    .from("utilisatrice")
    .select("date_naissance, heure_naissance, lieu_fuseau, lieu_latitude, lieu_longitude")
    .eq("id", utilisatriceId)
    .maybeSingle<LigneNaissance>();
  if (erreurNaissance) return { statut: "indisponible", raison: "lecture_impossible" };
  if (!naissance?.date_naissance) return { statut: "indisponible", raison: "naissance_absente" };

  const entrees: EntreesNaissance = {
    date: naissance.date_naissance,
    heure: naissance.heure_naissance,
    fuseau: naissance.lieu_fuseau,
    latitude: naissance.lieu_latitude,
    longitude: naissance.lieu_longitude,
  };

  // 3. Le calcul. Pur, déterministe, sans modèle de langage (AD-6/NFR-011).
  const theme = calculerThemeNatal(entrees, ephemeride);

  // 4. On grave. `ignoreDuplicates` : deux onglets ouverts en même temps produisent le même thème
  //    et une seule ligne. Le conflit n'est pas une erreur, c'est la course gagnée par l'autre.
  const { error: erreurEcriture } = await supabase.from("theme_natal").upsert(
    {
      utilisatrice_id: utilisatriceId,
      empreinte_entrees: empreinteDe(entrees, ephemeride.identifiant),
      contenu: theme,
    },
    { onConflict: "utilisatrice_id", ignoreDuplicates: true },
  );
  // Le write-gate art. 9 (0039) refuse sans consentement valide ou sous barrière de minorité. Ce
  // n'est pas une panne : c'est la garde qui fonctionne. On ne remonte que le code Postgres — la
  // date de naissance et les positions ne sortent jamais dans une erreur (NFR-022).
  if (erreurEcriture) return { statut: "indisponible", raison: "ecriture_refusee" };

  // 5. On RELIT plutôt que de rendre l'objet en mémoire : sur conflit ignoré, la ligne gagnante est
  //    celle de l'autre requête, et c'est ELLE qui fait foi. Rendre notre copie ferait diverger ce
  //    qu'on affiche de ce qui est gravé — deux thèmes identiques aujourd'hui, plus forcément le
  //    jour où l'adaptateur change entre les deux requêtes.
  const { data: relu, error: erreurRelecture } = await supabase
    .from("theme_natal")
    .select("version, contenu")
    .eq("utilisatrice_id", utilisatriceId)
    .maybeSingle<LigneTheme>();
  if (erreurRelecture || !relu || !themeExploitable(relu.contenu)) {
    return { statut: "indisponible", raison: "lecture_impossible" };
  }
  return { statut: "calcule", theme: relu.contenu, version: relu.version };
}
