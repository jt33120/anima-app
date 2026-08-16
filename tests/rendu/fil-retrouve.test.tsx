import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Conversation from "@/render/conversation/Conversation";
import type { TourHistorique } from "@/render/conversation/types";

/**
 * fil-retrouve.test.tsx — LE FIL REMIS À L'ÉCRAN (QA tour 1, T3).
 *
 * `depot-fil.test.ts` prouve que la base rend les bons tours, dans le bon ordre. Ce fichier prouve
 * la chose complémentaire, et ce n'est pas la même : **qu'ils atteignent l'écran**. C'est très
 * exactement l'écart qui a produit le défaut — le journal était écrit depuis la 4.1, et personne ne
 * le remontait.
 */

const HISTORIQUE: readonly TourHistorique[] = [
  { id: "h1", role: "utilisatrice", texte: "je reprends là où on s'était arrêtées" },
  { id: "h2", role: "anam", texte: "j'ai lu jusqu'au bout" },
  { id: "h3", role: "utilisatrice", texte: "le long message qu'on écrit une fois" },
];

describe("[QA T3] au montage, le fil déjà écrit est LÀ", () => {
  it("[LE CŒUR] les trois tours paraissent, dans l'ordre reçu", () => {
    // Mutation-cible : ne pas amorcer l'état avec l'historique. C'est l'état d'avant, et il laissait
    // toute la suite verte — le fil vivait entièrement dans l'état local du composant.
    render(<Conversation historique={HISTORIQUE} />);
    for (const t of HISTORIQUE) expect(screen.getByText(t.texte), t.texte).toBeTruthy();
  });

  it("l'ordre du DOM est l'ordre reçu — le rendu ne trie rien", () => {
    const { container } = render(<Conversation historique={HISTORIQUE} />);
    const texte = container.textContent ?? "";
    const positions = HISTORIQUE.map((t) => texte.indexOf(t.texte));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("sans historique, rien n'apparaît — et surtout aucune bulle vide", () => {
    // Le contrôle négatif : un composant qui rendrait un tour par défaut mettrait une bulle vide
    // dans le fil, ce qui se lit comme un message effacé — l'angoisse même qu'on répare.
    const { container } = render(<Conversation />);
    expect(container.querySelectorAll("li").length).toBe(0);
  });

  it("un tour d'Anam retrouvé n'affiche PAS d'état d'attente", () => {
    // ⚠️ Ils SONT complets : écrits, streamés, gravés. Les remettre en `flux` afficherait un curseur
    // qui n'attend rien — et une réponse qui semble en cours de rédaction depuis hier.
    const { container } = render(<Conversation historique={[HISTORIQUE[1]]} />);
    expect(container.querySelector("[aria-busy='true']")).toBeNull();
    expect((container.textContent ?? "").toLowerCase()).not.toContain("écrit");
  });

  it("[FR-034] aucun ÉVÉNEMENT de séance n'est rejoué avec le fil", () => {
    // Ni bilan, ni carte d'abonnement, ni ressources : ce sont des événements de SÉANCE, pas du
    // journal. Les rejouer ferait réapparaître une carte d'abonnement à chaque rechargement — la
    // relance exacte que FR-034 interdit.
    const { container } = render(<Conversation historique={HISTORIQUE} />);
    const texte = (container.textContent ?? "").toLowerCase();
    for (const interdit of ["abonn", "3114", "bilan", "sos amitié"]) {
      expect(texte, `« ${interdit} » n'a rien à faire dans un fil retrouvé`).not.toContain(interdit);
    }
  });
});
