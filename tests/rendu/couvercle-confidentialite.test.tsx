import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { CouvercleConfidentialite } from "@/render/confidentialite/CouvercleConfidentialite";

/**
 * Story 6.2 (AC5) — LE PRIVACY-COVER.
 *
 * ⚠️ CE QUE CE FICHIER NE PEUT PAS PROUVER, et il faut le dire : jsdom ne peint rien. Aucun test ici
 * ne démontre que le couvercle est visible AVANT que le système ne prenne sa vignette — ça se vérifie
 * sur un vrai téléphone, et c'est inscrit comme tel dans la story.
 *
 * Ce qu'il prouve, en revanche, est la seule chose qui rende cette course gagnable : que l'attribut
 * est posé **de façon synchrone**, dans le gestionnaire, sans passer par un rendu React. C'est
 * testable, et c'est exactement le détail qu'un refactor bien intentionné (« mettons ça dans un
 * `useState`, c'est plus idiomatique ») ferait disparaître sans casser aucun autre test.
 */

/** Force `document.visibilityState`, que jsdom expose en lecture seule. */
function visibilite(etat: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: etat, configurable: true });
}

afterEach(() => {
  cleanup();
  visibilite("visible");
  document.documentElement.removeAttribute("data-couvercle");
});

describe("[6.2/AC5] le couvercle se pose quand l'application passe en arrière-plan", () => {
  it("[LE CŒUR] l'attribut est posé SYNCHRONEMENT, sans attendre un rendu React", () => {
    // ⚠️ On dispatche HORS de `act`, et on asserte dans la foulée. Si l'implémentation passait par
    // `setState`, React n'aurait pas encore re-rendu à cette ligne et l'attribut serait absent.
    // C'est toute la différence entre un couvercle qui couvre et un couvercle qui arrive après la
    // photo — sauf que sur un téléphone, personne ne voit le test échouer.
    render(<CouvercleConfidentialite />);
    visibilite("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.documentElement.getAttribute("data-couvercle")).toBe("pose");
  });

  it("il se retire au retour", () => {
    render(<CouvercleConfidentialite />);
    visibilite("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibilite("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.documentElement.getAttribute("data-couvercle")).toBeNull();
  });

  it("[LE CŒUR] `pagehide` le pose AUSSI — c'est le chemin de Safari iOS", () => {
    // ⚠️ Mutation-cible : ne garder que `visibilitychange`. Sur Safari iOS, le retour à l'écran
    // d'accueil par balayage déclenche `pagehide` sans toujours passer par `visibilitychange` — donc
    // le chemin découvert serait le PLUS courant, sur la plateforme où la vignette est la plus
    // visible. Une garde qui protège tout sauf le cas principal.
    render(<CouvercleConfidentialite />);
    window.dispatchEvent(new Event("pagehide"));
    expect(document.documentElement.getAttribute("data-couvercle")).toBe("pose");
    window.dispatchEvent(new Event("pageshow"));
    expect(document.documentElement.getAttribute("data-couvercle")).toBeNull();
  });

  it("le couvercle est dans le DOM en permanence, et invisible aux lectrices d'écran", () => {
    // Présent en permanence : c'est ce qui permet à l'attribut de suffire. Un couvercle monté à la
    // demande devrait être créé, inséré et stylé pendant l'instant qu'on cherche à gagner.
    const { container } = render(<CouvercleConfidentialite />);
    const couvercle = container.querySelector('[data-testid="couvercle-confidentialite"]');
    expect(couvercle).not.toBeNull();
    expect(couvercle!.getAttribute("aria-hidden")).toBe("true");
    expect(couvercle!.textContent).toBe("Anam");
  });

  it("[ANTI-VACUITÉ] rien n'est posé tant qu'il ne se passe rien", () => {
    render(<CouvercleConfidentialite />);
    expect(document.documentElement.getAttribute("data-couvercle")).toBeNull();
  });

  it("le démontage ne laisse pas l'application couverte", () => {
    // Un couvercle oublié posé, c'est un écran opaque dont elle ne peut plus sortir. Le nettoyage du
    // `useEffect` le retire, et c'est plus qu'une politesse.
    const { unmount } = render(<CouvercleConfidentialite />);
    window.dispatchEvent(new Event("pagehide"));
    unmount();
    expect(document.documentElement.getAttribute("data-couvercle")).toBeNull();
  });

  it("après démontage, les événements ne posent plus rien", () => {
    const { unmount } = render(<CouvercleConfidentialite />);
    unmount();
    window.dispatchEvent(new Event("pagehide"));
    expect(document.documentElement.getAttribute("data-couvercle")).toBeNull();
  });
});
