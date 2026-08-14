import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Ancrage from "@/render/ancrage/Ancrage";
import type { AncrageVue, MotsAncrage } from "@/render/ancrage/types";

/**
 * ancrage.test.tsx — L'EXERCICE SE TRAVERSE PAS À PAS (Story 5.9, AC1/AC7).
 *
 * ⚠️ `jest-dom` N'EST PAS DISPONIBLE dans le projet `rendu` : on assert avec `toBeTruthy()` et
 * `getAttribute()`, jamais `toBeInTheDocument()` / `toHaveAttribute()`.
 */

const ANCRAGE: AncrageVue = {
  cle: "faux",
  titre: "Un titre d’Anima",
  temps: [
    { texte: "Premier temps." },
    { texte: "Deuxième temps." },
    { texte: "Troisième temps." },
  ],
};

const MOTS: MotsAncrage = { avancer: "Continuer", terminer: "C’est fini", traverse: "Voilà." };

function monter() {
  return render(<Ancrage ancrage={ANCRAGE} mots={MOTS} />);
}

describe("[AC1] un seul temps à l'écran — c'est ce qui en fait un exercice, pas un texte long", () => {
  it("au départ, seul le premier temps est rendu", () => {
    monter();
    expect(screen.getByText("Premier temps.")).toBeTruthy();
    expect(screen.queryByText("Deuxième temps.")).toBeNull();
    expect(screen.queryByText("Troisième temps.")).toBeNull();
  });

  it("« Continuer » fait avancer d'un temps, et d'un seul", () => {
    monter();
    fireEvent.click(screen.getByText("Continuer"));
    expect(screen.getByText("Deuxième temps.")).toBeTruthy();
    expect(screen.queryByText("Premier temps.")).toBeNull();
  });

  it("le DERNIER temps porte « C’est fini », jamais « Continuer »", () => {
    monter();
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("Continuer"));
    expect(screen.getByText("Troisième temps.")).toBeTruthy();
    expect(screen.getByText("C’est fini")).toBeTruthy();
    expect(screen.queryByText("Continuer")).toBeNull();
  });

  it("après le dernier temps, l'exercice est traversé — et il ne RECOMMENCE pas", () => {
    monter();
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("C’est fini"));
    expect(screen.getByText("Voilà.")).toBeTruthy();
    expect(screen.queryByText("Premier temps.")).toBeNull();
    expect(screen.queryByText("C’est fini")).toBeNull();
  });

  it("on peut REVENIR sur ses pas — rien n'est verrouillé derrière soi", () => {
    monter();
    expect(screen.queryByText("Revenir")).toBeNull(); // pas de retour depuis le premier temps
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("Revenir"));
    expect(screen.getByText("Premier temps.")).toBeTruthy();
  });
});

describe("[AC1] le repère de parcours est ANNONCÉ, pas seulement dessiné", () => {
  it("il situe dans CE parcours, et il est lu par les technologies d'assistance", () => {
    const { container } = monter();
    const repere = container.querySelector('[aria-live="polite"]');
    expect(repere).toBeTruthy();
    expect(repere?.textContent).toBe("1 / 3");
    fireEvent.click(screen.getByText("Continuer"));
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("2 / 3");
  });
});

describe("[AC7] rien d'audio, rien d'inerte, rien qui félicite", () => {
  it("aucun élément média n'est monté", () => {
    const { container } = monter();
    expect(container.querySelector("audio")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("le rendu n'invente AUCUN texte — tout ce qui s'affiche lui a été donné", () => {
    const { container } = monter();
    const donnes = new Set([
      ANCRAGE.titre,
      ...ANCRAGE.temps.map((t) => t.texte),
      MOTS.avancer,
      "Revenir",
      "1 / 3",
    ]);
    for (const el of Array.from(container.querySelectorAll("p, h2, button"))) {
      const t = el.textContent?.trim() ?? "";
      if (t.length > 0) expect(donnes.has(t), `texte non fourni : « ${t} »`).toBe(true);
    }
  });

  it("la fin ne porte ni félicitation, ni score, ni série", () => {
    monter();
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("C’est fini"));
    expect(screen.queryByText(/bravo|félicitation|série|jours d’affilée|score/i)).toBeNull();
  });
});
