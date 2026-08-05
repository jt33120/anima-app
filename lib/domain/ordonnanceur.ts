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
  /**
   * Au-delà de ce délai sans réussite, le job est en retard (AC5). Toujours STRICTEMENT plus grand qu'un
   * multiple de l'intervalle de la cadence — voir le commentaire du registre : une tolérance posée pile sur
   * un multiple fait dépendre l'alerte de la dérive de planification, c'est-à-dire du hasard.
   */
  readonly toleranceHeures: number;
  /**
   * Le jour où ce job est ENTRÉ AU REGISTRE. Sert de point de départ au retard tant qu'il n'a jamais réussi.
   *
   * Sans lui, un job ajouté au registre était en retard AU TICK MÊME OÙ IL TOURNAIT POUR LA PREMIÈRE FOIS :
   * le job de santé passe avant lui dans la boucle, ne trouve aucune réussite à son nom, et se rabattait
   * alors sur la naissance du SYSTÈME — vieille de plusieurs semaines. Chaque story ajoutant un job aurait
   * ouvert sa journée par un faux incident (revue de la Story 4.8, défaut n°4).
   */
  readonly enServiceDepuis: Date;
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
 * `derniereReussite` vaut `null` pour un job jamais exécuté avec succès — et c'est le seul cas difficile.
 * « Pas de réussite » ne dit rien tant qu'on ne sait pas DEPUIS QUAND on aurait dû en voir une. Il faut donc
 * une date de départ, et deux horloges différentes ont chacune raison sur une moitié du problème :
 *
 *   • `enServiceDepuis` — depuis quand ce JOB existe. Un job ajouté aujourd'hui n'a pas de retard à rattraper.
 *   • `naissanceSysteme` — depuis quand cette BASE voit tourner l'ordonnanceur. Un déploiement neuf ne doit
 *     pas hériter du retard d'un job déclaré il y a six mois dans le code.
 *
 * La borne juste est la PLUS RÉCENTE des deux, et les quatre cas se vérifient un par un :
 *
 *   1. job ancien, base neuve      → la naissance gagne     → rien n'est en retard le jour du déploiement ;
 *   2. job neuf, base ancienne     → la mise en service gagne → pas de faux incident le jour où on l'ajoute ;
 *   3. job neuf, base neuve        → les deux valent « maintenant » → rien n'est en retard ;
 *   4. l'un ou l'autre, deux jours plus tard et toujours aucune réussite → EN RETARD : la panne qu'on veut voir.
 *
 * Prendre la plus ANCIENNE des deux casserait les cas 1 et 2 ; n'en garder qu'une en casserait un.
 */
export function estEnRetard(
  job: DescriptionJob,
  derniereReussite: Date | null,
  naissanceSysteme: Date,
  instant: Date,
): boolean {
  const debut = Math.max(job.enServiceDepuis.getTime(), naissanceSysteme.getTime());
  const reference = derniereReussite?.getTime() ?? debut;
  return instant.getTime() - reference > job.toleranceHeures * MS_PAR_HEURE;
}
