import { ORDRE_ETAT, type EtatBranche } from "@/lib/scene/projection";

/**
 * Story 4.7 (T2) — LA FONCTION DE TRANSITION UNIQUE du cycle de vie d'une branche (AD-8 : « une fonction
 * de transition unique possédée (`lib/domain/`) ET une contrainte SQL »). Module PUR : 0 I/O, aucun
 * Next/Supabase/DOM, aucun modèle (AD-1).
 *
 * ⚠️ CE MODULE N'EST PAS LA GARANTIE. La garantie de FR-029 vit dans la migration 0025 (le trigger
 * `branche_garde_cycle`, qui mord jusqu'à `service_role`). Ici vit la même règle, du côté du domaine :
 *   • pour que le serveur puisse DÉCIDER avant d'écrire, et refuser proprement plutôt qu'attendre un
 *     échec SQL qu'il faudrait traduire ;
 *   • pour que la règle soit lisible et testable sans base.
 * Les deux doivent rester ÉQUIVALENTES — une garde de test compare le pas d'intensité des deux côtés
 * (R1-bis appliqué à l'arithmétique).
 *
 * `ORDRE_ETAT` est IMPORTÉ de `lib/scene/projection` (import domaine → domaine, pur, autorisé) : une
 * seconde copie de l'ordre monotone serait une occasion de diverger sur la question la plus structurante
 * du fichier — dans quel sens l'arbre a le droit d'aller.
 */

/**
 * Le pas d'intensité d'un retour sur le thème. **MIROIR de `public.branche_pas_feuillaison()`** (0025) :
 * si les deux divergent, l'app annonce une progression que la base n'écrit pas.
 *
 * ⚠️ PLACEHOLDER PRODUIT, au même titre qu'`INSTRUCTION_RECONCEPTUALISATION` — 0,2 = feuillage plein en
 * cinq retours espacés. À valider sur données réelles avant mise en ligne. **Jamais affiché** (FR-031 :
 * aucun seuil, aucune étape numérotée, aucun « 2 retours sur 3 » — l'utilisatrice n'a rien à confirmer).
 */
export const PAS_FEUILLAISON = 0.2;

/** L'état vivant d'une branche, réduit à ce dont la transition a besoin. */
export interface EtatCycle {
  readonly etat: EtatBranche;
  readonly intensite: number;
}

/**
 * Les deux seuls événements qui font bouger une branche — et ils ne sont pas de même nature (EXPERIENCE
 * L251) : le `retour` est un continuum INFÉRÉ, la `declaration` est un événement DÉCLARÉ par elle.
 * Les tenir dans un même type force tout appelant à choisir explicitement lequel il provoque.
 */
export type EvenementCycle = { readonly type: "retour" } | { readonly type: "declaration" };

/** Le refus est une VALEUR, pas une exception : l'appelant doit le regarder pour l'ignorer. */
export type Transition =
  | { readonly change: true; readonly suivant: EtatCycle }
  | { readonly change: false; readonly motif: "deja_au_maximum" | "deja_rayonnante" };

function borner(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/**
 * Applique un événement à l'état d'une branche. PURE et IDEMPOTENTE au sens qui compte : appliquer une
 * `declaration` à une branche déjà rayonnante ne change rien (et ne lève pas — un double-tap n'est pas
 * une erreur).
 *
 * Elle ne fait JAMAIS reculer quoi que ce soit : c'est un invariant du résultat, pas une politesse —
 * `transitionner` ne construit `suivant` qu'en avançant, et la garde de test le vérifie sur l'ensemble
 * des couples (état, événement).
 *
 * Un `retour` ne mène JAMAIS au rayonnement, quel que soit le nombre de retours : la pleine lumière n'est
 * pas au bout d'un compteur, elle est un geste (FR-028, AC3). C'est la raison d'être de la séparation.
 */
export function transitionner(courant: EtatCycle, evenement: EvenementCycle): Transition {
  const intensite = borner(courant.intensite);

  if (evenement.type === "declaration") {
    if (courant.etat === "rayonnement") return { change: false, motif: "deja_rayonnante" };
    // Le saut direct depuis `naissance` est légal : monotone ≠ obligation de gravir chaque marche. Elle a
    // pu vivre la chose sans jamais y revenir en séance, et c'est ELLE qui sait.
    return { change: true, suivant: { etat: "rayonnement", intensite } };
  }

  // Un retour sur une branche arrivée en pleine lumière ne fait rien bouger : elle est arrivée.
  if (courant.etat === "rayonnement") return { change: false, motif: "deja_rayonnante" };
  if (intensite >= 1) return { change: false, motif: "deja_au_maximum" };

  return {
    change: true,
    suivant: { etat: "feuillaison", intensite: Math.min(1, intensite + PAS_FEUILLAISON) },
  };
}

/**
 * Le prédicat de non-régression, exposé pour les gardes et pour le repli de lecture : `suivant` est-il
 * bien à la même hauteur ou plus haut que `precedent` ? Miroir exact des deux clauses de monotonie du
 * trigger 0025.
 */
export function progresseOuStagne(precedent: EtatCycle, suivant: EtatCycle): boolean {
  return (
    ORDRE_ETAT[suivant.etat] >= ORDRE_ETAT[precedent.etat] && borner(suivant.intensite) >= borner(precedent.intensite)
  );
}
