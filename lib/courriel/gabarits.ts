import "server-only";
import type { MotifCourriel } from "@/lib/courriel/port";
import type { JetonDesabonnement } from "@/lib/domain/jeton-desabonnement";
import type { Origine } from "@/lib/courriel/origine";

/**
 * Story 4.9 — LES GABARITS, table CONSTANTE et fermée (FR-035, NFR-015).
 *
 * Tout est ici en clair, et c'est le but : ce fichier est le seul endroit du dépôt où l'on peut lire, en
 * une page, l'intégralité de ce qui sortira jamais du produit vers un serveur de messagerie. Un test le
 * vérifie mot à mot — parce que ces textes-là, contrairement à ceux du modèle, EXISTENT en source et sont
 * donc prouvables.
 *
 * ── DEUX TROUS, ET PAS UN DE PLUS (revue T5-1 / T5-2) ──────────────────────────────────────────────────
 *
 * La règle d'origine était « aucune interpolation, aucun `${}` », et une garde textuelle la vérifiait.
 * Elle a dû céder deux fois, pour deux raisons qu'aucune astuce n'évite : l'hôte ne peut pas être écrit
 * en dur (il l'était, et le domaine est en vente — cf. `origine.ts`), et un lien de désabonnement qui ne
 * désigne personne ne désabonne personne.
 *
 * La propriété est donc maintenue AUTREMENT, et plus solidement qu'elle ne l'était : les deux trous sont
 * TYPÉS NOMINALEMENT (`Origine`, `JetonDesabonnement`). On ne peut y verser ni une chaîne quelconque, ni
 * une valeur venue du journal, ni un fragment de synthèse — les seuls constructeurs de ces types valident
 * une URL et un uuid. Ce qui reste vrai mot pour mot : hors ces deux valeurs, tout ce qui part est écrit
 * ci-dessous, visible d'un coup d'œil, et asséré par test sur le texte RENDU.
 *
 * ── CE QUE LE TEXTE NE FAIT PAS ────────────────────────────────────────────────────────────────────────
 *
 * Aucun registre ésotérique, aucune intimité dans l'objet (NFR-015 : « nom, icône et aperçus de
 * notification ne révèlent ni l'intimité du contenu ni un registre ésotérique »). L'objet apparaît sur un
 * écran verrouillé, potentiellement devant quelqu'un d'autre.
 *
 * Le lien pointe vers la halte, pas vers la synthèse : ouvrir demande d'être connectée. Un lien qui
 * afficherait le contenu sans authentification serait une fuite d'art. 9 par URL.
 *
 * Et il n'invite plus à RÉPONDRE. La phrase « réponds à ce courriel » ouvrait un canal art. 9 ENTRANT —
 * vers une boîte ordinaire, hors RLS, hors ZDR — pour une boîte qui d'ailleurs n'existait pas.
 */

export interface Gabarit {
  readonly objet: string;
  readonly texte: string;
  /** Cible du désabonnement en UN CLIC (RFC 8058, en-tête `List-Unsubscribe`) — accepte un POST. */
  readonly lienUnClic: string;
}

export interface Adresses {
  readonly origine: Origine;
  readonly jeton: JetonDesabonnement;
}

/**
 * Rend le gabarit du motif, ou `null` si le motif est hors de l'ensemble fermé — ce que le type interdit,
 * mais qu'un `as` ou une désérialisation peut produire. L'adaptateur refuse alors d'envoyer.
 */
export function gabaritPour(motif: MotifCourriel, { origine, jeton }: Adresses): Gabarit | null {
  if (motif !== "synthese_prete") return null;

  const halte = `${origine}/synthese`;
  const desabonnement = `${origine}/desabonnement?j=${jeton}`;

  return {
    objet: "Ta synthèse est prête",
    texte: [
      "Bonjour,",
      "",
      // « dans le menu de compte » a été retiré : ce menu n'existe pas. Un courriel qui décrit une
      // interface imaginaire fait douter la lectrice d'elle-même avant de la faire douter du produit.
      "Ta synthèse est prête. Elle t'attend dans l'application :",
      "",
      halte,
      "",
      "— Anam",
      "",
      "Pour ne plus recevoir ces messages :",
      desabonnement,
    ].join("\n"),
    lienUnClic: `${origine}/api/desabonnement?j=${jeton}`,
  };
}

/** L'expéditeur affiché. « Anam » seul : ni « Anima », ni un mot du registre ésotérique (NFR-015). */
export const EXPEDITEUR_NOM = "Anam";
