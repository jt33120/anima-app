import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Bibliotheque from "@/render/accueil/Bibliotheque";
import type { BibliothequeVue, CarteVue } from "@/render/accueil/types";

/**
 * bibliotheque.test.tsx — LA BIBLIOTHÈQUE MONTÉE POUR DE VRAI (Story 5.6, T7).
 *
 * `bibliotheque.test.ts` prouve que le MODÈLE ordonne bien et qu'aucun type ne peut porter une
 * mesure. Ce fichier prouve la chose complémentaire, qui n'est pas la même : **ce qui atteint
 * réellement l'écran** — l'ordre du DOM, ce que dit une carte vide, et les chemins par lesquels un
 * compte pourrait fuir sans jamais s'afficher (`aria-label`, texte alternatif, ordre implicite).
 *
 * C'est la raison d'être du projet `rendu` (revue 4.6) : une garde de source reste verte alors que
 * l'écran, lui, ment.
 */

const carte = (cle: string, o: Partial<CarteVue> = {}): CarteVue => ({
  cle,
  titre: `Titre ${cle}`,
  faits: [],
  texte: { statut: "non_ecrit" },
  ...o,
});

/** La carte d'Anam NEUTRE — l'état de très loin le plus fréquent (Story 6.3). */
const ANAM_NEUTRE = {
  titre: "Anam",
  presence: "Elle se manifeste quand elle a quelque chose de précis à dire.",
  ligne: null,
} as const;

/** L'état RÉEL du produit aujourd'hui : 165 créneaux déclarés, 0 écrit. */
const REELLE: BibliothequeVue = {
  jour: { a: 2026, m: 8, j: 14 },
  enAvant: "theme",
  anam: ANAM_NEUTRE,
  cartes: [
    carte("theme", {
      titre: "Ton thème",
      faits: [
        { intitule: "Soleil", valeur: "Balance" },
        { intitule: "Lune", valeur: "Cancer" },
      ],
    }),
    carte("mantra", { titre: "Le mantra du jour" }),
    carte("horoscope", { titre: "Ton ciel du jour" }),
    carte("nombres", { titre: "Tes nombres", faits: [{ intitule: "Chemin de vie", valeur: "7" }] }),
    carte("enneagramme", { titre: "Ton ennéagramme", faits: [{ intitule: "Type", valeur: "4" }] }),
  ],
};

describe("[5.6/AC1] l’ordre du DOM est EXACTEMENT celui reçu — le rendu ne trie rien", () => {
  it("les titres paraissent dans l’ordre des cartes", () => {
    render(<Bibliotheque bibliotheque={REELLE} />);
    const titres = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    // « Anam » ferme la liste et n'entre PAS dans la rotation du jour (Story 6.3, D8) : elle est
    // rendue hors de la grille, donc toujours en dernier, quelle que soit la carte mise en avant.
    expect(titres).toEqual([
      "Ton thème",
      "Le mantra du jour",
      "Ton ciel du jour",
      "Tes nombres",
      "Ton ennéagramme",
      "Anam",
    ]);
  });

  it("[LE TEST QUI COMPTE] inverser l’ordre reçu inverse l’ordre affiché", () => {
    // Sans cette assertion, un tri caché dans le composant passerait inaperçu : les deux ordres
    // coïncideraient par hasard sur le jeu ci-dessus. C'est le pouvoir que `lib/domain` retire au
    // rendu exprès (FR-033 : « jamais algorithmique »).
    const inverse = { ...REELLE, cartes: [...REELLE.cartes].reverse() };
    render(<Bibliotheque bibliotheque={inverse} />);
    const titres = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titres[0]).toBe("Ton ennéagramme");
  });
});

describe("[5.6/AC1] la carte du jour est ANNONCÉE, pas seulement plus grande", () => {
  it("la mise en avant est dite en toutes lettres", () => {
    render(<Bibliotheque bibliotheque={REELLE} />);
    // Une différence purement visuelle n'existe pas pour qui n'y a pas accès.
    expect(screen.getByText(/mise en avant aujourd’hui/i)).toBeTruthy();
  });

  it("UNE SEULE carte est mise en avant", () => {
    render(<Bibliotheque bibliotheque={REELLE} />);
    expect(screen.getAllByText(/mise en avant aujourd’hui/i)).toHaveLength(1);
  });

  it("aucune mise en avant quand aucune carte n’a rien à montrer", () => {
    render(<Bibliotheque bibliotheque={{ ...REELLE, enAvant: null }} />);
    expect(screen.queryByText(/mise en avant aujourd’hui/i)).toBeNull();
  });
});

describe("[5.6/AC5] l’absence est DITE — jamais un vide, jamais un « bientôt »", () => {
  it("une carte sans fait ni texte le dit honnêtement", () => {
    render(<Bibliotheque bibliotheque={REELLE} />);
    const mantra = screen.getByRole("article", { name: "Le mantra du jour" });
    expect(within(mantra).getByText(/n’a pas encore écrit/i)).toBeTruthy();
  });

  it("une carte qui a des faits mais pas de texte le dit AUSSI, et garde ses faits", () => {
    render(<Bibliotheque bibliotheque={REELLE} />);
    const theme = screen.getByRole("article", { name: "Ton thème" });
    expect(within(theme).getByText("Balance")).toBeTruthy();
    expect(within(theme).getByText(/n’a pas encore écrit/i)).toBeTruthy();
  });

  it("[FR-057] aucun « bientôt », aucun compte à rebours, aucune excuse", () => {
    const { container } = render(<Bibliotheque bibliotheque={REELLE} />);
    const texte = container.textContent ?? "";
    for (const interdit of ["bientôt", "prochainement", "à venir", "désolé", "excuse", "patience"]) {
      expect(texte.toLowerCase(), `« ${interdit} » teaser ce qu’on n’a pas`).not.toContain(interdit);
    }
  });

  it("le texte d’Anima paraît tel quel quand il est écrit", () => {
    const ecrite: BibliothequeVue = {
      ...REELLE,
      cartes: [carte("mantra", { titre: "Le mantra du jour", texte: { statut: "ecrit", texte: "Remarque ce qui tient." } })],
      enAvant: "mantra",
    };
    render(<Bibliotheque bibliotheque={ecrite} />);
    expect(screen.getByText("Remarque ce qui tient.")).toBeTruthy();
    expect(screen.queryByText(/n’a pas encore écrit/i)).toBeNull();
  });
});

describe("[5.6/AC2 DUR · FR-031] aucun compte n’atteint l’écran, par AUCUN chemin", () => {
  /**
   * ⚠️ LE CHEMIN DE FUITE OUBLIÉ, celui que la 4.10 a trouvé après coup : un compte n'a pas besoin
   * d'être VISIBLE pour exister. Il peut vivre dans un `aria-label`, un `title`, un `alt`. Ces
   * assertions lisent donc les attributs, pas seulement le texte.
   *
   * Et elles ne peuvent pas refuser « tout chiffre » : « 7 » (chemin de vie) et « 4 » (type) sont
   * des faits du socle, pas des mesures. Ce qu'on refuse, c'est un compte D'OBJETS.
   */
  it("aucun attribut d’accessibilité ne porte un compte", () => {
    const { container } = render(<Bibliotheque bibliotheque={REELLE} />);
    for (const el of Array.from(container.querySelectorAll("*"))) {
      for (const attr of ["aria-label", "title", "alt", "aria-description"]) {
        const v = el.getAttribute(attr);
        if (!v) continue;
        expect(v, `« ${v} » ressemble à un compte dans ${attr}`).not.toMatch(
          /\b\d+\s*(carte|nouveau|nouvelle|restant|sur\s+\d)/i,
        );
      }
    }
  });

  it("aucun libellé de type « 3 cartes », « 2 nouvelles », « 1/5 »", () => {
    const { container } = render(<Bibliotheque bibliotheque={REELLE} />);
    const texte = container.textContent ?? "";
    expect(texte).not.toMatch(/\b\d+\s*(cartes?|nouvelles?|restantes?)\b/i);
    expect(texte).not.toMatch(/\b\d+\s*\/\s*\d+\b/);
  });

  it("aucun mot de verrou n’apparaît nulle part", () => {
    const { container } = render(<Bibliotheque bibliotheque={REELLE} />);
    const texte = (container.textContent ?? "").toLowerCase();
    for (const mot of ["verrouill", "débloqu", "cadenas", "premium", "réservé aux"]) {
      expect(texte, `« ${mot} » sur la bibliothèque`).not.toContain(mot);
    }
  });

  it("[CONTRÔLE POSITIF] les faits du socle, eux, sont bien affichés", () => {
    // Sans ce contrôle, un composant qui n'afficherait RIEN passerait toutes les assertions
    // ci-dessus — le vert tautologique exact que ce dépôt traque.
    render(<Bibliotheque bibliotheque={REELLE} />);
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("Balance")).toBeTruthy();
  });
});

describe("[5.6/D4] la date est portée — sans elle, deux jours identiques se lisent comme une panne", () => {
  it("le jour civil est affiché", () => {
    render(<Bibliotheque bibliotheque={REELLE} />);
    // `lune_relative` ne change que tous les ~2,5 jours : le même texte d'horoscope sort deux à
    // trois jours de suite. C'est le ciel, pas un blocage — la date le dit.
    expect(screen.getByText("14 août")).toBeTruthy();
  });
});
