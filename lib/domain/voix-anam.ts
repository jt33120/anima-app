/**
 * La VOIX d'Anam — la troncature déterministe à 3 phrases (Story 2.8, T2 ; FR-084). Cœur PUR (AD-1,
 * zéro I/O). *« au maximum trois phrases (tronqué à la troisième ponctuation finale) »* (EXPERIENCE
 * §111 ; DESIGN : « au-delà de trois phrases, c'est un défaut de génération »).
 *
 * Définition de « ponctuation finale » : un groupe de `. ! ? …` CONSÉCUTIFS compte pour UNE fin (le
 * `+`). `estReponseLongue` (`signaux-arc.ts`) partage cette définition pour COMPTER ; ici on LOCALISE
 * un point de coupe — deux usages distincts. Le motif de coupe **exclut les points décimaux** (`2.5`)
 * pour ne jamais trancher au milieu d'un nombre (revue 2.8) ; c'est la seule divergence assumée avec
 * le motif de comptage.
 *
 * ⚠️ Appliqué CÔTÉ SERVEUR, sur le flux, et UNIQUEMENT hors détresse (`niveauSecurite === 0`) : en
 * détresse la réponse (orienter, donner le 3114, rester) dépasse légitimement 3 phrases et ne doit
 * JAMAIS être coupée avant l'orientation (garde de sécurité, câblage route). La mécanique de coupe SUR
 * FLUX est le cœur pur `absorberDelta` (testable en isolation) ; la route n'ajoute que le gate détresse.
 */

/** Groupe de ponctuation finale, hors points décimaux (`2.5`) — pour la TRONCATURE. */
const COUPE_PONCTUATION = /(?<!\d)[.!?…]+(?!\d)/g;

/**
 * Index juste après le 3ᵉ groupe de ponctuation finale, SI ce groupe est CLOS ; sinon `null`.
 *
 * « Clos » = un caractère NON-BLANC suit le groupe. Grâce au `+` glouton, le caractère qui suit
 * immédiatement un groupe est non-final ; on exige en plus qu'il ne soit pas une simple queue
 * d'espaces de fin de flux (sinon une réponse conforme de 3 phrases terminée par un « \n » serait
 * faussement tronquée et journalisée comme un manquement — revue 2.8). Sur un flux, tant que le 3ᵉ
 * groupe est en fin de chaîne (ou suivi de blanc), il peut encore grandir : on renvoie `null` et on
 * attend le fragment suivant. `null` aussi s'il y a moins de 3 phrases (rien à couper).
 */
export function pointDeCoupe(texte: string): number | null {
  const groupes = [...texte.matchAll(COUPE_PONCTUATION)];
  if (groupes.length < 3) return null;
  const troisieme = groupes[2];
  const fin = troisieme.index + troisieme[0].length;
  return texte.slice(fin).trim().length > 0 ? fin : null;
}

/**
 * Façade non-streaming (usage direct + tests) : tronque `texte` à 3 phrases s'il en a plus. Renvoie
 * le texte inchangé (`tronque: false`) quand il tient déjà en ≤ 3 phrases (queue blanche incluse).
 */
export function tronquerATroisPhrases(texte: string): { texte: string; tronque: boolean } {
  const coupe = pointDeCoupe(texte);
  return coupe === null ? { texte, tronque: false } : { texte: texte.slice(0, coupe), tronque: true };
}

/**
 * La mécanique de troncature SUR FLUX, PURE et testable (revue 2.8 : sortir le cœur du ReadableStream
 * de la route pour le prouver par un test comportemental, pas seulement par une garde de source). Le
 * gate détresse (`niveauSecurite === 0`) reste dans la route ; ici, la logique delta-par-delta :
 * accumuler, localiser la coupe, n'émettre que le texte autorisé, se terminer une fois coupé.
 */
export interface EtatTroncature {
  readonly texte: string; // texte accumulé (jamais loggé, jamais émis en entier)
  readonly emis: number; // longueur déjà émise au client
  readonly termine: boolean; // vrai dès la coupe → on n'émet plus (mais la route continue de drainer)
}

export function etatTroncatureInitial(): EtatTroncature {
  return { texte: "", emis: 0, termine: false };
}

/**
 * Absorbe un fragment : renvoie le prochain état, le texte à émettre MAINTENANT, et si la coupe vient
 * d'avoir lieu. Une fois `termine`, tout delta ultérieur n'émet plus rien (la route draine le flux
 * jusqu'à `fin` pour un métrage honnête).
 */
export function absorberDelta(
  etat: EtatTroncature,
  delta: string,
): { etat: EtatTroncature; aEmettre: string; tronque: boolean } {
  if (etat.termine) return { etat, aEmettre: "", tronque: false };
  const texte = etat.texte + delta;
  const coupe = pointDeCoupe(texte);
  if (coupe === null) {
    // On RETIENT la queue blanche : ne pas émettre un espace de fin tant qu'aucun contenu ne le suit
    // (sinon une 4ᵉ phrase arrivant au delta suivant laisserait un espace parasite après la coupe).
    const contenu = texte.replace(/\s+$/, "").length;
    return { etat: { texte, emis: contenu, termine: false }, aEmettre: texte.slice(etat.emis, contenu), tronque: false };
  }
  const aEmettre = coupe > etat.emis ? texte.slice(etat.emis, coupe) : "";
  return { etat: { texte, emis: coupe, termine: true }, aEmettre, tronque: true };
}
