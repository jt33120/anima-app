import "server-only";
import type { MotifCourriel } from "@/lib/courriel/port";

/**
 * Story 4.9 — LES GABARITS, table CONSTANTE et fermée (FR-035, NFR-015).
 *
 * Tout est ici en clair, et c'est le but : ce fichier est le seul endroit du dépôt où l'on peut lire, en
 * une page, l'intégralité de ce qui sortira jamais du produit vers un serveur de messagerie. Un test
 * statique le vérifie mot à mot — parce que ces textes-là, contrairement à ceux du modèle, EXISTENT en
 * source et sont donc prouvables.
 *
 * Les deux règles, et elles se voient à l'œil nu :
 *   • aucune interpolation, aucun `${}`, aucune variable — un gabarit qui accepterait une valeur serait
 *     un gabarit par lequel de l'art. 9 pourrait sortir ;
 *   • aucun registre ésotérique et aucune intimité dans l'objet (NFR-015 : « nom, icône et aperçus de
 *     notification ne révèlent ni l'intimité du contenu ni un registre ésotérique »). L'objet apparaît
 *     sur un écran verrouillé, potentiellement devant quelqu'un d'autre.
 *
 * Le lien pointe vers la halte, pas vers la synthèse : ouvrir demande d'être connectée. Un lien qui
 * afficherait le contenu sans authentification serait une fuite d'art. 9 par URL.
 */

export interface Gabarit {
  readonly objet: string;
  readonly texte: string;
}

const LIEN = "https://anima.app/synthese";

export const GABARITS: Readonly<Record<MotifCourriel, Gabarit>> = {
  synthese_prete: {
    objet: "Ta synthèse est prête",
    texte: [
      "Bonjour,",
      "",
      "Ta synthèse est prête. Elle t'attend dans l'application, dans le menu de compte.",
      "",
      LIEN,
      "",
      "— Anam",
      "",
      "Pour ne plus recevoir ces messages, réponds à ce courriel.",
    ].join("\n"),
  },
};

/** L'expéditeur affiché. « Anam » seul : ni « Anima », ni un mot du registre ésotérique (NFR-015). */
export const EXPEDITEUR_NOM = "Anam";
