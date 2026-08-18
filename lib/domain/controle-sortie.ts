import { chercherInterdits, type FamilleInterdit } from "./lexique-interdit";

/**
 * controle-sortie.ts — LE LEXIQUE INTERDIT APPLIQUÉ À CE QU'ANAM DIT VRAIMENT (QA tour 1, T29 / T5).
 *
 * Cœur PUR (AD-1) : zéro I/O, zéro Next, zéro modèle. La route n'ajoute que le gate de détresse.
 *
 * ── LE TROU QUE CE MODULE FERME, ET QUI ÉTAIT ÉCRIT DANS LE DÉPÔT DEPUIS DES MOIS ────────────────
 *
 * `lexique-interdit.ts` le disait lui-même, en toutes lettres : « `chercherInterdits` n'a AUCUN
 * appelant en production — cinq consommateurs, tous des tests », et « à savoir avant d'ajouter un
 * terme ici : cela ne changera RIEN à ce que le modèle produit ». Le contrôle « bloquant » de la 2.8
 * était un contrôle de SOURCE : il gardait les libellés et le corpus d'Anima, jamais la voix vivante.
 *
 * Le tour de QA en a fourni la preuve terrain, deux fois dans la même session :
 *   • « Je suis là si tu veux écrire encore. **Prends soin de toi.** » — FR-023 bannit « soin » et ses
 *     dérivés, et cette phrase EXACTE figure dans le contrôle positif de `lexique-interdit.test.ts`.
 *     La fonction l'aurait attrapée. Personne ne l'appelait.
 *   • « **Je suis contente de l'entendre.** » — deux écrans après avoir fait cocher « elle n'a ni
 *     conscience ni intuition ». Famille `affect`.
 *
 * ── POURQUOI LA GRANULARITÉ EST LA PHRASE, ET PAS LE FRAGMENT ───────────────────────────────────
 *
 * Parce qu'on ne peut pas retirer ce qui est déjà parti. Le protocole est append-only : un fragment
 * émis est à l'écran. Il faut donc décider AVANT d'émettre — et pour décider, il faut une unité
 * complète.
 *
 * ⚠️ ET SURTOUT : ON NE PEUT PAS COUPER À L'INDEX DU MOTIF. `chercherInterdits` travaille sur le texte
 * NORMALISÉ (entités décodées, diacritiques retirés, blancs écrasés) — `normaliserTexte` ne conserve
 * donc PAS les longueurs. Un index trouvé dans le normalisé ne désigne rien dans l'original. C'est la
 * raison technique, et elle est dirimante : la phrase est la plus petite unité qu'on puisse à la fois
 * vérifier et localiser.
 *
 * Le coût est nul en pratique. La QA a mesuré 7 371 ms d'attente puis 175 caractères en 303 ms : le
 * flux arrive déjà par blocs. Retenir une phrase le temps de la lire ne se voit pas.
 *
 * ── ⚠️ EN DÉTRESSE, ON OBSERVE, ON NE COUPE PAS (AD-15, AD-17) ───────────────────────────────────
 *
 * Même gate que la troncature à trois phrases, et pour une raison plus forte encore : couper une
 * réponse de détresse peut retirer l'orientation vers le 3114. Aucun manquement de lexique ne vaut ça.
 * Le mode `observe` journalise et laisse passer ; le mode `coupe` retient.
 *
 * C'est le repli vers MOINS d'effet appliqué à l'envers de l'intuition : ici, « moins d'effet » veut
 * dire « ne pas amputer », parce que l'amputation est l'action, pas le silence.
 *
 * ── CE QUE ÇA NE FAIT PAS ────────────────────────────────────────────────────────────────────────
 *
 * Rien contre le `!`, les majuscules d'emphase ou le vouvoiement : ce sont des affaires de consigne,
 * et les mettre ici produirait des faux positifs massifs (une exclamation légitime existe). Rien non
 * plus contre une phrase malveillante formulée sans aucun terme de la liste — un lexique borne des
 * mots, pas des intentions.
 */

/**
 * Ce que le contrôle a le droit de faire.
 *
 * `coupe` — hors détresse : la phrase fautive n'est pas émise, et rien ne l'est après elle.
 * `observe` — en détresse : tout passe, le manquement est rendu pour être journalisé.
 */
export type ModeControle = "coupe" | "observe";

/**
 * Fin de phrase : un groupe de `. ! ? …` consécutifs, hors points décimaux.
 *
 * ⚠️ MÊME DÉFINITION QUE `voix-anam.ts`, et RECOPIÉE PLUTÔT QU'IMPORTÉE — délibérément. Les deux
 * modules se chaînent mais ne servent pas la même fin : l'un COMPTE les phrases pour en garder trois,
 * l'autre les DÉLIMITE pour les relire une à une. Le jour où l'un des deux devra bouger (une
 * abréviation, un « M. Dupont »), l'autre ne doit pas bouger avec lui sans qu'on l'ait décidé.
 * `tests/controle-sortie.test.ts` prouve que les deux coïncident aujourd'hui.
 */
const FIN_DE_PHRASE = /(?<!\d)[.!?…]+(?!\d)/g;

export interface EtatControle {
  /** Tout le texte reçu du modèle. Jamais émis en entier, jamais journalisé (NFR-022). */
  readonly texte: string;
  /** Longueur déjà transmise au client. */
  readonly emis: number;
  /** La famille du manquement qui a coupé, ou `null`. Non-null ⇒ plus rien ne sera émis. */
  readonly coupePar: FamilleInterdit | null;
}

export function etatControleInitial(): EtatControle {
  return { texte: "", emis: 0, coupePar: null };
}

export interface IssueControle {
  readonly etat: EtatControle;
  /** Ce qui peut partir MAINTENANT. */
  readonly aEmettre: string;
  /**
   * Les familles constatées par CET appel. Pour la journalisation serveur — jamais une trame, jamais
   * le verbatim : une famille est un mot de vocabulaire fermé, pas un contenu (NFR-022).
   */
  readonly manquements: readonly FamilleInterdit[];
}

/** Les index de fin de chaque phrase CLOSE de `texte`. */
function finsDePhrase(texte: string): number[] {
  return [...texte.matchAll(FIN_DE_PHRASE)].map((m) => m.index + m[0].length);
}

/**
 * Relit les phrases closes depuis `depuis`, et rend la frontière jusqu'où l'on peut émettre.
 *
 * Chaque phrase est vérifiée SEULE. Un motif qui chevaucherait deux phrases passerait donc — c'est
 * assumé : les motifs du lexique sont intra-phrase par construction (frontières de mots, au plus un
 * mot intercalé), et vérifier le texte entier à chaque fragment coûterait un balayage quadratique
 * sans rien attraper de plus.
 */
function relire(texte: string, depuis: number, limite: number): { sur: number; famille: FamilleInterdit | null } {
  let debut = depuis;
  let sur = depuis;
  // ⚠️ ON REPART DE `depuis`, ET C'EST UN CORRECTIF, PAS UNE OPTIMISATION. La première version
  // relisait depuis zéro à chaque fragment. En mode `coupe` ça ne se voyait pas — `coupePar` court-
  // circuite dès la première trouvaille —, mais en mode `observe` rien ne court-circuite : la même
  // phrase fautive était re-constatée à CHAQUE fragment suivant, et le journal d'incident aurait
  // porté vingt lignes pour un seul manquement. Trouvé par le test « le manquement est quand même
  // CONSTATÉ », qui en attendait un et en a reçu deux.
  for (const fin of finsDePhrase(texte.slice(0, limite))) {
    if (fin <= depuis) continue; // déjà relue, déjà émise
    const phrase = texte.slice(debut, fin);
    const trouve = chercherInterdits(phrase);
    if (trouve.length > 0) return { sur, famille: trouve[0].famille };
    sur = fin;
    debut = fin;
  }
  return { sur, famille: null };
}

/**
 * Absorbe un fragment. N'émet QUE des phrases entières et relues.
 *
 * La queue non ponctuée est retenue : elle n'est pas encore une phrase, donc pas encore vérifiable.
 * `terminer` s'en occupe quand le flux se ferme — sans lui, un modèle qui s'arrête sans point final
 * ferait perdre sa dernière phrase.
 */
export function absorberSousControle(etat: EtatControle, delta: string, mode: ModeControle): IssueControle {
  if (etat.coupePar !== null) return { etat, aEmettre: "", manquements: [] };

  const texte = etat.texte + delta;
  const fins = finsDePhrase(texte);
  // La dernière phrase close ; rien de plus n'est vérifiable pour l'instant.
  const limite = fins.length > 0 ? fins[fins.length - 1] : 0;
  if (limite <= etat.emis) return { etat: { ...etat, texte }, aEmettre: "", manquements: [] };

  const { sur, famille } = relire(texte, etat.emis, limite);

  if (famille === null) {
    return { etat: { texte, emis: limite, coupePar: null }, aEmettre: texte.slice(etat.emis, limite), manquements: [] };
  }

  if (mode === "observe") {
    // ⚠️ DÉTRESSE : on constate et on laisse passer. Amputer une orientation vers le 3114 serait pire
    // que n'importe quel manquement de vocabulaire.
    return { etat: { texte, emis: limite, coupePar: null }, aEmettre: texte.slice(etat.emis, limite), manquements: [famille] };
  }

  // `sur` est la fin de la dernière phrase PROPRE : la phrase fautive n'est jamais émise, ni rien
  // après elle. `sur` peut valoir `etat.emis` (la fautive est la première non émise) → rien ne part.
  return {
    etat: { texte, emis: Math.max(sur, etat.emis), coupePar: famille },
    aEmettre: sur > etat.emis ? texte.slice(etat.emis, sur) : "",
    manquements: [famille],
  };
}

/**
 * La fermeture du flux : la queue non ponctuée devient une phrase, et se fait relire comme les autres.
 *
 * ⚠️ SANS ELLE, LE CONTRÔLE MANGERAIT LA DERNIÈRE PHRASE de toute réponse qui ne finit pas par une
 * ponctuation — et un modèle coupé par une limite de jetons finit rarement par un point.
 */
export function terminerControle(etat: EtatControle, mode: ModeControle): IssueControle {
  if (etat.coupePar !== null) return { etat, aEmettre: "", manquements: [] };
  const queue = etat.texte.slice(etat.emis);
  if (queue.trim().length === 0) return { etat, aEmettre: "", manquements: [] };

  const trouve = chercherInterdits(queue);
  if (trouve.length === 0) {
    return { etat: { ...etat, emis: etat.texte.length }, aEmettre: queue, manquements: [] };
  }
  if (mode === "observe") {
    return { etat: { ...etat, emis: etat.texte.length }, aEmettre: queue, manquements: [trouve[0].famille] };
  }
  return { etat: { ...etat, coupePar: trouve[0].famille }, aEmettre: "", manquements: [trouve[0].famille] };
}

/**
 * ── LE CONTRÔLE D'UN DOCUMENT ENTIER (revue Epic 5, R3) ────────────────────────────────────────
 *
 * ⚠️ CE MODULE N'AVAIT QU'UN SEUL APPELANT DE PRODUCTION, ET LA ROUTE EN A TROIS SORTIES.
 *
 * `absorberSousControle` est écrit pour un FLUX : on l'appelle fragment par fragment, puis
 * `terminerControle` ferme la queue non ponctuée. Le chemin de conversation le fait. Mais la même
 * route génère deux autres textes, NON streamés, par un `return` antérieur ou une passe séparée :
 * la RESTITUTION DE LECTURE (5.8) et le BILAN DE CLÔTURE (2.9). Ni l'un ni l'autre ne traversait le
 * contrôle. Le premier est le plus long texte du produit, il est GRAVÉ, re-servi à chaque ouverture
 * de « Mes lectures », et inclus dans l'export FR-067 — définitivement.
 *
 * Ce qui les gardait était une ligne de CONSIGNE (« aucun vocabulaire clinique ou médical, aucun
 * "soin" ni "soigner" »), c'est-à-dire exactement la défense dont l'en-tête de ce fichier documente
 * qu'elle n'a pas suffi. Mesuré : `chercherInterdits("Prends soin de toi.")` rend `soigner` — une
 * phrase que la QA a relevée sur ce même modèle.
 *
 * La fonction ne fait RIEN DE NEUF : elle enchaîne les deux appels que le flux fait déjà, pour que
 * les trois sorties citent un contrôle au lieu d'en recopier la danse en deux temps. Un document
 * n'a qu'un fragment, et sa queue se ferme immédiatement.
 */
export function controlerDocument(texte: string, mode: ModeControle): IssueControle {
  const absorbe = absorberSousControle(etatControleInitial(), texte, mode);
  const ferme = terminerControle(absorbe.etat, mode);
  return {
    etat: ferme.etat,
    aEmettre: absorbe.aEmettre + ferme.aEmettre,
    manquements: [...new Set([...absorbe.manquements, ...ferme.manquements])],
  };
}

/**
 * Le code de journalisation d'un manquement. Une FAMILLE, jamais un terme, jamais la phrase.
 *
 * Le terme matché serait déjà une citation de ce qu'Anam a dit à quelqu'un ; la phrase serait de
 * l'art. 9 par contamination (elle répond à un message intime). Une famille appartient à un ensemble
 * fermé de cinq valeurs et ne peut désigner personne.
 */
export function codeManquement(famille: FamilleInterdit): string {
  return `voix_${famille}`;
}
