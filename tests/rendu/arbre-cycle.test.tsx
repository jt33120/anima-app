import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FicheBranche from "@/render/arbre/FicheBranche";
import type { BrancheProjetee } from "@/lib/scene/projection";

/**
 * Story 4.7 (T5/T6) — le RENDU du cycle de vie, monté pour de vrai (jsdom + Testing Library).
 *
 * Une garde de source prouverait le câblage, jamais le comportement : c'est la leçon de la re-revue 4.6,
 * où un `useLayoutEffect` correctement écrit mais aux dépendances mal posées laissait l'arbre INVISIBLE
 * au scénario nominal sans qu'une seule garde rougisse. Ce qui est vérifié ici est donc VÉCU :
 *  - AC5 : le changement est DÉJÀ LÀ (aucune animation d'apparition), et la fiche dit quoi et QUAND ;
 *  - AC3 : le geste existe, il est explicite, confirmé, et absent quand la branche rayonne déjà ;
 *  - FR-031 : aucun chiffre de progression n'atteint l'écran.
 */

const BASE: BrancheProjetee = {
  id: "b1",
  etat: "naissance",
  intensite: 0,
  extraitSourceId: "e1",
  nom: "dire non à ma mère",
  dateNaissance: "2026-03-12T10:00:00Z",
  extraitContenu: "je n'arrive jamais à refuser",
};

function monter(branche: Partial<BrancheProjetee>, onDeclarer?: (id: string) => Promise<boolean>) {
  const props = {
    branche: { ...BASE, ...branche },
    onFermer: vi.fn(),
    onVoirDansConversation: vi.fn(),
    onRenommer: vi.fn(async () => true),
    onAnnoncer: vi.fn(),
    ...(onDeclarer ? { onDeclarerRayonnement: onDeclarer } : {}),
  };
  return { ...render(<FicheBranche {...props} />), props };
}

describe("[AC5] la fiche dit ce qui a changé ET QUAND", () => {
  it("une branche en feuillaison porte sa date de feuillaison", () => {
    monter({ etat: "feuillaison", intensite: 0.4, dateFeuillaison: "2026-04-02T09:00:00Z" });
    expect(screen.getByText(/s'étoffe depuis le 2 avril 2026/)).toBeTruthy();
  });

  it("une branche en pleine lumière dit depuis quand — et que c'est ELLE qui l'a dit", () => {
    monter({ etat: "rayonnement", intensite: 1, dateRayonnement: "2026-05-20T09:00:00Z" });
    const phrase = screen.getByText(/pleine lumière depuis le 20 mai 2026/);
    expect(phrase.textContent, "la fiche attribue le geste à l'utilisatrice, pas au produit").toMatch(
      /parce que tu l'as dit/,
    );
  });

  it("une branche qui a SAUTÉ la feuillaison n'invente pas une date qu'elle n'a pas", () => {
    // Le saut direct naissance → rayonnement est légal (elle a pu vivre la chose sans y revenir en
    // séance). `date_feuillaison` reste nulle : la fiche doit se taire là-dessus, pas broder.
    monter({ etat: "rayonnement", intensite: 0, dateRayonnement: "2026-05-20T09:00:00Z" });
    expect(screen.queryByText(/s'étoffe depuis/), "aucune feuillaison n'a eu lieu").toBeNull();
  });

  it("une branche en naissance ne raconte aucune transition", () => {
    monter({});
    expect(screen.queryByText(/s'étoffe depuis/)).toBeNull();
    expect(screen.queryByText(/pleine lumière depuis/)).toBeNull();
  });

  it("[AC5] AUCUNE animation d'apparition sur la phrase de transition (le changement est DÉJÀ là)", () => {
    // DESIGN L603 : « aucune étincelle, aucune particule, aucune animation festive au changement d'état ».
    monter({ etat: "rayonnement", intensite: 1, dateRayonnement: "2026-05-20T09:00:00Z" });
    const phrase = screen.getByText(/pleine lumière depuis/);
    const style = getComputedStyle(phrase);
    expect(style.animationName === "" || style.animationName === "none").toBe(true);
  });
});

describe("[AC3] le geste — explicite, confirmé, et jamais proposé pour rien", () => {
  it("le bouton n'apparaît PAS si la branche est déjà en pleine lumière", () => {
    monter({ etat: "rayonnement", intensite: 1, dateRayonnement: "2026-05-20T09:00:00Z" }, async () => true);
    expect(
      screen.queryByRole("button", { name: /devenu vrai en moi/i }),
      "proposer d'atteindre ce qui est atteint invite à refaire ce qui ne se refait pas",
    ).toBeNull();
  });

  it("le bouton n'apparaît pas non plus si l'hôte ne fournit pas le geste (AD-7 : le rendu ne décide pas)", () => {
    monter({ etat: "feuillaison", intensite: 0.4 });
    expect(screen.queryByRole("button", { name: /devenu vrai en moi/i })).toBeNull();
  });

  it("un seul clic ne déclare RIEN : le geste est irréversible, il passe par une confirmation", async () => {
    const declarer = vi.fn(async () => true);
    monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    expect(declarer, "le premier clic ouvre la confirmation, il n'écrit pas").not.toHaveBeenCalled();
    expect(screen.getByText(/elle y restera/i), "et la confirmation DIT que c'est définitif").toBeTruthy();
  });

  it("« Pas encore » referme sans rien écrire", async () => {
    const declarer = vi.fn(async () => true);
    monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /pas encore/i }));
    expect(declarer).not.toHaveBeenCalled();
    expect(screen.queryByText(/elle y restera/i)).toBeNull();
  });

  it("confirmer appelle le geste UNE fois, avec l'id de la branche, et l'annonce au lecteur d'écran", async () => {
    const declarer = vi.fn(async () => true);
    const { props } = monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /oui, c'est devenu vrai/i }));
    expect(declarer).toHaveBeenCalledTimes(1);
    expect(declarer).toHaveBeenCalledWith("b1");
    expect(props.onAnnoncer).toHaveBeenCalledWith(expect.stringMatching(/pleine lumière/i));
  });

  it("un REFUS serveur est dit honnêtement, et n'affiche pas un état que la base n'a pas écrit", async () => {
    // Refusé (fenêtre détresse D3, panne) : l'annonce doit inviter à réessayer, jamais annoncer un
    // succès. Sur un état IRRÉVERSIBLE, un optimisme mensonger est le pire des mensonges.
    const declarer = vi.fn(async () => false);
    const { props } = monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /oui, c'est devenu vrai/i }));
    expect(props.onAnnoncer).toHaveBeenCalledWith(expect.stringMatching(/pas pu/i));
    expect(props.onAnnoncer).not.toHaveBeenCalledWith(expect.stringMatching(/est en pleine lumière/i));
  });
});

describe("[FR-031] aucun chiffre de progression n'atteint l'écran", () => {
  it("une fiche en feuillaison n'affiche ni pourcentage, ni compteur, ni « x sur y »", () => {
    const { container } = monter({
      etat: "feuillaison",
      intensite: 0.6,
      dateFeuillaison: "2026-04-02T09:00:00Z",
    });
    const texte = container.textContent ?? "";
    // La DATE porte légitimement des chiffres : on vise la progression chiffrée, pas les dates.
    const sansDates = texte.replace(/\d{1,2}\s+\p{L}+\s+\d{4}/gu, "");
    expect(sansDates, "l'intensité ne doit jamais se lire en chiffres").not.toMatch(/\d/);
  });
});
