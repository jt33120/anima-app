import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ArbreInteractif from "@/render/arbre/ArbreInteractif";
import type { BrancheProjetee, ProjectionScene } from "@/lib/scene";
import { dimensionnerTout } from "./_outils";

/**
 * [FR-031 DUR] — AUCUNE MESURE À L'ÉCRAN, prouvé sur le DOM RENDU.
 *
 * Pourquoi ici et pas en lecture de source : la re-revue a montré qu'un scan de source ne peut pas
 * trancher. Il interdisait sept mots français — donc il rougissait sur un identifiant interne innocent
 * (`niveauDuRang`) tout en laissant passer un vrai compteur baptisé `nbBranches`. Un compteur peut
 * s'appeler n'importe comment ; ce qui ne ment pas, c'est le TEXTE QUE L'UTILISATRICE LIT.
 *
 * L'invariant : dans la vue arbre, il n'y a AUCUN CHIFFRE. Pas de nombre de branches, pas de
 * pourcentage, pas de palier, pas de date. L'arbre se regarde, il ne se lit pas comme un tableau de bord.
 * Cette garde est un tueur de mutant par construction : ajouter `{n} branches nommées` fait apparaître
 * un chiffre, donc rougir — sans qu'aucune liste de mots interdits n'ait à deviner son nom.
 */

const NB_BRANCHES = 7; // choisi pour ne coïncider avec aucun chiffre des dates de test

const branche = (i: number): BrancheProjetee => ({
  id: `b${i}`,
  etat: i % 3 === 0 ? "naissance" : i % 3 === 1 ? "feuillaison" : "rayonnement",
  intensite: 0.4,
  extraitSourceId: `extrait-${i}`,
  nom: `ce que j'ai compris, numéro ${"un deux trois quatre cinq six sept".split(" ")[i]}`,
  dateNaissance: "2026-03-11T10:00:00.000Z",
  extraitContenu: "je crois que je m'en veux depuis longtemps",
});

const scene = (n: number): ProjectionScene => ({
  tronc: { present: true },
  branches: Array.from({ length: n }, (_, i) => branche(i)),
});

function proprietes(projection: ProjectionScene) {
  return {
    projection,
    camera: { pan: { x: 0, y: 0 }, zoom: 1 },
    brancheSelectionnee: null,
    onCadrer: vi.fn(),
    onOuvrirFiche: vi.fn(),
    onFermerFiche: vi.fn(),
    onVoirDansConversation: vi.fn(),
    onRenommer: vi.fn(async () => true),
  };
}

/** Tout ce que l'utilisatrice LIT : le texte visible + les libellés annoncés aux lecteurs d'écran. */
function texteLu(racine: HTMLElement): string {
  const etiquettes = [...racine.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label") ?? "");
  return `${racine.textContent ?? ""} ${etiquettes.join(" ")}`;
}

describe("[FR-031 DUR] la vue arbre n'affiche AUCUNE mesure", () => {
  it("aucun CHIFFRE dans la vue arbre, quel que soit le nombre de branches", () => {
    dimensionnerTout(800, 600);
    const { container } = render(<ArbreInteractif {...proprietes(scene(NB_BRANCHES))} />);
    const lu = texteLu(container);

    expect(lu, `un chiffre affiché dans la vue arbre : « ${lu.trim()} »`).not.toMatch(/\d/);
    expect(lu).not.toContain("%");
  });

  it("aucun POURCENTAGE dans la vue liste non plus (elle porte des dates, pas des mesures)", async () => {
    dimensionnerTout(800, 600);
    render(<ArbreInteractif {...proprietes(scene(NB_BRANCHES))} />);
    // La bascule vers la vue liste est le doublage non-spatial (AC8).
    screen.getByRole("button", { name: /vue liste/i }).click();

    const lu = texteLu(document.body);
    expect(lu).not.toContain("%");
    // Le nombre de branches ne doit apparaître nulle part comme un décompte.
    expect(lu, "le nombre de branches est affiché comme un décompte").not.toMatch(
      new RegExp(`(^|\\D)${NB_BRANCHES}(\\D|$)`),
    );
  });

  it("[MÉTA] la garde MORD : un chiffre injecté dans le même texte serait attrapé", () => {
    // Contrôle positif du prédicat lui-même : sans lui, un `.not.toMatch` sur du texte vide passerait
    // toujours et la garde serait creuse (le reproche exact fait à la version précédente).
    expect("Progression : 45 %").toMatch(/\d/);
    expect(`${NB_BRANCHES} branches nommées`).toMatch(new RegExp(`(^|\\D)${NB_BRANCHES}(\\D|$)`));
  });
});
