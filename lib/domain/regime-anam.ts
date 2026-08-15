import { FUSEAU } from "@/lib/domain/ordonnanceur";

/**
 * regime-anam.ts — LE RÉGIME DE PAROLE D'ANAM (Story 6.3, FR-034 / FR-035 · AD-1, AD-15, AD-17).
 *
 * ── CE QUE FR-034 DEMANDE, MOT POUR MOT ────────────────────────────────────────────────────────
 *
 * « Anam ne se manifeste que lorsqu'elle a quelque chose de SPÉCIFIQUE à dire. Aucun message
 * générique récurrent. »
 *
 * C'est une règle d'EXISTENCE — une condition d'émission —, pas une règle de fréquence et surtout
 * pas un mandat d'émettre davantage. L'ensemble ci-dessous est un PLAFOND : ce qui a le droit de
 * sortir. Rien n'oblige les trois motifs à emprunter un canal.
 *
 * ── POURQUOI CE FICHIER EXISTE : LA VÉRITÉ ÉTAIT ÉPARPILLÉE EN TROIS ───────────────────────────
 *
 * Avant la 6.3, « quels sont les motifs d'Anam » se lisait dans trois endroits qui ne se
 * connaissaient pas :
 *
 *   • `MotifCourriel` (lib/courriel/port.ts) — deux littéraux TypeScript ;
 *   • le CHECK `notification_envoyee_motif_check` (0053) — trois valeurs, socle compris ;
 *   • `famille_motif` (0036) — qui classe, et qui LÈVE sur un motif non classé.
 *
 * Aucun des trois ne disait « ces trois-là, et pas un de plus ». Ce fichier le dit, et
 * `tests/regime-anam.test.ts` prouve qu'il est le MIROIR des trois autres — dans les deux sens.
 *
 * ── LE TROISIÈME MOTIF N'A PAS DE CANAL, ET C'EST ÉCRIT ────────────────────────────────────────
 *
 * `proposition_branche` appartient à l'ensemble et vit UNIQUEMENT dans l'application. Décision D1,
 * prise après qu'un critique adversarial a démoli les trois raisons de lui donner un canal :
 *
 *   1. la poussée ne peut structurellement rien dire de spécifique — le POST fait zéro octet, le
 *      service worker ne lit jamais `evenement.data`, et son `tag` fixe ferait REMPLACER la
 *      notification du socle par la sienne ;
 *   2. la discrétion offerte en échange serait vide — sur le palier `hobby` le socle se tait, donc
 *      une poussée d'Anam serait le SEUL signal, parfaitement identifiable ;
 *   3. un motif de plus classé `anam` mangerait le plafond de 72 h et ferait taire la synthèse du
 *      lendemain. AD-15 : le repli va vers MOINS d'effet.
 *
 * Une proposition de branche ne périme jamais (le signal reste `en_attente`) et Anam la dira
 * elle-même à la prochaine ouverture. Le silence lui coûte donc zéro.
 */

/** Les motifs d'Anam. Ensemble FERMÉ : tout ce qui n'est pas ici est refusé, jamais ignoré. */
export type MotifAnam = "synthese_prete" | "echeance_intention" | "proposition_branche";

/**
 * Le canal d'un motif.
 *
 * `in-app` n'est pas « pas encore de canal » : c'est un canal, celui de l'accueil, et il a ses
 * propres gardes (AD-17 porté en SQL, aucune pastille, aucun compteur).
 */
export type CanalAnam = "courriel" | "in-app";

export interface RegleMotif {
  readonly motif: MotifAnam;
  readonly canal: CanalAnam;
  /**
   * Le rang d'arbitrage quand deux motifs coexistent — le PLUS PETIT gagne.
   *
   * La doctrine du dépôt : ce qui ne revient pas de soi-même passe devant. Une échéance est datée
   * « aujourd'hui » et s'éteint seule à minuit ; une synthèse est rattrapable trois jours ; une
   * proposition attend indéfiniment.
   */
  readonly rang: number;
}

export const REGIME_ANAM: readonly RegleMotif[] = Object.freeze([
  Object.freeze({ motif: "echeance_intention", canal: "courriel", rang: 1 } as const),
  Object.freeze({ motif: "synthese_prete", canal: "courriel", rang: 2 } as const),
  Object.freeze({ motif: "proposition_branche", canal: "in-app", rang: 3 } as const),
]);

/** Les motifs seuls — pour les miroirs et les balayages. */
export const MOTIFS_ANAM: readonly MotifAnam[] = Object.freeze(REGIME_ANAM.map((r) => r.motif));

/**
 * Le refus est le DÉFAUT.
 *
 * ⚠️ Écrite en prédicat plutôt qu'en `Set.has` nu pour que le point de refus soit NOMMÉ : c'est ici
 * qu'on lit « tout autre motif est refusé », et c'est ici qu'un mutant se voit.
 */
export function motifAutorise(motif: string): motif is MotifAnam {
  return (MOTIFS_ANAM as readonly string[]).includes(motif);
}

/** La règle d'un motif, ou `null` — jamais une valeur inventée. */
export function regleDe(motif: string): RegleMotif | null {
  return REGIME_ANAM.find((r) => r.motif === motif) ?? null;
}

/**
 * Le motif qui l'emporte quand plusieurs coexistent. `null` si aucun.
 *
 * ⚠️ Trie sur `rang`, pas sur l'ordre du tableau : l'ordre d'un tableau se réarrange au premier
 * « je remets par ordre alphabétique », et l'arbitrage suivrait sans que rien ne rougisse.
 */
export function motifPrioritaire(presents: readonly string[]): MotifAnam | null {
  const regles = presents.map(regleDe).filter((r): r is RegleMotif => r !== null);
  if (regles.length === 0) return null;
  return regles.reduce((a, b) => (a.rang <= b.rang ? a : b)).motif;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le créneau diurne — « aucune notification le soir en v1 »
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Les bornes du créneau, en heures de Paris. Inclusives à gauche, EXCLUSIVES à droite : 21 est
 * refusé, donc rien ne part à 21 h 00.
 *
 * ⚠️ POURQUOI SI LOIN DE L'HEURE DE TIR. Le cron déclaré est `0 6 * * *` — 07 h en CET, 08 h en
 * CEST. Le palier `hobby` autorise une dérive de planification pouvant atteindre l'heure pleine.
 * Une borne posée près de l'heure de tir ferait donc dépendre l'émission de cette dérive : le
 * même code émettrait ou non selon le jour, et le test qui l'affirme serait vert par chance.
 *
 * C'est la leçon exacte de la 6.2, où mon premier raisonnement sur la dérive était faux (59 min à
 * 08 h 00 donne 08 h 59, toujours l'heure 8 — la frontière est l'heure PLEINE, pas la minute).
 * Ici la marge est de treize heures d'un côté et de six de l'autre : aucune dérive concevable ne
 * la franchit.
 */
export const CRENEAU_DIURNE_DEBUT = 6;
export const CRENEAU_DIURNE_FIN = 21;

/**
 * L'heure de Paris d'un instant, sans dépendance ni table de fuseaux embarquée.
 *
 * `Intl` connaît les règles de changement d'heure, y compris pour les années futures — les recopier
 * à la main ici produirait un second calendrier, faux au premier changement de règle européen.
 *
 * ⚠️ `hourCycle: "h23"` EST ÉCRIT, ET PAS `hour12: false`. Les deux donnent le même résultat sur ce
 * Node — ECMA-402 impose depuis 2021 que `hour12: false` résolve en `h23` —, mais l'un DIT ce qu'il
 * veut et l'autre l'espère d'une spécification qui a déjà changé une fois. Les trois autres cycles
 * sont des pannes silencieuses : `h24` rend « 24 » à minuit (donc `>= 6`, donc la nuit devient
 * diurne), et `h11`/`h12` rendent « 10 » à 22 h (donc un courriel à 22 h). Vérifié à la main, pas
 * supposé.
 *
 * La locale, elle, ne porte AUCUNE garde une fois le cycle épinglé : `en-GB` et `en-US` sont
 * interchangeables ici, et la campagne de mutation le confirme (M8, survivant équivalent assumé).
 * Ce qu'elle doit garantir est plus modeste — des CHIFFRES ASCII : `ar-EG` rendrait « ١٣ », donc
 * `NaN`, donc un créneau fermé pour toujours. Fail-closed, mais fermé quand même.
 */
export function heureParis(instant: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    // `FUSEAU`, jamais `"Europe/Paris"` écrit à la main : le produit a UNE notion de « chez elle », et
    // une seconde chaîne littérale est une divergence qui attend son changement de règle.
    timeZone: FUSEAU,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return Number.parseInt(h, 10);
}

/**
 * Le créneau est-il ouvert ? FAIL-CLOSED : hors créneau, on n'émet pas.
 *
 * ⚠️ ASYMÉTRIE ASSUMÉE, ET IL FAUT LA LIRE AVANT DE « RÉPARER » QUOI QUE CE SOIT :
 *
 *   • une SYNTHÈSE refusée le soir est rattrapée — `syntheses_non_annoncees(_, 3)` la reprend
 *     pendant trois jours, donc rien n'est perdu ;
 *   • un RAPPEL D'ÉCHÉANCE refusé le soir est PERDU — l'échéance est strictement « aujourd'hui »,
 *     et rien ne la rattrape.
 *
 * C'est voulu. Un rappel d'échéance délivré à 22 h n'est plus un rappel, c'est un reproche à
 * l'heure du coucher, sur un objectif qu'elle s'était fixé le matin. Le jour où quelqu'un voudra
 * « ne rien perdre » en ajoutant une file d'attente, il livrera exactement ça.
 */
export function creneauDiurneOuvert(instant: Date): boolean {
  const h = heureParis(instant);
  return h >= CRENEAU_DIURNE_DEBUT && h < CRENEAU_DIURNE_FIN;
}
