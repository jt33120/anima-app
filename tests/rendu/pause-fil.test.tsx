import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Conversation from "@/render/conversation/Conversation";
import { PHRASE_PAUSE } from "@/lib/domain/rythme-pause";
import { MOTIFS_ANAM } from "@/lib/domain/regime-anam";

/**
 * pause-fil.test.tsx — LE GESTE DE PAUSE, MONTÉ POUR DE VRAI (Story 6.4, AC1/AC2/AC5).
 *
 * `rythme-pause.test.ts` prouve que la MESURE est juste et que la PHRASE ne demande rien. Ce fichier
 * prouve la chose complémentaire, qui n'est pas la même : que le produit ne fait RIEN D'AUTRE que
 * l'afficher.
 *
 * ⚠️ C'est le seul endroit où l'AC2 peut être éprouvé. « Aucun verrouillage, aucune minuterie, aucun
 * écran "tu as assez utilisé l'app" » est une propriété de ce qui atteint l'écran : un domaine
 * parfaitement pur et une base parfaitement gardée laisseraient passer un `disabled` posé dans le
 * composant en trois caractères.
 */

vi.mock("@/render/conversation/useFluxAnam", () => ({
  useFluxAnam: () => ({ prepare: false, enCours: false, envoyer: vi.fn() }),
}));

const PAUSE = { type: "pause" as const, phrase: PHRASE_PAUSE };

describe("[6.4/AC1] la phrase est un TOUR ORDINAIRE d'Anam", () => {
  it("elle apparaît dans le fil", async () => {
    render(<Conversation ouverture={PAUSE} />);
    expect(await screen.findByText(PHRASE_PAUSE)).toBeDefined();
  });

  it("[LE CŒUR] aucun BOUTON n'apparaît avec elle", async () => {
    // ⚠️ Mutation-cible : lui donner un rôle dédié avec une action (« D'accord », « Plus tard »,
    // « Rappelle-moi demain »). Le réflexe est fort — une proposition semble appeler une réponse —
    // et c'est très exactement l'engagement que l'AC1 interdit d'extorquer. Il n'y a RIEN à faire de
    // cette phrase : elle se lit, et elle s'en va avec le fil.
    render(<Conversation ouverture={PAUSE} />);
    await screen.findByText(PHRASE_PAUSE);
    const boutons = screen.queryAllByRole("button").map((b) => b.textContent ?? "");
    for (const mot of ["D'accord", "Plus tard", "Ignorer", "Fermer", "Compris", "Merci"]) {
      expect(boutons, `« ${mot} » transforme la proposition en dispositif`).not.toContain(mot);
    }
  });

  it("[FR-031] aucun chiffre n'atteint l'écran, alors que la phrase NAÎT d'un compte", async () => {
    // ⚠️ C'est la seule ouverture du produit qui vient d'une mesure. Les deux compteurs meurent côté
    // serveur (la ligne de `pause_rythme` les garde, et personne ne peut lire cette table) : le
    // rendu ne peut donc pas afficher « 7 séances cette semaine », il n'a jamais reçu de 7.
    const { container } = render(<Conversation ouverture={PAUSE} />);
    await screen.findByText(PHRASE_PAUSE);
    expect(container.textContent ?? "").not.toMatch(/\d/);
  });
});

describe("[6.4/AC2 DUR] le produit n'IMPOSE rien — le composeur reste actif", () => {
  it("[LE CŒUR] la zone de saisie n'est ni désactivée ni en lecture seule", async () => {
    // ⚠️ MUTATION-CIBLE LA PLUS DANGEREUSE DE LA STORY, parce qu'elle s'écrirait avec les meilleures
    // intentions : « on l'aide en fermant doucement ». Or quelqu'un qui écrit beaucoup peut être
    // quelqu'un qui traverse quelque chose. Un produit qui ferme la porte au moment de l'intensité
    // la ferme au pire moment possible — et c'est aussi pourquoi la garde de détresse existe en base.
    render(<Conversation ouverture={PAUSE} />);
    await screen.findByText(PHRASE_PAUSE);

    const saisie = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(saisie.disabled, "le composeur a été désactivé").toBe(false);
    expect(saisie.readOnly, "le composeur est passé en lecture seule").toBe(false);
    expect(saisie.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("[LE CŒUR] aucun MINUTEUR, aucun compte à rebours, aucun écran d'interruption", async () => {
    const { container } = render(<Conversation ouverture={PAUSE} />);
    await screen.findByText(PHRASE_PAUSE);
    const texte = container.textContent ?? "";
    for (const interdit of [
      /assez utilis/i,
      /trop utilis/i,
      /revenir dans/i,
      /dans \d+ ?(?:min|h|heures?)/i,
      /verrouill/i,
      /bloqu[ée]/i,
      /limite atteinte/i,
    ]) {
      expect(interdit.test(texte), `« ${interdit} » est apparu à l'écran`).toBe(false);
    }
    // Et aucune boîte modale : un `dialog` interrompt, il ne propose pas.
    expect(container.querySelectorAll("dialog, [role='dialog'], [role='alertdialog']")).toHaveLength(0);
  });

  it("[ANTI-VACUITÉ] le composeur EXISTE — sinon les deux gardes ci-dessus sont vides", async () => {
    render(<Conversation ouverture={PAUSE} />);
    await screen.findByText(PHRASE_PAUSE);
    expect(screen.getByRole("textbox")).toBeDefined();
  });
});

describe("[6.4/AC5] la pause vit UNIQUEMENT en conversation", () => {
  it("[LE CŒUR] elle n'est PAS un motif de canal — ni poussée, ni courriel", () => {
    // ⚠️ L'AC5 le dit mot pour mot : « la proposition de pause n'est jamais portée par une
    // notification ». La 6.3 a déclaré l'ensemble FERMÉ des motifs d'Anam en un seul endroit ; la
    // garde consiste donc à vérifier que cette story n'y a rien ajouté.
    //
    // Et ce n'est pas une précaution théorique : une notification de pause serait le comble de la
    // contradiction — interrompre quelqu'un sur son écran verrouillé pour lui dire qu'elle utilise
    // trop l'application.
    expect([...MOTIFS_ANAM].sort()).toEqual([
      "echeance_intention",
      "proposition_branche",
      "synthese_prete",
    ]);
    for (const m of MOTIFS_ANAM) {
      expect(String(m), "un motif de pause est entré dans l'ensemble").not.toMatch(/pause|rythme/i);
    }
  });
});
