import { corpus, lireTexte, NON_ECRIT, type Corpus, type TexteCorpus } from "./port";
import { normaliserTexte } from "../domain/normalisation-texte";
import { CLES_JEU, type CleCarteJeu } from "../tirage/jeu";

/**
 * description-cartes.ts — CE QUI EST DESSINÉ SUR CHAQUE CARTE (Story 5.7, AC8 · FR-018, NFR-016).
 *
 * ── LE PROBLÈME QUE CE FICHIER RÉSOUT ──────────────────────────────────────────────────────────
 *
 * L'UX est catégorique : tant que l'utilisatrice n'a pas répondu, « AUCUNE signification n'est
 * affichée nulle part — pas de nom de carte, pas de mot-clé, pas d'infobulle ».
 *
 * Mais une image sans texte alternatif est une faute d'accessibilité, et une utilisatrice au lecteur
 * d'écran ne peut pas projeter sur une image qu'on ne lui décrit pas. La question « qu'est-ce que tu
 * vois ? » n'a aucun sens si elle ne peut rien voir.
 *
 * La sortie n'est pas de choisir entre les deux — c'est de voir que DÉCRIRE N'EST PAS SIGNIFIER.
 *
 * Ce que voit l'utilisatrice voyante, c'est un dessin : *une porte entrouverte dans un mur de pierre,
 * au crépuscule*. Ce n'est pas un sens ; c'est la MATIÈRE sur laquelle elle projette. Le texte
 * alternatif doit lui être strictement équivalent : la même matière, dans l'autre canal.
 *
 * Sans la garde ci-dessous, la première description écrite par distraction dirait « le passage vers
 * une nouvelle étape » — et le lecteur d'écran recevrait LA LECTURE avant d'avoir eu la carte. Ce
 * serait une violation de FR-018 déguisée en accessibilité, c'est-à-dire la pire espèce : celle
 * qu'on défend avec de bonnes intentions.
 *
 * ── CES 21 TEXTES NE SONT PAS D'ANIMA, ET C'EST POURQUOI ILS SONT COMPTÉS À PART ───────────────
 *
 * FR-054 réserve à Anima les textes d'INTERPRÉTATION. Une description littérale n'en est pas une :
 * elle se rédige avec le visuel, par qui le produit, en regardant l'image. Les mêler aux 165 créneaux
 * d'Anima corromprait le seul chiffre qui dit où en est la porte pré-lancement d'écriture.
 * `tests/corpus-architecture.test.ts` les inventorie donc séparément.
 *
 * Le SENS des cartes, lui, est bien d'Anima — et il vit ailleurs, sous `server-only`
 * (`lib/lecture/sens-cartes.ts`). Les deux tables ne se rejoignent jamais.
 */

/** Clé de créneau : `"description:<clé de carte>"`. */
export const cleDescription = (carte: CleCarteJeu): string => `description:${carte}`;

/** Les 21 créneaux, DÉRIVÉS du jeu — jamais recopiés (une liste recopiée diverge à la première carte ajoutée). */
export const CORPUS_DESCRIPTION_CARTES: Corpus = corpus(
  "description-cartes",
  Object.fromEntries(CLES_JEU.map((carte) => [cleDescription(carte), NON_ECRIT])),
);

/** La description littérale d'une carte — le texte alternatif de son visuel. */
export function lireDescriptionCarte(carte: CleCarteJeu): TexteCorpus {
  return lireTexte(CORPUS_DESCRIPTION_CARTES, cleDescription(carte));
}

/**
 * ── RELIRE UNE ARCHIVE (revue Epic 5, R1) ──────────────────────────────────────────────────────
 *
 * ⚠️ `lireDescriptionCarte` JETTE sur une clé non déclarée, et c'est juste AU DÉPÔT : le tirage
 * puise dans le jeu courant, donc une clé inconnue y est un défaut de code qui doit crier. C'est
 * FAUX à la RELECTURE : une lecture close en juillet porte la carte du jeu de juillet, et la 5.10
 * a retiré des cartes du jeu. Le compilateur ne pouvait rien dire — `app/lectures/page.tsx` passait
 * `l.carte as CleCarteJeu`, un transtypage qui affirme précisément ce qui est faux.
 *
 * Ce que ça donnait : UNE ligne d'archive sur une carte retirée, et la halte « Mes lectures »
 * ENTIÈRE tombait — pas la ligne, la page. Toutes ses autres lectures avec elle.
 *
 * Une carte retirée d'un jeu n'est pas un défaut de code : c'est une décision de produit, prise
 * après coup, sur une trace qu'on lui a promis de garder. Elle rend donc `NON_ECRIT` — exactement
 * ce que rendent aujourd'hui les 21 cartes du jeu courant, dont aucune description n'est écrite.
 * Le chemin est donc éprouvé à chaque affichage, et le rendu sait déjà le traverser sans inventer
 * un visuel d'emprunt (FR-022) ni nommer la carte (FR-018).
 */
export function lireDescriptionCarteArchivee(carte: string): TexteCorpus {
  return Object.hasOwn(CORPUS_DESCRIPTION_CARTES.textes, cleDescription(carte as CleCarteJeu))
    ? lireDescriptionCarte(carte as CleCarteJeu)
    : NON_ECRIT;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La garde : une description décrit, elle ne signifie pas
// ══════════════════════════════════════════════════════════════════════════════════════════════

export type FamilleSens = "signification" | "adresse";

export interface SensTrouve {
  famille: FamilleSens;
  /** Le fragment réellement matché — pour un message d'échec qui cite sa preuve. */
  terme: string;
}

/**
 * Motifs appliqués au texte NORMALISÉ (donc écrits sans accent et en minuscules — même convention
 * que `lexique-interdit.ts`, dont la normalisation est partagée).
 *
 * ── DEUX CHOIX QUI SE DISCUTENT, ET QUI SONT ASSUMÉS ───────────────────────────────────────────
 *
 * 1. **« représente » est rejeté**, alors que « le dessin représente une barque » est du français
 *    parfaitement descriptif. C'est délibéré : un texte alternatif ne s'annonce pas comme une image
 *    (« Image de… », « Le dessin représente… ») — il donne directement ce qu'on voit. Le rejet force
 *    « Une barque échouée sur des galets », qui est meilleur comme description ET plus court à
 *    entendre. La garde améliore ici l'écriture au lieu de seulement l'interdire.
 *
 * 2. **La deuxième personne est rejetée** (famille `adresse`). Une description n'a aucune raison de
 *    s'adresser à quelqu'un ; « tu es à un carrefour » n'est pas une description de carrefour, c'est
 *    une lecture. C'est la forme la plus probable de la dérive, parce qu'elle se glisse sans qu'on
 *    remarque avoir changé de registre.
 */
const MOTIFS_SENS: readonly { famille: FamilleSens; motif: RegExp }[] = [
  // Les verbes de signification. Racines volontairement courtes : elles attrapent toutes les
  // conjugaisons ET les substantifs dérivés (« symbolique », « signification », « suggestion »).
  { famille: "signification", motif: /\bsymboli\w*/g },
  { famille: "signification", motif: /\bsignifi\w*/g },
  { famille: "signification", motif: /\brepresent\w*/g },
  { famille: "signification", motif: /\bevoqu\w*/g },
  { famille: "signification", motif: /\bannonc\w*/g },
  { famille: "signification", motif: /\bsugg\w*/g },
  { famille: "signification", motif: /\bincarn\w*/g },
  { famille: "signification", motif: /\bmetaphor\w*/g },
  { famille: "signification", motif: /\ballegori\w*/g },
  // Les locutions. Elles échappent aux racines parce qu'elles sont bâties sur des verbes ordinaires :
  // c'est le COMPLÉMENT qui les rend signifiantes, donc le motif doit porter sur les deux mots.
  { famille: "signification", motif: /\bve(?:ut|ulent) dire\b/g },
  { famille: "signification", motif: /\binvit\w* a\b/g },
  { famille: "signification", motif: /\brenvoi\w* a\b/g },
  { famille: "signification", motif: /\bparl\w* de\b/g },
  // L'adresse à la deuxième personne.
  { famille: "adresse", motif: /\b(?:tu|toi|ton|ta|tes|vous|votre|vos)\b/g },
];

/**
 * Cherche, dans une description, ce qui relève du SENS plutôt que de ce qui est dessiné.
 *
 * Rend la liste des fragments fautifs (vide = conforme). Une liste plutôt qu'un booléen : le message
 * d'échec doit pouvoir citer le mot, sinon la personne qui corrige cherche à l'aveugle.
 */
export function chercherSensDansDescription(texte: string): SensTrouve[] {
  const trouvailles: SensTrouve[] = [];
  const norm = normaliserTexte(texte);
  for (const { famille, motif } of MOTIFS_SENS) {
    for (const m of norm.matchAll(motif)) {
      trouvailles.push({ famille, terme: m[0] });
    }
  }
  return trouvailles;
}
