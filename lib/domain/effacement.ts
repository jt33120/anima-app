/**
 * effacement.ts — LA FENÊTRE DE SURVIVANCE, EN DOMAINE PUR (Story 6.7, AC2 · AD-14).
 *
 * AD-14 exige que les échéances soient « des paramètres lus à l'exécution et jamais codés en dur ».
 * Ce fichier ne LIT rien — `lib/domain/` n'a ni `process.env` ni I/O (AD-1) : il porte la valeur par
 * défaut, la borne, et le seul jugement qui compte (« cette fenêtre est-elle recevable ? »).
 * `lib/data/effacer-donnees.ts` lit l'environnement et passe le nombre en ARGUMENT à la fonction SQL,
 * dont la contrainte de table le borne une seconde fois — y compris pour `service_role`.
 *
 * ── POURQUOI SEPT JOURS PAR DÉFAUT ─────────────────────────────────────────────────────────────
 *
 * C'est la fenêtre de restauration de l'hébergeur : au-delà, plus aucune copie de la ligne effacée
 * n'existe, même par restauration. Annoncer moins serait mentir ; annoncer plus serait s'engager à
 * garder ce qu'on ne garde pas.
 *
 * ⚠️ LA VALEUR RÉELLE EST UN RÉGLAGE D'INFRASTRUCTURE, PAS UNE LIGNE DE CODE. Ce module déclare ce
 * que le produit PROMET ; que le projet hébergé soit bien réglé sur cette fenêtre est une porte
 * pré-lancement humaine, inscrite comme telle. Le crypto-shredding (une clé par utilisatrice,
 * détruite à l'effacement) — l'autre branche qu'AD-14 autorise — n'est pas construit.
 */

/** La fenêtre annoncée par défaut, en jours. */
export const FENETRE_PITR_JOURS_DEFAUT = 7;

/**
 * La borne dure, en jours. Au-delà, la promesse « rien ne survit » devient invérifiable — et la
 * contrainte de table `effacement_fenetre_bornee` refuse la même valeur, côté base.
 */
export const FENETRE_PITR_JOURS_MAX = 35;

/**
 * Une fenêtre est recevable si c'est un entier de 0 à 35. `0` est permis et signifie « aucune copie
 * ne survit » — ce n'est pas une valeur absurde, c'est celle du crypto-shredding le jour où il
 * existera.
 */
export function fenetreRecevable(jours: unknown): jours is number {
  return (
    typeof jours === "number" &&
    Number.isInteger(jours) &&
    jours >= 0 &&
    jours <= FENETRE_PITR_JOURS_MAX
  );
}

/**
 * La fenêtre à appliquer, à partir de ce que l'environnement dit.
 *
 * ⚠️ UNE VALEUR ILLISIBLE RETOMBE SUR LE DÉFAUT, ELLE NE LÈVE PAS. Le raisonnement est celui d'AD-15
 * (le repli penche vers le moins d'effet) appliqué à l'envers de d'habitude : ici, refuser
 * d'effacer parce qu'une variable d'environnement est mal écrite ferait d'une faute de frappe un
 * refus de droit. On efface, avec la fenêtre annoncée par défaut.
 */
export function fenetreDepuisTexte(brut: string | undefined): number {
  if (brut === undefined) return FENETRE_PITR_JOURS_DEFAUT;
  const n = Number(brut.trim());
  return fenetreRecevable(n) ? n : FENETRE_PITR_JOURS_DEFAUT;
}
