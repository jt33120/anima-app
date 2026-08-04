/**
 * Outils du projet de test « rendu » (jsdom).
 *
 * jsdom NE FAIT AUCUNE MISE EN PAGE : sans intervention, `getBoundingClientRect()` rend 0×0 pour
 * tout élément, et `ResizeObserver` n'existe pas. Un composant qui MESURE son conteneur — c'est
 * précisément le cas de l'arbre — serait donc « toujours à 0 », ce qui masquerait le bug au lieu
 * de le révéler. Ces outils donnent aux tests le contrôle EXPLICITE de la taille rendue :
 * aucune magie, la taille est toujours posée par le test qui en a besoin.
 */

const tailles = new WeakMap<Element, { width: number; height: number }>();
let tailleParDefaut = { width: 0, height: 0 };

/** Taille rendue par TOUT élément non dimensionné individuellement. */
export function dimensionnerTout(largeur: number, hauteur: number) {
  tailleParDefaut = { width: largeur, height: hauteur };
}

/** Taille rendue par CET élément (l'emporte sur le défaut). */
export function dimensionner(el: Element, largeur: number, hauteur: number) {
  tailles.set(el, { width: largeur, height: hauteur });
}

/** Réinitialisation entre deux tests (appelée par l'installation). */
export function oublierLesTailles() {
  tailleParDefaut = { width: 0, height: 0 };
}

/** Le rect qu'un élément doit rendre — utilisé par le correctif de `getBoundingClientRect`. */
export function rectDe(el: Element): DOMRect {
  const { width, height } = tailles.get(el) ?? tailleParDefaut;
  return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) } as DOMRect;
}

// ── ResizeObserver pilotable ───────────────────────────────────────────────────────────────────
type Abonne = { cible: Element; rappel: ResizeObserverCallback; obs: ResizeObserver };
const abonnes = new Set<Abonne>();

export class ObservateurTailleFactice implements ResizeObserver {
  constructor(private rappel: ResizeObserverCallback) {}
  observe(cible: Element) {
    abonnes.add({ cible, rappel: this.rappel, obs: this });
  }
  unobserve(cible: Element) {
    for (const a of abonnes) if (a.obs === this && a.cible === cible) abonnes.delete(a);
  }
  disconnect() {
    for (const a of abonnes) if (a.obs === this) abonnes.delete(a);
  }
}

/**
 * Rejoue une notification de redimensionnement vers tous les abonnés vivants.
 * Sert à prouver qu'un composant RÉAGIT au redimensionnement — pas seulement qu'il s'abonne.
 */
export function notifierRedimensionnement() {
  for (const a of [...abonnes]) a.rappel([], a.obs);
}

/** Nombre d'abonnements VIVANTS — prouve le désabonnement au démontage (fuite d'écouteur). */
export function abonnementsVivants(): number {
  return abonnes.size;
}

export function oublierLesAbonnements() {
  abonnes.clear();
}
