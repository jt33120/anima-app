import type { MessageIa, RequeteIa } from "@/lib/ai/port";
import { transitionner } from "@/lib/domain/cycle-branche";
import type { EtatBranche } from "@/lib/scene/projection";

/**
 * Story 4.7 (T3) — la détection du RETOUR SPONTANÉ sur le thème d'une branche. Module PUR (AD-1),
 * même découpe que `reconceptualisation.ts` : ici vivent la PRÉSÉLECTION déterministe, l'instruction
 * structurée et le parser ; le seul I/O (l'appel egress au modèle fort) vit dans l'orchestrateur
 * `lib/safety/retour-theme-pipeline.ts`, jamais ici.
 *
 * POURQUOI UN HYBRIDE (décision D1). Un recouvrement lexical seul rate la paraphrase — « maman » pour
 * « ma mère », « j'ai posé une limite » pour « j'ai osé dire non » — et c'est précisément ce cas-là qui
 * compte. Un modèle seul ferait grossir le payload avec le nombre de branches. Donc : présélection
 * déterministe (bornée, gratuite) puis UNE confirmation forte.
 *
 * ET SURTOUT — l'effet est IRRÉVERSIBLE : `intensite` ne redescend jamais. Un faux négatif retarde un
 * épaississement de trait ; un faux positif inscrit DÉFINITIVEMENT dans son arbre qu'elle est revenue
 * sur un thème qu'elle n'a pas abordé. L'asymétrie impose la PRÉCISION avant le rappel : le doute ne
 * retient RIEN, des deux côtés du pipeline.
 *
 * [AC7 DUR] Le `nom` d'une branche ne transite JAMAIS vers un modèle (migration 0021 L7-L9 :
 * « proposition & nommage 100 % déterministes »). Il sert à la présélection — qui reste ENTIÈREMENT
 * en mémoire serveur — et rien d'autre. Ce qui part au modèle, ce sont les EXTRAITS de journal, du
 * contenu qui transite déjà légitimement sous l'egress art. 9.
 */

/** Une branche candidate au retour. `nom` est du LOCAL PUR : il ne quitte jamais ce processus. */
export interface BrancheCandidate {
  readonly id: string;
  /** art. 9 — présélection uniquement, JAMAIS envoyé au modèle (AC7). */
  readonly nom: string;
  /** Le verbatim du moment dont la branche est née : c'est LUI qui part au modèle. */
  readonly extrait: string;
  /** État vivant — sert à écarter les branches qui ne peuvent PLUS progresser (voir `peutEncoreFeuiller`). */
  readonly etat: EtatBranche;
  readonly intensite: number;
}

/**
 * Cette branche a-t-elle encore quelque chose à gagner d'un retour ? Délègue à la FONCTION DE TRANSITION
 * UNIQUE (`lib/domain/cycle-branche`) — c'est elle qui possède la règle, ici on ne fait que la consulter.
 *
 * ⚠️ REVUE — deux défauts d'un coup. (1) `transitionner` n'avait AUCUN appelant de production : la
 * « fonction de transition unique dans `lib/domain/` » qu'exigent AC1 et AD-8 était du code mort, et la
 * règle vivait en réalité uniquement dans le SQL. (2) Une branche au feuillage PLEIN restait candidate :
 * son verbatim art. 9 repartait au modèle à chaque tour pour rien, et elle évinçait du plafond de trois
 * des branches qui, elles, pouvaient encore pousser.
 */
export function peutEncoreFeuiller(c: BrancheCandidate): boolean {
  return transitionner({ etat: c.etat, intensite: c.intensite }, { type: "retour" }).change;
}

/** Au-delà, le payload grossit sans gagner en justesse — et l'art. 9 exposé grossit avec lui. */
export const MAX_CANDIDATS = 3;

/**
 * Mots trop fréquents pour porter un thème. Volontairement COURTE : la vraie sélectivité vient de la
 * longueur minimale et de l'exigence de recouvrement, pas d'une liste qu'il faudrait maintenir.
 */
const VIDES = new Set([
  "ainsi", "alors", "aussi", "autre", "avec", "avoir", "beaucoup", "bien", "cela", "cette", "chez",
  "chose", "comme", "dans", "depuis", "dire", "donc", "dont", "elle", "elles", "encore", "etre",
  "fait", "faire", "juste", "leur", "leurs", "mais", "meme", "moins", "nous", "parce", "pareil",
  "pense", "peut", "plus", "pour", "quand", "quelque", "quoi", "rien", "sais", "sans", "sentir",
  "sous", "toujours", "tous", "tout", "toute", "tres", "trop", "vais", "vers", "vous", "vraiment",
]);

/**
 * Longueur minimale d'un mot porteur. QUATRE, pas cinq : « mère », « peur », « seul », « dire non »
 * sont exactement les mots qui nomment un thème en français, et les couper reviendrait à ne jamais
 * reconnaître le retour le plus fréquent. Les outils grammaticaux de quatre lettres sont écartés
 * nommément par `VIDES` — une liste, ici, est plus juste qu'un seuil.
 */
const LONGUEUR_MOT = 4;

/**
 * Normalise pour comparer : minuscules, accents retirés, ponctuation en séparateur. `NFD` + retrait
 * des diacritiques fait que « mère » et « mere » se rencontrent — sans ça, la présélection raterait
 * une écriture sans accent, fréquente au clavier mobile.
 */
export function motsPorteurs(texte: string): Set<string> {
  const normalise = texte
    // \u26a0\ufe0f REVUE \u2014 les LIGATURES d'abord : `NFD` d\u00e9compose les diacritiques, mais \u00ab \u0153 \u00bb et \u00ab \u00e6 \u00bb ne sont
    // PAS d\u00e9composables. Elles tombaient donc dans le s\u00e9parateur `[^a-z0-9]+`, coupaient le mot en deux
    // fragments trop courts, et le mot DISPARAISSAIT. \u00ab s\u0153ur \u00bb, \u00ab c\u0153ur \u00bb, \u00ab v\u0153u \u00bb, \u00ab n\u0153ud \u00bb, \u00ab m\u0153urs \u00bb \u2014
    // le vocabulaire d'un journal intime. Et le clavier iOS corrigeant \u00ab coeur \u00bb en \u00ab c\u0153ur \u00bb, le m\u00eame
    // mot tap\u00e9 par la m\u00eame personne s'appariait un jour et pas l'autre.
    .replace(/\u0153/gi, "oe")
    .replace(/\u00e6/gi, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const mots = normalise.split(/[^a-z0-9]+/).filter((m) => m.length >= LONGUEUR_MOT && !VIDES.has(m));
  return new Set(mots);
}

/** Nombre de mots porteurs communs — la mesure de proximité, volontairement grossière. */
export function recouvrement(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const m of a) if (b.has(m)) n++;
  return n;
}

/**
 * PRÉSÉLECTION déterministe : les branches dont le thème POURRAIT être celui du tour. Elle ne décide
 * rien — elle borne ce qu'on ira demander au modèle. Un seul mot porteur commun suffit à passer :
 * être large ici est sans risque (le modèle tranche derrière), tandis qu'être étroit ferait rater
 * silencieusement des retours réels.
 *
 * Le `nom` participe à la comparaison — c'est souvent le meilleur résumé du thème, et il ne quitte
 * jamais le serveur (AC7). Ordre TOTAL (score décroissant, puis id) : deux exécutions sur les mêmes
 * données donnent la même liste, sinon la détection deviendrait irreproductible.
 */
export function preselectionner(
  branches: readonly BrancheCandidate[],
  tour: string,
  maxCandidats: number = MAX_CANDIDATS,
): BrancheCandidate[] {
  const motsTour = motsPorteurs(tour);
  // Un tour sans aucun mot porteur (« ok », « oui ») ne réveille rien : pas d'appel fort pour rien.
  if (motsTour.size === 0) return [];

  // Écarter d'ABORD ce qui ne peut plus progresser : inutile d'exposer un verbatim art. 9 pour une
  // branche arrivée, et surtout inutile qu'elle occupe une des trois places du plafond.
  const vivantes = branches.filter(peutEncoreFeuiller);

  const apparies = vivantes
    .map((b) => ({ b, score: recouvrement(motsPorteurs(`${b.nom} ${b.extrait}`), motsTour) }))
    .filter((c) => c.score > 0)
    .sort((x, y) => y.score - x.score || x.b.id.localeCompare(y.b.id))
    .slice(0, Math.max(0, maxCandidats))
    .map((c) => c.b);
  if (apparies.length > 0) return apparies;

  /**
   * ⚠️ REVUE — le lexical était un PORTAIL FERMÉ, pas un classeur. Quand rien ne s'appariait, le pipeline
   * s'arrêtait net : aucun appel, aucun rattrapage possible. Or la paraphrase — « j'ai posé une limite
   * avec maman » pour une branche « dire non à ma mère » — ne partage AUCUN mot porteur. Le retour le
   * plus significatif qu'elle puisse faire était exactement celui que l'arbre ignorait, silencieusement
   * (FR-031 interdit toute jauge : rien à l'écran ne le lui aurait dit) et indéfiniment.
   *
   * REPLI, borné par le coût : si l'ensemble des candidats tient DÉJÀ dans l'envoi, on les transmet tous
   * — la charge et l'art. 9 exposé sont identiques à ceux d'un appariement réussi, et c'est la situation
   * d'une utilisatrice de ses premiers mois. Au-delà, le lexical redevient un classeur et la paraphrase
   * peut être ratée : limite ASSUMÉE et documentée, pas silencieuse.
   */
  return vivantes.length <= maxCandidats ? [...vivantes] : [];
}

/**
 * ⚠️ PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE SUR DONNÉES RÉELLES, au même titre
 * qu'`INSTRUCTION_RECONCEPTUALISATION`. On code la MACHINE (sortie structurée → décision → écriture
 * gardée) ; pas le JUGEMENT (ce qui fait qu'un thème est « le même »).
 */
export const INSTRUCTION_RETOUR_THEME = [
  "[PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE SUR DONNÉES RÉELLES]",
  "Tu observes le DERNIER message de l’utilisatrice, puis une liste numérotée de moments plus anciens",
  "de sa propre vie. Pour chaque moment, dis si le dernier message REVIENT SUR LE MÊME SUJET DE FOND —",
  "la même situation, la même relation, la même question ouverte — même si les mots sont différents.",
  "Ce n’est PAS un retour si le lien est seulement une émotion partagée, un mot commun, ou un thème",
  "général (le travail, la famille) sans que ce soit la MÊME chose qui revienne.",
  "Réponds UNIQUEMENT par cette ligne, avec les numéros concernés séparés par des virgules, ou `aucun` :",
  "RETOURS: (numéros des moments sur lesquels ce message revient)",
  "En cas de doute, réponds `aucun` : ne retiens un retour que s’il est MANIFESTE — jamais inféré.",
].join("\n");

export interface DecisionRetour {
  /** Index (0-based) des candidats confirmés. Vide = aucun retour retenu. */
  readonly indices: readonly number[];
}

/**
 * La ligne `RETOURS:` doit être EXACTEMENT une liste de nombres — rien d'autre. Un seul mot qui traîne
 * disqualifie la ligne entière.
 *
 * ⚠️ REVUE (défaut HAUTE, reproduit bout-en-bout). L'ancienne lecture prenait toute la fin de ligne et
 * gardait tous les entiers dans les bornes. Or l'instruction dit au modèle « en cas de doute, réponds
 * `aucun` » — et un modèle fort répond en français naturel : « RETOURS: aucun. Le message ne revient ni
 * sur 1, ni sur 2, ni sur 3. » L'ancien parser en tirait `[0,1,2]` et faisait feuiller LES TROIS
 * branches. Invisible (l'étage tourne dans `after()`), non journalisé, et DÉFINITIF : l'arbre ne
 * régresse jamais (FR-029). Une réponse qui dit NON écrivait donc dans son arbre des thèmes qu'elle
 * n'avait jamais abordés, jusqu'à l'effacement.
 *
 * Refuser toute ligne non strictement numérique coûte un faux négatif quand le modèle bavarde en
 * confirmant — le prochain retour rattrapera. Le sens inverse ne se rattrape pas.
 */
const LIGNE_NUMERIQUE = /^\s*\d+(?:\s*[,;\s]\s*\d+)*\s*$/;

/**
 * Lit la ligne structurée `RETOURS: 1,3` (numéros 1-based). Scanne TOUTES les occurrences et retient
 * la DERNIÈRE conforme (la conclusion — patron `detecterReconceptualisation`). Illisible, absente,
 * bavarde, ou hors bornes → rien : le doute ne fait progresser AUCUNE branche.
 */
export function lireRetoursTheme(sortieModele: string, nbCandidats: number): DecisionRetour {
  let derniere: string | null = null;
  for (const m of sortieModele.matchAll(/RETOURS\s*[:=]\s*([^\n\r]*)/gi)) derniere = m[1];
  if (derniere === null || !LIGNE_NUMERIQUE.test(derniere)) return { indices: [] };

  const indices = new Set<number>();
  for (const brut of derniere.trim().split(/[,;\s]+/)) {
    const n = Number.parseInt(brut, 10);
    // 1-based côté modèle → 0-based côté domaine. Hors bornes = hallucination : on l'ignore, jamais
    // on ne la rabat sur un candidat voisin (ça ferait pousser la MAUVAISE branche).
    if (Number.isInteger(n) && n >= 1 && n <= nbCandidats) indices.add(n - 1);
  }
  return { indices: [...indices].sort((a, b) => a - b) };
}

/**
 * Construit la requête : passe FORTE séparée, sous egress art. 9. `capacite: "retour_theme"` ⇒ tier
 * fort résolu par la politique unique (AD-5).
 *
 * [AC7 DUR] Seuls les EXTRAITS sont sérialisés — jamais `candidat.nom`. Un test dédié monte des noms
 * distinctifs et vérifie qu'aucun n'apparaît dans le payload : c'est la garde qui compte, parce que
 * l'erreur inverse (ajouter le nom « pour aider le modèle ») serait une régression invisible.
 */
/**
 * Longueur maximale d'un extrait envoyé au modèle. Un verbatim n'est pas borné en base (300 caractères
 * ne s'appliquent qu'au `nom`) : minimisation art. 9 et coût. Le début d'un tour porte son sujet.
 */
const EXTRAIT_MAX = 400;

/**
 * Rend un extrait sûr à mettre dans une liste numérotée : sur UNE ligne, et borné.
 *
 * ⚠️ REVUE (défaut HAUTE, second chemin). L'extrait est du verbatim BRUT — et sur mobile, Entrée fait un
 * saut de ligne. Une utilisatrice qui écrit « J'ai compris deux choses :\n1. …\n2. … » injectait de VRAIES
 * lignes numérotées dans le payload : le modèle visait une ligne interne, le mapping numéro → branche
 * glissait d'un cran, et c'est la MAUVAISE branche qui feuillait — définitivement.
 *
 * On aplatit plutôt que de tronquer au premier saut de ligne : amputer le verbatim ferait juger le
 * modèle sur un fragment, et c'est son sens complet qui décide s'il y a retour.
 */
function extraitSurUneLigne(extrait: string): string {
  const plat = extrait.replace(/\s+/g, " ").trim();
  return plat.length <= EXTRAIT_MAX ? plat : `${plat.slice(0, EXTRAIT_MAX)}…`;
}

export function requeteRetourTheme(messages: MessageIa[], candidats: readonly BrancheCandidate[]): RequeteIa {
  const liste = candidats.map((c, i) => `${i + 1}. ${extraitSurUneLigne(c.extrait)}`).join("\n");
  return {
    capacite: "retour_theme",
    messages: [
      { role: "system", content: INSTRUCTION_RETOUR_THEME },
      ...messages,
      { role: "system", content: `Moments à comparer :\n${liste}` },
    ],
    contientArt9: true,
  };
}
