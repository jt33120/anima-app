/**
 * numerologie.ts — LE CALCUL NUMÉROLOGIQUE (Story 5.2, AD-6 / FR-047 / NFR-011).
 *
 * Module PUR, comme `theme-natal.ts` : aucune I/O, aucun `server-only`, aucun Supabase, aucun
 * `@/lib/ai/*`. Gardé par `tests/astro-architecture.test.ts`.
 *
 * ── AUCUNE PROSE ICI NON PLUS (FR-053) ─────────────────────────────────────────────────────────
 *
 * Ce module rend des NOMBRES et des énumérations, rien d'autre. Le SENS de ces nombres vit dans
 * `lib/corpus/numerologie.ts` et il est écrit par Anima (FR-054, FR-086). La séparation n'est pas
 * cosmétique : elle est ce qui permet à la garde d'absence de `astro-architecture.test.ts` de
 * continuer à surveiller l'apparition d'un champ de texte dans le socle.
 *
 * ── DÉTERMINISME : AUCUNE HORLOGE, PAS MÊME EN PARAMÈTRE `Date` ────────────────────────────────
 *
 * L'année personnelle est le seul nombre qui bouge dans le temps. Le réflexe serait de prendre un
 * `Date` en paramètre — c'est déjà mieux qu'un `new Date()` interne (patron du dépôt :
 * `lib/domain/intention.ts`, `lib/domain/branche.ts`). Mais ça ne suffit pas ici : extraire une
 * ANNÉE d'un `Date` oblige à choisir entre `getFullYear()` et `getUTCFullYear()`, et les deux
 * divergent le 1ᵉʳ janvier entre 00 h 00 et 01 h 00 à Paris. Ce module se retrouverait à trancher
 * une question de fuseau qu'il n'a aucun moyen de trancher.
 *
 * Donc le paramètre est un ENTIER : `anneeDeReference`. La couche qui connaît le fuseau
 * (`lib/data/lire-numerologie.ts`) le résout et le passe. Ici, même entrée ⇒ même sortie, sans
 * qu'aucune notion de « maintenant » n'existe.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les six nombres — périmètre FERMÉ (Story 5.2, P12)
// ══════════════════════════════════════════════════════════════════════════════════════════════

export type NomNombre =
  | "chemin_de_vie"
  | "expression"
  | "intime"
  | "personnalite"
  | "jour_de_naissance"
  | "annee_personnelle";

/** Ordre de lecture du socle. Source unique : on itère dessus, jamais sur une copie. */
export const NOMBRES: readonly NomNombre[] = Object.freeze([
  "chemin_de_vie",
  "expression",
  "intime",
  "personnalite",
  "jour_de_naissance",
  "annee_personnelle",
]);

/** Les trois nombres qui exigent le nom complet de naissance. */
export const NOMBRES_DU_NOM: readonly NomNombre[] = Object.freeze([
  "expression",
  "intime",
  "personnalite",
]);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La réduction
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Les nombres maîtres. Ils ne se réduisent PAS — c'est la règle la plus identifiante de la
 * numérologie et la plus facile à perdre par accident (voir `reduire`).
 */
export const MAITRES: readonly number[] = Object.freeze([11, 22, 33]);

export function estMaitre(n: number): boolean {
  return MAITRES.includes(n);
}

function sommeDesChiffres(n: number): number {
  let somme = 0;
  for (let v = n; v > 0; v = Math.floor(v / 10)) somme += v % 10;
  return somme;
}

/**
 * Réduit à un chiffre — SAUF si un nombre maître apparaît en route.
 *
 * ⚠️ LE PIÈGE. La formulation naïve
 *
 *     while (n > 9) n = sommeDesChiffres(n);       // ❌
 *
 * avale 11 → 2, 22 → 4, 33 → 6. Elle ne plante jamais et détruit exactement l'information qui fait
 * la particularité d'un thème numérologique. Le test d'appartenance doit précéder CHAQUE réduction,
 * jamais la suivre.
 *
 * Jette sur une entrée < 1 : un nombre numérologique vaut toujours au moins 1, donc un 0 qui
 * arriverait ici viendrait d'un jeu de lettres vide — une absence déguisée en résultat (P9 de la
 * 5.1, transposée). Les appelants déclarent l'absence AVANT d'arriver jusqu'ici.
 */
export function reduire(n: number): number {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`numerologie : réduction impossible sur ${n} — un nombre ne se devine pas`);
  }
  let v = n;
  while (v > 9 && !estMaitre(v)) v = sommeDesChiffres(v);
  return v;
}

/**
 * Réduction SANS nombre maître : la racine numérique pure, de 1 à 9.
 *
 * Réservée à l'année personnelle, qui parcourt un cycle de neuf ans. (Fait rassurant : la racine
 * numérique étant invariante modulo 9 et 11 ≡ 2, 22 ≡ 4, 33 ≡ 6, conserver ou non un maître dans un
 * sous-total ne change JAMAIS le résultat final — il n'y a donc pas d'ambiguïté d'école à trancher
 * pour ce nombre-là.)
 */
export function reduireSansMaitre(n: number): number {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`numerologie : réduction impossible sur ${n} — un nombre ne se devine pas`);
  }
  let v = n;
  while (v > 9) v = sommeDesChiffres(v);
  return v;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les lettres — le français, avec ses accents et ses ligatures
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * `Y` est traitée comme une VOYELLE, sans analyse contextuelle.
 *
 * La règle « voyelle quand elle en fait fonction » demanderait un analyseur phonétique du français
 * — avec ses propres erreurs, sur un nom propre qui n'obéit pas forcément à la phonétique commune.
 * La règle est déclarée ici ET inscrite dans la sortie, pour qu'elle ne soit jamais devinée à la
 * lecture d'un résultat.
 */
export const VOYELLES = "aeiouy";

/**
 * Réduit un nom à ses lettres `a-z`.
 *
 * ⚠️ LES LIGATURES NE SE DÉCOMPOSENT PAS EN NFD — vérifié, ce n'est pas une précaution théorique :
 *
 *     'é' → NFD longueur 2 → 'e' après retrait des diacritiques   ✅
 *     'œ' → NFD longueur 1 → 'œ'                                   ❌ intacte
 *     'æ' → NFD longueur 1 → 'æ'                                   ❌
 *     'ß' → NFD longueur 1 → 'ß'                                   ❌
 *
 * Pour un lexique, une ligature non dépliée est sans conséquence. Ici on COMPTE des lettres :
 * un « œ » avalé par le filtre `a-z` retirerait DEUX lettres de la somme et changerait le nombre
 * d'expression, silencieusement. D'où l'expansion explicite, avant tout le reste.
 */
export function lettresDe(nom: string): string {
  return nom
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

/**
 * Table de PYTHAGORE — la table de la numérologie occidentale francophone (jamais la chaldéenne).
 *
 *     A B C D E F G H I     J K L M N O P Q R     S T U V W X Y Z
 *     1 2 3 4 5 6 7 8 9     1 2 3 4 5 6 7 8 9     1 2 3 4 5 6 7 8
 *
 * Écrite comme un calcul plutôt que comme une table de 26 entrées : une table se recopie de travers,
 * la périodicité de 9 ne se recopie pas.
 */
export function valeurLettre(lettre: string): number {
  const code = lettre.charCodeAt(0) - 97;
  if (code < 0 || code > 25) {
    throw new Error(`numerologie : « ${lettre} » n'est pas une lettre a-z normalisée`);
  }
  return (code % 9) + 1;
}

function sommeLettres(lettres: string): number {
  let somme = 0;
  for (const l of lettres) somme += valeurLettre(l);
  return somme;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les entrées et les sorties
// ══════════════════════════════════════════════════════════════════════════════════════════════

export interface EntreesNumerologie {
  /** ISO `AAAA-MM-JJ`. Obligatoire (FR-048). */
  readonly date: string;
  /**
   * Le nom complet DE NAISSANCE, **prénom inclus** (P13).
   *
   * `utilisatrice.prenom` n'entre JAMAIS dans un calcul : c'est une donnée d'adresse (comment Anam
   * la nomme). Concaténer les deux compterait le prénom deux fois — faux, et invisible.
   */
  readonly nomComplet?: string | null;
}

/**
 * Pourquoi un nombre n'a pas pu être calculé. Fermé : une raison libre finirait en texte d'excuse,
 * c'est-à-dire en prose, dans le module qui n'en porte aucune.
 */
export type RaisonNombreAbsent =
  /** Le nom complet n'a jamais été renseigné (FR-048 : il est optionnel). */
  | "nom_absent"
  /** Renseigné, mais aucune lettre exploitable (« --- », des chiffres seuls). Défaut de saisie. */
  | "nom_sans_lettre"
  /** Aucune voyelle : le nombre intime n'a rien à compter. */
  | "nom_sans_voyelle"
  /** Aucune consonne : le nombre de personnalité n'a rien à compter. */
  | "nom_sans_consonne";

/**
 * Une lecture est une UNION, pas un `number | undefined` — même raison qu'en 5.1 : avec un
 * optionnel, un `?? 0` quelque part transformerait une absence en résultat, et 0 n'est pas un
 * nombre numérologique valide mais il s'afficherait comme s'il l'était.
 */
export type LectureNombre =
  | { readonly statut: "calcule"; readonly valeur: number; readonly maitre: boolean }
  | { readonly statut: "non_calcule"; readonly raison: RaisonNombreAbsent };

export interface Numerologie {
  /** Version de FORME du document. */
  readonly schema: 1;
  /**
   * Les conventions employées, INSCRITES dans la sortie et jamais supposées. Deux écoles de
   * numérologie donnent des nombres différents pour la même personne (voir `cheminDeVie`) : sans
   * cette mention, un résultat serait invérifiable après coup.
   */
  readonly methodeCheminDeVie: "reduction_separee";
  readonly regleY: "voyelle";
  readonly basculeAnneePersonnelle: "premier_janvier";
  readonly anneeDeReference: number;
  readonly nombres: Readonly<Record<NomNombre, LectureNombre>>;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les calculs
// ══════════════════════════════════════════════════════════════════════════════════════════════

interface DateEclatee {
  readonly jour: number;
  readonly mois: number;
  readonly annee: number;
}

/**
 * Éclate `AAAA-MM-JJ` en trois entiers.
 *
 * ⚠️ Surtout PAS `new Date(chaine)` : `new Date("1970-11-28")` est interprété en UTC, et
 * `.getDate()` rendrait 27 pour quiconque vit à l'ouest de Greenwich. La date de naissance est une
 * date CIVILE, pas un instant — elle n'a pas de fuseau et ne doit jamais en traverser un.
 */
function eclaterDate(iso: string): DateEclatee {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) throw new Error("numerologie : date attendue au format AAAA-MM-JJ");
  const annee = Number(m[1]);
  const mois = Number(m[2]);
  const jour = Number(m[3]);
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || annee < 1) {
    throw new Error("numerologie : date hors bornes");
  }
  return { jour, mois, annee };
}

/**
 * LE CHEMIN DE VIE — par RÉDUCTION SÉPARÉE du jour, du mois et de l'année.
 *
 * ⚠️ IL EXISTE DEUX MÉTHODES ET ELLES DIVERGENT. L'autre — additionner tous les chiffres de la date
 * d'un seul coup — écrase les nombres maîtres apparus dans les sous-totaux. Aucune des deux ne
 * plante : elles rendent toutes les deux un nombre plausible.
 *
 *     28 novembre 1970
 *       séparée : jour 28→1 · mois 11→11 (maître conservé) · année 1970→17→8 · 1+11+8 = 20 → 2
 *       globale : 2+8+1+1+1+9+7+0 = 29 → 11
 *
 * Deux nombres sans rapport, pour la même personne. La réduction séparée est la convention
 * majoritaire de la numérologie francophone — celle qu'attend une utilisatrice qui a déjà croisé son
 * chemin de vie ailleurs. Le choix est inscrit dans `methodeCheminDeVie`.
 */
export function cheminDeVie(iso: string): number {
  const { jour, mois, annee } = eclaterDate(iso);
  return reduire(reduire(jour) + reduire(mois) + reduire(annee));
}

/** Le jour du mois, réduit. */
export function jourDeNaissance(iso: string): number {
  return reduire(eclaterDate(iso).jour);
}

/**
 * L'ANNÉE PERSONNELLE — jour + mois de naissance + année de référence, réduits à 1..9.
 *
 * Bascule au 1ᵉʳ JANVIER (convention majoritaire française), pas à l'anniversaire. C'est pourquoi le
 * paramètre est une année et non une date : il n'y a rien d'autre à savoir.
 */
export function anneePersonnelle(iso: string, anneeDeReference: number): number {
  if (!Number.isInteger(anneeDeReference) || anneeDeReference < 1) {
    throw new Error("numerologie : année de référence invalide");
  }
  const { jour, mois } = eclaterDate(iso);
  return reduireSansMaitre(reduire(jour) + reduire(mois) + reduireSansMaitre(anneeDeReference));
}

/** Toutes les lettres du nom complet de naissance. */
export function expression(nomComplet: string): number {
  const lettres = lettresDe(nomComplet);
  if (lettres.length === 0) throw new Error("numerologie : aucune lettre exploitable");
  return reduire(sommeLettres(lettres));
}

/** Les voyelles seules — `y` comprise (voir `VOYELLES`). */
export function intime(nomComplet: string): number {
  const voyelles = [...lettresDe(nomComplet)].filter((l) => VOYELLES.includes(l)).join("");
  if (voyelles.length === 0) throw new Error("numerologie : aucune voyelle");
  return reduire(sommeLettres(voyelles));
}

/** Les consonnes seules — donc `y` en est exclue (voir `VOYELLES`). */
export function personnalite(nomComplet: string): number {
  const consonnes = [...lettresDe(nomComplet)].filter((l) => !VOYELLES.includes(l)).join("");
  if (consonnes.length === 0) throw new Error("numerologie : aucune consonne");
  return reduire(sommeLettres(consonnes));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'assemblage
// ══════════════════════════════════════════════════════════════════════════════════════════════

function calcule(valeur: number): LectureNombre {
  return { statut: "calcule", valeur, maitre: estMaitre(valeur) };
}

function absent(raison: RaisonNombreAbsent): LectureNombre {
  return { statut: "non_calcule", raison };
}

/**
 * LE CALCUL COMPLET. Fonction pure : mêmes entrées ⇒ même sortie, toujours (FR-047, AC3).
 *
 * Aboutit TOUJOURS avec ce qui est disponible (FR-048/FR-049) : sans nom complet, les trois nombres
 * du nom passent en `non_calcule` avec leur raison, et les trois nombres de date aboutissent quand
 * même. C'est la même discipline que les corps absents du thème natal.
 */
export function calculerNumerologie(
  entrees: EntreesNumerologie,
  anneeDeReference: number,
): Numerologie {
  const nombres: Record<NomNombre, LectureNombre> = {
    chemin_de_vie: calcule(cheminDeVie(entrees.date)),
    jour_de_naissance: calcule(jourDeNaissance(entrees.date)),
    annee_personnelle: calcule(anneePersonnelle(entrees.date, anneeDeReference)),
    expression: absent("nom_absent"),
    intime: absent("nom_absent"),
    personnalite: absent("nom_absent"),
  };

  const brut = entrees.nomComplet?.trim() ?? "";
  if (brut.length > 0) {
    const lettres = lettresDe(brut);
    if (lettres.length === 0) {
      // Renseigné mais inexploitable : distinct de « jamais renseigné ». Les confondre ferait
      // passer un défaut de saisie pour un champ optionnel laissé vide, et personne n'irait voir.
      for (const n of NOMBRES_DU_NOM) nombres[n] = absent("nom_sans_lettre");
    } else {
      const voyelles = [...lettres].filter((l) => VOYELLES.includes(l));
      const consonnes = [...lettres].filter((l) => !VOYELLES.includes(l));
      nombres.expression = calcule(reduire(sommeLettres(lettres)));
      nombres.intime =
        voyelles.length > 0
          ? calcule(reduire(sommeLettres(voyelles.join(""))))
          : absent("nom_sans_voyelle");
      nombres.personnalite =
        consonnes.length > 0
          ? calcule(reduire(sommeLettres(consonnes.join(""))))
          : absent("nom_sans_consonne");
    }
  }

  return Object.freeze({
    schema: 1,
    methodeCheminDeVie: "reduction_separee",
    regleY: "voyelle",
    basculeAnneePersonnelle: "premier_janvier",
    anneeDeReference,
    nombres: Object.freeze(nombres),
  });
}
