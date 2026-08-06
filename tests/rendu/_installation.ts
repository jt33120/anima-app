/**
 * Installation du projet de test « rendu » (jsdom + Testing Library).
 *
 * On ne pose ici QUE ce que jsdom ne fournit pas et sans quoi un composant réel ne peut pas être
 * monté du tout. Tout le reste — les tailles, les gestes — est piloté explicitement par chaque
 * test via `./_outils`, pour qu'aucune garde ne repose sur un comportement implicite du harnais.
 */
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { ObservateurTailleFactice, rectDe, oublierLesTailles, oublierLesAbonnements } from "./_outils";

// jsdom n'implémente pas ResizeObserver : sans lui, tout composant qui mesure son conteneur jette au montage.
globalThis.ResizeObserver = ObservateurTailleFactice as unknown as typeof ResizeObserver;

// jsdom ne fait pas de mise en page → 0×0 partout. On délègue à `_outils` la taille que le TEST a posée.
Element.prototype.getBoundingClientRect = function (this: Element) {
  return rectDe(this);
};

// jsdom n'implémente pas `matchMedia` : sans lui, le Composeur (donc toute la Conversation) jette au
// montage. On rend un objet INERTE — jamais un `matches: true` arbitraire, qui déciderait à la place du
// test dans quel palier on se trouve. Le test qui voudra éprouver un palier posera son propre double.
if (!window.matchMedia) {
  window.matchMedia = ((requete: string) => ({
    media: requete,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom n'implémente pas la capture de pointeur (utilisée pour qu'un glisser survive à la sortie du cadre).
if (!Element.prototype.setPointerCapture) {
  const captures = new WeakMap<Element, Set<number>>();
  Element.prototype.setPointerCapture = function (this: Element, id: number) {
    const s = captures.get(this) ?? new Set<number>();
    s.add(id);
    captures.set(this, s);
  };
  Element.prototype.releasePointerCapture = function (this: Element, id: number) {
    captures.get(this)?.delete(id);
  };
  Element.prototype.hasPointerCapture = function (this: Element, id: number) {
    return captures.get(this)?.has(id) ?? false;
  };
}

beforeEach(() => {
  // Node 22 expose un `localStorage` expérimental qui masque parfois celui de jsdom : on passe par
  // `window` et on tolère son absence — le composant lui-même traite le stockage en best-effort.
  try {
    window.localStorage.clear();
  } catch {
    /* stockage indisponible : la vue arbre reste le défaut, c'est ce que les tests supposent */
  }
});

afterEach(() => {
  cleanup();
  oublierLesTailles();
  oublierLesAbonnements();
});
