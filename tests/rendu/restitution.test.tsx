import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Restitution from "@/render/lecture/Restitution";

/**
 * restitution.test.tsx — SES MOTS NE SONT JAMAIS EN SOURDINE (Story 5.8, AC6 · FR-021).
 *
 * ⚠️ `jest-dom` N'EST PAS DISPONIBLE dans le projet `rendu` : on assert avec `toBeTruthy()` et
 * `getAttribute()`, jamais `toBeInTheDocument()` / `toHaveAttribute()`.
 */

const TEXTE = "Tu as parlé d'une ouverture.\n\nEt tu as dit que tu hésitais à la franchir.";

describe("[AC6] la restitution est un DOCUMENT", () => {
  it("la prose est découpée en paragraphes sur les lignes vides", () => {
    const { container } = render(<Restitution texte={TEXTE} />);
    // Le rendu ne parse AUCUN markdown (AD-7) : il respecte des blancs, et c'est tout ce qu'un
    // rendu muet a le droit de faire.
    expect(container.querySelectorAll("article p").length).toBe(2);
  });

  it("un texte d'un seul bloc reste un seul paragraphe", () => {
    const { container } = render(<Restitution texte="Une seule phrase." />);
    expect(container.querySelectorAll("article p").length).toBe(1);
  });

  it("le bloc est un `<article>` DANS le flux, jamais une modale", () => {
    const { container } = render(<Restitution texte={TEXTE} />);
    const article = container.querySelector("article");
    expect(article).toBeTruthy();
    expect(article!.getAttribute("aria-label")).toBe("Une lecture");
    expect(container.querySelector("dialog")).toBeNull();
  });
});

describe("[AC6 · FR-021] ses mots, en citation visuellement distincte", () => {
  it("ses mots sont portés par un `<blockquote>` — pas un paragraphe de plus", () => {
    const { container } = render(<Restitution texte={TEXTE} sesMots="je vois une porte" />);
    const citation = container.querySelector("blockquote");
    expect(citation).toBeTruthy();
    expect(citation!.textContent).toContain("je vois une porte");
  });

  it("⚠️ ses mots ne sont JAMAIS mis en `texte-doux` — on ne met pas ses mots en sourdine", () => {
    // DESIGN.md, `tour-utilisatrice` : « jamais {colors.texte-doux} pour ses mots à elle ». La
    // distinction des deux voix se fait par le filet et le retrait, pas par l'extinction. Le défaut
    // serait invisible en revue de code et très visible à l'écran, chez elle.
    const { container } = render(<Restitution texte={TEXTE} sesMots="je vois une porte" />);
    const citation = container.querySelector("blockquote")!;
    expect(citation.className).not.toContain("doux");
    expect(citation.querySelector("p")!.className).not.toContain("doux");
  });

  it("dans le fil, ses mots sont OMIS — son propre tour est juste au-dessus", () => {
    const { container } = render(<Restitution texte={TEXTE} />);
    expect(container.querySelector("blockquote")).toBeNull();
  });
});

describe("[AC6] la date, le visuel et le lien vers l'échange source", () => {
  it("les trois sont rendus quand ils sont fournis (la halte)", () => {
    render(
      <Restitution
        texte={TEXTE}
        sesMots="je vois une porte"
        date="14 août 2026"
        visuel={<span data-testid="visuel" />}
        echangeSource={<a href="#source">Voir dans la conversation</a>}
      />,
    );
    expect(screen.getByText("14 août 2026")).toBeTruthy();
    expect(screen.getByTestId("visuel")).toBeTruthy();
    expect(screen.getByText("Voir dans la conversation")).toBeTruthy();
  });

  it("aucun des trois n'est inventé quand il manque (le fil)", () => {
    const { container } = render(<Restitution texte={TEXTE} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("[FR-018] la restitution n'affiche AUCUNE signification cataloguée", () => {
  it("la signature ne prend ni carte, ni sens — le composant n'a pas de quoi en afficher", () => {
    // La garde de type est dans `render/lecture/types.ts` et `tests/lecture-frontiere.test.ts` ;
    // ici on vérifie que ce composant-ci n'a pas ouvert une seconde porte.
    const rendu = render(<Restitution texte={TEXTE} sesMots="je vois une porte" />);
    const html = rendu.container.innerHTML.toLowerCase();
    for (const mot of ["signification", "mot-clé", "en savoir plus"]) {
      expect(html, `« ${mot} » a atteint l'écran`).not.toContain(mot);
    }
  });
});
