/**
 * offre-abonnement.ts — la COPIE de la carte d'abonnement (Story 3.2), en registre SYSTÈME : jamais
 * la voix d'Anam. Anam ne vend rien (AC4).
 *
 * Vit dans `render/` (chrome de présentation, comme les libellés de boutons) et N'IMPORTE RIEN — en
 * particulier PAS `lib/domain` : le rendu est l'adaptateur MUET (AD-7), il ne connaît pas la couche
 * domaine (gardes `tests/scene-architecture.test.ts` / `tests/arc-architecture.test.ts`). La décision
 * de PROPOSER, elle, est serveur (trame `paywall`, `lib/domain/proposer-abonnement`).
 *
 * COUPLAGE (AC2/AC3) : le prix AFFICHÉ est couplé PAR TEST au prix FACTURÉ
 * (`PRIX_ABONNEMENT_ANNUEL_CENTIMES`, `lib/stripe/config`, serveur) — jamais « affiche 69, facture 79 »
 * (tests/offre-abonnement.test.ts, qui peut importer les deux côtés). Le prix facturé reste `server-only` ;
 * l'affichage vit ici, prouvé égal au centime près.
 *
 * ZÉRO DARK PATTERN (FR-061, AC2) : prix unique, aucun barré, aucun compte à rebours, aucune rareté,
 * aucune urgence — rejetés par la garde de copie. Aucune donnée art. 9, aucun secret.
 */

/** Prix annuel AFFICHÉ, en euros entiers. Couplé au prix facturé (× 100 = centimes EUR) par test. */
export const PRIX_ABONNEMENT_ANNUEL_EUROS = 69;

/** « 69 € » — l'affichage du prix unique (AC2 : sans barré, sans rabais, sans « au lieu de »). */
export function formaterPrixAnnuel(): string {
  return `${PRIX_ABONNEMENT_ANNUEL_EUROS} €`;
}

/** Cadence, affichée à côté du prix (le prix est ANNUEL). */
export const CADENCE_ABONNEMENT = "par an";

/** Titre de la carte — NEUTRE, registre produit (jamais signé Anam). */
export const TITRE_CARTE = "Continuer avec Anam";

/**
 * Garantie de remboursement (FR-089, AC3) — écrite SUR la carte, en `t-meta`, à côté du prix ; jamais
 * reléguée aux CGU ni derrière un lien. Formulée sur un ARTEFACT du produit (une branche posée), jamais
 * en termes d'état ou de résultat personnel.
 */
export const GARANTIE_REMBOURSEMENT =
  "Si aucune branche n'a été posée au bout de trois mois, remboursement sur simple demande.";

/**
 * ── LA RECONDUCTION, DITE AU MOMENT OÙ ON DEMANDE L'ARGENT (Story 3.6, art. L215-1) ────────────
 *
 * ⚠️ CETTE PHRASE MANQUAIT, ET C'EST UN MANQUE LÉGAL, PAS UNE OMISSION DE CONFORT.
 *
 * La 3.5 a construit tout le nécessaire pour l'information AVANT reconduction (courriel, réservation
 * idempotente, `information_reconduction`) — c'est-à-dire l'obligation qui court PENDANT le contrat.
 * Mais aucune surface de VENTE ne disait que l'abonnement se reconduit. On demandait 69 € sans dire
 * que ce serait 69 € l'an prochain aussi.
 *
 * Elle est posée ICI, dans la source unique de la copie d'offre, donc elle paraît sur les DEUX
 * surfaces où l'on vend : la carte du fil (3.2) et la page d'offre (3.6). Une phrase à enjeu légal
 * ne se recopie pas — deux exemplaires divergent, et l'un des deux devient faux.
 *
 * Elle nomme les trois choses vraies, et rien d'autre : la durée, la reconduction, et la sortie.
 * L'avis par courriel est mentionné parce qu'il EXISTE (3.5) — jamais une promesse sans code
 * derrière elle.
 */
export const RECONDUCTION =
  "L'abonnement dure un an, puis se reconduit chaque année. Tu es prévenue par courriel avant " +
  "chaque reconduction, et tu peux l'arrêter à tout moment, en trois clics.";

/** Ce qui reste gratuit, pour toujours (FR-055) — sur la même surface (AC4). */
export const PERIMETRE_GRATUIT_TITRE = "Gratuit, pour toujours";
export const PERIMETRE_GRATUIT: readonly string[] = [
  "Ta numérologie, ton thème natal, ton horoscope et ton mantra du jour",
  "Ta première séance en entier, jusqu'au bilan",
  "Le tronc de ton arbre et les ressources d'aide",
];

/** Ce que le premium ajoute (FR-056) — sur la même surface (AC4). */
export const PERIMETRE_PREMIUM_TITRE = "Avec le premium";
export const PERIMETRE_PREMIUM: readonly string[] = [
  "La conversation avec Anam, sans limite",
  "Les branches de ton arbre et leur mémoire dans la durée",
  "Les lectures, les ancrages et les plans d'étapes",
];

/** Libellés des deux actions — d'ÉGALE lisibilité (AC2). */
export const ACTION_ABONNER = "M'abonner";
export const ACTION_PAS_MAINTENANT = "Pas maintenant";
