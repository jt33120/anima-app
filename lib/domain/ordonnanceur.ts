/**
 * Story 4.8 — LE DOMAINE PUR DE LA CADENCE. Aucune I/O, aucun framework, aucune infra (AD-1).
 *
 * Deux notions, et deux seulement :
 *
 *   • LA FENÊTRE — la clé déterministe qui identifie une OCCURRENCE d'un job. Deux ticks tombant dans la
 *     même fenêtre produisent la même clé, donc la même ligne d'exécution, donc un seul effet. C'est là que
 *     vit l'idempotence (AC2) : pas dans la porte, pas dans le job, ici.
 *
 *   • LE RETARD — un job dont la dernière réussite est plus vieille que sa tolérance. C'est ce que le job de
 *     santé observe (AC5).
 *
 * Ce qui N'EST PAS ici, volontairement : « ce job est-il dû ? ». La question a l'air d'appartenir au domaine,
 * mais y répondre en mémoire puis réclamer en base, c'est prendre la même décision à deux endroits — et deux
 * endroits finissent toujours par diverger. La réclamation atomique EST la décision (voir `reclamer_execution`).
 */

export type Cadence = "quotidien" | "hebdomadaire";

/** Le fuseau de référence du produit. Une utilisatrice vit à Paris ; une fenêtre « du jour » aussi. */
export const FUSEAU = "Europe/Paris";

export interface DescriptionJob {
  /** Identifiant stable — sert de clé d'exécution ET de clé d'incident. Ne jamais renommer à la légère. */
  readonly nom: string;
  readonly cadence: Cadence;
  /** Au-delà de ce délai sans réussite, le job est en retard (AC5). Toujours > l'intervalle de la cadence. */
  readonly toleranceHeures: number;
  /** Borne d'exécution. Un job qui dépasse est clos en échec — il ne mange pas le budget des suivants (D1). */
  readonly delaiMs: number;
}

const MS_PAR_HEURE = 3_600_000;

/**
 * La date civile à Paris, décomposée. On passe par `formatToParts` plutôt que par une locale « qui rend du
 * ISO » (`sv-SE`, `en-CA`…) : ces astuces dépendent des données de locale de l'environnement, et une CI qui
 * change de conteneur les casse en silence. Ici on lit les champs par leur nom.
 */
function dateCivileParis(instant: Date): { annee: number; mois: number; jour: number } {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const lire = (type: string) => Number(parties.find((p) => p.type === type)!.value);
  return { annee: lire("year"), mois: lire("month"), jour: lire("day") };
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * La semaine ISO 8601 de la date civile donnée. La règle : la semaine d'une date est celle de son JEUDI, et
 * la semaine 1 est celle qui contient le 4 janvier. C'est ce détour par le jeudi qui rend correct le cas
 * pénible — le 31 décembre 2026 appartient à la semaine 53 de 2026, mais le 1er janvier 2027 aussi.
 */
function semaineIso(annee: number, mois: number, jour: number): { annee: number; semaine: number } {
  const jeudi = new Date(Date.UTC(annee, mois - 1, jour));
  jeudi.setUTCDate(jeudi.getUTCDate() - ((jeudi.getUTCDay() + 6) % 7) + 3);

  const anneeIso = jeudi.getUTCFullYear();
  const premierJeudi = new Date(Date.UTC(anneeIso, 0, 4));
  premierJeudi.setUTCDate(premierJeudi.getUTCDate() - ((premierJeudi.getUTCDay() + 6) % 7) + 3);

  const semaine = 1 + Math.round((jeudi.getTime() - premierJeudi.getTime()) / (7 * 86_400_000));
  return { annee: anneeIso, semaine };
}

/**
 * La clé de fenêtre. `2026-08-05` pour un job quotidien, `2026-W32` pour un hebdomadaire.
 *
 * Déterministe et sans état : deux processus, deux régions, deux relances donnent la même clé pour le même
 * instant. C'est la seule propriété qui compte — tout le reste de l'idempotence en découle.
 */
export function fenetreDe(cadence: Cadence, instant: Date): string {
  const { annee, mois, jour } = dateCivileParis(instant);
  if (cadence === "quotidien") return `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`;
  const iso = semaineIso(annee, mois, jour);
  return `${iso.annee}-W${deuxChiffres(iso.semaine)}`;
}

/**
 * Le job est-il en retard ? (AC5)
 *
 * `derniereReussite` vaut `null` pour un job jamais exécuté avec succès — et c'est exactement le cas qu'il
 * faut traiter avec soin. On se replie alors sur la NAISSANCE DU SYSTÈME (la plus ancienne exécution connue,
 * tous jobs confondus). Deux erreurs sont ainsi évitées d'un coup :
 *
 *   • au premier tick, la naissance vaut « maintenant » → aucun job n'est en retard, pas de bruit le jour du
 *     déploiement, précisément le jour où un faux positif serait le plus coûteux ;
 *   • une semaine plus tard, un job enregistré mais jamais exécuté EST en retard → la panne qu'on veut voir.
 *
 * Un `null` traité comme « pas de retard » serait aveugle au job mort-né ; traité comme « en retard »
 * hurlerait au démarrage. Le repli sur la naissance est ce qui rend les deux vrais.
 */
export function estEnRetard(
  job: DescriptionJob,
  derniereReussite: Date | null,
  naissanceSysteme: Date,
  instant: Date,
): boolean {
  const reference = derniereReussite ?? naissanceSysteme;
  return instant.getTime() - reference.getTime() > job.toleranceHeures * MS_PAR_HEURE;
}
