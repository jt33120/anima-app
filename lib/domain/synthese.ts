import { FUSEAU } from "@/lib/domain/ordonnanceur";

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
 *   • QUE FAIRE DU TROP-PLEIN ? — le plafond mord par le PLUS RÉCENT : on garde le DÉBUT de la période,
 *     et le filigrane s'arrête à la dernière entrée lue. La suite est racontée le lendemain, dans une
 *     tranche qui reprend exactement là. Revu par la revue 4.9 : mordre par le plus ancien (la version
 *     d'origine) écartait le début de la période puis posait le filigrane à MAINTENANT — ce qui avait été
 *     écarté passait sous le filigrane et n'entrait plus jamais dans aucune synthèse. La première
 *     synthèse visant tout le journal depuis l'inscription, une utilisatrice bavarde perdait sa première
 *     année dès le jour un. Le récit est chronologique ou il n'est pas.
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
 * Le plafond de TAILLE, en caractères, d'une tranche envoyée au modèle.
 *
 * `PLAFOND_ENTREES` seul ne bornait rien : 200 est un nombre d'entrées, et rien ne borne la longueur
 * d'une entrée — ni contrainte en base, ni `maxLength` au composeur. 200 entrées de 2,5 ko (soit ~350
 * mots chacune : quelqu'un qui journalise en paragraphes, pas un abus) dépassent la fenêtre du modèle.
 * La requête échouait alors en 400, rien n'était écrit, le filigrane n'avançait pas — donc les mêmes 200
 * entrées le lendemain, et la même erreur, tous les jours, pour toujours, et en silence puisqu'un incident
 * n'est levé que si TOUT le lot échoue.
 *
 * 200 000 caractères ≈ 55 000 jetons de français : large pour une tranche, et loin sous la fenêtre du
 * modèle fort même en comptant la consigne et la sortie.
 */
export const PLAFOND_OCTETS = 200_000;

/**
 * La longueur maximale acceptée pour une synthèse produite. Au-delà, on coupe plutôt que de refuser :
 * refuser ferait échouer la tranche, donc la rejouer à l'identique demain, donc échouer à nouveau.
 */
export const LONGUEUR_SYNTHESE_MAX = 20_000;

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
  /**
   * LE FILIGRANE de cette tranche — jusqu'où elle va. Devient `periode_fin`, donc le `depuis` de la
   * prochaine. Quand `tronquee`, ce n'est PAS l'instant de lecture mais l'horodatage de la dernière
   * entrée réellement lue : c'est ce qui fait que la tranche suivante reprend exactement là, et que
   * rien ne tombe entre les deux.
   */
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

/**
 * La sortie du modèle, avant écriture (revue 4.9, T2-3).
 *
 * C'était la SEULE sortie de modèle du produit qui n'était bornée par rien. Partout ailleurs il y a une
 * garde : `extraireNiveau` et `extraireFamille` sont des parseurs à repli sûr, `lireBooleen` répond
 * `false` dans le doute, `structurerBilan` n'émet AUCUN bilan plutôt qu'un bloc malformé, le flux
 * conversationnel est coupé à trois phrases. Ici, `reponse.texte` allait tel quel en base.
 *
 * Deux conséquences réelles. Le modèle refuse — « Je ne peux pas vous aider avec cela. » — et ce refus
 * est stocké verbatim, annoncé par courriel, et lu par elle comme le récit de sa semaine. Ou le modèle
 * rend du blanc, la contrainte `length(btrim(contenu)) > 0` lève, la tranche échoue, et comme le
 * filigrane n'avance pas elle est rejouée à l'identique le lendemain : une garde de base de données
 * transformée en panne permanente.
 *
 * Rend `null` quand il n'y a rien d'écrivable — l'appelant clôt alors en échec, ce qui est la vérité :
 * on a payé un appel au modèle fort et on n'a rien obtenu.
 */
export function validerSortieSynthese(texte: string | null | undefined): string | null {
  const propre = (texte ?? "").trim();
  if (propre.length === 0) return null;
  // On COUPE plutôt que de refuser : refuser rejouerait la même tranche demain, pour le même résultat.
  return propre.length > LONGUEUR_SYNTHESE_MAX ? propre.slice(0, LONGUEUR_SYNTHESE_MAX) : propre;
}

/**
 * La période racontée, écrite pour être lue (revue 4.9, T6-1).
 *
 * Elle vit ICI, dans le domaine, et pas dans `render/`, pour deux raisons qui se rejoignent. La première
 * est que le fuseau est une DÉCISION, et que le rendu ne décide pas (AD-7, AD-10) — la garde
 * d'architecture du dépôt refuse d'ailleurs tout import de `lib/domain` depuis `render/`, et c'est elle
 * qui a tranché. La seconde est que la fonction était RECOPIÉE à l'identique dans la halte et dans la
 * fiche, et que les deux copies omettaient `timeZone` : le rendu se faisait donc dans le fuseau du
 * serveur — Paris en développement, UTC en production. Une entrée écrite à 00 h 30 heure de Paris, heure
 * de journal intime s'il en est, s'affichait la veille une fois déployée. Le défaut ne se voyait pas en
 * local, et il fallait le corriger deux fois : la duplication n'était pas le symptôme, elle était la cause.
 */
export function periodeLisible(debut: string, fin: string): string {
  const jour = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: FUSEAU,
    });
  const [d, f] = [jour(debut), jour(fin)];
  // Une tranche peut tenir dans une seule journée — c'est le cas quand le plafond mord sur peu d'entrées.
  // « Du 3 août au 3 août » se lit comme une erreur d'affichage ; ce n'en est pas une, mais autant l'écrire
  // comme quelqu'un l'écrirait.
  return d === f ? `Le ${d}` : `Du ${d} au ${f}`;
}
