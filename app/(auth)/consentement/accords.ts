/**
 * Lecture + validation PURE des deux accords du formulaire de consentement.
 * Isolé ici (aucune dépendance serveur/admin) pour être testable directement : le filet CI
 * couvre la re-validation serveur (AC5) sans avoir à invoquer la Server Action, qui, elle,
 * embarque `redirect`/cookies difficiles à exécuter en test.
 */
export function lireAccords(formData: FormData): { art9: boolean; cgu: boolean } {
  return {
    art9: formData.get("art9") === "on",
    cgu: formData.get("cgu") === "on",
  };
}

/** Les DEUX accords doivent être explicitement cochés (art. 9 distinct des CGU/18 ans). */
export function accordsComplets(formData: FormData): boolean {
  const { art9, cgu } = lireAccords(formData);
  return art9 && cgu;
}
