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
export async function executerSante(ctx: ContexteJob): Promise<void> {
  const etat = await ctx.depot.etat();

  // Aucune exécution en base ? Alors le système naît maintenant — et rien n'est en retard. C'est ce repli
  // qui évite qu'un premier déploiement s'alerte sur toute la ligne (voir `estEnRetard`).
  const naissance = etat.naissance ?? ctx.instant;

  for (const job of ctx.registre) {
    const derniere = etat.reussites.get(job.nom) ?? null;
    if (!estEnRetard(job, derniere, naissance, ctx.instant)) continue;
    await ctx.depot.leverIncident(
      "job_en_retard",
      job.nom,
      derniere === null ? "aucune_reussite_connue" : "reussite_hors_tolerance",
    );
  }
}
