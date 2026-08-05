/**
 * Story 4.9 — LE DOMAINE PUR DE LA SYNTHÈSE. Aucune I/O, aucun framework, aucune infra (AD-1).
 *
 * Trois décisions vivent ici, et une seule fois chacune :
 *
 *   • FAUT-IL PRODUIRE ? (D3) — une période sans rien à dire ne produit rien du tout. FR-034 est
 *     catégorique : « Anam ne se manifeste que lorsqu'elle a quelque chose de spécifique à dire. Aucun
 *     message générique récurrent. » Une synthèse « il ne s'est rien passé » EST ce message-là.
 *   • QUELLE PÉRIODE ? (D2) — de la dernière synthèse à maintenant, jamais une fenêtre glissante de sept
 *     jours. Un tick manqué ne doit pas creuser un trou définitif dans le récit.
 *   • QUE FAIRE DU TROP-PLEIN ? — le plafond mord par le PLUS ANCIEN, et la synthèse le dit.
 *
 * Ce qui N'EST PAS ici : l'exclusion de détresse et le filtre des tombstones. Ils vivent dans la base
 * (`entrees_hors_detresse`, `materiau_synthese`), parce qu'une garde qu'un appelant peut oublier n'est
 * pas une garde — c'est ce que l'AC3 demande littéralement.
 */

/**
 * Le nombre maximal d'entrées de journal envoyées au modèle fort pour une synthèse.
 *
 * La période n'étant pas bornée (D2 : depuis la dernière synthèse, quelle qu'en soit la durée), il faut
 * une borne ailleurs — sinon un retour après trois mois d'absence enverrait trois mois de journal en une
 * requête. 200 entrées, c'est-à-dire environ cent tours de conversation : très au-delà d'une semaine
 * ordinaire, et sous la fenêtre du modèle fort.
 */
export const PLAFOND_ENTREES = 200;

/**
 * Le plafond de notification, tous motifs confondus (AC4, FR-035). Il borne le CANAL, jamais le CONTENU :
 * une synthèse refusée par le plafond est quand même écrite et consultable — c'est le courriel qui ne part
 * pas. Confondre les deux reviendrait à laisser une règle de politesse effacer un récit.
 */
export const PLAFOND_NOTIFICATION_HEURES = 72;

/**
 * Combien d'utilisatrices au plus par tick. Le fan-out est séquentiel dans une lambda bornée à 60 s et
 * chaque personne coûte un appel au modèle fort : le lot doit tenir dans le budget. Celles qui n'ont pas
 * eu leur tour reviennent demain — la reprise quotidienne EST le mécanisme (cf. le piège de la cadence).
 */
export const LOT_PAR_TICK = 20;

export interface EntreeMateriau {
  readonly role: "utilisatrice" | "anam";
  readonly contenu: string;
  readonly cree_le: string;
}

export interface MateriauSynthese {
  /** Fin de la dernière synthèse, ou `null` s'il n'y en a jamais eu. */
  readonly depuis: string | null;
  /** L'instant où la base a lu le matériau. Devient `periode_fin`, donc le `depuis` de la prochaine. */
  readonly jusqu_a: string;
  /** Nombre total d'entrées éligibles, AVANT le plafond. */
  readonly total: number;
  readonly tronquee: boolean;
  readonly entrees: readonly EntreeMateriau[];
  readonly faits: readonly string[];
}

export interface PeriodeSynthese {
  readonly debut: string;
  readonly fin: string;
  readonly tronquee: boolean;
}

/**
 * Y a-t-il quelque chose à dire ? (D3)
 *
 * La condition est l'existence d'au moins une ENTRÉE DE JOURNAL éligible — pas d'un fait, pas d'une
 * branche. Le distinguo n'est pas un détail : les faits sont cumulatifs et survivent aux périodes, si
 * bien qu'« il existe des faits » serait vrai pour toujours dès la première semaine. On synthétiserait
 * alors chaque semaine, y compris les vides, ce qui est exactement l'inverse de FR-034.
 *
 * Le matériau arrive déjà purgé de la détresse (AC3) : une personne dont toute la période s'est passée
 * en épisode ouvert n'a donc rien d'éligible, et ne reçoit rien. C'est voulu — rien ne naît pendant la
 * détresse (AD-17).
 */
export function aQuelqueChoseADire(materiau: MateriauSynthese): boolean {
  return materiau.entrees.length > 0;
}

/**
 * La période effectivement racontée.
 *
 * Le début n'est PAS `depuis` : quand le plafond a mordu, les entrées les plus anciennes ont été
 * écartées et la synthèse ne couvre plus que ce qu'elle a réellement lu. Le début est donc la plus
 * ancienne entrée GARDÉE — annoncer autre chose serait promettre un récit qu'on n'a pas écrit.
 *
 * Rend `null` quand il n'y a rien à raconter : `aQuelqueChoseADire` est la garde, et cette fonction ne
 * fabrique pas une période à partir de rien.
 */
export function periodeDe(materiau: MateriauSynthese): PeriodeSynthese | null {
  const premiere = materiau.entrees[0];
  if (!premiere) return null;
  return { debut: premiere.cree_le, fin: materiau.jusqu_a, tronquee: materiau.tronquee };
}
