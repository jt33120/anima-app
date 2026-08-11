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
 * ── STORY 5.3 : LE RECALCUL EST PARESSEUX, DÉCLENCHÉ PAR L'EMPREINTE ──────────────────────────
 *
 * Le réflexe serait de recalculer dans l'action qui écrit l'heure de naissance. Trois raisons de ne
 * pas le faire, et la troisième est décisive :
 *
 *   • une panne pendant ce recalcul laisserait l'heure écrite et le thème PÉRIMÉ POUR TOUJOURS
 *     (write-once : elle ne peut pas réessayer en réécrivant son heure) ;
 *   • deux onglets recalculeraient deux fois, et l'un des deux violerait `version + 1` ;
 *   • surtout : un recalcul câblé sur l'action ne se déclenche JAMAIS pour une MIGRATION DE FORME
 *     du thème (personne n'a « ajouté son heure »). Or c'est exactement ce dont la 5.3 a besoin —
 *     le passage de `schema: 1` à `schema: 2` doit réparer tous les comptes existants.
 *
 * Un seul mécanisme couvre les deux : à chaque lecture, on compare l'EMPREINTE stockée à celle des
 * entrées du jour. Différentes ⇒ recalcul + `version + 1`. C'est la décision D4 de la 5.1
 * (« paresseux et idempotent ») appliquée à l'autre bout du cycle de vie.
 *
 * ⚠️ COROLLAIRE : une lecture de socle coûte désormais DEUX requêtes au lieu d'une (le thème, puis
 * les entrées de naissance). C'est le prix, et il est payé en connaissance de cause. Ce qui reste
 * intact, c'est la propriété qui compte : sur un thème à jour, l'ÉPHÉMÉRIDE N'EST PAS APPELÉE.
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
  empreinte_entrees: string;
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
  return c.schema === 2 && Array.isArray(c.positions) && Array.isArray(c.absents);
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
const CHAMPS_THEME = "version, empreinte_entrees, contenu";

export async function lireThemeNatal(
  supabase: SupabaseClient,
  utilisatriceId: string,
  ephemeride: EphemerisPort = ephemerideAstronomyEngine(),
): Promise<ResultatThemeNatal> {
  const rendre = (l: LigneTheme): ResultatThemeNatal | null =>
    themeExploitable(l.contenu) ? { statut: "calcule", theme: l.contenu, version: l.version } : null;

  // 1. Le thème déjà gravé, s'il existe.
  const { data: existant, error: erreurLecture } = await supabase
    .from("theme_natal")
    .select(CHAMPS_THEME)
    .eq("utilisatrice_id", utilisatriceId)
    .maybeSingle<LigneTheme>();
  if (erreurLecture) return { statut: "indisponible", raison: "lecture_impossible" };
  const dejaLa = existant ? rendre(existant) : null;

  // 2. Les entrées de naissance — lues MÊME quand un thème existe (Story 5.3, décision D5).
  //    C'est le coût du recalcul paresseux : un `select` de plus par lecture de socle. En échange,
  //    l'ajout de l'heure et les migrations de forme se réparent tout seuls, à la lecture suivante.
  const { data: naissance, error: erreurNaissance } = await supabase
    .from("utilisatrice")
    .select("date_naissance, heure_naissance, lieu_fuseau, lieu_latitude, lieu_longitude")
    .eq("id", utilisatriceId)
    .maybeSingle<LigneNaissance>();
  // Une panne ici ne doit PAS faire disparaître un socle valide : on rend ce qu'on a.
  if (erreurNaissance) return dejaLa ?? { statut: "indisponible", raison: "lecture_impossible" };
  if (!naissance?.date_naissance) {
    return dejaLa ?? { statut: "indisponible", raison: "naissance_absente" };
  }

  const entrees: EntreesNaissance = {
    date: naissance.date_naissance,
    heure: naissance.heure_naissance,
    fuseau: naissance.lieu_fuseau,
    latitude: naissance.lieu_latitude,
    longitude: naissance.lieu_longitude,
  };
  const empreinte = empreinteDe(entrees, ephemeride.identifiant);

  // 3. LE CHEMIN DE TRÈS LOIN LE PLUS FRÉQUENT : rien n'a changé. On rend le thème gravé, et
  //    `ephemeride` n'est PAS APPELÉ UNE SEULE FOIS — c'est le coût marginal nul de l'AC4 de la
  //    5.1, mesuré par un port doublé qui compte ses appels.
  if (dejaLa && existant!.empreinte_entrees === empreinte) return dejaLa;

  // 4. Il faut (re)calculer. Pur, déterministe, sans modèle de langage (AD-6/NFR-011).
  const theme = calculerThemeNatal(entrees, ephemeride);

  // 5a. PREMIER calcul : on grave. `ignoreDuplicates` — deux onglets ouverts en même temps
  //     produisent le même thème et une seule ligne. Le conflit n'est pas une erreur, c'est la
  //     course gagnée par l'autre.
  if (!existant) {
    const { error } = await supabase.from("theme_natal").upsert(
      { utilisatrice_id: utilisatriceId, empreinte_entrees: empreinte, contenu: theme },
      { onConflict: "utilisatrice_id", ignoreDuplicates: true },
    );
    // Le write-gate art. 9 (0039) refuse sans consentement valide ou sous barrière de minorité. Ce
    // n'est pas une panne : c'est la garde qui fonctionne. On ne remonte que le code Postgres — la
    // date de naissance et les positions ne sortent jamais dans une erreur (NFR-022).
    if (error) return { statut: "indisponible", raison: "ecriture_refusee" };
  } else {
    // 5b. RECALCUL. Un `upsert` ne ferait RIEN ici (conflit ignoré) tout en rendant un succès —
    //     le thème périmé resterait affiché pour toujours (piège P3). Le seul chemin est un
    //     `update` explicite qui apporte les DEUX preuves exigées par le trigger de 0039 :
    //     version + 1 exactement, ET empreinte différente.
    const { error } = await supabase
      .from("theme_natal")
      .update({ version: existant.version + 1, empreinte_entrees: empreinte, contenu: theme })
      .eq("utilisatrice_id", utilisatriceId);
    if (error) {
      // Deux causes possibles, et la réponse est la même : NE PAS PERDRE CE QU'ON A.
      //   • le write-gate refuse (consentement révoqué) — le vieux thème reste vrai, et le
      //     détruire pour améliorer un détail serait absurde (P2) ;
      //   • une autre requête a recalculé entre-temps : notre `version + 1` est déjà pris et le
      //     trigger nous refuse. C'est le BON comportement — une seule écriture gagne. On relit
      //     pour rendre la version gagnante plutôt que notre copie périmée (P4).
      const { data: apres } = await supabase
        .from("theme_natal")
        .select(CHAMPS_THEME)
        .eq("utilisatrice_id", utilisatriceId)
        .maybeSingle<LigneTheme>();
      const gagnant = apres ? rendre(apres) : null;
      return gagnant ?? dejaLa ?? { statut: "indisponible", raison: "ecriture_refusee" };
    }
  }

  // 6. On RELIT plutôt que de rendre l'objet en mémoire : sur conflit ignoré, la ligne gagnante est
  //    celle de l'autre requête, et c'est ELLE qui fait foi. Rendre notre copie ferait diverger ce
  //    qu'on affiche de ce qui est gravé — deux thèmes identiques aujourd'hui, plus forcément le
  //    jour où l'adaptateur change entre les deux requêtes.
  const { data: relu, error: erreurRelecture } = await supabase
    .from("theme_natal")
    .select(CHAMPS_THEME)
    .eq("utilisatrice_id", utilisatriceId)
    .maybeSingle<LigneTheme>();
  if (erreurRelecture || !relu) return { statut: "indisponible", raison: "lecture_impossible" };
  return rendre(relu) ?? { statut: "indisponible", raison: "lecture_impossible" };
}
