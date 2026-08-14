import { indiceDuJour, type JourCivil } from "@/lib/astro/quotidien";
import type { TexteCorpus } from "@/lib/corpus/port";
import { terme, type CleTerme } from "./vocabulaire";

/**
 * bibliotheque.ts — LE MODÈLE DE L'ACCUEIL (Story 5.6, T3). Pur (AD-1) : zéro I/O, zéro Supabase,
 * zéro `server-only`. Il décide de l'ORDRE et de la MISE EN AVANT ; il ne lit rien et n'écrit rien.
 *
 * ── LA GARDE FR-031 EST LE TYPE, PAS UN TEST DE RENDU ──────────────────────────────────────────
 *
 * UX-DR-30 : « aucun badge, aucun compteur, aucun cadenas ». La façon naturelle de tester ça serait
 * de balayer le DOM à la recherche d'un chiffre — et c'est **impossible ici** : la carte des nombres
 * affiche des nombres, celle de l'ennéagramme affiche un type, celle du thème affiche des degrés
 * quand l'heure est connue. Un test lexical serait donc soit vide, soit faux.
 *
 * La 4.10 a déjà payé cette leçon sur l'arbitrage (`tests/arbitrage-frontiere.test.ts`) : « la façon
 * naturelle de faire fuir un compte est de l'ajouter au type qui traverse la frontière, donc c'est
 * le type qui garde. » Ici, `CarteBibliotheque` n'a **aucun champ** capable de porter une mesure —
 * pas de `badge`, pas de `compte`, pas de `total`, pas de `nouveau`, pas de `verrouille`. Il n'y a
 * nulle part où l'écrire, donc rien à masquer au rendu.
 *
 * ── ET AUCUNE CARTE INDISPONIBLE N'EST CONSTRUITE ──────────────────────────────────────────────
 *
 * Le corollaire du même choix : `cartesDisponibles` **retire** ce que le compte n'a pas, au lieu de
 * le construire puis de le verrouiller. C'est la traduction littérale du refus de conception
 * d'`EXPERIENCE.md` §511 — « teaser en permanence ce qu'on ne peut pas avoir contredit FR-057 ».
 * La disponibilité est DÉRIVÉE du glossaire (`vocabulaire.ts`) : une carte dont le terme est premium
 * est premium, sans drapeau à tenir à jour en double.
 */

/** Les cartes du socle. Une sixième se déclare ICI, jamais dans un composant. */
export type CleCarte = "mantra" | "horoscope" | "theme" | "nombres" | "enneagramme";

/**
 * Une ligne de fait CALCULÉ, déjà mise en mots par le domaine — le rendu ne formate rien (AD-7).
 * `valeur` est du texte parce que « Balance » et « 7 » se présentent pareil : le rendu n'a pas à
 * savoir lequel est un nombre.
 */
export interface LigneFait {
  readonly intitule: string;
  readonly valeur: string;
}

export interface CarteBibliotheque {
  readonly cle: CleCarte;
  /** Le titre affiché. Source unique — sous `lib/`, donc balayé par le contrôle de voix (2.8). */
  readonly titre: string;
  /**
   * Le terme du glossaire quand la carte en porte un (FR-080), `null` sinon. C'est lui qui décide
   * de la disponibilité : pas de drapeau `premium` recopié ici, qui pourrait diverger.
   */
  readonly terme: CleTerme | null;
  /** Ce que le SOCLE a calculé. Vide = il n'y a rien de calculé à montrer (le mantra, par nature). */
  readonly faits: readonly LigneFait[];
  /** Ce qu'ANIMA a écrit — ou n'a pas encore écrit. L'union force à traiter le second cas (FR-054). */
  readonly texte: TexteCorpus;
}

/**
 * L'ORDRE FIXE (AC1). Une constante, dans l'ordre d'`EXPERIENCE.md` §66 — aucun tri ne s'applique
 * entre ici et le rendu, hors la mise en tête de la carte du jour.
 *
 * ⚠️ UX-DR-30 pose un plancher de 4 et un plafond de 6. `assertCatalogueBorne` le vérifie au
 * chargement du module plutôt qu'en test : une sixième carte ajoutée par la 5.8 ou la 5.9 ne peut
 * pas franchir le plafond en silence.
 */
export const CATALOGUE_CARTES: readonly CleCarte[] = Object.freeze([
  "mantra",
  "horoscope",
  "theme",
  "nombres",
  "enneagramme",
]);

if (CATALOGUE_CARTES.length < 4 || CATALOGUE_CARTES.length > 6) {
  throw new Error(
    `bibliotheque : ${CATALOGUE_CARTES.length} cartes au catalogue — UX-DR-30 en exige 4 à 6`,
  );
}

const RANG = new Map(CATALOGUE_CARTES.map((c, i) => [c, i]));

/** Remet les cartes dans l'ordre du catalogue, quel que soit l'ordre d'arrivée. */
function ordreCatalogue(cartes: readonly CarteBibliotheque[]): readonly CarteBibliotheque[] {
  return [...cartes].sort((a, b) => (RANG.get(a.cle) ?? 99) - (RANG.get(b.cle) ?? 99));
}

/**
 * La carte a-t-elle quelque chose à montrer aujourd'hui ?
 *
 * Un fait calculé suffit : « Soleil en Balance » se tient tout seul, même sans le texte d'Anima.
 * Une carte sans fait ET sans texte — le mantra du jour tant que les 60 créneaux sont vides — n'a
 * rien. Elle reste AFFICHÉE (elle dit honnêtement ce qui manque, AC5), mais elle ne peut pas être
 * la carte mise en avant : ouvrir l'accueil sur une carte muette en tête serait absurde.
 */
export function estPresentable(carte: CarteBibliotheque): boolean {
  return carte.faits.length > 0 || carte.texte.statut === "ecrit";
}

/** Ce que ce compte peut avoir. Le premium est DÉRIVÉ du glossaire, jamais recopié (AC2/AC8). */
export function cartesDisponibles(
  cartes: readonly CarteBibliotheque[],
  aPremium: boolean,
): readonly CarteBibliotheque[] {
  if (aPremium) return cartes;
  return cartes.filter((c) => c.terme === null || !terme(c.terme).premium);
}

/**
 * LA CLÉ DE LA CARTE DU JOUR — exportée séparément, et c'est une décision de testabilité autant que
 * de conception.
 *
 * Même piège qu'en 5.4 pour `cleMantraDuJour` : **tant qu'aucun texte n'est écrit, deux cartes vides
 * sont indiscernables**. Une rotation cassée (« toujours la première ») resterait donc invisible
 * jusqu'au jour de la mise en ligne. Exposer la clé donne une porte par laquelle la rotation se
 * vérifie sans dépendre du contenu.
 *
 * La rotation ne prend QUE le jour civil (patron `indiceDuJour`) : aucun paramètre par lequel un
 * signal de comportement, une fraîcheur ou une donnée personnelle pourrait entrer. FR-033
 * (« jamais algorithmique ») devient une propriété de la signature, pas une consigne.
 *
 * Elle tourne sur les seules cartes PRÉSENTABLES (AC5). Prix à connaître : l'ensemble présentable
 * dépend de l'état du corpus, donc la carte d'un jour donné changera quand Anima écrira. Il n'y a
 * pas d'archive en v1 (`EXPERIENCE.md` §607), donc personne ne peut constater l'écart — mais c'est
 * un fait, pas un détail à taire.
 */
export function cleCarteDuJour(
  jour: JourCivil,
  cartes: readonly CarteBibliotheque[],
): CleCarte | null {
  const presentables = ordreCatalogue(cartes).filter(estPresentable);
  if (presentables.length === 0) return null;
  return presentables[indiceDuJour(jour, presentables.length)].cle;
}

export interface Bibliotheque {
  /** Les cartes dans l'ordre d'affichage : la carte du jour en tête, le reste au catalogue. */
  readonly cartes: readonly CarteBibliotheque[];
  /** Celle qui est mise en avant, ou `null` si aucune n'a rien à montrer aujourd'hui. */
  readonly enAvant: CleCarte | null;
}

/** L'assemblage final : ordre fixe + une seule carte en tête (AC1). */
export function assemblerBibliotheque(
  cartes: readonly CarteBibliotheque[],
  jour: JourCivil,
): Bibliotheque {
  const dansOrdre = ordreCatalogue(cartes);
  const enAvant = cleCarteDuJour(jour, cartes);
  if (enAvant === null) return { cartes: dansOrdre, enAvant: null };
  const tete = dansOrdre.filter((c) => c.cle === enAvant);
  const reste = dansOrdre.filter((c) => c.cle !== enAvant);
  return { cartes: [...tete, ...reste], enAvant };
}
