import "server-only";
import type { MotifCourriel, InformationLegale } from "@/lib/courriel/port";
import { PRIX_ABONNEMENT_ANNUEL_CENTIMES } from "@/lib/stripe/config";
import type { JetonDesabonnement } from "@/lib/domain/jeton-desabonnement";
import type { Origine } from "@/lib/courriel/origine";

/**
 * Story 4.9 — LES GABARITS, table CONSTANTE et fermée (FR-035, NFR-015).
 *
 * Tout est ici en clair, et c’est le but : ce fichier est le seul endroit du dépôt où l’on peut lire, en
 * une page, l’intégralité de ce qui sortira jamais du produit vers un serveur de messagerie. Un test le
 * vérifie mot à mot — parce que ces textes-là, contrairement à ceux du modèle, EXISTENT en source et sont
 * donc prouvables.
 *
 * ── DEUX TROUS, ET PAS UN DE PLUS (revue T5-1 / T5-2) ──────────────────────────────────────────────────
 *
 * La règle d’origine était « aucune interpolation, aucun `${}` », et une garde textuelle la vérifiait.
 * Elle a dû céder deux fois, pour deux raisons qu’aucune astuce n’évite : l’hôte ne peut pas être écrit
 * en dur (il l’était, et le domaine est en vente — cf. `origine.ts`), et un lien de désabonnement qui ne
 * désigne personne ne désabonne personne.
 *
 * La propriété est donc maintenue AUTREMENT, et plus solidement qu’elle ne l’était : les deux trous sont
 * TYPÉS NOMINALEMENT (`Origine`, `JetonDesabonnement`). On ne peut y verser ni une chaîne quelconque, ni
 * une valeur venue du journal, ni un fragment de synthèse — les seuls constructeurs de ces types valident
 * une URL et un uuid. Ce qui reste vrai mot pour mot : hors ces deux valeurs, tout ce qui part est écrit
 * ci-dessous, visible d’un coup d'œil, et asséré par test sur le texte RENDU.
 *
 * ── CE QUE LE TEXTE NE FAIT PAS ────────────────────────────────────────────────────────────────────────
 *
 * Aucun registre ésotérique, aucune intimité dans l’objet (NFR-015 : « nom, icône et aperçus de
 * notification ne révèlent ni l’intimité du contenu ni un registre ésotérique »). L’objet apparaît sur un
 * écran verrouillé, potentiellement devant quelqu’un d’autre.
 *
 * Le lien pointe vers la halte, pas vers la synthèse : ouvrir demande d’être connectée. Un lien qui
 * afficherait le contenu sans authentification serait une fuite d’art. 9 par URL.
 *
 * Et il n’invite plus à RÉPONDRE. La phrase « réponds à ce courriel » ouvrait un canal art. 9 ENTRANT —
 * vers une boîte ordinaire, hors RLS, hors ZDR — pour une boîte qui d’ailleurs n’existait pas.
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
 * Rend le gabarit du motif, ou `null` si le motif est hors de l’ensemble fermé — ce que le type interdit,
 * mais qu’un `as` ou une désérialisation peut produire. L’adaptateur refuse alors d’envoyer.
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
        // « dans le menu de compte » a été retiré : ce menu n’existe pas. Un courriel qui décrit une
        // interface imaginaire fait douter la lectrice d’elle-même avant de la faire douter du produit.
        "Ta synthèse est prête. Elle t’attend dans l’application :",
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
    // Ni le « si », ni le « alors », ni le nom de la branche, ni combien d’échéances tombent aujourd’hui.
    // NFR-015 : l’objet paraît sur un écran verrouillé, potentiellement devant quelqu’un d’autre. « Tu as
    // dit que si tu sentais la boule au ventre, tu appellerais ta sœur » est exactement le genre de
    // phrase qui ne doit jamais apparaître là — et la signature du port fait qu’on ne PEUT pas l’écrire :
    // il n’existe aucun paramètre où la mettre.
    //
    // Le texte porte donc UNIQUEMENT le fait, et le fait est déjà tout ce qui compte : elle s’est fixé un
    // rendez-vous avec elle-même, et c’est aujourd’hui.
    //
    // « que tu as fixée » n’est pas une politesse. C’est la différence entre un rappel et une injonction :
    // le produit ne lui a rien demandé, il lui rend ce qu’elle a posé. Aucun « n’oublie pas », aucun
    // « pense à », aucun point d’exclamation — la charte §6 interdit le décret, et un rappel d’échéance
    // est l’endroit où l’on glisse vers l’injonction sans s’en apercevoir.
    return {
      objet: "Une échéance, aujourd’hui",
      texte: [
        "Bonjour,",
        "",
        "Une échéance que tu as fixée arrive aujourd’hui. Elle t’attend dans l’application :",
        "",
        `${origine}/`,
        ...pied,
      ].join("\n"),
      lienUnClic,
    };
  }

  // Motif hors de l’ensemble fermé — ce que le type interdit, mais qu’un `as` ou une désérialisation
  // peut produire. L’adaptateur refuse alors d’envoyer.
  return null;
}

/**
 * Le prix, rendu comme il s’écrit en français. Il vient de `lib/stripe/config` — la même constante que
 * celle envoyée à Stripe — plutôt que d’être recopié : un courriel légal annonçant un montant différent
 * de celui débité serait la pire divergence possible entre deux chiffres du produit.
 */
function euros(centimes: number): string {
  return centimes % 100 === 0
    ? `${centimes / 100} €`
    : `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}

/**
 * Story 3.5 — LE GABARIT LÉGAL. Une fonction séparée, sans `jeton` et sans `lienUnClic`.
 *
 * ── CE QU’IL N’A PAS, ET POURQUOI L’ABSENCE EST LE POINT ────────────────────────────────────────────────
 *
 * Pas de pied de désabonnement. Le pied de `gabaritPour` promet « pour ne plus recevoir ces messages » —
 * une promesse tenable pour une synthèse, intenable ici : l’information avant reconduction tacite est due
 * (art. L215-1 C. consommation), et elle repartira l’an prochain quoi qu’elle clique. Offrir le lien
 * quand même serait mentir poliment ; et le mensonge serait découvert exactement au moment où elle
 * recevrait le courriel suivant.
 *
 * Pas d’en-têtes `List-Unsubscribe` non plus, pour la même raison — RFC 8058 vise le courrier en volume,
 * pas le transactionnel. Un bouton « Se désabonner » affiché par Gmail à côté de l’expéditeur ferait la
 * même promesse, en plus visible.
 *
 * ── CE QU’IL DIT, ET CE QU’IL NE DIT PAS ────────────────────────────────────────────────────────────────
 *
 * L’objet reste neutre (NFR-015) : il paraît sur un écran verrouillé. « Ton abonnement Anam va être
 * reconduit » nomme déjà un produit et une dépense devant qui regarde par-dessus l’épaule. Ni le montant
 * ni la date n’y entrent : un aperçu de notification ne chiffre pas une dépense devant un tiers.
 *
 * ── LA DATE ET LE MONTANT ÉTAIENT ABSENTS DU CORPS, ET C’ÉTAIT UN MANQUEMENT (revue 1-4, #14) ──────────
 *
 * Le texte disait : « La date et le montant sont dans l’application : … ». Le raisonnement d’origine était
 * architectural et sincère — la table est constante, ses deux trous sont typés nominalement, et interpoler
 * une chaîne libre rouvrirait ce que toute la 4.9 a fermé.
 *
 * Il était juste sur le moyen et faux sur la fin. L’art. L215-1 ne demande pas d’indiquer OÙ trouver la
 * date limite de résiliation : il demande de la MENTIONNER, « dans un encadré apparent », dans le courrier
 * électronique DÉDIÉ. Renvoyer vers un écran derrière authentification, c’est demander à quelqu’un d’aller
 * chercher ce que la loi impose de lui apporter — et quelqu’un qui ne se connecte plus est précisément
 * celui que la reconduction tacite prend au dépourvu.
 *
 * Le troisième trou est donc ouvert, et refermé comme les deux autres : `DateLimiteResiliation` est une
 * chaîne MARQUÉE dont l’unique constructeur n’accepte qu’un instant analysable et rend lui-même le rendu
 * français (cf. `lib/domain/date-limite.ts`). Le MONTANT, lui, n’a besoin d’aucun trou : une seule offre
 * existe, donc il s’écrit en clair ici comme le reste du texte.
 *
 * ⚠️ DETTE NOMMÉE — L'« ENCADRÉ » EST DESSINÉ EN TEXTE. L’adaptateur n’envoie qu’une partie `text/plain`
 * (cf. `adaptateurs/resend.ts`) : l’encadré est donc une règle au-dessus et au-dessous, sur sa propre
 * ligne. C’est apparent dans tout client, et ça ne dépend d’aucune police. Si le juriste exige une vraie
 * bordure, il faudra une partie HTML — porte pré-lancement §6, avec les CGU et les mentions légales.
 *
 * Le chemin de résiliation est nommé DANS le courriel : prévenir quelqu’un d’une reconduction sans lui
 * dire où l’arrêter serait le respect de la lettre contre l’esprit.
 */
export function gabaritLegalPour(information: InformationLegale, origine: Origine): Gabarit | null {
  const { motif } = information;
  if (motif === "reconduction_a_venir") {
    // L’encadré : sa largeur suit la ligne qu’il entoure, donc il reste juste quelle que soit la date.
    const encadre = `Date limite de résiliation : ${information.dateLimite}`;
    const regle = "═".repeat(encadre.length);
    return {
      objet: "Ton abonnement va se renouveler",
      texte: [
        "Bonjour,",
        "",
        "Ton abonnement Anam arrive à échéance et sera reconduit automatiquement",
        `pour un an, au prix de ${euros(PRIX_ABONNEMENT_ANNUEL_CENTIMES)}.`,
        "",
        regle,
        encadre,
        regle,
        "",
        "Jusqu’à cette date, tu peux résilier en quelques secondes, sans avoir à te justifier :",
        "",
        `${origine}/abonnement`,
        "",
        "— Anam",
      ].join("\n"),
      // Le champ existe pour satisfaire `Gabarit`, mais l’adaptateur NE POSE PAS l’en-tête sur ce chemin.
      // Il pointe vers la page d’abonnement : si quelqu’un l’utilisait un jour, il mènerait au vrai geste
      // (résilier) plutôt qu’à une préférence d’envoi qui n’existe pas pour ce courriel.
      lienUnClic: `${origine}/abonnement`,
    };
  }

  /**
   * Story 6.8 (AC2) — L’AVIS D’INACTIVITÉ.
   *
   * ⚠️ IL N’EST PAS SIGNÉ « — Anam », ET C’EST LA SEULE DIFFÉRENCE VISIBLE AVEC LE GABARIT
   * CI-DESSUS. L’AC2 le demande mot pour mot : « une notification est émise par le produit, jamais
   * signée d’Anam ». Anam est une présence à qui l’on parle ; lui faire annoncer qu’elle va effacer
   * ce qu’on lui a confié, c’est lui faire jouer le rôle de l’huissier. Le nom d’expéditeur reste
   * « Anam » — c’est l’identité de la route, pas une voix (NFR-015).
   *
   * ⚠️ ET IL NE DEMANDE PAS DE REVENIR. « Jamais un rappel de connexion » (EXPERIENCE.md) tient même
   * ici : le texte dit ce qui va se passer et où aller pour l’empêcher ou pour tout emporter. Il ne
   * dit ni « tu nous manques », ni « reconnecte-toi ».
   *
   * L’export est nommé AVANT la suppression, comme l’exige AD-14 : prévenir quelqu’un d’un
   * effacement sans lui dire où récupérer ses données serait le respect de la lettre contre l’esprit.
   */
  if (motif === "inactivite_avant_suppression") {
    return {
      objet: "Ton compte va être supprimé",
      texte: [
        "Bonjour,",
        "",
        "Ce compte n’a pas servi depuis longtemps. Sans usage d’ici trois mois, il sera supprimé,",
        "avec tout ce qu’il contient — et rien n’en reviendra.",
        "",
        "Se servir du compte annule la suppression. Tout est aussi téléchargeable, à tout moment :",
        "",
        `${origine}/mes-donnees`,
      ].join("\n"),
      // Comme pour l’information légale : le champ existe pour satisfaire `Gabarit`, mais l’adaptateur
      // ne pose PAS l’en-tête sur ce chemin — il n’y a rien à désabonner d’une suppression annoncée.
      lienUnClic: `${origine}/mes-donnees`,
    };
  }

  return null;
}

/** L’expéditeur affiché. « Anam » seul : ni « Anima », ni un mot du registre ésotérique (NFR-015). */
export const EXPEDITEUR_NOM = "Anam";
