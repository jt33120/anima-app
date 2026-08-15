import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import type { EphemerisPort } from "@/lib/astro/port";
import {
  assemblerBibliotheque,
  cartesDisponibles,
  type Bibliotheque,
  type CarteBibliotheque,
} from "@/lib/domain/bibliotheque";
import {
  carteEnneagramme,
  carteHoroscope,
  carteMantra,
  carteNombres,
  carteTheme,
} from "@/lib/domain/cartes-socle";
import { carteAnam, type CarteAnam } from "@/lib/domain/carte-anam";
import { creerDepotMotifsAnam } from "@/lib/data/depot-motifs-anam";
import { lireEnneagramme } from "@/lib/data/lire-enneagramme";
import { lireNumerologie } from "@/lib/data/lire-numerologie";
import { lireSocleQuotidien, jourCivilParis } from "@/lib/data/lire-quotidien";
import type { ResultatThemeNatal } from "@/lib/data/depot-theme-natal";
import { NON_ECRIT } from "@/lib/corpus/port";

/**
 * lire-bibliotheque.ts — LA BIBLIOTHÈQUE DE L'ACCUEIL (Story 5.6, T4).
 *
 * Le seul endroit du produit où les cinq lectures du socle se retrouvent. Aucune migration, aucune
 * table : tout est déjà calculé ou déjà stocké ailleurs — la bibliothèque est une VUE, pas une donnée.
 *
 * ── UN SEUL APPEL À `lireThemeNatal`, ET CE N'EST PAS UNE OPTIMISATION ─────────────────────────
 *
 * Deux cartes ont besoin du thème natal : l'horoscope (qui aspecte le ciel du jour sur les positions
 * natales) et le thème lui-même. Or `lireThemeNatal` fait deux requêtes et peut **ÉCRIRE** — premier
 * calcul d'un compte, ou recalcul après l'ajout de l'heure (5.3). Dans le cas dégradé, ce calcul
 * coûte une fenêtre de 50 h échantillonnée à l'heure, soit ~663 lectures d'éphéméride.
 *
 * L'appeler deux fois paierait donc ce coût deux fois ET tenterait l'écriture deux fois. C'est le
 * piège P10, et il ne se voit pas à l'exécution : les deux appels rendraient le même thème.
 *
 * ⚠️ ET LE PIÈGE ÉTAIT PLUS GRAND QUE CE MODULE. `chargerProjectionArbre` lit lui aussi le thème
 * (drapeau de tronc incomplet, 5.3) et vit dans le MÊME `Promise.all` que cette lecture, dans
 * `app/page.tsx`. Avant cette story, un seul chemin le lisait ; depuis qu'il y en a deux, le premier
 * chargement d'un compte lançait **deux calculs concurrents** et **deux écritures en course**, dont
 * aucune ne voyait l'autre. La page lit donc le thème UNE FOIS et le passe aux deux (`themeDejaLu`).
 *
 * La parade est structurelle plutôt que disciplinaire : le paramètre traverse toute la chaîne
 * (`lireBibliotheque` → `lireSocleQuotidien`), et `tests/bibliotheque-lecture.test.ts` compte les
 * appels réellement faits.
 *
 * ── CHAQUE LECTURE PORTE SON PROPRE `try` ──────────────────────────────────────────────────────
 *
 * Leçon payée en 5.4 (revue B4) : un chemin fragile placé en amont d'un chemin robuste emporte le
 * second. Une lenteur de Supabase sur la numérologie ne doit pas faire disparaître le mantra, et
 * une panne d'ennéagramme ne doit pas vider l'accueil. Trois lectures, trois `try`, et l'échec de
 * l'une rend une carte vide plutôt que rien.
 *
 * ── SOUS LE JWT, JAMAIS `service_role` (AD-12) ─────────────────────────────────────────────────
 *
 * Le client est celui de l'utilisatrice. Aucune donnée personnelle dans un log (NFR-022) : on ne
 * journalise que le nom de l'erreur.
 *
 * ── FR-055 : POURQUOI CE FICHIER N'EST PAS DANS LE BALAYAGE LEXICAL « ZÉRO PREMIUM » ───────────
 *
 * `tests/socle-jamais-coupe.test.ts` refuse le mot « premium » dans les fichiers qui SERVENT le
 * socle gratuit (`lire-quotidien.ts`, `lib/corpus/mantra.ts`…). Ce fichier-ci ne peut pas entrer
 * dans cette liste : il porte `aPremium`, et il le porte légitimement — la bibliothèque est le
 * CONTENANT, et elle accueillera des cartes payantes en 5.8 et 5.9.
 *
 * L'écrire ainsi serait une échappatoire commode si on s'arrêtait là. La garde équivalente est donc
 * COMPORTEMENTALE et vit dans le même fichier de test : les cinq cartes du socle survivent à
 * `cartesDisponibles(..., aPremium = false)`. Elle est plus forte que le balayage lexical, parce
 * qu'elle interdit le RÉSULTAT (une carte du socle qui disparaît) plutôt qu'un mot.
 *
 * ⚠️ Ce qui reste interdit ici, et qu'aucun test ne peut deviner à ma place : un `if (aPremium)`
 * qui déciderait du CONTENU d'une carte du socle plutôt que de sa présence au catalogue.
 */

export interface ResultatBibliotheque extends Bibliotheque {
  /** Le jour civil parisien qui a servi à la mise en avant — porté jusqu'à la carte (report 5.4). */
  readonly jour: { readonly a: number; readonly m: number; readonly j: number };
  /**
   * Story 6.3 (D9) — LA CARTE « ANAM ». Elle vit ICI et non sur `Bibliotheque`, pour deux raisons qui
   * se rejoignent : le domaine pur ne sait pas la produire (elle demande une lecture), et l'ajouter en
   * champ requis casserait `assemblerBibliotheque`, qui rend deux littéraux sans elle.
   *
   * ⚠️ ELLE N'ENTRE PAS DANS `CATALOGUE_CARTES` (D8). Ce n'est pas une carte du socle : elle n'a ni
   * fait calculé ni texte d'Anima, et le repli « Anima n'a pas encore écrit cette carte » n'a aucun
   * sens pour elle. En revanche elle COMPTE dans la borne UX-DR-30, qui porte sur les objets RENDUS —
   * cinq cartes de catalogue plus celle-ci font six, soit exactement le plafond.
   */
  readonly anam: CarteAnam;
}

/**
 * LA BIBLIOTHÈQUE DE L'UTILISATRICE COURANTE.
 *
 * `maintenant` est injecté : la seule horloge du chemin vit chez l'appelant (patron `lireNumerologie`
 * et `lireSocleQuotidien`). C'est ce qui rend la mise en avant du jour testable de bout en bout.
 *
 * `aPremium` ne sert QU'À RETIRER des cartes que ce compte n'a pas — jamais à en verrouiller une.
 * En v1 aucune carte de la bibliothèque n'est premium (les deux formats payants, la lecture et
 * l'ancrage, arrivent en 5.8 et 5.9) : le paramètre est donc sans effet aujourd'hui, et c'est
 * volontaire — câbler la mécanique maintenant évite qu'elle se câble dans l'urgence plus tard,
 * avec la carte cadenassée qui revient par la porte de derrière.
 */
export async function lireBibliotheque(
  supabase: SupabaseClient,
  utilisatriceId: string,
  maintenant: Date,
  aPremium: boolean,
  ephemeride: EphemerisPort = ephemerideAstronomyEngine(),
  themeDejaLu?: ResultatThemeNatal,
): Promise<ResultatBibliotheque> {
  const cartes: CarteBibliotheque[] = [];

  // ── La carte « Anam » : LANCÉE ICI, ATTENDUE À LA FIN (Story 6.3, AC6) ────────────────────────
  //
  // Elle n'a besoin d'aucune des trois lectures ci-dessous, donc la faire attendre son tour coûterait
  // un aller-retour de plus sur le chemin critique de l'accueil, pour rien. Le `catch` est attaché
  // ICI, à la création — attaché plus bas, une RPC qui échoue avant le premier `await` produirait un
  // rejet non traité.
  //
  // REPLI VERS MOINS D'EFFET (AD-15) : carte NEUTRE, jamais une ligne fabriquée. Se taire à tort coûte
  // un rappel différé ; parler à tort met sur son accueil une phrase qui ne correspond à rien.
  //
  // ⚠️ CE `catch` NE PEUT PAS MASQUER LA GARDE AD-17. La fenêtre de détresse est portée par le SQL :
  // en épisode, la fonction rend zéro ligne — donc la carte est neutre par le CHEMIN NORMAL, pas par
  // le chemin d'erreur. C'est ce qui permet de le prouver contre le vrai Postgres plutôt que de faire
  // confiance à un `catch`.
  const motifsEnVol = creerDepotMotifsAnam(supabase)
    .motifs()
    .catch((e) => {
      journaliser("motifs anam", e);
      return [];
    });

  // ── Le quotidien : mantra + horoscope + LE THÈME, en un seul appel ───────────────────────────
  // `lireSocleQuotidien` porte déjà son propre `try` interne (le mantra survit à une panne
  // d'horoscope, 5.4/B4). Celui-ci couvre ce que le sien ne couvre pas : une panne du client lui-même.
  let jour = jourCivilParis(maintenant);
  try {
    const socle = await lireSocleQuotidien(supabase, utilisatriceId, maintenant, ephemeride, themeDejaLu);
    jour = socle.jour;
    // ⚠️ L'APLATISSEMENT DES UNIONS SE FAIT ICI, ET NULLE PART AILLEURS. `lib/domain` n'a pas le
    // droit de connaître les formes de `lib/data` (AD-10, appliqué par ESLint) — et c'est juste :
    // « naissance absente » et « lecture impossible » sont des états d'I/O, pas des états du socle.
    // Le domaine ne reçoit donc qu'une chose : le thème, ou rien.
    cartes.push(carteMantra(socle.mantra));
    cartes.push(carteHoroscope(socle.horoscope.statut === "calcule" ? socle.horoscope.horoscope : null));
    cartes.push(carteTheme(socle.theme.statut === "calcule" ? socle.theme.theme : null));
  } catch (e) {
    journaliser("socle quotidien", e);
    cartes.push(carteMantra(NON_ECRIT));
    cartes.push(carteHoroscope(null));
    cartes.push(carteTheme(null));
  }

  // ── Les nombres ──────────────────────────────────────────────────────────────────────────────
  try {
    const n = await lireNumerologie(supabase, utilisatriceId, maintenant);
    cartes.push(carteNombres(n.statut === "calcule" ? n.numerologie : null));
  } catch (e) {
    journaliser("numerologie", e);
    cartes.push(carteNombres(null));
  }

  // ── L'ennéagramme ────────────────────────────────────────────────────────────────────────────
  try {
    const e9 = await lireEnneagramme(supabase, utilisatriceId);
    // Le texte est attaché au résultat par la 5.5 elle-même — deux écrans le demanderaient sinon,
    // et l'un des deux finirait par écrire son propre repli.
    cartes.push(
      e9.statut === "calcule" ? carteEnneagramme(e9.type, e9.texte) : carteEnneagramme(null, NON_ECRIT),
    );
  } catch (e) {
    journaliser("enneagramme", e);
    cartes.push(carteEnneagramme(null, NON_ECRIT));
  }

  // ── La carte « Anam » (Story 6.3, AC6) ───────────────────────────────────────────────────────
  //
  // Son propre `try`, comme les trois autres lectures : une panne de la RPC des motifs ne doit pas
  // faire disparaître le socle. Et le repli va vers MOINS d'effet (AD-15) — carte NEUTRE, jamais une
  // ligne fabriquée. Se taire à tort coûte un rappel différé ; parler à tort met sur son accueil une
  // phrase qui ne correspond à rien.
  //
  // ⚠️ CE `catch` NE PEUT PAS MASQUER LA GARDE AD-17. La fenêtre de détresse est portée par le SQL :
  // en épisode, la fonction rend zéro ligne — donc la carte est neutre par le CHEMIN NORMAL, pas par
  // le chemin d'erreur. C'est ce qui permet à `tests/motifs-anam-sql.test.ts` de le prouver contre le
  // vrai Postgres plutôt que de faire confiance à un `catch`.
  return {
    ...assemblerBibliotheque(cartesDisponibles(cartes, aPremium), jour),
    jour,
    anam: carteAnam(await motifsEnVol),
  };
}

/** Le nom de l'erreur, rien d'autre : ni identifiant, ni date, ni nombre (NFR-022). */
function journaliser(quoi: string, e: unknown): void {
  console.error(`[bibliotheque] ${quoi} indisponible — les autres cartes sont servies`, {
    nom: e instanceof Error ? e.name : "inconnu",
  });
}
