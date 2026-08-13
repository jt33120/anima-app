import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Conversation from "@/render/conversation/Conversation";
import { PHRASE_OUVERTURE_HYPOTHESE } from "@/lib/domain/enneagramme-hypothese";
import { ACTION_VOIR_HYPOTHESE } from "@/render/conversation/copie-hypothese";

/**
 * hypothese-enneagramme.test.tsx — L'HYPOTHÈSE, MONTÉE POUR DE VRAI (Story 5.5, AC2).
 *
 * `enneagramme-hypothese.test.ts` prouve que le TYPE ne peut pas porter de numéro et que la phrase
 * ne peut pas asséner. Ce fichier prouve la chose complémentaire, qui n'est pas la même : ce qui
 * apparaît RÉELLEMENT à l'écran, et QUAND la parole est dépensée.
 *
 * C'est la raison d'être du projet `rendu` (revue 4.6) : un `useEffect` correctement écrit mais dont
 * le tableau de dépendances l'empêche de rejouer laisse la garde de source parfaitement verte.
 */

vi.mock("@/render/conversation/useFluxAnam", () => ({
  useFluxAnam: () => ({ prepare: false, enCours: false, envoyer: vi.fn() }),
}));

const HYPOTHESE = {
  type: "hypothese-enneagramme" as const,
  phrase: PHRASE_OUVERTURE_HYPOTHESE,
  hypotheseId: "h-42",
};

describe("[5.5/AC2] ce qui atteint l'écran, et rien d'autre", () => {
  it("la phrase est un TOUR DU FIL, jamais un bandeau", async () => {
    render(<Conversation ouverture={HYPOTHESE} />);
    const bloc = await screen.findByRole("article", { name: /idée d'Anam/i });
    expect(bloc.textContent).toContain(PHRASE_OUVERTURE_HYPOTHESE);
  });

  it("[LE CŒUR] AUCUN chiffre à l'écran — le numéro n'est pas dans le contrat", async () => {
    // Mutation-cible : afficher « type 4 » à côté de la phrase. Le type l'interdit déjà (aucun champ
    // ne le porte) ; ceci attrape la dérivation à partir de rien. Asséner un numéro au milieu d'une
    // conversation, sans le contexte ni la place de répondre autrement que par oui, est exactement
    // ce que FR-006 refuse.
    const { container } = render(<Conversation ouverture={HYPOTHESE} />);
    await screen.findByText(PHRASE_OUVERTURE_HYPOTHESE);
    expect(container.textContent ?? "").not.toMatch(/\d/);
  });

  it("elle MÈNE quelque part — sinon la question serait sans issue", async () => {
    const onVoir = vi.fn();
    render(<Conversation ouverture={HYPOTHESE} onAllerVersHypothese={onVoir} />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_VOIR_HYPOTHESE }));
    expect(onVoir).toHaveBeenCalledTimes(1);
  });

  it("aucun « Non » : refuser une hypothèse, c'est ne pas aller la voir", async () => {
    // Les trois vraies réponses (accepter, refuser, corriger) vivent à la halte, où le type est sous
    // ses yeux. Un « Non » ici la ferait trancher sur un numéro qu'elle n'a même pas lu.
    render(<Conversation ouverture={HYPOTHESE} onAllerVersHypothese={vi.fn()} />);
    await screen.findByText(PHRASE_OUVERTURE_HYPOTHESE);
    const boutons = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    for (const mot of ["Non", "Plus tard", "Fermer", "Ignorer"]) {
      expect(boutons, `« ${mot} » n'a rien à faire ici`).not.toContain(mot);
    }
  });
});

describe("[5.5/AC2 DUR] la parole se dépense quand elle est LUE, pas quand elle est rendue", () => {
  it("[LE CŒUR] région ACTIVE → marquée « dite », UNE seule fois", async () => {
    // Le composant reste monté toute la séance et se rend à chaque frappe du composeur. Sans le
    // latch, le marquage repartirait à chaque rendu.
    const onDite = vi.fn();
    const { rerender } = render(
      <Conversation ouverture={HYPOTHESE} regionActive onHypotheseDite={onDite} />,
    );
    await screen.findByText(PHRASE_OUVERTURE_HYPOTHESE);
    rerender(<Conversation ouverture={HYPOTHESE} regionActive onHypotheseDite={onDite} />);
    expect(onDite).toHaveBeenCalledTimes(1);
    expect(onDite).toHaveBeenCalledWith("h-42");
  });

  it("[LE CŒUR] région INERTE → RIEN n'est dépensé", async () => {
    // Mutation-cible : retirer `regionActive` de la condition. La scène monte ses trois régions en
    // permanence, `inert` sauf l'active : une phrase rendue là n'est annoncée par aucun lecteur
    // d'écran et vue par personne. La faute a été payée en revue 4.10 puis en migration 0045.
    const onDite = vi.fn();
    render(<Conversation ouverture={HYPOTHESE} regionActive={false} onHypotheseDite={onDite} />);
    await screen.findByText(PHRASE_OUVERTURE_HYPOTHESE);
    expect(onDite).not.toHaveBeenCalled();
  });

  it("la région qui DEVIENT active dépense — le latch ne bloque pas le cas nominal", async () => {
    // Contrôle positif du test précédent : sans lui, « ne jamais dépenser » le satisferait aussi.
    const onDite = vi.fn();
    const { rerender } = render(
      <Conversation ouverture={HYPOTHESE} regionActive={false} onHypotheseDite={onDite} />,
    );
    await screen.findByText(PHRASE_OUVERTURE_HYPOTHESE);
    rerender(<Conversation ouverture={HYPOTHESE} regionActive onHypotheseDite={onDite} />);
    expect(onDite).toHaveBeenCalledTimes(1);
  });

  it("une AUTRE hypothèse (autre identifiant) est dépensée à son tour", async () => {
    // Le latch porte l'identifiant, pas un booléen : sinon une seconde hypothèse — le cas d'un
    // compte réimporté, ou d'une correction — resterait muette pour toujours.
    const onDite = vi.fn();
    const { rerender } = render(
      <Conversation ouverture={HYPOTHESE} regionActive onHypotheseDite={onDite} />,
    );
    await screen.findByText(PHRASE_OUVERTURE_HYPOTHESE);
    rerender(
      <Conversation
        ouverture={{ ...HYPOTHESE, hypotheseId: "h-99" }}
        regionActive
        onHypotheseDite={onDite}
      />,
    );
    expect(onDite).toHaveBeenCalledTimes(2);
    expect(onDite).toHaveBeenLastCalledWith("h-99");
  });
});
