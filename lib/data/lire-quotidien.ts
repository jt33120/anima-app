import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import type { EphemerisPort } from "@/lib/astro/port";
import { instantDepuisLocal } from "@/lib/astro/theme-natal";
import {
  assemblerHoroscope,
  cielDuJour,
  type CielDuJour,
  type HoroscopeDuJour,
  type JourCivil,
  type JourResolu,
} from "@/lib/astro/quotidien";
import { mantraDuJour } from "@/lib/corpus/mantra";
import type { TexteCorpus } from "@/lib/corpus/port";
import { FUSEAU } from "@/lib/domain/ordonnanceur";
import { lireThemeNatal, type RaisonIndisponible } from "@/lib/data/depot-theme-natal";

/**
 * lire-quotidien.ts — LE SOCLE QUOTIDIEN DE L'UTILISATRICE COURANTE (Story 5.4, T7).
 *
 * ── AUCUN STOCKAGE, AUCUNE MIGRATION — ET C'EST LE MÊME RAISONNEMENT QU'EN 5.2 ─────────────────
 *
 * Le réflexe, pour « servi sans attente depuis le cache » (AC1), est une table `horoscope_jour`.
 * Trois raisons de ne pas la créer, et la troisième suffirait :
 *
 *   1. ce serait une ligne art. 9 DÉRIVÉE par utilisatrice ET PAR JOUR — 365 par an et par compte,
 *      à conserver (NFR-021), à exporter et à effacer (FR-067), pour zéro information nouvelle ;
 *   2. le calcul personnel est de l'arithmétique sur des longitudes : quelques dizaines de
 *      microsecondes. Il n'y a rien à économiser de ce côté ;
 *   3. **la source bouge.** La 5.3 recalcule le thème natal le jour où l'heure de naissance arrive.
 *      Un horoscope mis en cache avant ce recalcul resterait juste-en-apparence pour toujours —
 *      exactement le mode d'échec qu'un cache à invalider produit quand personne ne le regarde.
 *
 * Ce qui EST mémoïsé, c'est le **ciel du jour** : il ne dépend d'aucune donnée personnelle, il est
 * le même pour tout le monde, et il est immuable une fois le jour fixé (décision D7).
 *
 * ── LE JOUR CIVIL EST CELUI D'EUROPE/PARIS (décision D3) ───────────────────────────────────────
 *
 * « Bascule à minuit local » — local de qui ? Il n'existe aucune colonne de fuseau de RÉSIDENCE ; le
 * seul fuseau stocké est celui du LIEU DE NAISSANCE (5.3), qui n'a rien à voir avec l'endroit où
 * elle vit. Trois sources internes convergent déjà sur Paris : `FUSEAU` (ordonnanceur),
 * `jourCivilParis` (branche) et l'année de référence de `lire-numerologie`. On suit.
 *
 * Résidu assumé : une utilisatrice en Guadeloupe voit le jour basculer à 20 h locales.
 *
 * ── SOUS LE JWT DE L'UTILISATRICE ──────────────────────────────────────────────────────────────
 *
 * Aucune écriture propre à ce fichier. `lireThemeNatal` peut, lui, écrire (premier calcul ou
 * recalcul, 5.3) — il est appelé UNE SEULE FOIS par lecture (piège P10), jamais en boucle.
 * Jamais `service_role` (AD-12). Aucune donnée personnelle dans une erreur ou un log (NFR-022).
 *
 * ⚠️ Ce fichier est balayé par `tests/socle-jamais-coupe.test.ts` : l'horoscope et le mantra sont
 * gratuits à vie (FR-055), et le registre commercial n'a rien à faire ici — commentaires compris.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le jour civil parisien
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Le jour civil d'un instant, à Paris. Patron `jourCivilParis` de `lib/domain/branche.ts`.
 *
 * Passe par `Intl` plutôt que par une soustraction d'heures : le décalage de Paris n'est pas une
 * constante (+1 en hiver, +2 en été), et une soustraction faite à la main se trompe deux jours par
 * an — les deux jours où personne ne teste.
 */
export function jourCivilParis(maintenant: Date): JourCivil {
  const parties = new Intl.DateTimeFormat("fr-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(maintenant);
  const lire = (type: string) => {
    const p = parties.find((x) => x.type === type);
    if (!p) throw new Error(`lire-quotidien : ${type} introuvable`);
    return Number(p.value);
  };
  return { a: lire("year"), m: lire("month"), j: lire("day") };
}

/**
 * Le jour civil parisien RÉSOLU en instants UTC.
 *
 * ⚠️ PIÈGE P5 — les trois instants sont résolus INDÉPENDAMMENT par le fuseau. Bâtir midi comme
 * « minuit + 12 h » ou la borne haute comme « minuit + 24 h » est faux les deux jours de changement
 * d'heure (la journée locale dure 23 h ou 25 h) et invisible les 363 autres.
 *
 * L'instant de RÉFÉRENCE est MIDI (décision D2) : c'est la convention du « thème de midi » de la
 * 5.1, et pour la même raison — la Lune parcourt ~13,2° par jour, midi divise par deux l'écart
 * maximal à n'importe quel moment de la journée.
 */
export function jourResoluParis(maintenant: Date): JourResolu {
  const jour = jourCivilParis(maintenant);
  const { a, m, j } = jour;
  return {
    jour,
    fenetre: {
      min: instantDepuisLocal(Date.UTC(a, m - 1, j, 0, 0, 0), FUSEAU),
      // `Date.UTC(a, m-1, j+1)` gère le débordement de mois et d'année tout seul.
      max: instantDepuisLocal(Date.UTC(a, m - 1, j + 1, 0, 0, 0), FUSEAU),
    },
    reference: instantDepuisLocal(Date.UTC(a, m - 1, j, 12, 0, 0), FUSEAU),
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La mémoïsation du ciel — le « cache » de l'AC1
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Deux entrées : hier et aujourd'hui.
 *
 * ⚠️ PIÈGE P6 — un `Map` non borné dans un processus long est une fuite mémoire, et en serverless
 * personne ne la verrait avant la production. Deux entrées couvrent le seul cas réel de
 * cohabitation : les quelques secondes autour de minuit où deux requêtes tombent de part et
 * d'autre de la bascule.
 */
const MEMO_TAILLE_MAX = 2;
const memoCiel = new Map<string, CielDuJour>();

/**
 * La clé inclut l'IDENTIFIANT DE L'ADAPTATEUR, et ce n'est pas décoratif : le jour où une source
 * d'éphéméride change (Chiron, porte pré-lancement), un ciel mémoïsé sous l'ancienne source serait
 * servi pour l'ancienne. Même raisonnement que l'empreinte d'entrées de `theme_natal` (0039).
 */
function cielMemoise(jour: JourResolu, ephemeride: EphemerisPort): CielDuJour {
  const cle = `${jour.jour.a}-${jour.jour.m}-${jour.jour.j}|${ephemeride.identifiant}`;
  const dejaLa = memoCiel.get(cle);
  if (dejaLa) return dejaLa;

  const calcule = cielDuJour(jour, ephemeride);
  memoCiel.set(cle, calcule);
  // Un `Map` conserve l'ordre d'insertion : la première clé est la plus ancienne.
  while (memoCiel.size > MEMO_TAILLE_MAX) {
    const plusAncienne = memoCiel.keys().next().value;
    if (plusAncienne === undefined) break;
    memoCiel.delete(plusAncienne);
  }
  return calcule;
}

/** Vide la mémoïsation. Réservé aux tests — la production n'en a jamais besoin. */
export function viderMemoCiel(): void {
  memoCiel.clear();
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le socle quotidien
// ══════════════════════════════════════════════════════════════════════════════════════════════

export type ResultatHoroscope =
  | { readonly statut: "calcule"; readonly horoscope: HoroscopeDuJour }
  | { readonly statut: "indisponible"; readonly raison: RaisonIndisponible };

export interface SocleQuotidien {
  readonly jour: JourCivil;
  /**
   * TOUJOURS SERVI (AC6). Le mantra ne dépend d'aucune donnée de naissance : une utilisatrice qui
   * n'a pas encore donné sa date, ou dont la lecture échoue, a quand même son texte du jour. C'est
   * le seul morceau du socle qui ne demande rien à personne.
   */
  readonly mantra: TexteCorpus;
  readonly horoscope: ResultatHoroscope;
}

/**
 * LE SOCLE QUOTIDIEN.
 *
 * `maintenant` est injecté — la seule horloge du chemin vit chez l'appelant, jamais enfouie ici
 * (patron `lireNumerologie`). C'est ce qui rend le déterminisme testable de bout en bout.
 *
 * `ephemeride` est composé ICI, une seule fois, et **partagé** avec `lireThemeNatal` : deux
 * instances donneraient deux identifiants identiques mais deux objets distincts, sans conséquence
 * aujourd'hui — et l'unique composition rend la lecture du chemin plus simple à vérifier.
 */
export async function lireSocleQuotidien(
  supabase: SupabaseClient,
  utilisatriceId: string,
  maintenant: Date,
  ephemeride: EphemerisPort = ephemerideAstronomyEngine(),
): Promise<SocleQuotidien> {
  const jour = jourResoluParis(maintenant);
  const mantra = mantraDuJour(jour.jour);

  // UN SEUL appel (P10) : `lireThemeNatal` fait deux requêtes et peut ÉCRIRE (premier calcul ou
  // recalcul après ajout de l'heure, 5.3).
  const theme = await lireThemeNatal(supabase, utilisatriceId, ephemeride);
  if (theme.statut !== "calcule") {
    return { jour: jour.jour, mantra, horoscope: { statut: "indisponible", raison: theme.raison } };
  }

  return {
    jour: jour.jour,
    mantra,
    horoscope: {
      statut: "calcule",
      horoscope: assemblerHoroscope(theme.theme, jour.jour, cielMemoise(jour, ephemeride)),
    },
  };
}
