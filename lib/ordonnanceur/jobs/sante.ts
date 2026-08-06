import "server-only";
import { estEnRetard } from "@/lib/domain/ordonnanceur";
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
const RESERVE_INCIDENT_MS = 1_200;

export async function executerSante(ctx: ContexteJob): Promise<void> {
  const etat = await ctx.depot.etat();

  // Aucune exécution en base ? Alors le système naît maintenant — et rien n'est en retard. C'est ce repli
  // qui évite qu'un premier déploiement s'alerte sur toute la ligne (voir `estEnRetard`).
  const naissance = etat.naissance ?? ctx.instant;

  for (const job of ctx.registre) {
    const derniere = etat.reussites.get(job.nom) ?? null;
    if (!estEnRetard(job, derniere, naissance, ctx.instant)) continue;
    // Rendre la main plutôt que se faire couper : les incidents déjà levés le sont, les suivants
    // reviendront au tick suivant (ils sont dédoublonnés par jour), et le job ne ment pas sur lui-même.
    if (ctx.echeance.getTime() - Date.now() < RESERVE_INCIDENT_MS) return;
    await ctx.depot.leverIncident(
      "job_en_retard",
      job.nom,
      derniere === null ? "aucune_reussite_connue" : "reussite_hors_tolerance",
    );
  }
}
