import type { MessageIa, RequeteIa } from "@/lib/ai/port";
import { estTypeEnneagramme, type TypeEnneagramme } from "@/lib/domain/enneagramme";

/**
 * enneagramme-hypothese.ts — L'HYPOTHÈSE D'ANAM (Story 5.5, AC2 — FR-052/FR-006/AD-3). Module PUR
 * (AD-1) : zéro I/O, zéro horloge, zéro base. L'unique appel modèle vit dans
 * `lib/safety/hypothese-enneagramme-pipeline.ts`, jamais ici — même découpe que `retour-theme.ts`.
 *
 * ── LE MODÈLE NE RÉDIGE JAMAIS LA PHRASE : IL REND UN NUMÉRO ──────────────────────────────────
 *
 * L'AC2 dit « jamais assénée ». J'ai passé `"Tu es un 4."` et `"Ta blessure fondamentale est
 * l'abandon."` dans `chercherPredictions` ET `chercherInterdits` : les deux sont VERTS. Aucune garde
 * de ce dépôt ne regarde l'affirmation péremptoire au présent sur la personne. Tant que la phrase
 * vient du modèle, « jamais assénée » est une intention, pas une propriété.
 *
 * On transpose donc D1 de la 4.10 — « la forme est garantie par la forme des données, jamais par un
 * prompt » : le modèle rend UNE LIGNE, un numéro ou `aucun`, et la phrase est une CONSTANTE d'ici.
 * « Jamais assénée » devient alors testable sur la constante : forme interrogative, deux phrases,
 * les deux détecteurs vides, aucun impératif.
 *
 * ── DEUX PHRASES, ET LA PREMIÈRE NE NOMME AUCUN TYPE ──────────────────────────────────────────
 *
 * L'exemple de référence de la charte de voix porte LITTÉRALEMENT sur l'ennéagramme :
 *
 *   ⛔ « Ton type 2 t'empêche de dire non. »
 *   ✅ « Il y a un truc qui revient : tu dis oui, puis tu t'en veux. Ça te parle ? »
 *
 * La version acceptée ne nomme PAS le type. Et le produit ne peut pas nommer le motif observé à sa
 * place — ce serait au modèle de le rédiger, ce que D1 vient d'interdire. D'où la découpe :
 *
 *   `PHRASE_OUVERTURE_HYPOTHESE` — dans la conversation. Elle ouvre une porte, elle ne dit rien.
 *   `phraseHypothese(type)`      — à la halte, où il y a la place de dire ce que c'est.
 *
 * Conséquence directe, et c'est une décision : **le numéro ne franchit pas la frontière avec
 * l'ouverture**. La phrase du fil n'en a pas besoin, et la halte lit la ligne en base. Le mettre
 * dans le contrat de rendu fabriquerait une SECONDE source pour le même fait — la divergence R1-bis
 * que ce dépôt a déjà payée deux fois.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La décision : quand Anam a-t-elle quelque chose à proposer ?
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Les deux faits, et rien d'autre. Aucun compte, aucune date : le prédicat ne peut pas devenir une
 * jauge (FR-031), et il se teste sans base.
 */
export interface FaitsHypothese {
  /** Elle a déjà un type retenu — par le test ou par une hypothèse acceptée. */
  readonly aUnType: boolean;
  /** Anam a DÉJÀ proposé, une fois, quelle qu'ait été la réponse (en attente, acceptée, refusée). */
  readonly aDejaEteProposee: boolean;
}

/**
 * Anam propose-t-elle ? **Une seule fois dans la vie d'un compte**, et jamais si elle a déjà un type.
 *
 * ⚠️ « UNE SEULE FOIS » EST LA CLAUSE QUI COMPTE, et elle va plus loin que l'unicité en base. L'index
 * partiel de 0049 empêche DEUX hypothèses EN ATTENTE ; il n'empêche pas Anam de reproposer un autre
 * numéro le lendemain d'un refus. Or un refus veut dire « ce n'est pas moi » : y répondre en
 * proposant autre chose est exactement le message générique récurrent que FR-034 interdit — et le
 * plus agaçant de tous, celui qui se répète parce qu'il n'a pas été accepté.
 *
 * Ce qu'elle perd : Anam ne se ravise jamais, même six mois plus tard avec beaucoup plus de matière.
 * C'est assumé — le test court reste ouvert en permanence, et c'est un geste D'ELLE.
 */
export function momentDeProposer(faits: FaitsHypothese): boolean {
  return !faits.aUnType && !faits.aDejaEteProposee;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'appel au modèle
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE SUR DONNÉES RÉELLES, au même titre
 * qu'`INSTRUCTION_RECONCEPTUALISATION` et `INSTRUCTION_RETOUR_THEME`. On code la MACHINE (sortie
 * structurée → décision → écriture gardée) ; pas le JUGEMENT (ce qui fait qu'une parole ressemble à
 * un type plutôt qu'à un autre).
 *
 * L'instruction ne demande AUCUNE prose, et c'est ce qui rend la garde possible : il n'y a aucun
 * texte du modèle à filtrer, puisqu'il n'en produit pas. Le doute rend `aucun`, et le silence est
 * la bonne réponse par défaut — se tromper de type coûte une étiquette fausse posée sur quelqu'un.
 */
export const INSTRUCTION_HYPOTHESE_ENNEAGRAMME = [
  "[PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE SUR DONNÉES RÉELLES]",
  "Tu observes un échange, et rien d’autre. La question posée est celle-ci : ce que cette personne",
  "raconte d’elle-même — ce qui la met en mouvement, ce qu’elle évite, ce qu’elle répète — correspond-il",
  "de façon MANIFESTE à l’un des neuf types de l’ennéagramme ?",
  "Ne réponds par un numéro que si le motif est net et revient plusieurs fois. Un seul indice, une",
  "émotion passagère, ou une situation qui pourrait se lire de trois façons : ce n’est pas manifeste.",
  "Réponds UNIQUEMENT par cette ligne, sans aucun autre mot :",
  "TYPE_HYPOTHESE: (un chiffre de 1 à 9, ou `aucun`)",
  "En cas de doute, réponds `aucun`.",
].join("\n");

/**
 * Une ligne strictement conforme : un chiffre seul, ou `aucun`. Un mot qui traîne disqualifie tout.
 *
 * ⚠️ LA LEÇON EST CELLE DE `lireRetoursTheme`, ET ELLE A ÉTÉ PAYÉE. L'instruction dit « en cas de
 * doute, réponds `aucun` » — et un modèle fort répond en français naturel : « TYPE_HYPOTHESE: aucun,
 * mais si je devais choisir, ce serait plutôt le 4. » Un parser tolérant en tirerait `4`, et
 * poserait sur elle exactement l'étiquette que la réponse refusait de poser. Invisible (l'étage
 * tourne dans `after()`), et le germe est écrit avant que quiconque ait lu la sortie.
 */
const LIGNE_TYPE = /^\s*(?:[1-9]|aucun)\s*$/i;

/**
 * Lit la ligne `TYPE_HYPOTHESE: 4`. Scanne TOUTES les occurrences et retient la DERNIÈRE conforme —
 * la conclusion, patron `lireRetoursTheme` / `detecterReconceptualisation`. Absente, bavarde, hors
 * `1..9`, ou `aucun` → `null` : aucune hypothèse. Le doute n'étiquette personne.
 */
export function lireTypeHypothese(sortieModele: string): TypeEnneagramme | null {
  let derniere: string | null = null;
  for (const m of sortieModele.matchAll(/TYPE_HYPOTHESE\s*[:=]\s*([^\n\r]*)/gi)) derniere = m[1];
  if (derniere === null || !LIGNE_TYPE.test(derniere)) return null;
  // `aucun` → `NaN` → hors domaine → `null`. Aucun cas particulier à écrire, aucun à oublier.
  const n = Number.parseInt(derniere.trim(), 10);
  return estTypeEnneagramme(n) ? n : null;
}

/**
 * Construit la requête : passe FORTE séparée, sous egress art. 9 (`contientArt9: true`).
 * `capacite: "hypothese_enneagramme"` ⇒ tier fort résolu par la politique unique (AD-5).
 *
 * Aucune donnée du socle n'entre ici — ni thème natal, ni numérologie, ni nom de branche. Ce qui
 * part, ce sont les messages de l'échange, qui transitent déjà légitimement sous l'egress.
 */
export function requeteHypotheseEnneagramme(messages: MessageIa[]): RequeteIa {
  return {
    capacite: "hypothese_enneagramme",
    messages: [{ role: "system", content: INSTRUCTION_HYPOTHESE_ENNEAGRAMME }, ...messages],
    contientArt9: true,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les deux phrases — CONSTANTES, déterministes, jamais un modèle
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Ce qu'Anam dit DANS LE FIL. Elle ouvre une porte, elle ne dit rien de ce qu'il y a derrière.
 *
 * Trois tentations écartées :
 *   • nommer le type ici — ce serait l'asséner au milieu d'une conversation, sans le contexte ni la
 *     place de répondre autrement que par oui ;
 *   • décrire le motif observé — seul le modèle pourrait le rédiger, ce que D1 interdit ;
 *   • « j'ai remarqué que tu... » — un constat sur elle, donc un début de verdict.
 *
 * Une question, et un geste qui mène quelque part : sans le second, une invitation devient un
 * reproche (leçon 4.10).
 */
export const PHRASE_OUVERTURE_HYPOTHESE =
  "Il y a une chose qui revient souvent dans ce que tu me racontes. Ça me donne une idée — tu veux la voir ?";

/**
 * Ce qu'Anam dit À LA HALTE, une fois le type sous les yeux.
 *
 * La forme est celle de la charte : une observation prudente, puis une question qui rend la main.
 * Jamais « tu es un 4 », jamais « ton type t'empêche de », jamais un trait de caractère — ni ici,
 * ni nulle part : l'interprétation vit dans `lib/corpus/enneagramme.ts`, sous le balayage du
 * détecteur de prédiction et du lexique interdit, et elle est écrite par Anima.
 *
 * ⚠️ « ce qu'on appelle » n'est pas une précaution de style : c'est ce qui fait du numéro un NOM
 * EXTÉRIEUR — une grille qu'on lui présente — plutôt qu'une propriété d'elle qu'on aurait mesurée.
 */
export function phraseHypothese(type: TypeEnneagramme): string {
  return (
    `Ce qui revient chez toi ressemble à ce qu’on appelle le type ${type}. ` +
    `Est-ce que ça te parle ?`
  );
}
