import "server-only";
import type { DescriptionJob } from "@/lib/domain/ordonnanceur";
import type { DepotOrdonnanceur } from "@/lib/data/depot-ordonnanceur";
import { executerSante, RESERVE_INCIDENT_MS } from "@/lib/ordonnanceur/jobs/sante";
import { executerSynthese, NOM_JOB as NOM_SYNTHESE } from "@/lib/ordonnanceur/jobs/synthese";
import {
  executerRappelEcheance,
  NOM_JOB as NOM_RAPPEL,
  RESERVE_ENVOI_MS,
} from "@/lib/ordonnanceur/jobs/rappel-echeance";
import {
  executerSocleQuotidien,
  NOM_JOB as NOM_SOCLE,
  DELAI_JOB_SOCLE_MS,
  RESERVE_PERSONNE_POUSSEE_MS,
} from "@/lib/ordonnanceur/jobs/socle-quotidien";
import { RESERVE_PERSONNE_MS } from "@/lib/domain/synthese";

/**
 * Story 4.8 (AC1) — LE REGISTRE. La liste, unique et déclarative, de tout ce qui s'exécute périodiquement
 * dans ce produit.
 *
 * C'est le fichier qu'on lit pour répondre à « qu'est-ce qui tourne tout seul ici ? ». Que cette question
 * ait UNE réponse tient à une seule chose : rien d'autre dans le dépôt ne déclenche de mécanisme périodique.
 * Un test de garde (`tests/ordonnanceur-architecture.test.ts`) casse le build si ça change — c'est l'AC4.
 *
 * Le futur pensionnaire, déjà nommé ailleurs et volontairement absent ici :
 *   • la rétention et l'effacement (Epic 6, AD-14).
 *
 * Le socle quotidien (FR-033) y est entré en Story 6.2 — autre FAMILLE de notification, autre rythme,
 * et le premier job dont l'utilité dépend d'une cadence plus fine que sa propre fenêtre.
 *
 * ── LE BUDGET DE TEMPS EST UNE RESSOURCE PARTAGÉE, ET IL ÉTAIT PLEIN (Story 4.10, décision D5) ────────
 *
 * La garde exige `Σ delaiMs + margeHorsDelais(n) ≤ BUDGET_TICK_MS`. À deux jobs, la somme valait
 * 12 + 38 = 50 s : il restait exactement DEUX SECONDES, et le troisième job ne rentrait pas.
 *
 * Le rééquilibrage prend le temps là où il ne servait à rien plutôt que là où il sert. Le job de SANTÉ
 * lit un état et lève au plus trois incidents — trois ou quatre allers-retours, jamais douze secondes ;
 * il passe à 6 s. La SYNTHÈSE garde l'essentiel (36 s), parce qu'elle appelle le modèle fort et qu'une
 * seconde garde exige qu'elle puisse tenter AU MOINS une personne (son `reserveMs`).
 * Le RAPPEL prend 8 s, ce qui est large : il ne fabrique rien, il lit des dates et poste des courriels.
 *
 * Σ = 6 + 36 + 8 = 50 s — soit EXACTEMENT ce que le registre consommait déjà. La plateforme ne voit
 * aucune différence ; c'est la répartition interne qui a changé. (Le socle quotidien y a ajouté 10 s
 * en 6.2, et c'est le budget du TICK qui est monté, pas la répartition des trois premiers.)
 *
 * ⚠️ NE PAS « RÉGLER » UN DÉPASSEMENT FUTUR EN MONTANT LA MARGE. Cette marge couvre ce qui vit HORS des
 * `avecDelai` (vérification d'environnement, `reclamer`/`clore` de chaque job, sérialisation de la
 * réponse), et elle grandit avec le nombre de jobs, pas l'inverse. L'élargir pour faire entrer un job
 * reviendrait à supprimer la garde en prétendant la respecter. Depuis la 6.1 c'est une FONCTION
 * (`margeHorsDelais`), calibrée sur un comptage du répartiteur, et bornée dans les deux sens.
 *
 * ── LE BUDGET SE LÈVE QUAND UN JOB ENTRE, JAMAIS EN PRÉVISION (Story 6.1) ─────────────────────────────
 *
 * Le plafond de 60 s n'a JAMAIS été celui de la plateforme : il vient de notre propre
 * `app/api/ordonnanceur/route.ts`. Le vrai plafond du palier vit dans `lib/domain/ordonnanceur-budget.ts`
 * (300 s sur `hobby`), et la chaîne gardée est désormais à trois termes :
 *
 *     Σ delaiMs + margeHorsDelais(n)  ≤  BUDGET_TICK_MS  ≤  PLAFOND_DUREE_MS[PALIER]
 *
 * Chaque story qui ajoute un job monte `BUDGET_TICK_MS` **et** le littéral `maxDuration` DANS LE MÊME
 * COMMIT. Acheter du plafond « pour être tranquille » reconstruirait exactement le mou dans lequel la
 * garde cesse de mordre — d'où la borne HAUTE sur le mou (`RESERVE_DECLAREE_MS`).
 *
 * ── LE MULTI-TICK EST UNE REPRISE SUR ÉCHEC, PAS UN DÉBIT ────────────────────────────────────────────
 *
 * Ajouter des ticks ne fait PAS passer l'invariant de `Σ delaiMs` à `max(delaiMs)`, et n'aide donc pas
 * un registre plein. `executer.ts` itère TOUT le registre à chaque tick, et `fenetreDe("quotidien", …)`
 * rend la même clé civile toute la journée : au tick suivant la réclamation refuse, le répartiteur
 * pousse `deja_fait` et passe — `job.executer` n'est jamais rappelé. Un second tick ne sert qu'à
 * rattraper un tick qui a échoué.
 *
 * ⚠️ Et sur le palier `hobby`, un second tick est purement impossible : une expression plus fréquente
 * qu'une fois par jour FAIT ÉCHOUER LE DÉPLOIEMENT.
 */

export interface ContexteJob {
  readonly depot: DepotOrdonnanceur;
  readonly instant: Date;
  /**
   * L'ÉCHÉANCE du job — `instant + delaiMs` (revue 4.9, T3-1). Un job qui fait du travail par lots doit
   * pouvoir s'arrêter DE LUI-MÊME avant que le répartiteur ne le coupe.
   *
   * La différence n'est pas cosmétique : coupé par `avecDelai`, le job est clos en `echoue` et lève un
   * `job_echoue` — alors qu'il a peut-être servi tout le monde. Ce mensonge quotidien faisait répondre
   * `degrade` à la sonde publique en permanence dès le premier jour de production, ce qui est la façon
   * la plus sûre de rendre une alarme inutile. Rendre la main proprement, c'est réussir.
   */
  readonly echeance: Date;
  /** Le registre lui-même — le job de santé en a besoin, et le lui passer évite un cycle d'importation. */
  readonly registre: readonly JobEnregistre[];
}

export interface JobEnregistre extends DescriptionJob {
  readonly executer: (ctx: ContexteJob) => Promise<void>;
  /**
   * LE PLANCHER DE CE JOB (Story 6.1, AC5) — ce qu'il lui faut au minimum pour faire **une** unité de
   * travail : une personne servie, un courriel posté, un incident levé.
   *
   * ⚠️ **Requis, jamais optionnel.** Un `?` viderait de son sens l'anti-vacuité de la garde : un job
   * ajouté sans plancher passerait en `undefined`, la comparaison `delaiMs >= undefined` rendrait
   * `false`… ou serait simplement sautée selon l'écriture. Le type doit obliger l'auteur d'un job à
   * répondre à la question « et il te faut combien pour servir une seule personne ? ».
   *
   * ⚠️ **Rétrécir les `delaiMs` pour faire tenir l'addition n'est une solution que tant que chaque job
   * peut encore faire quelque chose.** Un job dont le budget passe sous son plancher rend la main à
   * chaque tick sans jamais servir personne — un système qui ne fait rien, et qui le fait sans se
   * plaindre. C'est exactement ce que cette valeur rend impossible.
   */
  readonly reserveMs: number;
}

export const REGISTRE: readonly JobEnregistre[] = [
  {
    nom: "sante-ordonnanceur",
    cadence: "quotidien",
    // 60 h, et surtout PAS 48. L'intention est « un tick manqué ne déclenche rien, deux ticks manqués, si ».
    // À 48 h — pile deux fois la cadence — la comparaison au deuxième tick tombait à quelques secondes de la
    // bascule : elle se jouait sur la dérive de planification de l'ordonnanceur externe, qui se compte
    // en minutes (±59 min sur le palier `hobby`) — la même panne alertait ou non selon l'horaire. 60 h place le seuil au MILIEU de l'intervalle
    // [48 h, 72 h] : deux ticks manqués alertent toujours, un seul jamais (revue 4.8, défaut n°9).
    toleranceHeures: 60,
    // 8 s (6 s jusqu'à la 6.2). ⚠️ **Ce nombre n'est pas un réglage, c'est une CONSÉQUENCE.** Ce job
    // lit `etat()` — un aller-retour — puis lève au plus un incident PAR JOB DU REGISTRE : son
    // plancher vaut `COUT_ETAT_MS + RESERVE_INCIDENT_MS × (n + 1)` et grandit donc quand un job
    // entre. L'arrivée du socle l'a porté à 7 200 ms, au-dessus des 6 000 qu'il avait — et c'est
    // `tests/sante-job.test.ts` qui l'a dit, pas une relecture.
    //
    // C'est exactement ce que la 6.1 avait construit : le budget est une ressource PARTAGÉE, et un
    // job qui entre peut renchérir le coût d'un autre sans le toucher. Un plafond acheté « pour être
    // tranquille » aurait avalé le signal.
    delaiMs: 8_000,
    // Son unité de travail est UN incident levé. Le plancher complet de ce job est plus exigeant que
    // cette seule valeur — il croît avec le registre — et vit dans `tests/sante-job.test.ts`
    // (`COUT_ETAT_MS + RESERVE_INCIDENT_MS × (n + 1)`), parce qu'il dépend de quelque chose que le
    // registre ne peut pas connaître de l'intérieur : sa propre longueur.
    reserveMs: RESERVE_INCIDENT_MS,
    // Le jour où ce job est entré au registre (Story 4.8). Lu seulement tant qu'il n'a jamais réussi.
    enServiceDepuis: new Date("2026-08-05T00:00:00Z"),
    executer: executerSante,
  },
  {
    // ⚠️ QUOTIDIEN, et la synthèse ne l'est pas. Ce n'est pas une erreur — c'est le mécanisme de reprise
    // ET celui du rattrapage. Le job est un FAN-OUT : il repasse chaque jour et réclame une fenêtre
    // QUOTIDIENNE par personne ; c'est la CADENCE, en base, qui décide s'il faut la servir aujourd'hui
    // (sept jours depuis la dernière période racontée, sauf rattrapage en cours). Voir l'en-tête de
    // `jobs/synthese.ts`.
    nom: NOM_SYNTHESE,
    cadence: "quotidien",
    // 60 h, pour la même raison que le job de santé : jamais pile sur un multiple de la cadence.
    toleranceHeures: 60,
    // Le délai borne le FAN-OUT entier, pas une personne — chaque personne a en plus son propre bail
    // (`BAIL_PERSONNE_S`) et son propre délai sur l'appel modèle (`DELAI_MODELE_MS`).
    //
    // 36 s (38 avant la 4.10) — et la somme du registre compte : 6 + 36 + 8 = 50 s pour un tick borné
    // à `BUDGET_TICK_MS`. À 15 + 50 = 65 s, le budget du registre dépassait celui du tick, et le
    // dernier job pouvait être tué par la plateforme AVANT que son propre `avecDelai` ne s'arme —
    // rien de clos, aucun incident levé, la ligne laissée `en_cours` : un échec totalement muet.
    // Un test d'architecture garde la chaîne `Σ + margeHorsDelais(n) ≤ BUDGET_TICK_MS ≤ plafond du
    // palier`, ET le fait que ce job-ci garde de quoi tenter au moins une personne (`reserveMs`).
    delaiMs: 36_000,
    // Son unité de travail est UNE personne : l'appel au modèle fort, plus ses allers-retours.
    reserveMs: RESERVE_PERSONNE_MS,
    enServiceDepuis: new Date("2026-08-05T00:00:00Z"),
    executer: executerSynthese,
  },
  {
    // Story 4.10 (AC3). QUOTIDIEN, sans rattrapage : la sélection ne regarde que les échéances du JOUR
    // MÊME. Un tick manqué perd les rappels de ce jour-là, définitivement — et c'est le comportement
    // voulu (un rappel qui arrive avec trois jours de retard est un reproche daté), pas une lacune.
    nom: NOM_RAPPEL,
    cadence: "quotidien",
    // 60 h, pour la même raison que les deux autres : jamais pile sur un multiple de la cadence, sans
    // quoi l'alerte se joue sur la dérive de planification de l'ordonnanceur externe — le hasard.
    toleranceHeures: 60,
    // 8 s, et c'est confortable : ce job ne fabrique RIEN. Aucun appel modèle (décision D1 — elle écrit
    // les intentions, pas Anam), donc aucun budget à réserver pour une réponse qui traîne. Il lit des
    // dates, réserve un canal, poste des courriels : quatre allers-retours par personne, dix au plus.
    delaiMs: 8_000,
    // Son unité de travail est UN courriel posté : l'envoi borné, plus ses allers-retours.
    // ⚠️ `RESERVE_ENVOI_MS` (5 500), et surtout PAS `RESERVE_PERSONNE_MS` (31 000) : les deux
    // s'appelaient pareil jusqu'à la 6.1, et l'auto-complétion importait la mauvaise sans le moindre
    // signal — un plancher près de six fois trop laxiste, silencieusement.
    reserveMs: RESERVE_ENVOI_MS,
    enServiceDepuis: new Date("2026-08-06T00:00:00Z"),
    executer: executerRappelEcheance,
  },
  {
    // Story 6.2 (AC2). QUOTIDIEN comme les trois autres — la clé de fenêtre reste le jour civil — mais
    // c'est le premier job dont l'utilité dépend d'une cadence PLUS FINE que la fenêtre : il ne sert
    // que les personnes dont l'heure choisie est l'heure courante. Sur un palier à un tick par jour,
    // il n'y a aucune heure honorable et le job refuse d'émettre (`palierHonoreLHeure`), plutôt que de
    // pousser à l'heure du hasard.
    nom: NOM_SOCLE,
    cadence: "quotidien",
    // 60 h, pour la même raison que les trois autres : jamais pile sur un multiple de la cadence.
    toleranceHeures: 60,
    // 10 s. Le job ne fabrique RIEN — aucun appel modèle, le corps de l'aperçu est choisi dans le
    // service worker à partir d'un ensemble fini (décision D1). Il lit une sélection, réserve, et
    // POSTe zéro octet par appareil.
    //
    // La chaîne gardée, à quatre jobs :
    //     Σ      = 8 000 + 36 000 + 8 000 + 10 000 = 62 000
    //     marge  = margeHorsDelais(4) = 800 + 4 × 2 400 = 10 400
    //     Σ+marge= 72 400 ≤ BUDGET_TICK_MS = 74 000 ≤ PLAFOND_DUREE_MS.hobby = 300 000
    //     mou    = 1 600 ≤ RESERVE_DECLAREE_MS = 2 000
    // `maxDuration` de `app/api/ordonnanceur/route.ts` passe à 74 DANS LE MÊME COMMIT.
    //
    // ⚠️ Les 8 000 du job de SANTÉ ci-dessus ne sont pas un arrondi de confort : son plancher croît
    // avec la longueur du registre, et ce quatrième job l'a poussé de 6 000 à 7 200. Ajouter un job
    // en renchérit un autre — c'est le sens de « ressource partagée ».
    delaiMs: DELAI_JOB_SOCLE_MS,
    // Son unité de travail est UNE personne réveillée : le POST borné, plus ses allers-retours.
    reserveMs: RESERVE_PERSONNE_POUSSEE_MS,
    enServiceDepuis: new Date("2026-08-15T00:00:00Z"),
    executer: executerSocleQuotidien,
  },
];
