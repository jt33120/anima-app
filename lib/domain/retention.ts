/**
 * retention.ts — LES ÉCHÉANCES DE CONSERVATION, EN DOMAINE PUR (Story 6.8 · NFR-021 · AD-14).
 *
 * AD-14 exige que les échéances soient « des paramètres lus à l'exécution et jamais codés en dur ».
 * Ce fichier ne lit rien — `lib/domain/` n'a ni `process.env` ni I/O (AD-1) : il porte les valeurs
 * par défaut, leurs bornes, et le seul jugement qui compte (« cette durée est-elle recevable ? »).
 * `lib/data/depot-retention.ts` lit l'environnement et passe les nombres en ARGUMENTS aux fonctions
 * SQL, qui les revalident à leur tour.
 *
 * ══ POURQUOI CHAQUE BORNE EXISTE ════════════════════════════════════════════════════════════════
 *
 * Une durée mal saisie ne produit pas une erreur : elle produit une SUPPRESSION. Un `2` au lieu de
 * `24` efface les données de quiconque n'est pas venu depuis deux mois, sans que rien ne rougisse.
 * Les bornes ne protègent donc pas d'une valeur absurde, elles protègent d'une COQUILLE — et c'est
 * pour ça que le plancher d'inactivité est haut (12 mois) plutôt que symbolique.
 */

/** L'inactivité au bout de laquelle le produit prévient (NFR-021 : 24 mois). */
export const INACTIVITE_MOIS_DEFAUT = 24;

/**
 * Le plancher. Douze mois, et pas « un mois » : en dessous d'un an, ce n'est plus de la rétention,
 * c'est une purge — et aucune coquille plausible ne descend en dessous de ce plancher par hasard.
 */
export const INACTIVITE_MOIS_MIN = 12;
export const INACTIVITE_MOIS_MAX = 120;

/** Le préavis entre l'avis et la suppression (NFR-021 : 3 mois). */
export const PREAVIS_MOIS_DEFAUT = 3;
export const PREAVIS_MOIS_MIN = 1;
export const PREAVIS_MOIS_MAX = 24;

/**
 * La rétention du JOURNAL de l'ordonnanceur (trouvaille R1 de la revue 6.1a).
 *
 * 90 jours : assez long pour qu'un incident de la saison passée reste diagnosticable, assez court
 * pour qu'une ligne par personne et par jour ne s'accumule pas indéfiniment. Ces lignes ne portent
 * aucun contenu — mais un `cible_id` reste un rattachement à une personne, et rien ne justifie de
 * le garder trois ans.
 */
export const JOURNAL_JOURS_DEFAUT = 90;
export const JOURNAL_JOURS_MIN = 7;
export const JOURNAL_JOURS_MAX = 400;

/** Combien de personnes au plus par tick, pour chacune des deux phases. */
export const LOT_MAX = 50;

function entierDans(valeur: unknown, min: number, max: number): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= min && valeur <= max;
}

export function inactiviteRecevable(mois: unknown): mois is number {
  return entierDans(mois, INACTIVITE_MOIS_MIN, INACTIVITE_MOIS_MAX);
}
export function preavisRecevable(mois: unknown): mois is number {
  return entierDans(mois, PREAVIS_MOIS_MIN, PREAVIS_MOIS_MAX);
}
export function journalRecevable(jours: unknown): jours is number {
  return entierDans(jours, JOURNAL_JOURS_MIN, JOURNAL_JOURS_MAX);
}

/**
 * Une durée lue dans l'environnement, ou le défaut.
 *
 * ⚠️ UNE VALEUR HORS BORNES RETOMBE SUR LE DÉFAUT, ELLE NE LÈVE PAS — mais elle ne s'applique pas
 * non plus. C'est l'inverse du repli de l'effacement à la demande (6.7), et pour une raison qui
 * n'est pas symétrique : là-bas, refuser d'agir privait quelqu'un d'un droit ; ici, agir sur une
 * mauvaise valeur SUPPRIME. Dans le doute, on garde la durée la plus prudente qu'on connaisse.
 */
export function dureeDepuisTexte(
  brut: string | undefined,
  defaut: number,
  recevable: (v: unknown) => boolean,
): number {
  if (brut === undefined) return defaut;
  const n = Number(brut.trim());
  return recevable(n) ? n : defaut;
}

/** Ce que la SQL rend quand on lui demande de trancher une échéance. */
export type IssueEcheance = "effacee" | "graciee" | "ignoree";

export function issueRecevable(brut: unknown): brut is IssueEcheance {
  return brut === "effacee" || brut === "graciee" || brut === "ignoree";
}
