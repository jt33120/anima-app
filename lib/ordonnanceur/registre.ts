import "server-only";
import type { DescriptionJob } from "@/lib/domain/ordonnanceur";
import type { DepotOrdonnanceur } from "@/lib/data/depot-ordonnanceur";
import { executerSante } from "@/lib/ordonnanceur/jobs/sante";
import { executerSynthese, NOM_JOB as NOM_SYNTHESE } from "@/lib/ordonnanceur/jobs/synthese";
import { executerRappelEcheance, NOM_JOB as NOM_RAPPEL } from "@/lib/ordonnanceur/jobs/rappel-echeance";

/**
 * Story 4.8 (AC1) — LE REGISTRE. La liste, unique et déclarative, de tout ce qui s'exécute périodiquement
 * dans ce produit.
 *
 * C'est le fichier qu'on lit pour répondre à « qu'est-ce qui tourne tout seul ici ? ». Que cette question
 * ait UNE réponse tient à une seule chose : rien d'autre dans le dépôt ne déclenche de mécanisme périodique.
 * Un test de garde (`tests/ordonnanceur-architecture.test.ts`) casse le build si ça change — c'est l'AC4.
 *
 * Les futurs pensionnaires, déjà nommés ailleurs et volontairement absents ici :
 *   • la rétention et l'effacement (Epic 6, AD-14) ;
 *   • le socle quotidien (Epic 6, FR-033) — autre FAMILLE de notification, autre rythme.
 *
 * ── LE BUDGET DE TEMPS EST UNE RESSOURCE PARTAGÉE, ET IL ÉTAIT PLEIN (Story 4.10, décision D5) ────────
 *
 * La garde `[T3-3]` exige `Σ delaiMs + marge(8 s) ≤ maxDuration(60 s)`. À deux jobs, la somme valait
 * 12 + 38 = 50 s : il restait exactement DEUX SECONDES, et le troisième job ne rentrait pas.
 *
 * Le rééquilibrage prend le temps là où il ne servait à rien plutôt que là où il sert. Le job de SANTÉ
 * lit un état et lève au plus trois incidents — trois ou quatre allers-retours, jamais douze secondes ;
 * il passe à 6 s. La SYNTHÈSE garde l'essentiel (36 s), parce qu'elle appelle le modèle fort et qu'une
 * seconde garde `[T3-3]` exige qu'elle puisse tenter AU MOINS une personne (`≥ RESERVE_PERSONNE_MS`).
 * Le RAPPEL prend 8 s, ce qui est large : il ne fabrique rien, il lit des dates et poste des courriels.
 *
 * Σ = 6 + 36 + 8 = 50 s — soit EXACTEMENT ce que le registre consommait déjà. La plateforme ne voit
 * aucune différence ; c'est la répartition interne qui a changé.
 *
 * ⚠️ NE PAS « RÉGLER » UN DÉPASSEMENT FUTUR EN MONTANT LA MARGE de `[T3-3]`. Cette marge couvre ce qui
 * vit HORS des `avecDelai` (vérification d'environnement, `reclamer`/`clore` de chaque job, sérialisation
 * de la réponse), et elle grandit avec le nombre de jobs, pas l'inverse. L'élargir pour faire entrer un
 * job reviendrait à supprimer la garde en prétendant la respecter.
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
}

export const REGISTRE: readonly JobEnregistre[] = [
  {
    nom: "sante-ordonnanceur",
    cadence: "quotidien",
    // 60 h, et surtout PAS 48. L'intention est « un tick manqué ne déclenche rien, deux ticks manqués, si ».
    // À 48 h — pile deux fois la cadence — la comparaison au deuxième tick tombait à quelques secondes de la
    // bascule : elle se jouait sur la dérive de planification de Vercel Cron, qui se compte en minutes. La
    // même panne alertait ou non selon le hasard de l'horaire. 60 h place le seuil au MILIEU de l'intervalle
    // [48 h, 72 h] : deux ticks manqués alertent toujours, un seul jamais (revue 4.8, défaut n°9).
    toleranceHeures: 60,
    // 6 s, et c'est LARGE (revu en 4.10 / D5). Ce job lit `etat()` — un aller-retour — puis lève au plus
    // un incident par job du registre. Douze secondes étaient une réserve confortable posée quand il
    // était seul ; elles bloquaient l'entrée du troisième job. Le temps va là où il sert.
    delaiMs: 6_000,
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
    // 36 s (38 avant la 4.10) — et la somme du registre compte : 6 + 36 + 8 = 50 s pour une lambda
    // bornée à 60 (`maxDuration`). À 15 + 50 = 65 s, le budget du registre dépassait celui de la
    // plateforme, et le dernier job pouvait être tué par Vercel AVANT que son propre `avecDelai` ne
    // s'arme — rien de clos, aucun incident levé, la ligne laissée `en_cours` : un échec totalement
    // muet. Un test d'architecture garde l'invariant `Σ delaiMs + marge ≤ maxDuration` (revue 4.9, T3-3),
    // ET le fait que ce job-ci garde de quoi tenter au moins une personne (`≥ RESERVE_PERSONNE_MS`).
    delaiMs: 36_000,
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
    // quoi l'alerte se joue sur la dérive de planification de Vercel Cron, c'est-à-dire sur le hasard.
    toleranceHeures: 60,
    // 8 s, et c'est confortable : ce job ne fabrique RIEN. Aucun appel modèle (décision D1 — elle écrit
    // les intentions, pas Anam), donc aucun budget à réserver pour une réponse qui traîne. Il lit des
    // dates, réserve un canal, poste des courriels : quatre allers-retours par personne, dix au plus.
    delaiMs: 8_000,
    enServiceDepuis: new Date("2026-08-06T00:00:00Z"),
    executer: executerRappelEcheance,
  },
];
