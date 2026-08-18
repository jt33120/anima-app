import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import Fil from "@/render/conversation/Fil";
import type { Tour } from "@/render/conversation/types";

/**
 * fil-suivi-apres-filet.test.tsx — LE FIL NE SE FIGE PLUS APRÈS LE FILET (QA tour 2, BLOQUANT).
 *
 * ══ CE QUI ÉTAIT EN JEU ═════════════════════════════════════════════════════════════════════════
 *
 * Le suivi du bas est NON CAPTIF depuis la 2.2 : si elle a remonté le fil, on ne la ramène pas.
 * `etaitEnBas` répond donc à UNE question — « veut-elle suivre ? » — et seul SON geste peut y
 * répondre.
 *
 * Or le navigateur émet le même évènement `scroll` pour son doigt et pour notre `scrollIntoView`.
 * Le correctif de la 6.9 (amener le bloc de ressources dans le champ, l'unique exception nommée)
 * déclenchait donc un `scroll` que le gestionnaire lisait comme SON geste. Le bloc n'étant pas tout
 * en bas, `estAncreEnBas` devenait faux — et le suivi ne se rallumait plus JAMAIS.
 *
 * Mesuré au tour 2 : `scrollTop` figé à 341 px après le filet, alors que le témoin sans détresse
 * suivait 0 → 130 → 388. Tout ce qu'elle écrit ensuite, et tout ce qu'Anam répond ensuite, naît
 * hors de l'écran, sans que rien ne bouge — au moment le plus délicat du produit, et seulement là.
 *
 * ⚠️ LE CORRECTIF DE LA 6.9 AVAIT CRÉÉ PIRE QUE CE QU'IL RÉPARAIT. C'est la deuxième famille de
 * défauts du dépôt — le défaut vit dans l'intervalle, ici entre une story et son propre correctif.
 *
 * ⚠️ `jest-dom` N'EST PAS DISPONIBLE dans le projet `rendu`.
 */

const HAUTEUR_VISIBLE = 400;

/** jsdom ne fait aucune mise en page : on installe les métriques que le navigateur calculerait. */
function equiperConteneur(el: HTMLElement, scrollHeight: number) {
  Object.defineProperty(el, "clientHeight", { value: HAUTEUR_VISIBLE, configurable: true });
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
}

const fil = () => document.querySelector('[class*="fil"]') as HTMLElement;

/** Deux trames — la garde des défilements programmés ne dure pas plus longtemps. */
const rendreLaMainAuNavigateur = () =>
  act(
    () =>
      new Promise<void>((resoudre) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resoudre()));
      }),
  );

const tourUtilisatrice = (id: string): Tour => ({ id, role: "utilisatrice", texte: `moi ${id}` });
const tourAnam = (id: string): Tour => ({ id, role: "anam", texte: `anam ${id}`, etat: "complet" });
const tourRessource = (id: string): Tour => ({
  id,
  role: "ressource",
  ancreId: "a1",
  ressources: [
    { numero: "3114", tel: "3114", aria: "3 1 1 4", service: "Prévention du suicide", desc: "…" },
  ],
  verifieLe: "2026-08-18",
});

beforeEach(() => {
  // jsdom n'implémente pas `scrollIntoView` : on l'observe plutôt que de le subir.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("[QA tour 2] après le filet, la conversation suit toujours", () => {
  it("⚠️ un tour qui arrive APRÈS le bloc de ressources ramène bien le fil en bas", async () => {
    let tours: Tour[] = [tourUtilisatrice("u1"), tourAnam("a1")];
    const { rerender } = render(<Fil tours={tours} annonce="" />);
    const el = fil();
    equiperConteneur(el, 600);
    el.scrollTop = 200; // elle est en bas (600 - (200 + 400) = 0 ≤ marge)

    // Le filet arrive. Le composant l'amène dans le champ — et le navigateur émet un `scroll`.
    tours = [...tours, tourRessource("r1")];
    act(() => rerender(<Fil tours={tours} annonce="" />));
    expect(Element.prototype.scrollIntoView, "le filet doit venir à elle").toHaveBeenCalled();

    // C'EST ICI QUE TOUT SE JOUAIT. Le `scrollIntoView` a laissé le fil ailleurs qu'en bas, et le
    // navigateur émet l'évènement. Sans la garde, le gestionnaire y lit « elle a remonté ».
    equiperConteneur(el, 900);
    el.scrollTop = 341;
    act(() => el.dispatchEvent(new Event("scroll")));

    // Un tour de plus : elle doit toujours suivre.
    tours = [...tours, tourAnam("a2")];
    act(() => rerender(<Fil tours={tours} annonce="" />));

    expect(
      el.scrollTop,
      "le fil s'est figé : ce qu'Anam répond après le filet naît hors de l'écran",
    ).toBe(900);
  });

  it("mais SON geste à elle coupe toujours le suivi — la règle non captive tient", async () => {
    // La garde ne doit pas rendre le suivi CAPTIF : si elle remonte le fil pour relire, on ne la
    // ramène pas. C'est la règle de la 2.2 (AC3), et le correctif ne doit pas l'emporter avec lui.
    let tours: Tour[] = [tourUtilisatrice("u1"), tourAnam("a1")];
    const { rerender } = render(<Fil tours={tours} annonce="" />);
    const el = fil();
    equiperConteneur(el, 600);

    // ⚠️ ON LAISSE PASSER LES TRAMES AVANT SON GESTE, et ce n'est pas un contournement : elle ne
    // PEUT PAS défiler avant que le navigateur ait rendu. Sans cette attente, le test simulerait un
    // geste impossible — un doigt plus rapide qu'une trame — et exigerait une garde qui distingue
    // l'indistinguable.
    await rendreLaMainAuNavigateur();

    // Elle remonte franchement — aucun défilement programmé n'est en cours.
    el.scrollTop = 0;
    act(() => el.dispatchEvent(new Event("scroll")));

    equiperConteneur(el, 900);
    tours = [...tours, tourAnam("a2")];
    act(() => rerender(<Fil tours={tours} annonce="" />));

    expect(el.scrollTop, "on ne ramène pas quelqu'un qui a choisi de remonter").toBe(0);
  });
});
