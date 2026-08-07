import "server-only";
import type { MotifCourriel, MotifLegal } from "@/lib/courriel/port";
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
  const desabonnement = `${origine}/desabonnement?j=${jeton}`;
  const lienUnClic = `${origine}/api/desabonnement?j=${jeton}`;
  const pied = ["", "— Anam", "", "Pour ne plus recevoir ces messages :", desabonnement];

  if (motif === "synthese_prete") {
    return {
      objet: "Ta synthèse est prête",
      texte: [
        "Bonjour,",
        "",
        // « dans le menu de compte » a été retiré : ce menu n'existe pas. Un courriel qui décrit une
        // interface imaginaire fait douter la lectrice d'elle-même avant de la faire douter du produit.
        "Ta synthèse est prête. Elle t'attend dans l'application :",
        "",
        `${origine}/synthese`,
        ...pied,
      ].join("\n"),
      lienUnClic,
    };
  }

  if (motif === "echeance_intention") {
    // ── STORY 4.10 (AC3) — CE QUE CE TEXTE NE DIT PAS, ET POURQUOI ────────────────────────────────────
    //
    // Ni le « si », ni le « alors », ni le nom de la branche, ni combien d'échéances tombent aujourd'hui.
    // NFR-015 : l'objet paraît sur un écran verrouillé, potentiellement devant quelqu'un d'autre. « Tu as
    // dit que si tu sentais la boule au ventre, tu appellerais ta sœur » est exactement le genre de
    // phrase qui ne doit jamais apparaître là — et la signature du port fait qu'on ne PEUT pas l'écrire :
    // il n'existe aucun paramètre où la mettre.
    //
    // Le texte porte donc UNIQUEMENT le fait, et le fait est déjà tout ce qui compte : elle s'est fixé un
    // rendez-vous avec elle-même, et c'est aujourd'hui.
    //
    // « que tu as fixée » n'est pas une politesse. C'est la différence entre un rappel et une injonction :
    // le produit ne lui a rien demandé, il lui rend ce qu'elle a posé. Aucun « n'oublie pas », aucun
    // « pense à », aucun point d'exclamation — la charte §6 interdit le décret, et un rappel d'échéance
    // est l'endroit où l'on glisse vers l'injonction sans s'en apercevoir.
    return {
      objet: "Une échéance, aujourd'hui",
      texte: [
        "Bonjour,",
        "",
        "Une échéance que tu as fixée arrive aujourd'hui. Elle t'attend dans l'application :",
        "",
        `${origine}/`,
        ...pied,
      ].join("\n"),
      lienUnClic,
    };
  }

  // Motif hors de l'ensemble fermé — ce que le type interdit, mais qu'un `as` ou une désérialisation
  // peut produire. L'adaptateur refuse alors d'envoyer.
  return null;
}

/**
 * Story 3.5 — LE GABARIT LÉGAL. Une fonction séparée, sans `jeton` et sans `lienUnClic`.
 *
 * ── CE QU'IL N'A PAS, ET POURQUOI L'ABSENCE EST LE POINT ────────────────────────────────────────────────
 *
 * Pas de pied de désabonnement. Le pied de `gabaritPour` promet « pour ne plus recevoir ces messages » —
 * une promesse tenable pour une synthèse, intenable ici : l'information avant reconduction tacite est due
 * (art. L215-1 C. consommation), et elle repartira l'an prochain quoi qu'elle clique. Offrir le lien
 * quand même serait mentir poliment ; et le mensonge serait découvert exactement au moment où elle
 * recevrait le courriel suivant.
 *
 * Pas d'en-têtes `List-Unsubscribe` non plus, pour la même raison — RFC 8058 vise le courrier en volume,
 * pas le transactionnel. Un bouton « Se désabonner » affiché par Gmail à côté de l'expéditeur ferait la
 * même promesse, en plus visible.
 *
 * ── CE QU'IL DIT, ET CE QU'IL NE DIT PAS ────────────────────────────────────────────────────────────────
 *
 * L'objet reste neutre (NFR-015) : il paraît sur un écran verrouillé. « Ton abonnement Anam va être
 * reconduit » nomme déjà un produit et une dépense devant qui regarde par-dessus l'épaule.
 *
 * Le texte NE PORTE NI LA DATE NI LE MONTANT — pas par prudence de registre, mais parce qu'ils ne peuvent
 * pas être écrits ici : la table est constante et ses deux seuls trous sont typés nominalement. Les
 * interpoler rouvrirait le paramètre libre que toute la 4.9 a servi à fermer. Ils sont sur la page, qui
 * est derrière une authentification — c'est-à-dire au seul endroit où ils regardent quelqu'un.
 *
 * Le chemin de résiliation est nommé DANS le courriel : prévenir quelqu'un d'une reconduction sans lui
 * dire où l'arrêter serait le respect de la lettre contre l'esprit.
 */
export function gabaritLegalPour(motif: MotifLegal, origine: Origine): Gabarit | null {
  if (motif === "reconduction_a_venir") {
    return {
      objet: "Ton abonnement va se renouveler",
      texte: [
        "Bonjour,",
        "",
        "Ton abonnement Anam arrive à échéance et sera reconduit automatiquement.",
        "La date et le montant sont dans l'application :",
        "",
        `${origine}/abonnement`,
        "",
        "Tu peux résilier depuis cette même page, en quelques secondes, quand tu veux.",
        "",
        "— Anam",
      ].join("\n"),
      // Le champ existe pour satisfaire `Gabarit`, mais l'adaptateur NE POSE PAS l'en-tête sur ce chemin.
      // Il pointe vers la page d'abonnement : si quelqu'un l'utilisait un jour, il mènerait au vrai geste
      // (résilier) plutôt qu'à une préférence d'envoi qui n'existe pas pour ce courriel.
      lienUnClic: `${origine}/abonnement`,
    };
  }
  return null;
}

/** L'expéditeur affiché. « Anam » seul : ni « Anima », ni un mot du registre ésotérique (NFR-015). */
export const EXPEDITEUR_NOM = "Anam";
