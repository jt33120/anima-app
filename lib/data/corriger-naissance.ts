import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import type { EphemerisPort } from "@/lib/astro/port";
import { calculerThemeNatal, type EntreesNaissance } from "@/lib/astro/theme-natal";
import { comparerThemes, type ApercuCorrection } from "@/lib/domain/correction-naissance";

/**
 * corriger-naissance.ts — LIRE, APERCEVOIR, CORRIGER (Story 6.5b, art. 16).
 *
 * ── SOUS LE JWT, JAMAIS `service_role` (AD-12) ─────────────────────────────────────────────────
 *
 * Ce sont ses entrées à elle, et ce qui garantit qu'on n'écrit que les siennes est la policy de
 * `utilisatrice` (0002) plus les grants colonne par colonne de 0041 — pas un `where` écrit ici,
 * qu'un refactor pourrait perdre.
 *
 * ── L'APERÇU NE PASSE PAR AUCUNE ÉCRITURE, ET C'EST TOUT SON INTÉRÊT ───────────────────────────
 *
 * `calculerThemeNatal` est PUR (AD-6) : on peut calculer le thème que produirait une heure sans
 * rien graver, sans incrémenter aucune version, sans toucher au thème en place. C'est ce qui permet
 * de MONTRER avant d'écrire — et donc de se passer d'un plafond de corrections (0060).
 *
 * ⚠️ Coût assumé : un aperçu appelle l'éphéméride DEUX fois (le thème d'avant, celui d'après). C'est
 * le seul endroit du produit qui la sollicite sur un geste interactif. Il est borné par la nature du
 * geste — on ne corrige pas son heure de naissance en boucle — et il n'écrit rien, donc il ne peut
 * pas laisser d'état à moitié fait derrière lui.
 *
 * ── AUCUN RECALCUL ÉCRIT ICI (décision D5 de la 5.3, tenue) ────────────────────────────────────
 *
 * On écrit l'heure, rien d'autre. `lireThemeNatal` regrave tout seul à la lecture suivante parce
 * que l'empreinte aura changé. Câbler la regravure ici rouvrirait les trois pièges que la 5.3 a
 * fermés — dont celui qui compte : une panne en cours de regravure laisserait l'heure écrite et le
 * thème périmé, sans rien pour réessayer.
 *
 * ── NFR-022 ───────────────────────────────────────────────────────────────────────────────────
 *
 * Ni l'heure, ni la date de naissance, ni les coordonnées ne sortent dans un message d'erreur ou un
 * log. On ne rend que des verdicts d'un ensemble fermé.
 */

/** Ce que l'écran a besoin de savoir avant de proposer quoi que ce soit. */
export interface EtatNaissance {
  /** `HH:MM:SS` déjà enregistrée, ou `null` — il n'y a alors rien à corriger. */
  readonly heure: string | null;
  /** Date de la dernière correction, ou `null`. Le NOMBRE n'est jamais lu : voir `copie-naissance`. */
  readonly corrigeeLe: Date | null;
}

interface LigneNaissance {
  date_naissance: string | null;
  heure_naissance: string | null;
  lieu_fuseau: string | null;
  lieu_latitude: number | null;
  lieu_longitude: number | null;
  naissance_corrigee_le: string | null;
}

const CHAMPS =
  "date_naissance, heure_naissance, lieu_fuseau, lieu_latitude, lieu_longitude, naissance_corrigee_le";

async function ligneDe(
  supabase: SupabaseClient,
  utilisatriceId: string,
): Promise<LigneNaissance | null> {
  const { data, error } = await supabase
    .from("utilisatrice")
    .select(CHAMPS)
    .eq("id", utilisatriceId)
    .maybeSingle<LigneNaissance>();
  return error ? null : (data ?? null);
}

export async function lireNaissance(
  supabase: SupabaseClient,
  utilisatriceId: string,
): Promise<EtatNaissance | null> {
  const ligne = await ligneDe(supabase, utilisatriceId);
  if (!ligne) return null;
  return {
    heure: ligne.heure_naissance,
    corrigeeLe: ligne.naissance_corrigee_le ? new Date(ligne.naissance_corrigee_le) : null,
  };
}

/**
 * Ce que la nouvelle heure changerait — calculé, jamais écrit.
 *
 * Rend `null` quand la comparaison n'a pas de sens : pas de date de naissance (le thème n'existe
 * pas), ou aucune heure déjà gravée (il n'y a alors rien à corriger, il y a à ajouter — c'est le
 * parcours de la 5.3, et l'écran y renvoie).
 */
export async function apercuDeCorrection(
  supabase: SupabaseClient,
  utilisatriceId: string,
  nouvelleHeure: string,
  ephemeride: EphemerisPort = ephemerideAstronomyEngine(),
): Promise<ApercuCorrection | null> {
  const ligne = await ligneDe(supabase, utilisatriceId);
  if (!ligne?.date_naissance || ligne.heure_naissance === null) return null;

  const commun = {
    date: ligne.date_naissance,
    fuseau: ligne.lieu_fuseau,
    latitude: ligne.lieu_latitude,
    longitude: ligne.lieu_longitude,
  };
  const avant: EntreesNaissance = { ...commun, heure: ligne.heure_naissance };
  const apres: EntreesNaissance = { ...commun, heure: nouvelleHeure };

  return comparerThemes(
    calculerThemeNatal(avant, ephemeride),
    calculerThemeNatal(apres, ephemeride),
  );
}

/**
 * Le verdict d'une écriture. Ensemble FERMÉ : l'écran en dérive ses messages, et aucun code
 * Postgres ne remonte jusqu'à lui.
 */
export type IssueCorrection = "corrigee" | "consentement_absent" | "refusee";

export async function ecrireHeureCorrigee(
  supabase: SupabaseClient,
  utilisatriceId: string,
  heure: string,
): Promise<IssueCorrection> {
  const { error } = await supabase
    .from("utilisatrice")
    .update({ heure_naissance: heure })
    .eq("id", utilisatriceId);
  if (!error) return "corrigee";
  // `42501` est le code que `naissance_corrigible` (0060) lève quand le consentement art. 9 n'est
  // plus valide ou que la barrière de minorité est posée. On distingue ce refus d'une panne : dire
  // « réessaie » à quelqu'un qui a révoqué le ferait réessayer pour rien, indéfiniment.
  return error.code === "42501" ? "consentement_absent" : "refusee";
}
