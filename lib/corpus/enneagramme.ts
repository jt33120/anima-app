import { corpus, lireTexte, NON_ECRIT, type Corpus, type TexteCorpus } from "./port";
import { TYPES, type ResultatTest, type TypeEnneagramme } from "../domain/enneagramme";

/**
 * enneagramme.ts — LES NEUF INTERPRÉTATIONS DE TYPE (Story 5.5, AC1 — FR-054).
 *
 * Quatrième corpus du produit, après la numérologie (69 créneaux), les mantras (60) et l'horoscope
 * (27). Même port, même format de clé `"<domaine>:<valeur>"` — décidé une fois en 5.2, où le
 * commentaire réservait déjà nommément la place de celui-ci.
 *
 * ⚠️ CE FICHIER NE CONTIENT AUCUN TEXTE, ET C'EST LA SEULE FORME CONFORME. Les neuf créneaux sont
 * DÉCLARÉS et tous `non_ecrit`. Les remplir nous-mêmes signerait du nom d'une personne réelle un
 * texte qu'elle n'a pas écrit (FR-086) ; les faire générer par un modèle serait la même faute en
 * pire (FR-047/FR-054). L'écran de résultat dit donc honnêtement qu'Anima ne l'a pas encore écrit —
 * exactement comme le socle annonce ce qu'il ne peut pas calculer sans l'heure de naissance.
 *
 * ══ NEUF, ET PAS UN DE PLUS ══════════════════════════════════════════════════════════════════════
 *
 * Ailes (18), instincts (27), flèches (18), croisement complet (54) : chacun est un produit
 * cartésien sur les neuf types. La 5.4 a écrit la règle en refusant les siens — on garde l'axe
 * qu'une personne identifie comme ELLE, on refuse le croisement. Et contrairement au mantra, le
 * texte est lu UNE FOIS, pas chaque matin : aucun cycle de rotation n'est nécessaire.
 *
 * Ajouter des clés plus tard ne casse rien et l'inventaire de complétude suit — mais on part d'ici.
 */

/** Le nombre de types. Nommé plutôt qu'écrit en dur : l'inventaire s'y adosse. */
export const CARDINAL_ENNEAGRAMME = 9;

/**
 * La clé d'un créneau : `"enneagramme:4"`.
 *
 * JETTE hors domaine, comme `cleMantra` et `cleNombre`. Une clé fabriquée à partir d'un type
 * invalide n'est pas une absence de texte, c'est un défaut de code — et `lireTexte` la refuserait
 * de toute façon, plus loin et moins clairement.
 */
export function cleEnneagramme(type: number): string {
  if (!Number.isInteger(type) || type < 1 || type > CARDINAL_ENNEAGRAMME) {
    throw new Error(`corpus ennéagramme : type hors domaine (${type}) — attendu 1..${CARDINAL_ENNEAGRAMME}`);
  }
  return `enneagramme:${type}`;
}

/** Les neuf clés, dans l'ordre des types. Exportée pour rendre la complétude mesurable. */
export const CLES_ENNEAGRAMME: readonly string[] = Object.freeze(TYPES.map((t) => `enneagramme:${t}`));

/**
 * ⚠️ TOUS LES CRÉNEAUX SONT `NON_ECRIT`. La table se construit depuis `CLES_ENNEAGRAMME` plutôt
 * qu'en neuf lignes recopiées : une liste écrite à la main finirait par diverger de la source.
 *
 * Anima écrit en remplaçant une entrée :
 *
 *     [cleEnneagramme(4)]: ecrit("…"),
 */
export const CORPUS_ENNEAGRAMME: Corpus = corpus(
  "enneagramme",
  Object.fromEntries(CLES_ENNEAGRAMME.map((cle) => [cle, NON_ECRIT])),
);

/**
 * L'interprétation d'un type retenu.
 *
 * ⚠️ REND `null` QUAND IL N'Y A PAS DE TYPE, et c'est la troisième valeur qui compte. Le port ne
 * connaît que `ecrit` et `non_ecrit` ; ici il faut distinguer « Anima ne l'a pas encore écrit » de
 * « il n'y a rien à écrire, parce qu'aucun type n'a été retenu ». Confondre les deux ferait dire au
 * produit « ce texte n'est pas encore écrit » à quelqu'un dont le test n'a désigné personne — une
 * promesse de texte à venir, là où le résultat est un ex æquo qu'on lui doit d'expliquer.
 *
 * C'est la signature de jonction de la 5.2, à l'identique (`texteDe(nombre, lecture)`).
 */
export function texteDuType(resultat: ResultatTest): TexteCorpus | null {
  if (resultat.statut !== "retenu") return null;
  return lireTexte(CORPUS_ENNEAGRAMME, cleEnneagramme(resultat.type));
}

/** Variante directe, pour un type déjà retenu et relu depuis la base. */
export function texteDuTypeRetenu(type: TypeEnneagramme): TexteCorpus {
  return lireTexte(CORPUS_ENNEAGRAMME, cleEnneagramme(type));
}
