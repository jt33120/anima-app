import "server-only"; // AC4 : « aucune représentation côté client » devient un ÉCHEC DE BUILD.
import { corpus, lireTexte, NON_ECRIT, type Corpus, type TexteCorpus } from "@/lib/corpus/port";
import { CLES_JEU, type CleCarteJeu } from "@/lib/tirage/jeu";

/**
 * sens-cartes.ts — LE CATALOGUE DE SENS DES 24 CARTES (Story 5.7, FR-016 / FR-018 · AD-11).
 *
 * ── POURQUOI CE CORPUS N'EST PAS DANS `lib/corpus/` ────────────────────────────────────────────
 *
 * Les cinq corpus du socle (numérologie, mantras, horoscope, ennéagramme, descriptions) vivent dans
 * `lib/corpus/`, et `tests/corpus-architecture.test.ts` y interdit `server-only` : un corpus du socle
 * est une CONSTANTE partagée, que le rendu peut lire.
 *
 * Celui-ci est l'exact inverse. Toute sa valeur tient à ce qu'il NE FRANCHISSE JAMAIS la frontière
 * client. Le poser dans `lib/corpus/` aurait obligé à percer une exception dans une garde saine —
 * et une garde à exceptions finit par n'en être plus une. Il vit donc dans `lib/lecture/`, avec le
 * rituel qu'il sert, et il porte `server-only`.
 *
 * Ce que ça change concrètement : AC4 (« le catalogue n'a aucune représentation côté client ») n'est
 * pas vérifié par un test qu'on pourrait oublier de lancer, mais par le BUILD, qui échoue si un
 * composant client l'importe, même transitivement, même par accident.
 *
 * Il reste balayé par les gardes de contenu — voix (Story 2.8, qui ratisse `lib/` en récursif) et
 * prédiction/lexique (FR-053, par chemin explicite dans `tests/corpus-architecture.test.ts`) — et
 * compté à part dans l'inventaire de la porte pré-lancement.
 *
 * ── LA CONTRADICTION APPARENTE AVEC FR-018, TRANCHÉE EXPLICITEMENT ─────────────────────────────
 *
 * FR-018 : « la lecture se construit à partir de la projection de l'utilisatrice, PAS d'une
 * signification cataloguée ». AD-11 : « le catalogue de sens n'existe que côté serveur ». Donc il
 * existe, et il ne fonde pas la lecture. Les deux sont vrais, et il faut trancher explicitement —
 * sinon quelqu'un tranchera par accident.
 *
 * La 5.7 fait UNE chose : elle déclare le catalogue et prouve qu'il ne traverse pas. Le rôle exact
 * qu'Anam lui donne — et surtout l'ORDRE, jamais avant qu'elle ait parlé — est une décision de la
 * 5.8, où il y aura une conversation pour l'incarner. Trancher ici serait trancher à l'aveugle.
 *
 * Ce qui est acquis dès maintenant, et ne se rediscutera pas : le catalogue ne PRÉCÈDE jamais la
 * projection, et le tireur ne le voit pas (verrou ESLint sur `lib/tirage/**`).
 *
 * ── VINGT-QUATRE CRÉNEAUX DÉCLARÉS, AUCUN ÉCRIT ────────────────────────────────────────────────
 *
 * Même forme et même raison que les cinq autres corpus : ces textes sont d'Anima, et de personne
 * d'autre (FR-054, FR-086). Les écrire nous-mêmes en ferait du texte générique repris — ce que
 * FR-054 bannit — signé du nom d'une personne réelle. Les faire générer serait la même faute en
 * pire (FR-047).
 */

/** Clé de créneau : `"carte:<clé de carte>"`, même format que les cinq autres corpus (décidé en 5.2). */
export const cleSens = (carte: CleCarteJeu): string => `carte:${carte}`;

/**
 * Les 24 créneaux, DÉRIVÉS du jeu — jamais recopiés.
 *
 * La dérivation n'est pas de la coquetterie : une liste recopiée diverge à la première carte
 * ajoutée, et le créneau manquant serait indiscernable d'un créneau non écrit. `lireSensCarte`
 * jetterait alors sur une carte parfaitement valide, en production, au moment d'une lecture.
 */
export const CORPUS_SENS_CARTES: Corpus = corpus(
  "sens-cartes",
  Object.fromEntries(CLES_JEU.map((carte) => [cleSens(carte), NON_ECRIT])),
);

/**
 * Le sens d'une carte — côté serveur uniquement, et jamais avant qu'elle ait parlé (FR-017/FR-018).
 *
 * La signature prend une `CleCarteJeu` et non une `string` : une faute de frappe devient une erreur
 * de compilation plutôt qu'un `lireTexte` qui jette à l'exécution.
 */
export function lireSensCarte(carte: CleCarteJeu): TexteCorpus {
  return lireTexte(CORPUS_SENS_CARTES, cleSens(carte));
}
