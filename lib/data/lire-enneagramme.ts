import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { texteDuTypeRetenu } from "@/lib/corpus/enneagramme";
import type { TexteCorpus } from "@/lib/corpus/port";
import {
  estNiveauReponse,
  estTypeEnneagramme,
  type ReponseItem,
  type TypeEnneagramme,
} from "@/lib/domain/enneagramme";
import type { FaitsHypothese } from "@/lib/domain/enneagramme-hypothese";

/**
 * lire-enneagramme.ts — CE QUE LA BASE SAIT DU TYPE (Story 5.5, T6).
 *
 * ── SOUS LE JWT DE L'UTILISATRICE, JAMAIS `service_role` ───────────────────────────────────────
 *
 * Un type d'ennéagramme est un contenu art. 9 POSSÉDÉ par elle, comme `entree_journal` et
 * `theme_natal`. `service_role` contournerait la RLS **et** le write-gate de consentement —
 * c'est-à-dire les deux gardes que 0049 met en place (AD-12, AD-13). Patron `depot-theme-natal.ts`.
 *
 * ── TROIS LECTURES, PARCE QU'IL Y A TROIS CHOSES DISTINCTES À SAVOIR ───────────────────────────
 *
 * Les fusionner en une seule ferait exactement la confusion que 0049 refuse en séparant les tables :
 * « Anam pense que » n'est pas « elle a dit oui », et une tentative en cours n'est pas un type.
 *
 *   `lireEnneagramme`          le type RETENU, avec son texte de corpus.
 *   `lireTentativeEnneagramme` les réponses EN COURS, pour reprendre là où elle s'était arrêtée.
 *   `lireHypotheseEnneagramme` le germe d'Anam — à DIRE, ou seulement à RÉPONDRE (voir plus bas).
 *
 * ── « À DIRE » ET « À RÉPONDRE » NE SONT PAS LA MÊME QUESTION (leçon 0045) ─────────────────────
 *
 * `dite_le` marque qu'une hypothèse a ATTEINT UN ÉCRAN. Une fois dite, elle ne se redit pas — Anam
 * qui répète « je me demande si tu ne serais pas un 4 » à chaque chargement harcèle. Mais elle reste
 * SANS RÉPONSE, et les trois portes (accepter, refuser, corriger) doivent rester ouvertes.
 *
 * D'où le paramètre `seulementADire` : la conversation demande le germe à dire, la halte demande le
 * germe à répondre. Une seule lecture pour les deux ferait taire l'une ou nagger l'autre.
 *
 * ── ON NE FAIT PAS CONFIANCE À CE QU'ON RELIT ─────────────────────────────────────────────────
 *
 * La contrainte `check (type between 1 and 9)` existe, et on valide quand même à la relecture :
 * `service_role` a la latitude du réimport FR-067 (0049 § 5), donc une ligne peut entrer sans passer
 * par la RLS. Sans ce contrôle, `cleEnneagramme` lèverait — dans un rendu serveur, chez elle. Même
 * raisonnement que `themeExploitable` dans `depot-theme-natal.ts`.
 *
 * ── ART. 9 DANS LES ERREURS : JAMAIS (NFR-022) ────────────────────────────────────────────────
 *
 * Ni le type, ni les réponses ne sortent dans un message d'erreur ou un log. On ne remonte qu'une
 * raison d'une union FERMÉE. Le type REMONTE en donnée — c'est l'affichage légitime à la
 * propriétaire, distinct de NFR-022.
 *
 * ⚠️ Ce fichier est balayé par `tests/socle-jamais-coupe.test.ts` : l'ennéagramme est gratuit à vie
 * (FR-055), et le registre commercial n'a rien à faire ici — commentaires compris.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le type retenu
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** D'où vient le type : ses réponses, ou une hypothèse qu'elle a acceptée. Miroir de 0049. */
export type OrigineType = "test" | "hypothese";

export type RaisonEnneagrammeIndisponible =
  /** Aucun type retenu. Ce n'est PAS un incident : c'est l'état de départ de tout le monde. */
  | "sans_type"
  /** Lecture en base impossible, ou ligne inexploitable. DISTINCT de « pas encore » : un incident. */
  | "lecture_impossible";

export type ResultatEnneagramme =
  | {
      readonly statut: "calcule";
      readonly type: TypeEnneagramme;
      readonly origine: OrigineType;
      /**
       * Le texte d'Anima pour ce type — `non_ecrit` en v1, et affiché honnêtement comme tel (AC1).
       * Attaché ICI plutôt que chez l'appelant : deux écrans le demanderaient sinon, et l'un des
       * deux finirait par écrire sa propre phrase de repli — le troisième état que `lib/corpus/port`
       * refuse d'exister.
       */
      readonly texte: TexteCorpus;
    }
  | { readonly statut: "indisponible"; readonly raison: RaisonEnneagrammeIndisponible };

interface LigneType {
  type: number;
  origine: string;
}

function estOrigine(v: unknown): v is OrigineType {
  return v === "test" || v === "hypothese";
}

/** Le type retenu de l'utilisatrice courante, s'il y en a un. Aucune écriture. */
export async function lireEnneagramme(
  supabase: SupabaseClient,
  utilisatriceId: string,
): Promise<ResultatEnneagramme> {
  const { data, error } = await supabase
    .from("enneagramme")
    .select("type, origine")
    .eq("utilisatrice_id", utilisatriceId)
    .maybeSingle<LigneType>();

  if (error) return { statut: "indisponible", raison: "lecture_impossible" };
  if (!data) return { statut: "indisponible", raison: "sans_type" };
  // Une ligne hors domaine est un INCIDENT, pas une absence : dire « tu n'as pas encore de type » à
  // quelqu'un dont la ligne existe serait un mensonge, et lui proposer de refaire le test écraserait
  // ce qu'on n'a pas su lire.
  if (!estTypeEnneagramme(data.type) || !estOrigine(data.origine)) {
    return { statut: "indisponible", raison: "lecture_impossible" };
  }

  return {
    statut: "calcule",
    type: data.type,
    origine: data.origine,
    texte: texteDuTypeRetenu(data.type),
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La tentative en cours
// ══════════════════════════════════════════════════════════════════════════════════════════════

export interface TentativeEnCours {
  /**
   * L'identité de CETTE passe. Elle remonte jusqu'à la `key` du composant (D8/T8) : refaire le test
   * change l'identifiant, donc remonte l'arbre React, donc garantit qu'aucune réponse de la passe
   * précédente ne survit à l'écran. C'est le piège trouvé en 4.6, et la parade est structurelle.
   */
  readonly tentativeId: string;
  /** Les réponses déjà données, appariées NOMINALEMENT (D7) — jamais par index de position. */
  readonly reponses: readonly ReponseItem[];
}

export type ResultatTentative =
  | { readonly statut: "calcule"; readonly tentative: TentativeEnCours }
  | { readonly statut: "indisponible"; readonly raison: "aucune" | "lecture_impossible" };

interface LigneTentative {
  tentative_id: string;
  reponses: unknown;
}

/**
 * Les réponses relues en `ReponseItem[]`.
 *
 * Une entrée dont le niveau n'est pas 0..3 est ÉCARTÉE plutôt que corrigée : la ramener à 0 serait
 * répondre « pas du tout » à sa place, et `conclure` doit pouvoir dire « incomplet » en nommant
 * l'item. La contrainte `reponses_enneagramme_valides` (0049) rend le cas quasi impossible — le
 * « quasi » est le réimport `service_role`.
 */
export function reponsesDepuisJson(brut: unknown): readonly ReponseItem[] {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return [];
  return Object.entries(brut as Record<string, unknown>)
    .filter(([, niveau]) => estNiveauReponse(niveau))
    .map(([itemId, niveau]) => ({ itemId, niveau: niveau as ReponseItem["niveau"] }));
}

/** La tentative en cours, pour reprendre plus tard (NFR-017 — une fermeture d'onglet ne perd rien). */
export async function lireTentativeEnneagramme(
  supabase: SupabaseClient,
  utilisatriceId: string,
): Promise<ResultatTentative> {
  const { data, error } = await supabase
    .from("enneagramme_tentative")
    .select("tentative_id, reponses")
    .eq("utilisatrice_id", utilisatriceId)
    .maybeSingle<LigneTentative>();

  if (error) return { statut: "indisponible", raison: "lecture_impossible" };
  if (!data) return { statut: "indisponible", raison: "aucune" };
  return {
    statut: "calcule",
    tentative: { tentativeId: data.tentative_id, reponses: reponsesDepuisJson(data.reponses) },
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'hypothèse d'Anam
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Les deux faits dont `momentDeProposer` a besoin. LÈVE sur échec réel (patron `chargerCandidats` de
 * `retour-theme-pipeline`) : c'est l'appelant qui décide quoi faire du doute, et il décide de SE
 * TAIRE. Rendre `false, false` en cas de panne ferait reproposer une hypothèse à quelqu'un qui vient
 * de la refuser — exactement le message récurrent que FR-034 interdit.
 *
 * Deux requêtes `head` (aucune ligne rapatriée), en parallèle : on ne lit ni le type ni le numéro,
 * seulement leur EXISTENCE. C'est aussi de la minimisation — ce chemin tourne à chaque clôture de
 * séance, et il n'a aucun besoin de savoir de quel type il s'agit.
 */
export async function lireFaitsHypothese(
  supabase: SupabaseClient,
  utilisatriceId: string,
): Promise<FaitsHypothese> {
  const [type, hypotheses] = await Promise.all([
    supabase
      .from("enneagramme")
      .select("utilisatrice_id", { count: "exact", head: true })
      .eq("utilisatrice_id", utilisatriceId),
    supabase
      .from("enneagramme_hypothese")
      .select("id", { count: "exact", head: true })
      .eq("utilisatrice_id", utilisatriceId),
  ]);
  if (type.error) throw new Error(`enneagramme.faits: ${type.error.code ?? "echec"}`);
  if (hypotheses.error) throw new Error(`enneagramme.faits: ${hypotheses.error.code ?? "echec"}`);
  return {
    aUnType: (type.count ?? 0) > 0,
    // TOUS statuts confondus — y compris `refusee`. Voir `momentDeProposer` : Anam ne se ravise pas.
    aDejaEteProposee: (hypotheses.count ?? 0) > 0,
  };
}

export interface HypotheseEnAttente {
  readonly id: string;
  readonly type: TypeEnneagramme;
  /** `true` tant que la phrase n'a pas atteint un écran. Voir l'en-tête (leçon 0045). */
  readonly aDire: boolean;
}

export type ResultatHypothese =
  | { readonly statut: "calcule"; readonly hypothese: HypotheseEnAttente }
  | { readonly statut: "indisponible"; readonly raison: "aucune" | "lecture_impossible" };

interface LigneHypothese {
  id: string;
  type: number;
  dite_le: string | null;
}

/**
 * ── LE GERME DÛ À LA PAROLE (revue Epic 5, R4 · migration 0063) ────────────────────────────────
 *
 * ⚠️ CHEMIN SÉPARÉ, ET C'EST TOUT L'OBJET DU CORRECTIF. `lireHypotheseEnneagramme` sert DEUX
 * appelants qui n'ont pas la même règle : `/enneagramme`, qu'elle ouvre elle-même pour y lire son
 * résultat, et `chargerOuverture`, où c'est ANAM QUI PARLE. La seconde doit se taire pendant un
 * épisode de détresse et dans les 72 h qui suivent (FR-042, AD-17) ; la première, jamais — lui
 * fermer ses propres données en crise serait un refus d'accès (art. 15).
 *
 * La règle ne vit PAS ici : elle vit dans `charger_hypothese_a_dire()` (0063), qui cite
 * `branche_bloquee_par_detresse()` — la même source unique que `charger_proposition_branche`, dont
 * le germe a exactement la même forme. La recopier en TypeScript fabriquerait la divergence que la
 * revue Epic 6 a payée sur `fait_extrait.statut` : deux lectures d'une règle, qui finissent par ne
 * plus dire la même chose.
 *
 * `aDire` est vrai par construction : la RPC ne rend que des germes dont `dite_le is null`.
 */
export async function chargerHypotheseADire(supabase: SupabaseClient): Promise<ResultatHypothese> {
  const { data, error } = await supabase
    .rpc("charger_hypothese_a_dire")
    .maybeSingle<{ id: string; type: number }>();

  if (error) return { statut: "indisponible", raison: "lecture_impossible" };
  if (!data) return { statut: "indisponible", raison: "aucune" };
  if (!estTypeEnneagramme(data.type)) return { statut: "indisponible", raison: "lecture_impossible" };

  return { statut: "calcule", hypothese: { id: data.id, type: data.type, aDire: true } };
}

/**
 * L'hypothèse en attente, s'il y en a une.
 *
 * `seulementADire` — `true` pour la conversation (ne redis pas ce qui a été dit), `false` pour la
 * halte (elle peut encore répondre). La distinction est expliquée en tête de fichier.
 *
 * LECTURE SEULE, sans le moindre effet de bord : ce fichier est appelé depuis un rendu serveur, qui
 * se ré-exécute à chaque rafraîchissement. Poser `dite_le` ici dépenserait la parole sans qu'elle
 * atteigne jamais un écran — la faute payée deux fois (revue 4.10, puis 0045).
 */
export async function lireHypotheseEnneagramme(
  supabase: SupabaseClient,
  utilisatriceId: string,
  { seulementADire = false }: { seulementADire?: boolean } = {},
): Promise<ResultatHypothese> {
  let requete = supabase
    .from("enneagramme_hypothese")
    .select("id, type, dite_le")
    .eq("utilisatrice_id", utilisatriceId)
    .eq("statut", "en_attente");
  if (seulementADire) requete = requete.is("dite_le", null);

  // La plus ANCIENNE d'abord : l'index partiel de 0049 est ordonné ainsi, et un `limit` sans `order`
  // rendrait une ligne arbitraire — donc une hypothèse différente d'un chargement à l'autre.
  const { data, error } = await requete
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle<LigneHypothese>();

  if (error) return { statut: "indisponible", raison: "lecture_impossible" };
  if (!data) return { statut: "indisponible", raison: "aucune" };
  if (!estTypeEnneagramme(data.type)) return { statut: "indisponible", raison: "lecture_impossible" };

  return {
    statut: "calcule",
    hypothese: { id: data.id, type: data.type, aDire: data.dite_le === null },
  };
}
