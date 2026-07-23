/**
 * Calcul d'âge — pur et testable (le contrôle de majorité est côté serveur, NFR-023).
 * Séparé du Server Action car un fichier "use server" ne peut exporter que des actions async.
 */

/** Âge en années révolues depuis une date ISO `yyyy-mm-dd`. NaN si invalide. */
export function calculerAge(dateISO: string, maintenant: Date = new Date()): number {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  let age = maintenant.getUTCFullYear() - d.getUTCFullYear();
  const m = maintenant.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && maintenant.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

export function estMajeur(dateISO: string, maintenant?: Date): boolean {
  const age = calculerAge(dateISO, maintenant);
  return !Number.isNaN(age) && age >= 18;
}
