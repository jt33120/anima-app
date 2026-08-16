import { motifPrioritaire } from "@/lib/domain/regime-anam";

/**
 * carte-anam.ts — LA CARTE « ANAM » DE L'ACCUEIL (Story 6.3, T5 · FR-034, AC6/AC7/AC8). Pure (AD-1) :
 * zéro I/O, zéro Supabase, zéro `server-only`.
 *
 * ── CE QUE CETTE CARTE RÉSOUT, ET QUI N'EST PAS « AFFICHER UNE NOTIFICATION » ───────────────────────
 *
 * Le trou que les trois critiques ont désigné : une annonce pouvait arriver sur un écran où
 * l'application ne montrait RIEN. Le courriel disait « ta synthèse est prête » ; l'app ne le disait
 * nulle part. Cette carte et le canal sortant dérivent maintenant de la même source — l'ensemble fermé
 * des motifs (`regime-anam.ts`) et la fonction qui les rend (`motifs_anam_du`, migration 0054).
 *
 * ── LA CARTE NE PARLE PAS À LA PLACE D'ANAM (décision D5) ──────────────────────────────────────────
 *
 * Aucun « je ». La région Anam dit déjà « Il s'est passé quelque chose hier » ; deux voix pour un même
 * événement, dont l'une invente une intimité que l'autre évite, est un défaut de copie. La carte parle
 * D'ELLE, à la troisième personne, et laisse la conversation être la conversation.
 *
 * ── AUCUNE PASTILLE, AUCUN COMPTEUR, ET RIEN OÙ EN ÉCRIRE UN (FR-031) ─────────────────────────────
 *
 * Même doctrine que `bibliotheque.ts` et que l'arbitrage de la 4.10 : la façon naturelle de faire fuir
 * un compte est de l'ajouter au type qui traverse la frontière. `CarteAnam` ne porte donc AUCUN champ
 * numérique — une seule ligne de texte, ou `null`. Le motif qui l'emporte est choisi ici, les autres
 * meurent ici : le rendu ne reçoit jamais « 2 choses en attente », parce qu'il ne reçoit jamais de 2.
 *
 * ── LA SPÉCIFICITÉ DISPONIBLE N'EST PAS LA MÊME POUR LES TROIS MOTIFS (décision D10) ───────────────
 *
 * L'AC6 d'origine annonçait « la branche concernée » pour la proposition. C'est IMPOSSIBLE, et la
 * table le dit : `signal_reconceptualisation` (0020) ne référence qu'une `entree_journal_id` — il n'y
 * a pas de branche à nommer, puisque la proposition consiste précisément à en ouvrir une. Et la seule
 * chose nommable de ce côté serait son verbatim de journal, que la 4.5 refuse de faire traverser.
 *
 * Chaque motif est donc spécifique de la façon dont il PEUT l'être, et jamais par un littéral
 * identique pour tout le monde :
 *   • l'échéance porte SES MOTS — le « si » et le « alors » qu'elle a écrits elle-même ;
 *   • la synthèse porte la DATE de fin de la période racontée ;
 *   • la proposition porte le JOUR où quelque chose est venu.
 */

/**
 * Un motif tel que la base le rend (`motifs_anam_du`). Les trois derniers champs sont `null` selon le
 * motif — c'est la minimisation portée par le SQL, pas un oubli.
 */
export interface MotifAnamPresent {
  readonly motif: string;
  /** Jour civil parisien `YYYY-MM-DD`. */
  readonly jour: string | null;
  /** Le « si » d'une intention — de sa main, art. 9. `null` pour les autres motifs. */
  readonly titre: string | null;
  /** Le « alors » d'une intention — de sa main, art. 9. `null` pour les autres motifs. */
  readonly detail: string | null;
}

/**
 * Ce que le rendu reçoit. UNE ligne, ou rien.
 *
 * ⚠️ AUCUN CHAMP NUMÉRIQUE, JAMAIS. Pas de `compte`, pas de `total`, pas de `nouveau`. S'il n'existe
 * aucun champ où écrire une mesure, il n'y a rien à masquer au rendu — et
 * `tests/bibliotheque-frontiere.test.ts` refuse qu'un tel champ apparaisse d'un côté ou de l'autre.
 */
export interface CarteAnam {
  readonly titre: string;
  /** La phrase invariante. Identique pour tout le monde, donc porteuse d'aucune information. */
  readonly presence: string;
  /** La ligne SPÉCIFIQUE, ou `null` quand aucun motif n'existe (carte neutre). */
  readonly ligne: string | null;
}

export const TITRE_CARTE_ANAM = "Anam";

/**
 * La phrase que la carte porte TOUJOURS, motif ou pas.
 *
 * Elle dit FR-034 à l'utilisatrice, en clair — et c'est sa fonction : sans elle, une carte sans ligne
 * se lit comme une carte en panne, et la rareté d'Anam se lit comme un manque. Avec elle, l'absence
 * de ligne devient une information juste : il n'y a rien de précis, donc elle se tait.
 *
 * Identique pour tout le monde et sans chiffre : elle ne peut donc rien laisser fuir (AC6, FR-031).
 */
export const PRESENCE_ANAM = "Elle se manifeste quand elle a quelque chose de précis à dire.";

/**
 * La borne d'affichage d'une ligne.
 *
 * Une intention fait jusqu'à 300 caractères PAR MOITIÉ (contraintes `intention_*_borne`, 0036), donc
 * une ligne brute pourrait en faire plus de six cents sur une carte d'accueil. On rogne pour
 * L'AFFICHAGE seulement — le texte entier se lit dans le plan d'étapes, et rien n'est perdu.
 */
export const LIGNE_ANAM_MAX = 160;

/**
 * Rogne au dernier mot entier, avec un signe visible que ça continue.
 *
 * Le repli sur une coupe FRANCHE (aucune espace dans la première moitié) n'est pas décoratif : un mot
 * de 200 caractères — une adresse collée, une suite sans espace — rendrait sinon une chaîne vide, donc
 * une ligne réduite à « … », qui se lit comme un défaut d'affichage.
 */
export function rognerLigne(texte: string, max: number = LIGNE_ANAM_MAX): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > max / 2 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/**
 * Les mois, en toutes lettres. Douze chaînes qui ne changeront pas.
 *
 * `render/accueil/Bibliotheque.tsx` en porte une copie, et c'est la frontière AD-7/AD-10 qui l'impose :
 * le rendu n'a pas le droit d'importer `lib/domain`. Ce n'est pas une divergence en attente — un mois
 * français ne se renomme pas.
 */
const MOIS = Object.freeze([
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
]);

/**
 * Le jour civil `YYYY-MM-DD`, écrit pour être lu. `null` si la chaîne n'est pas une date civile.
 *
 * ⚠️ AUCUN `Date`, AUCUN FUSEAU, ET C'EST LA DÉCISION DU MODULE. `periodeLisible` (synthèse) et
 * `dateLisible` (plan d'étapes) partent d'un INSTANT, donc ils doivent nommer un fuseau — et tous deux
 * ont payé le défaut de ne pas le faire. Ici l'entrée est une colonne `date` : une date civile n'est
 * pas un instant, et la convertir en instant pour la reformater est précisément le geste qui fait
 * basculer un jour.
 *
 * Le prix de la version « instant » était pire qu'un bug : elle demandait DEUX défenses — une ancre à
 * midi et un `timeZone` explicite — dont aucun test ne pouvait distinguer la contribution, parce que
 * chacune couvrait la panne de l'autre. Sans `Date`, il n'y a plus qu'une seule chose à prouver.
 */
export function jourLisible(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, annee, mois, jour] = m;
  const nom = MOIS[Number(mois) - 1];
  const j = Number(jour);
  // La base ne peut pas rendre un 31 février — une colonne `date` a déjà refusé. Mais le contrat de
  // `motifs_anam_du` peut changer, et « 45 août » sur une carte est pire qu'une carte neutre.
  if (!nom || j < 1 || j > 31) return null;
  return `${j} ${nom} ${annee}`;
}

/**
 * LA LIGNE SPÉCIFIQUE DU MOTIF QUI L'EMPORTE, ou `null`.
 *
 * ⚠️ FAIL-CLOSED SUR CHAQUE MOTIF, ET C'EST LA GARDE QUI COMPTE (AD-15 : le repli va vers MOINS
 * d'effet). Un motif dont la charge utile manque — une échéance sans ses mots, une synthèse sans sa
 * date — ne produit PAS une phrase à trous : il ne produit RIEN. Le jour où la fonction SQL changera
 * de colonnes, la carte redeviendra neutre au lieu d'afficher « Ta synthèse jusqu'au null est prête ».
 *
 * Et il n'y a pas de repli sur le motif suivant : celui qui l'emporte l'emporte. Basculer sur le
 * second parce que le premier est incomplet ferait dire à la carte autre chose que ce que le canal
 * sortant a annoncé — exactement la divergence qu'AC8 existe pour empêcher.
 */
export function ligneAnam(presents: readonly MotifAnamPresent[]): string | null {
  const gagnant = motifPrioritaire(presents.map((p) => p.motif));
  if (gagnant === null) return null;

  // ⚠️ CE `if` N'EST PAS UNE GARDE, C'EST UN RÉTRÉCISSEMENT DE TYPE, et il faut le savoir avant de
  // lui chercher un test. `gagnant` sort de `motifPrioritaire(presents.map(…))` : il vient donc
  // FORCÉMENT de `presents`, et `find` ne peut pas échouer. Aucun mutant ne peut le tuer — la
  // campagne l'a vérifié (N2, survivant équivalent assumé) — parce qu'il n'existe aucune entrée qui
  // l'atteigne. Il est là parce que `find` rend `T | undefined` et que TypeScript exige qu'on le
  // traite ; le supprimer demanderait un `!`, qui mentirait davantage.
  const p = presents.find((x) => x.motif === gagnant);
  if (!p) return null;

  switch (gagnant) {
    case "echeance_intention": {
      // SES MOTS, dans leur forme d'origine — « si … alors … » est la forme que le plan lui impose
      // (AC1 de la 4.10 : les deux moitiés, ou rien), et la carte la respecte plutôt que de la
      // paraphraser. Rien n'est ajouté à ce qu'elle a écrit ; on lui rappelle qu'elle l'a écrit.
      if (!p.titre || !p.detail) return null;
      return rognerLigne(`Pour aujourd'hui : si ${p.titre}, alors ${p.detail}.`);
    }
    case "synthese_prete": {
      const date = p.jour && jourLisible(p.jour);
      if (!date) return null;
      return `Ta synthèse est prête — elle va jusqu'au ${date}.`;
    }
    case "proposition_branche": {
      const date = p.jour && jourLisible(p.jour);
      if (!date) return null;
      // Aucun verbatim, et c'est la minimisation héritée de la 4.5. Ce qui est spécifique ici est le
      // JOUR : il varie d'une personne à l'autre et d'une fois à l'autre, donc la ligne n'est pas un
      // littéral identique pour tout le monde — ce qu'AC6 refuse.
      return `Quelque chose est venu le ${date}, et n'a pas encore de nom.`;
    }
  }
}

/** La carte complète. Neutre par défaut : la ligne est le seul champ qui varie. */
export function carteAnam(presents: readonly MotifAnamPresent[]): CarteAnam {
  return { titre: TITRE_CARTE_ANAM, presence: PRESENCE_ANAM, ligne: ligneAnam(presents) };
}
