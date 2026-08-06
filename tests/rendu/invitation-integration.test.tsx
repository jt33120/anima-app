import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Conversation from "@/render/conversation/Conversation";
import { PHRASE_INVITATION } from "@/lib/domain/arbitrage-ouverture";
import { ACTION_ALLER_VERS_BRANCHE } from "@/render/conversation/copie-proposition";

/**
 * Story 4.10 (T7) — [AC4/AC5 DUR] L'INVITATION, MONTÉE POUR DE VRAI.
 *
 * `arbitrage-frontiere.test.ts` prouve que le TYPE ne peut pas porter de compte. Ce fichier prouve la
 * chose complémentaire, et elle n'est pas la même : ce qui apparaît RÉELLEMENT à l'écran. Un composant
 * peut très bien dériver un chiffre de rien du tout (« Tu en as plusieurs »), ou se rendre en dehors du
 * fil — deux choses qu'aucune lecture de type ne verrait.
 */

vi.mock("@/render/conversation/useFluxAnam", () => ({
  useFluxAnam: () => ({ prepare: false, enCours: false, envoyer: vi.fn() }),
}));

const INVITATION = {
  type: "invitation" as const,
  phrase: PHRASE_INVITATION,
  brancheCibleId: "b-la-plus-ancienne",
};

describe("[AC5 DUR] rien de chiffré n'atteint l'écran", () => {
  it("[LE CŒUR] aucun chiffre nulle part dans le fil", async () => {
    // Mutation-cible : afficher « (3) » à côté de la phrase, ou une pastille de compte. Le type l'interdit
    // déjà (aucun champ numérique) ; ceci attrape la dérivation à partir de rien — « plusieurs branches »,
    // une jauge, un badge. FR-031 est marqué DUR : ce n'est pas une préférence esthétique, c'est que
    // compter ses prises de conscience les transforme en score.
    const { container } = render(<Conversation ouverture={INVITATION} />);
    expect(await screen.findByText(PHRASE_INVITATION)).toBeTruthy();
    expect(container.textContent ?? "", "aucun chiffre à l'écran").not.toMatch(/\d/);
  });

  it("aucun quantificateur non plus, ni le mot « branches » au pluriel", async () => {
    const { container } = render(<Conversation ouverture={INVITATION} />);
    await screen.findByText(PHRASE_INVITATION);
    const texte = (container.textContent ?? "").toLowerCase();
    for (const mot of ["plusieurs", "trois", "branches", "en cours", "ouvertes"]) {
      expect(texte, `« ${mot} » compte, même sans chiffre`).not.toContain(mot);
    }
  });
});

describe("[AC4] en conversation, jamais en bandeau — et elle mène quelque part", () => {
  it("l'invitation est un TOUR DU FIL (un `article`), au même rang que les autres", async () => {
    render(<Conversation ouverture={INVITATION} />);
    const bloc = await screen.findByRole("article", { name: /branche attend/i });
    expect(bloc.textContent).toContain(PHRASE_INVITATION);
  });

  it("[LE CŒUR] le geste emmène vers LA branche visée, pas vers une liste", async () => {
    // Une invitation qui ne mène nulle part est un constat sur ce qu'elle n'a pas fait, c'est-à-dire un
    // reproche. Mutation-cible : retirer le bouton, ou l'envoyer vers la vue liste (qui redeviendrait un
    // compte : voir toutes ses branches en naissance, c'est les compter).
    const onAller = vi.fn();
    render(<Conversation ouverture={INVITATION} onAllerVersBranche={onAller} />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_ALLER_VERS_BRANCHE }));
    expect(onAller).toHaveBeenCalledWith("b-la-plus-ancienne");
    expect(onAller, "UNE branche, une seule fois").toHaveBeenCalledTimes(1);
  });

  it("aucun bouton pour la refuser : refuser une invitation, c'est ne pas la suivre", async () => {
    // Mutation-cible : ajouter « Plus tard ». Elle obligerait à RÉPONDRE à quelque chose qui ne
    // demandait rien, et ferait de l'invitation une question fermée.
    render(<Conversation ouverture={INVITATION} onAllerVersBranche={vi.fn()} />);
    // Scopé au TOUR d'invitation : le fil porte aussi le composeur, qui n'a rien à voir avec elle.
    const bloc = await screen.findByRole("article", { name: /branche attend/i });
    const boutons = within(bloc).getAllByRole("button");
    expect(boutons, "un seul geste, et il est doux").toHaveLength(1);
    expect(boutons[0].textContent).toBe(ACTION_ALLER_VERS_BRANCHE);
  });
});

describe("l'autre embranchement du même `if` reste intact", () => {
  it("une PROPOSITION rend toujours Oui/Non et son champ de nommage (4.5 non régressée)", async () => {
    render(
      <Conversation
        ouverture={{ type: "proposition", signalId: "sig-1", phrase: "Il s'est passé quelque chose hier." }}
      />,
    );
    expect(await screen.findByText("Il s'est passé quelque chose hier.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Oui" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Non" })).toBeTruthy();
  });

  it("aucune ouverture → fil vide, aucun tour amorcé", async () => {
    const { container } = render(<Conversation ouverture={null} />);
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });
});

describe("[REVUE 4.10 — LE BLOQUANT] l'ouverture est RÉACTIVE, pas figée au montage", () => {
  /**
   * ⚠️ LE DÉFAUT LE PLUS GRAVE DE LA STORY, et il était invisible à la lecture.
   *
   * `Conversation` reste montée en permanence (correctif 4.6 : la démonter détruisait le fil de la
   * séance). Le fil était amorcé dans l'initialiseur de `useState` — qui ne s'exécute qu'au montage.
   * Or entrer dans la région arbre déclenche `router.refresh()`, qui ré-exécute `app/page.tsx`, donc
   * `chargerOuverture()`, donc `reserverParole()` — QUI ÉCRIT.
   *
   * Parcours ordinaire : elle nomme sa 3ᵉ branche, elle clique sur l'onglet arbre. La fenêtre de sept
   * jours était CONSOMMÉE, la nouvelle prop arrivait, l'initialiseur ne rejouait pas, et l'invitation
   * n'était JAMAIS affichée. Anam se taisait une semaine au moment précis où elle devait parler.
   */
  it("[LE CŒUR] une invitation qui arrive APRÈS le montage s'affiche quand même", async () => {
    // Mutation-cible : remettre le calcul du fil dans le seul initialiseur de `useState`.
    const { rerender } = render(<Conversation ouverture={null} />);
    expect(screen.queryByText(PHRASE_INVITATION), "rien au montage").toBeNull();

    rerender(<Conversation ouverture={INVITATION} />);
    expect(
      await screen.findByText(PHRASE_INVITATION),
      "la parole a été réservée en base : elle DOIT être dite à l'écran",
    ).toBeTruthy();
  });

  it("le même rafraîchissement deux fois ne l'empile PAS deux fois", async () => {
    // Chaque round-trip RSC fabrique un objet neuf : comparer les identités dupliquerait le tour à chaque
    // `router.refresh()`. On compare une CLÉ STABLE. Mutation-cible : comparer `ouverture !== prec`.
    const { rerender } = render(<Conversation ouverture={INVITATION} />);
    rerender(<Conversation ouverture={{ ...INVITATION }} />);
    rerender(<Conversation ouverture={{ ...INVITATION }} />);
    expect(screen.getAllByText(PHRASE_INVITATION), "une seule fois dans le fil").toHaveLength(1);
  });

  it("une PROPOSITION qui arrive après le montage s'affiche aussi (le même chemin sert les deux)", async () => {
    const { rerender } = render(<Conversation ouverture={null} />);
    rerender(
      <Conversation ouverture={{ type: "proposition", signalId: "sig-9", phrase: "Il s'est passé quelque chose." }} />,
    );
    expect(await screen.findByText("Il s'est passé quelque chose.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Oui" })).toBeTruthy();
  });

  it("l'ouverture qui DISPARAÎT n'efface pas ce qui a déjà été dit", async () => {
    // Le fil est un récit : un tour prononcé ne se retire pas parce qu'un rafraîchissement ultérieur
    // n'a plus rien à ouvrir. Mutation-cible : remplacer le fil au lieu d'y ajouter.
    const { rerender } = render(<Conversation ouverture={INVITATION} />);
    await screen.findByText(PHRASE_INVITATION);
    rerender(<Conversation ouverture={null} />);
    expect(screen.getByText(PHRASE_INVITATION), "ce qui a été dit reste dit").toBeTruthy();
  });
});
