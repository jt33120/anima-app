import "server-only";
import { estEnRetard } from "@/lib/domain/ordonnanceur";
import { journaliserExploitation } from "@/lib/safety/rpc-repli";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";

/**
 * Story 4.8 (AC5) — LE JOB DE SANTÉ. Le seul job enregistré par cette story, et le seul que l'AC5 exige.
 *
 * Il regarde chaque job du registre et lève un incident pour ceux dont la dernière réussite est plus vieille
 * que leur tolérance. Il se regarde donc lui-même — c'est voulu : un ordonnanceur qui ne tourne plus doit
 * pouvoir le dire au tick suivant, s'il en reste un.
 *
 * Ce qu'il n'écrit JAMAIS : le nom d'une utilisatrice, un identifiant de cible, un extrait. `job` est un
 * identifiant technique, `detail` un code fermé. L'incident dit « ceci ne tourne plus », rien d'autre
 * (NFR-020/NFR-022).
 */
/**
 * Ce qu'il faut avoir en réserve pour lever un incident de plus (revue 4.10).
 *
 * ⚠️ CE JOB ÉTAIT LE SEUL DES TROIS SANS GARDE DE RENDU DE MAIN — et la 4.10 a rendu l'omission
 * coûteuse : son budget est passé de 12 s à 6 s pendant que le nombre de jobs à surveiller passait de
 * deux à trois, donc son pire cas de 3 à 4 allers-retours. Se faire couper par `avecDelai` le clôt en
 * `echoue` et lève un `job_echoue` — sur le job de SANTÉ, c'est-à-dire sur la seule sonde du produit.
 * Une alarme qui accuse l'alarme est la façon la plus sûre de rendre une alarme inutile (leçon 4.9/T3-1).
 *
 * Et le couplage s'aggrave à chaque story : un job de plus au registre taxe DEUX fois ce budget — une
 * fois dans la somme `Σ delaiMs` que garde `[T3-3]`, une seconde fois en ajoutant un aller-retour ici.
 */
export const RESERVE_INCIDENT_MS = 1_200;

/**
 * Le coût de la lecture d'état — l'aller-retour `etat()` que ce job fait AVANT sa boucle (Story 6.1).
 *
 * Il vit ici et non dans `lib/domain/ordonnanceur-budget.ts` : c'est le coût de CE job, pas une
 * constante de l'ordonnanceur. Le module de budget provisionne la mécanique du répartiteur ; ce que
 * chaque job dépense à l'intérieur de son propre `delaiMs` le regarde lui.
 *
 * ⚠️ Il donne, avec `RESERVE_INCIDENT_MS`, le PLANCHER de `delaiMs` pour ce job :
 *
 *     COUT_ETAT_MS + RESERVE_INCIDENT_MS × (nombre de jobs + 1)
 *
 * Le « + 1 » n'est pas de la prudence : la boucle teste la réserve AVANT chaque `leverIncident`, donc
 * un registre de N jobs demande N tests plus le dernier qui doit encore pouvoir passer. À trois jobs
 * cela vaut 1 200 + 1 200 × 4 = 6 000 — exactement le budget d'aujourd'hui.
 *
 * ⚠️ Et cette formule RENDRA ROUGE la garde au premier job ajouté (6 000 < 9 600 dès quatre jobs).
 * C'est voulu. La story qui ajoutera ce job devra monter `sante.delaiMs`, donc `Σ`, donc
 * `BUDGET_TICK_MS` et le littéral `maxDuration`, dans le même commit.
 */
export const COUT_ETAT_MS = 1_200;

export async function executerSante(ctx: ContexteJob): Promise<void> {
  const etat = await ctx.depot.etat();

  // Aucune exécution en base ? Alors le système naît maintenant — et rien n'est en retard. C'est ce repli
  // qui évite qu'un premier déploiement s'alerte sur toute la ligne (voir `estEnRetard`).
  const naissance = etat.naissance ?? ctx.instant;

  for (const [rang, job] of ctx.registre.entries()) {
    const derniere = etat.reussites.get(job.nom) ?? null;
    if (!estEnRetard(job, derniere, naissance, ctx.instant)) continue;
    // Rendre la main plutôt que se faire couper : les incidents déjà levés le sont, les suivants
    // reviendront au tick suivant (ils sont dédoublonnés par jour), et le job ne ment pas sur lui-même.
    if (ctx.echeance.getTime() - Date.now() < RESERVE_INCIDENT_MS) {
      // ⚠️ Story 6.1 — CE RETOUR ÉTAIT MUET, et c'était le seul des trois. `synthese.ts:170` et
      // `rappel-echeance.ts:102` journalisent tous deux quand ils rendent la main : la SEULE ALARME
      // DU PRODUIT était la seule à se taire.
      //
      // Ce que le silence coûtait, en toutes lettres : que quelqu'un rogne ce budget « puisqu'il ne
      // fait que lire un état », que `etat()` traîne, et le job sort AVANT le premier
      // `leverIncident`. Il est alors clos en `reussi` — il n'a pas échoué, il a rendu la main —,
      // l'homme mort voit une réussite, et `/api/health` répond `ok`. **Plus aucun `job_en_retard`
      // n'est jamais levé, pour aucun job**, et c'est le SEUL incident qui dégrade la sonde
      // (`0031:69-91` : un `job_echoue` ne la dégrade pas). Un moteur de rétention en panne devient
      // strictement invisible.
      //
      // Sous la clé `code` et sous forme interpolée, comme les deux autres : `journaliserExploitation`
      // n'accepte qu'un vocabulaire fermé, et un rang de registre n'identifie personne (NFR-022).
      journaliserExploitation("sante_lot_incomplet", { code: `restants_${ctx.registre.length - rang}` });
      return;
    }
    await ctx.depot.leverIncident(
      "job_en_retard",
      job.nom,
      derniere === null ? "aucune_reussite_connue" : "reussite_hors_tolerance",
    );
  }
}
