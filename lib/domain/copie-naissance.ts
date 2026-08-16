import { SIGNE_LIBELLE } from "@/lib/domain/cartes-socle";
import type { ApercuCorrection, RefusHeure } from "@/lib/domain/correction-naissance";

/**
 * copie-naissance.ts — LA COPIE DE « CORRIGER TON HEURE DE NAISSANCE » (Story 6.5b).
 *
 * Seconde section de `/memoire`, et le registre est celui de sa voisine : **c'est le produit qui
 * parle, pas Anam.** On montre à quelqu'un une donnée qui le concerne et on lui propose de la
 * rectifier — un droit, pas un moment d'intimité. Une phrase chaleureuse ici ferait passer le
 * registre d'Anam sur l'exercice d'un droit, ce que `copie-memoire.ts` refuse déjà pour la même
 * raison et sur le même écran.
 *
 * ⚠️ AUCUN NOMBRE DE CORRECTIONS N'EST DIT. La base en compte un (piste d'audit) ; l'écran montre
 * la DATE de la dernière. « Tu as corrigé 3 fois » est un compteur, et FR-031 les refuse — c'est
 * l'arbitrage déjà rendu à dix centimètres de là, où la 6.5 affiche « Tu as réécrit cette phrase. »
 * sans jamais dire combien de fois.
 */

export const TITRE_SECTION = "Ton heure de naissance";

/**
 * ⚠️ CETTE INTRODUCTION EST CONTRAIGNANTE. Elle doit dire les trois choses vraies, et la troisième
 * est celle qu'on oublie : que la correction n'est pas un réglage d'affichage mais un recalcul de
 * ce qui sert de socle. Sans elle, quelqu'un corrige « pour voir » et découvre après coup que son
 * horoscope du jour a changé de fond en comble.
 */
export const INTRODUCTION =
  "L'heure inscrite sur ton acte de naissance décide de ton ascendant et de tes maisons. Si celle " +
  "qui est enregistrée est fausse, tu peux la corriger — autant de fois qu'il le faut. Ton thème " +
  "sera recalculé à partir de la nouvelle, et l'ancien ne sera pas conservé.";

export const HEURE_ABSENTE =
  "Aucune heure n'est enregistrée pour l'instant. Il n'y a donc rien à corriger : il y a à ajouter.";

export const LIEN_AJOUTER = "Ajouter mon heure de naissance";

export const ETIQUETTE_NOUVELLE_HEURE = "La bonne heure";
export const AIDE_NOUVELLE_HEURE =
  "Telle qu'elle est écrite sur ta copie intégrale d'acte de naissance.";

export const ACTION_VOIR = "Voir ce que ça change";
export const ACTION_CONFIRMER = "Corriger mon heure";
export const ACTION_RENONCER = "Renoncer";

export const CORRIGE = "C'est corrigé. Ton thème se recalcule à ta prochaine ouverture d'Anima.";

/**
 * Le refus après révocation.
 *
 * Corriger fait REGRAVER le thème natal, qui est une donnée art. 9 : sans consentement valide, la
 * base refuse l'écriture (trigger `naissance_corrigible`, 0060). On l'annonce d'avance plutôt que
 * de la laisser composer une correction pour se la voir rejeter — même geste que sa voisine.
 */
export const CORRECTION_APRES_REVOCATION =
  "Tu as retiré ton consentement : ton thème ne peut plus être recalculé, donc corriger ton heure " +
  "ne changerait rien. Supprimer tes données reste possible, et le restera toujours.";

const REFUS: Readonly<Record<RefusHeure, string>> = Object.freeze({
  format: "Entre une heure au format 07:15.",
  inexistante: "Cette heure n'existe pas.",
  inchangee: "C'est déjà l'heure enregistrée.",
});

export function messageDeRefus(refus: RefusHeure): string {
  return REFUS[refus];
}

/** « le 16 août 2026 » — jamais une heure : la date de correction n'est pas un horodatage d'audit. */
export function dateLisible(instant: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(instant);
}

export function dejaCorrigeeLe(instant: Date): string {
  return `Tu as déjà corrigé ton heure de naissance, le ${dateLisible(instant)}.`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'APERÇU — la seule chose qui rend défendable une correction sans plafond
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Ce que la correction change, mis en mots.
 *
 * ⚠️ ELLE DOIT POUVOIR DIRE « ÇA APPAUVRIT ». Une correction peut faire PERDRE des corps (une heure
 * qui rend un signe ambigu ne s'invente pas). Un aperçu qui ne saurait annoncer que des gains
 * mentirait exactement dans le cas où elle a le plus besoin de la vérité avant de valider.
 *
 * Rend une liste de phrases plutôt qu'un paragraphe : le rendu les empile, et un test peut mesurer
 * la présence d'une ligne sans dépendre d'une ponctuation.
 */
export function phrasesApercu(apercu: ApercuCorrection): readonly string[] {
  const phrases: string[] = [];

  const nom = (s: ApercuCorrection["ascendantAvant"]) => (s === null ? null : SIGNE_LIBELLE[s]);
  const avant = nom(apercu.ascendantAvant);
  const apres = nom(apercu.ascendantApres);

  if (avant !== null && apres !== null && avant !== apres) {
    phrases.push(`Ton ascendant passe de ${avant} à ${apres}, et tes maisons avec lui.`);
  } else if (avant === null && apres !== null) {
    phrases.push(`Ton ascendant devient calculable : ${apres}.`);
  } else if (avant !== null && apres === null) {
    phrases.push(`Ton ascendant ne sera plus calculable, alors qu'il l'est aujourd'hui (${avant}).`);
  }

  if (apercu.precisionAvant === "midi_par_defaut" && apercu.precisionApres === "heure_connue") {
    phrases.push("Ton thème cesse d'être calculé depuis midi par défaut.");
  } else if (apercu.precisionAvant === "heure_connue" && apercu.precisionApres === "midi_par_defaut") {
    phrases.push("Ton thème repasse à midi par défaut : l'heure ne serait plus exploitable.");
  }

  if (apercu.corpsRegagnes > 0) {
    phrases.push(
      apercu.corpsRegagnes === 1
        ? "Un corps de plus devient calculable."
        : `${apercu.corpsRegagnes} corps de plus deviennent calculables.`,
    );
  } else if (apercu.corpsRegagnes < 0) {
    const perdus = -apercu.corpsRegagnes;
    phrases.push(
      perdus === 1
        ? "Un corps cesse d'être calculable."
        : `${perdus} corps cessent d'être calculables.`,
    );
  }

  if (phrases.length === 0) {
    phrases.push(
      "Ni ton ascendant ni tes maisons ne changent. Ton thème sera tout de même recalculé sur " +
        "la nouvelle heure.",
    );
  }
  return phrases;
}
