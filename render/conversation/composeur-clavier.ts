/**
 * composeur-clavier.ts — Règles d'interaction PURES du composeur et du fil (Story 2.2, B3/B4),
 * extraites pour être prouvées sans DOM (env node). Le composant ne fait qu'APPLIQUER ces
 * décisions ; il ne les redécide pas (une seule source de vérité, mutation-testable).
 */

/** Palier de saisie : `sm` = mobile (Entrée = nouvelle ligne) ; `md` = ≥ 768px (Entrée = envoie). */
export type Palier = "sm" | "md";

export type ActionClavier = "envoyer" | "nouvelle-ligne" | "ignorer";

/**
 * Entrée contextuelle (AC7, UX-DR-21). En **sm**, `Entrée` insère une ligne et l'envoi passe par le
 * bouton SEUL : on n'envoie jamais une confidence par accident au pouce. En **md**, `Entrée` envoie
 * et `Maj+Entrée` insère une ligne. Pendant une composition IME (japonais, chinois…), `Entrée`
 * valide le candidat de saisie → on ne doit JAMAIS l'interpréter comme un envoi.
 */
export function decisionEntree(
  palier: Palier,
  touche: { key: string; shiftKey: boolean; isComposing?: boolean },
): ActionClavier {
  if (touche.key !== "Enter") return "ignorer";
  if (touche.isComposing) return "nouvelle-ligne"; // IME en cours → jamais envoyer
  if (palier === "sm") return "nouvelle-ligne";
  return touche.shiftKey ? "nouvelle-ligne" : "envoyer";
}

/**
 * L'utilisatrice est-elle ancrée en bas du fil ? Sert au suivi du bas NON CAPTIF (AC3) : on ne
 * recolle au bas QUE si elle y était déjà avant l'arrivée d'un fragment. Dès qu'elle remonte
 * (au-delà de la marge), la fonction renvoie faux → le fil cesse de la ramener de force.
 */
export function estAncreEnBas(
  metriques: { scrollTop: number; scrollHeight: number; clientHeight: number },
  margePx = 48,
): boolean {
  const { scrollTop, scrollHeight, clientHeight } = metriques;
  return scrollHeight - (scrollTop + clientHeight) <= margePx;
}
