import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PremierPassage from "@/render/premier-passage";
import type { PremierPassageVue } from "@/render/premier-passage";

/**
 * premier-passage.test.tsx — LE PREMIER PASSAGE MONTÉ POUR DE VRAI (H4, QA visuelle du 2026-08-19).
 *
 * `premier-passage.test.ts` prouve que le MODÈLE décide juste. Ce fichier prouve la chose
 * complémentaire, et ce n'est pas la même : **ce qui atteint l'écran** — et surtout que le bloc
 * n'existe PAS quand il n'est pas dû. Une garde de source resterait verte alors qu'un `du: false`
 * rendrait quand même un `<section>` vide occupant de la hauteur au-dessus de la porte.
 */

const classes = { classe: "c", classeListe: "l", classeNote: "n" };
const monte = (modele: PremierPassageVue) => render(<PremierPassage modele={modele} {...classes} />);

describe("[H4] quand le passage n'est PAS dû", () => {
  it("[LE CŒUR] il ne rend RIEN — pas même un conteneur vide", () => {
    const { container } = monte({ du: false, desCartesAttendent: true });
    expect(container.innerHTML, "un bloc vide pousse la porte hors de l'écran").toBe("");
  });

  it("[LE CŒUR] la note sur les cartes vides est inatteignable de ce côté-là", () => {
    // Le champ vaut `true` : c'est bien `du` qui ferme, pas le hasard de la donnée.
    monte({ du: false, desCartesAttendent: true });
    expect(screen.queryByText(/écrits à la main/)).toBeNull();
  });
});

describe("[H4] quand le passage EST dû", () => {
  it("[LE CŒUR] les trois places sont nommées, et il n'y en a pas une quatrième", () => {
    monte({ du: true, desCartesAttendent: false });
    const noms = screen.getAllByRole("term").map((e) => e.textContent);
    expect(noms).toEqual(["Anam", "L’arbre", "L’accueil"]);
  });

  it("chaque place a sa définition — un nom sans phrase n'explique rien", () => {
    monte({ du: true, desCartesAttendent: false });
    expect(screen.getAllByRole("definition")).toHaveLength(3);
  });

  it("[LE CŒUR] il dit par quoi commencer — c'est la moitié du constat H4", () => {
    // « je viens de m'inscrire » → « je sais quoi faire ». Nommer les places sans dire par où
    // commencer ne répond qu'à la première moitié.
    monte({ du: true, desCartesAttendent: false });
    expect(screen.getByText(/Le plus simple/)).toBeTruthy();
  });

  it("le bloc est un repère nommé pour un lecteur d'écran", () => {
    monte({ du: true, desCartesAttendent: false });
    const titre = screen.getByRole("heading", { level: 2 });
    expect(titre.textContent).toBe("Trois places");
    // La voix de titre reste UNE : Fraunces (`--pile-anam`), jamais l'interface.
    expect(titre.className).toContain("t-titre-sm");
  });
});

describe("[H4] la note qui se retire toute seule", () => {
  it("[LE CŒUR] elle paraît TANT QUE des cartes attendent", () => {
    monte({ du: true, desCartesAttendent: true });
    expect(screen.getByText(/attendent encore les leurs/)).toBeTruthy();
  });

  it("[LE CŒUR] et disparaît sans que personne n'ait à l'effacer", () => {
    monte({ du: true, desCartesAttendent: false });
    expect(screen.queryByText(/attendent encore les leurs/)).toBeNull();
  });

  it("elle dit que ces textes ne sortent PAS du modèle (FR-054/FR-086)", () => {
    // C'est la chose la plus importante à savoir sur ce lieu, et la seule occasion de la dire.
    monte({ du: true, desCartesAttendent: true });
    expect(screen.getByText(/jamais par Anam/)).toBeTruthy();
  });
});

describe("[H4 · FR-031] rien ne compte, rien ne se verrouille", () => {
  it("[LE CŒUR] aucun chiffre n'atteint l'écran", () => {
    // ⚠️ LE CHEMIN DE FUITE EST ICI, PAS DANS LE TYPE. La frontière interdit un champ numérique ;
    // rien n'empêcherait le rendu de FABRIQUER un compte (« 3 places », « étape 1 sur 4 »). Deux
    // gardes, deux chemins.
    const { container } = monte({ du: true, desCartesAttendent: true });
    expect(container.textContent ?? "", "un chiffre est apparu dans la présentation").not.toMatch(/[0-9]/);
  });

  it("aucun attribut d'accessibilité ne porte de compte ni d'étape", () => {
    // La pastille qui ne s'écrit pas : un `aria-label` « étape 1 sur 4 » ferait exister la visite
    // guidée pour un lecteur d'écran alors qu'elle n'existe pas à l'œil.
    const { container } = monte({ du: true, desCartesAttendent: true });
    for (const el of container.querySelectorAll("*")) {
      for (const attr of ["aria-label", "aria-describedby", "aria-valuenow", "data-etape"]) {
        const v = el.getAttribute(attr);
        expect(v === null || !/[0-9]/.test(v), `${attr}=« ${v} »`).toBe(true);
      }
    }
  });
});
