/**
 * enneagramme.ts — LE CALCUL DU TYPE (Story 5.5, AC1 — FR-052).
 *
 * Module PUR (AD-1) : zéro I/O, zéro horloge, zéro aléa, et surtout **zéro modèle de langage**.
 * L'AC1 l'exige en toutes lettres — « aucun modèle de langage pour le score ». Le pendant
 * conversationnel (AC2) vit ailleurs et n'a rien à voir avec ce fichier.
 *
 * ══ POURQUOI LE SCORE NE SORT JAMAIS D'ICI ═══════════════════════════════════════════════════════
 *
 * FR-031 : « Aucun score, aucune note, aucune jauge, aucune série. » La charte visuelle en fait une
 * liste de composants qui « n'existent pas et ne doivent pas être créés » — barre de progression,
 * anneau de complétion, pourcentage, compteur, note en étoiles, score, graphique.
 *
 * Le score existe donc comme ARTEFACT INTERNE et rien d'autre. Ce module rend un TYPE, jamais un
 * nombre de points, jamais un classement des neuf. `Scores` est exporté pour être testé, pas pour
 * être affiché — aucune fonction de rendu ne doit le recevoir.
 *
 * ══ L'EX ÆQUO : LE PRODUIT REFUSE, IL NE TRANCHE PAS ═════════════════════════════════════════════
 *
 * Le réflexe est un départage arbitraire — « le plus petit numéro gagne ». Il est total, il est
 * déterministe, et il est mauvais : il fabrique un biais systématique vers le type 1, invisible à
 * l'écran et impossible à contester. Personne ne saurait jamais qu'elle a été rangée là par ordre
 * alphabétique.
 *
 * La 5.3 a écrit la doctrine pour l'heure de naissance manquante : « je préfère ne pas te
 * l'inventer ». C'est le même geste. À égalité, il n'y a **pas de type retenu** : le résultat est
 * `indecis`, il NOMME les types à égalité, et il renvoie vers l'autre chemin — celui où Anam
 * propose. C'est aussi ce que la story promet dans son titre : « avoir le choix du chemin ».
 *
 * Cette règle-là EST totale et déterministe (tout jeu de scores tombe dans exactement un cas), donc
 * elle satisfait l'AC1 sans inventer une réponse.
 *
 * ══ CE QUI EST DÉLIBÉRÉMENT ABSENT ═══════════════════════════════════════════════════════════════
 *
 * Ailes, instincts, flèches, sous-types. Chacun est un produit cartésien sur les neuf types, et la
 * 5.4 a écrit la règle en refusant les siens : on garde l'axe qu'une personne identifie comme ELLE,
 * on refuse le croisement. Ajouter une clé plus tard ne casse rien ; on part d'ici.
 */

/** Les neuf types. Union FERMÉE : un `number` laisserait entrer un 0 ou un 12. */
export type TypeEnneagramme = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const TYPES: readonly TypeEnneagramme[] = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9] as const);

/** Vrai si `v` est l'un des neuf types. Le seul point d'entrée depuis l'extérieur (RPC, base, URL). */
export function estTypeEnneagramme(v: unknown): v is TypeEnneagramme {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 9;
}

/**
 * L'échelle de réponse — QUATRE degrés, SANS milieu, et c'est une décision.
 *
 * Un point central (« ni l'un ni l'autre ») est la case qu'on coche quand on ne veut pas répondre :
 * sur dix-huit énoncés, il produit des scores plats, donc des ex æquo partout, donc un test qui ne
 * conclut jamais. Quatre degrés obligent à un penchant, même léger, sans forcer un engagement.
 *
 * Les valeurs sont des ENTIERS ORDONNÉS parce qu'on les additionne. Elles ne s'affichent jamais :
 * l'écran ne montre que des libellés (« pas du tout » … « tout à fait »), jamais 0, 1, 2, 3.
 */
export type NiveauReponse = 0 | 1 | 2 | 3;

export const NIVEAUX: readonly NiveauReponse[] = Object.freeze([0, 1, 2, 3] as const);

export function estNiveauReponse(v: unknown): v is NiveauReponse {
  return v === 0 || v === 1 || v === 2 || v === 3;
}

/**
 * Une réponse est appariée par IDENTIFIANT, jamais par position (D7).
 *
 * ⚠️ C'est la garde la plus discrète de la story et la plus coûteuse à rater. Un appariement
 * positionnel — « la 3ᵉ réponse va au 3ᵉ item » — survit à toutes les relectures et casse
 * silencieusement le jour où quelqu'un insère, retire ou réordonne une question. Le type rendu
 * serait alors FAUX de façon parfaitement déterministe : invisible aux tests de déterminisme de
 * l'AC1, et invisible à l'écran tant que le corpus est vide, puisque deux textes non écrits sont
 * égaux. Le dépôt a déjà payé la version « miroir qui diverge » (leçon R1-bis).
 */
export interface ReponseItem {
  readonly itemId: string;
  readonly niveau: NiveauReponse;
}

/** Ce qu'un item apporte au calcul : son identité, et le type qu'il pèse. */
export interface ItemBareme {
  readonly id: string;
  readonly type: TypeEnneagramme;
}

/** Le total par type. Exporté pour être ÉPROUVÉ, jamais pour être rendu. */
export type Scores = Readonly<Record<TypeEnneagramme, number>>;

/**
 * Additionne les réponses par type.
 *
 * Une réponse dont l'`itemId` est inconnu du barème est **ignorée** — pas d'exception, pas de
 * comptage implicite. C'est un client qui envoie n'importe quoi, pas une panne : la garde de
 * complétude ci-dessous s'en charge, et elle le dira en nommant ce qui manque. Une réponse en
 * double sur le même item ne compte qu'une fois : la DERNIÈRE, parce qu'un formulaire qui laisse
 * revenir en arrière produit exactement ça.
 */
export function scorer(reponses: readonly ReponseItem[], bareme: readonly ItemBareme[]): Scores {
  const typeParItem = new Map(bareme.map((i) => [i.id, i.type]));
  const derniere = new Map<string, NiveauReponse>();
  for (const r of reponses) {
    if (!typeParItem.has(r.itemId)) continue;
    derniere.set(r.itemId, r.niveau);
  }
  const totaux = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<TypeEnneagramme, number>;
  for (const [itemId, niveau] of derniere) {
    totaux[typeParItem.get(itemId) as TypeEnneagramme] += niveau;
  }
  return Object.freeze(totaux);
}

/**
 * Le verdict du test court. Union discriminée — la loi du socle : un `type: TypeEnneagramme | null`
 * autoriserait un `?? 1` quelque part, qui transformerait une absence en résultat plausible.
 */
export type ResultatTest =
  | { readonly statut: "retenu"; readonly type: TypeEnneagramme }
  | { readonly statut: "indecis"; readonly exaequo: readonly TypeEnneagramme[] }
  | { readonly statut: "incomplet"; readonly manquants: readonly string[] };

/**
 * Les items auxquels elle n'a pas répondu. Un test incomplet ne se score PAS : additionner des
 * absences comme des zéros reviendrait à répondre « pas du tout » à sa place, et le type rendu
 * serait celui de son silence.
 */
export function itemsManquants(reponses: readonly ReponseItem[], bareme: readonly ItemBareme[]): readonly string[] {
  const repondus = new Set(reponses.map((r) => r.itemId));
  return bareme.filter((i) => !repondus.has(i.id)).map((i) => i.id);
}

/** Le type dominant, ou le refus de trancher. Voir l'en-tête pour l'ex æquo. */
export function conclure(reponses: readonly ReponseItem[], bareme: readonly ItemBareme[]): ResultatTest {
  const manquants = itemsManquants(reponses, bareme);
  if (manquants.length > 0) return { statut: "incomplet", manquants };

  const scores = scorer(reponses, bareme);
  // ⚠️ Le maximum se calcule sur les VALEURS, jamais par un tri. `Array.sort` est stable depuis
  // ES2019 : « le premier de la liste » et « le plus haut score » coïncident tant que les données
  // sont ordonnées, ce qui rend un test de départage vert pour la mauvaise raison. C'est la zone de
  // coïncidence qui a produit trois des cinq survivants de la campagne de la 5.4.
  const meilleur = Math.max(...TYPES.map((t) => scores[t]));
  const exaequo = TYPES.filter((t) => scores[t] === meilleur);
  if (exaequo.length > 1) return { statut: "indecis", exaequo: Object.freeze(exaequo) };
  return { statut: "retenu", type: exaequo[0] };
}
