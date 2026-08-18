/**
 * date-limite.ts — LE TROISIÈME TROU DES GABARITS, ET SON BOUCHON (revue des Epics 1 à 4, #14).
 *
 * ══ POURQUOI UN TYPE MARQUÉ PLUTÔT QU'UNE `string` ════════════════════════════════════════════
 *
 * `lib/courriel/gabarits.ts` est une table CONSTANTE, et c'est ce qui fait toute sa sûreté : hors
 * deux valeurs typées nominalement (`Origine`, `JetonDesabonnement`), tout ce qui sortira jamais du
 * produit vers un serveur de messagerie est écrit en clair dans ce fichier, lisible d'un coup d'œil.
 * La phrase « ajoutons juste le premier paragraphe de la synthèse en aperçu » y est INÉCRIVABLE : il
 * n'existe aucun paramètre où la mettre.
 *
 * L'art. L215-1 oblige à mentionner la date limite de résiliation DANS le courriel dédié. Il fallait
 * donc un troisième trou. Ouvert en `string`, il redonnait d'un coup ce que toute la 4.9 avait
 * fermé — n'importe quelle chaîne, dont de l'art. 9, aurait pu y transiter jusque chez Resend.
 *
 * Le bouchon est le même que pour les deux autres : le type est MARQUÉ, et son unique constructeur
 * VALIDE. `dateLimiteResiliation` n'accepte qu'un instant analysable et rend LUI-MÊME le rendu
 * français — il ne relaie jamais la chaîne reçue. Passer « Je me sens vraiment mal » rend `null`, à
 * l'exécution, pas seulement à la compilation.
 *
 * ══ PARIS, PAS LE SERVEUR ═════════════════════════════════════════════════════════════════════
 *
 * Vercel tourne en UTC. Une échéance au 5 mars à 23 h 30 UTC est le 6 mars à Paris : sans fuseau
 * explicite, la date limite annoncée au titre de la loi serait fausse d'un jour — du mauvais côté,
 * celui qui fait croire qu'il reste un jour de moins. Même horloge que le reste du produit (AD-17).
 *
 * Ce module est PUR (AD-1) : aucune E/S, aucun import runtime. Il vit dans `lib/domain/` pour la
 * même raison que `jeton-desabonnement.ts`.
 */

declare const marqueDateLimite: unique symbol;

/**
 * Une date limite de résiliation PRÊTE À ÊTRE LUE — « 5 mars 2027 ». Elle ne se fabrique que par
 * `dateLimiteResiliation()`, jamais par un transtypage depuis une chaîne du domaine.
 */
export type DateLimiteResiliation = string & { readonly [marqueDateLimite]: true };

const CALENDRIER_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Rend la date limite de résiliation, ou `null` si l'instant est illisible.
 *
 * `null` plutôt qu'une valeur approximative : un courriel légal qui annoncerait une date fausse est
 * pire qu'un courriel qui n'part pas — le second se rattrape, le premier fait foi. L'appelant
 * (`annoncerReconduction`) lève alors, le webhook répond 500, et Stripe rejoue.
 */
export function dateLimiteResiliation(instantIso: string): DateLimiteResiliation | null {
  if (typeof instantIso !== "string" || instantIso.trim() === "") return null;
  const t = Date.parse(instantIso);
  if (Number.isNaN(t)) return null;
  return CALENDRIER_PARIS.format(new Date(t)) as DateLimiteResiliation;
}
