/**
 * rythme-pause.ts — LE GESTE DE PAUSE (Story 6.4, T1 ; FR-036). Domaine PUR : zéro I/O, aucun import
 * (AD-1). Il ne sait rien de Supabase, rien de la conversation, rien de l'heure de Paris.
 *
 * ── CE QUE CE FICHIER MESURE, ET CE QU'IL SE REFUSE À MESURER ───────────────────────────────────
 *
 * La contre-métrique du PRD : « plus de 5 sessions par semaine ou plus de 60 min/semaine sur un
 * compte → signal de dépendance : Anam propose une pause (FR-036), et le cas est revu ».
 *
 * ⚠️ ET RIEN D'AUTRE. Compter les séances pour détecter l'intensité fabrique GRATUITEMENT, dans le
 * même objet, la capacité de détecter le décrochage : `mesure.seances === 0` est à une ligne. L'AC4
 * dit l'inverse, et il le dit comme une symétrie — « aucune absence n'est traitée comme un
 * décrochage et aucun message ne la constate ». Il n'existe donc ici AUCUNE fonction qui regarde
 * vers le bas : `seuilFranchi` est la seule lecture de la mesure, et elle ne sait dire que « oui ».
 *
 * ── D'OÙ VIENNENT LES HORODATAGES : `entree_journal`, ET SÛREMENT PAS `usage_ia` ────────────────
 *
 * `usage_ia` était le candidat évident — non-art. 9 par construction, déjà horodaté, déjà lu par
 * `lire-allocation.ts`. Il est FAUX ici : il compte les appels au MODÈLE, donc les travaux de fond
 * (synthèse périodique 4.9, extraction de faits 4.2, détection de reconceptualisation 4.4). Une
 * contre-métrique de dépendance qui se déclenche parce qu'un job de nuit a tourné serait un
 * mensonge, au seul endroit du produit où l'on prétend protéger quelqu'un de son propre usage.
 *
 * Le rythme de quelqu'un, c'est QUAND ELLE ÉCRIT. Le dépôt ne lit donc que les `cree_le` des tours
 * de rôle `utilisatrice`, et aucune colonne de contenu ne traverse (minimisation art. 9).
 */

/** La fenêtre de mesure : sept jours GLISSANTS, jamais la semaine civile (pas de falaise du lundi). */
export const FENETRE_JOURS = 7;

/**
 * Le silence au-delà duquel deux tours appartiennent à deux séances différentes.
 *
 * La table `seance` (2.7) ne peut pas répondre à la question : elle porte UN SEUL état d'arc courant
 * par utilisatrice, réécrit à chaque tour. Ce n'est pas un historique. Une grappe séparée par un
 * silence est la définition usuelle d'une session, elle se calcule sans rien persister de plus, et
 * trente minutes est généreux pour un produit où l'on réfléchit entre deux messages.
 */
export const SILENCE_SEANCE_MINUTES = 30;

/** « Plus de 5 séances » — STRICTEMENT plus. Cinq séances pile ne franchit rien. */
export const SEUIL_SEANCES = 5;

/** « Plus de 60 minutes » — STRICTEMENT plus, même discipline. */
export const SEUIL_MINUTES = 60;

/**
 * La fenêtre de silence d'Anam après une proposition de pause — trente jours.
 *
 * Le seuil se mesure sur sept jours glissants : si elle garde le même rythme, il reste franchi en
 * permanence, et sans fenêtre la proposition repartirait à chaque ouverture de l'application.
 *
 * ⚠️ AUCUNE CONDITION DE RÉARMEMENT, contrairement à l'invitation d'intégration (4.10, D3) où la
 * fenêtre écoulée ne suffisait pas — il fallait qu'une branche ait bougé. Ici, le seul « mouvement »
 * observable serait qu'elle ait RALENTI, c'est-à-dire que le produit vérifie si elle a obéi. Une
 * fenêtre plate dit la seule chose acceptable : Anam l'a dit une fois, elle ne le redira pas avant
 * un mois, et elle ne regarde pas si ça a servi.
 */
export const APAISEMENT_JOURS = 30;

/**
 * Ce que la mesure produit. Les deux nombres vivent en base (journalisation AC5, revue produit) et
 * NULLE PART AILLEURS : ils ne traversent jamais vers le client, puisque `Ouverture` n'a aucun champ
 * numérique (FR-031, gardé par `tests/arbitrage-frontiere.test.ts`).
 */
export interface MesureRythme {
  /** Grappes de tours séparées par au plus `SILENCE_SEANCE_MINUTES` de silence. */
  readonly seances: number;
  /** Somme des durées de chaque grappe, en minutes ENTIÈRES (troncature). */
  readonly minutes: number;
}

const MS_PAR_MINUTE = 60_000;

/**
 * Mesure le rythme sur la fenêtre glissante, à partir des horodatages d'écriture de l'utilisatrice.
 *
 * ⚠️ LA FENÊTRE EST APPLIQUÉE ICI, ET C'EST VOULU MÊME SI LA REQUÊTE FILTRE DÉJÀ. Le dépôt demande
 * une MARGE (huit jours) précisément pour que la borne exacte soit décidée en un seul endroit : deux
 * filtres identiques se couvriraient l'un l'autre, et le mutant de l'un survivrait grâce à l'autre.
 * C'est le piège des défenses redondantes, déjà payé dans ce dépôt.
 *
 * ⚠️ LA MESURE DES MINUTES SOUS-ESTIME, ET C'EST LA BONNE DIRECTION DU DOUTE. Une grappe d'un seul
 * tour dure zéro minute ; le temps passé à lire après le dernier message n'est compté nulle part. Le
 * seuil est donc plus difficile à franchir qu'il n'en a l'air. Sur-estimer ferait dire au produit
 * « tu viens trop » à quelqu'un qui ne vient pas trop — soit exactement le jugement que l'AC4 refuse
 * dans l'autre sens.
 */
export function mesurerRythme(horodatagesMs: readonly number[], maintenantMs: number): MesureRythme {
  const depuis = maintenantMs - FENETRE_JOURS * 24 * 60 * MS_PAR_MINUTE;

  // On TRIE ici plutôt que de faire confiance à l'ordre de la requête : sans ça, l'ordre du `select`
  // deviendrait porteur d'un invariant, et le jour où quelqu'un le change pour une bonne raison, le
  // découpage en séances deviendrait faux sans que rien ne rougisse.
  const dans = horodatagesMs
    .filter((t) => Number.isFinite(t) && t >= depuis && t <= maintenantMs)
    .sort((a, b) => a - b);

  if (dans.length === 0) return { seances: 0, minutes: 0 };

  const silence = SILENCE_SEANCE_MINUTES * MS_PAR_MINUTE;
  let seances = 1;
  let dureeMs = 0;
  let debutGrappe = dans[0];

  for (let i = 1; i < dans.length; i++) {
    // `>` et non `>=` : un silence de trente minutes PILE appartient encore à la même séance. Le
    // doute penche vers MOINS de séances, donc vers ne pas franchir le seuil.
    if (dans[i] - dans[i - 1] > silence) {
      dureeMs += dans[i - 1] - debutGrappe;
      debutGrappe = dans[i];
      seances++;
    }
  }
  dureeMs += dans[dans.length - 1] - debutGrappe;

  return { seances, minutes: Math.floor(dureeMs / MS_PAR_MINUTE) };
}

/**
 * Le seuil du PRD, littéralement : un OU, et deux comparaisons STRICTES.
 *
 * C'est la SEULE lecture d'une `MesureRythme` qui existe dans ce fichier — il n'y a pas de
 * `rythmeFaible`, pas de `estInactive`, pas de `decrochage`. Voir l'en-tête : l'absence de la
 * fonction inverse EST l'AC4.
 */
export function seuilFranchi(mesure: MesureRythme): boolean {
  return mesure.seances > SEUIL_SEANCES || mesure.minutes > SEUIL_MINUTES;
}

/**
 * LA PHRASE, et c'est une CONSTANTE — pas une génération.
 *
 * Précédent direct : `PHRASE_SOCLE_COMPLETE`, `PHRASE_INVITATION` et `PHRASE_OUVERTURE_HYPOTHESE`
 * vivent toutes en constantes de `lib/domain/`. La raison propre à cette story est dans l'AC1 :
 * « aucune condition de retour ni aucun engagement n'est extorqué » est une propriété DU TEXTE, et
 * aucun texte engendré ne peut la garantir. Une constante, elle, passe les détecteurs.
 *
 * Ce qu'elle ne fait pas, et chaque refus est éprouvé par un test :
 *   • elle ne CHIFFRE rien (« souvent », jamais « 7 séances ») — FR-031 ;
 *   • elle n'extorque aucun engagement (« promets-moi », « reviens », « je t'attends ») ;
 *   • elle ne pose AUCUNE question — une question appelle une réponse, donc un engagement ;
 *   • elle ne recommande pas (« tu devrais ») : elle constate qu'une chose est possible ;
 *   • elle tient en trois phrases (FR-084).
 *
 * Et ce qu'elle fait, qui est le cœur : elle retire la peur de perdre. « rien ne se perd » est
 * l'exact inverse du ressort qu'un produit ordinaire actionnerait ici.
 */
export const PHRASE_PAUSE =
  "Tu es venue souvent ces jours-ci. " +
  "Ce que tu as déposé reste là, et rien ne se perd si tu t’éloignes un moment. " +
  "Tu peux laisser reposer, ou continuer — les deux se valent.";
