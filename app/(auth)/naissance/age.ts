/**
 * Calcul d'âge — pur et testable (le contrôle de majorité est côté serveur, NFR-023).
 * Séparé du Server Action car un fichier "use server" ne peut exporter que des actions async.
 *
 * ══ UNE SEULE HORLOGE : `Europe/Paris` (revue des Epics 1 à 4, trouvaille #10) ═══════════════════
 *
 * L'âge se comptait ICI en UTC, pendant que le trigger `exiger_majorite` (0048) le compte en heure
 * de Paris. Deux horloges pour la même question — le défaut exact que l'AD-17 nomme, et que
 * l'en-tête de 0048 croyait avoir refermé : « Le TypeScript est aligné dessus dans le même
 * correctif ». Il ne l'a jamais été.
 *
 * ⚠️ ET LE DÉCALAGE NE FAIT PAS QUE REFUSER : IL BARRE À VIE. Le jour de ses dix-huit ans, entre
 * minuit et deux heures du matin en France métropolitaine, UTC est encore la veille — cette
 * fonction rendait donc 17. Or la Server Action ne se contente pas de refuser : elle écrit
 * `mineur_detecte = true`, et ce drapeau NE SE RETIRE JAMAIS (FR-070, trigger de 0042 : « il se
 * pose, ne se retire pas », y compris à `service_role`). Une adulte perdait le produit pour
 * toujours, à cause d'un fuseau, sur un créneau de deux heures.
 *
 * Mesuré : née le 2008-08-18, à l'instant 2026-08-17T23:30:00Z — soit le 18 août 01 h 30 à Paris,
 * le jour de son anniversaire — l'ancien calcul rendait 17.
 *
 * Le résidu assumé reste celui de 0048, mot pour mot : une personne dans un département d'outre-mer
 * à l'ouest de Paris peut être admise jusqu'à six heures avant son anniversaire local. Le fermer
 * exigerait de compter à UTC−12, ce qui refuserait tout métropolitain pendant les quatorze
 * premières heures de son anniversaire.
 */

/** `fr-CA` formate en `yyyy-mm-dd` — le seul format de sortie qui n'a pas besoin d'être réordonné. */
const CALENDRIER_PARIS = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Le jour CIVIL à Paris pour un instant donné — la même lecture que `now() at time zone 'Europe/Paris'`. */
function jourCivilAParis(instant: Date): { annee: number; mois: number; jour: number } {
  const [annee, mois, jour] = CALENDRIER_PARIS.format(instant).split("-").map(Number);
  return { annee, mois, jour };
}

/** Âge en années révolues depuis une date ISO `yyyy-mm-dd`, compté à Paris. NaN si invalide. */
export function calculerAge(dateISO: string, maintenant: Date = new Date()): number {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  if (Number.isNaN(maintenant.getTime())) return Number.NaN;
  const ici = jourCivilAParis(maintenant);
  // La date de naissance est un jour CIVIL, sans heure : on la lit en UTC parce qu'on l'y a écrite
  // à minuit pile. C'est l'INSTANT courant qui devait changer de fuseau, pas elle.
  let age = ici.annee - d.getUTCFullYear();
  const ecartMois = ici.mois - (d.getUTCMonth() + 1);
  if (ecartMois < 0 || (ecartMois === 0 && ici.jour < d.getUTCDate())) age -= 1;
  return age;
}

export function estMajeur(dateISO: string, maintenant?: Date): boolean {
  const age = calculerAge(dateISO, maintenant);
  return !Number.isNaN(age) && age >= 18;
}
