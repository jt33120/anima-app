/**
 * acces-lecture.ts — L'ORDRE DANS LEQUEL ON REFUSE (Story 5.8, AC7 · AD-9 / AD-17).
 *
 * ── POURQUOI CETTE FONCTION EXISTE ────────────────────────────────────────────────────────────
 *
 * 0050 refusait un tirage en détresse avec un `42501` indistinct des trois autres gardes, et le
 * résidu le disait en toutes lettres : « la 5.8 doit le dire avec des mots, pas avec une erreur ».
 * Dire avec des mots suppose de savoir LAQUELLE des quatre causes a parlé — donc de les interroger
 * AVANT de tirer, et de les arbitrer quelque part.
 *
 * Ce quelque part est ici, et nulle part ailleurs. Une seule dérivation : la route ne refait pas
 * l'arbitrage, elle rend ce que cette fonction dit.
 *
 * ── L'ORDRE EST UNE DÉCISION DE SÉCURITÉ, PAS UN DÉTAIL DE LISIBILITÉ ─────────────────────────
 *
 *     1. détresse      → aucune carte, AUCUNE OFFRE, Anam reste
 *     2. minorité      → refus dit
 *     3. consentement  → refus dit, avec le chemin pour le redonner
 *     4. premium       → l'offre
 *
 * Intervertir 1 et 4 met une proposition commerciale devant quelqu'un en détresse. C'est le
 * manquement qu'AD-9 nomme — « jamais de paywall sur la sécurité » — et il ne se rattrape pas par une
 * relecture attentive : il se rattrape par un test sur cette fonction, qui existe.
 *
 * La minorité passe avant le consentement parce qu'un compte barré ne doit pas se voir proposer de
 * redonner un consentement qui ne débloquerait rien.
 *
 * ── CE QUE LA FONCTION NE FAIT PAS ────────────────────────────────────────────────────────────
 *
 * Elle ne garde rien. Les gardes vivent dans les policies de `tirage` (0050) et `lecture` (0051), et
 * refuseraient toujours si quelqu'un sautait cet arbitrage. Cette fonction choisit des MOTS ; la base
 * choisit ce qui s'écrit. Les deux sont testées séparément — se fier à l'une pour l'autre est le
 * piège des défenses redondantes.
 */

/** Les trois prédicats SQL, tels que `causes_refus_lecture()` les rapporte. */
export interface CausesRefus {
  readonly consentementDonne: boolean;
  readonly barreMinorite: boolean;
  readonly detresseActive: boolean;
}

/**
 * Le verdict. Union discriminée plutôt qu'un booléen + une raison : le rendu ne peut pas oublier de
 * traiter un cas, et l'ajout d'une cinquième cause casserait la compilation au lieu de passer
 * silencieusement dans le `else`.
 */
export type AccesLecture =
  | { readonly type: "ouvert" }
  /** Fenêtre de détresse (AD-17). Aucune carte, aucune offre — Anam reste. */
  | { readonly type: "detresse" }
  | { readonly type: "minorite" }
  | { readonly type: "consentement" }
  /** Hors détresse et non premium : l'offre, dans le registre déjà acté (FR-056/FR-061). */
  | { readonly type: "offre" };

export function accesLecture(causes: CausesRefus, premium: boolean): AccesLecture {
  // 1. La détresse d'abord, inconditionnellement. AD-9.
  if (causes.detresseActive) return { type: "detresse" };
  // 2. Puis la barrière de minorité : un compte barré ne se voit rien proposer d'autre.
  if (causes.barreMinorite) return { type: "minorite" };
  // 3. Puis le consentement art. 9 : le rituel recueille de l'art. 9 dès la question suivante.
  if (!causes.consentementDonne) return { type: "consentement" };
  // 4. Enfin seulement, le commerce.
  if (!premium) return { type: "offre" };
  return { type: "ouvert" };
}
