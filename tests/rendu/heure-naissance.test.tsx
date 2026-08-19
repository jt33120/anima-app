import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * REVUE DE CODE du 2026-08-12 (A2) — LE FORMULAIRE DE L'HEURE ET DU LIEU, RÉELLEMENT MONTÉ.
 *
 * `tests/heure-naissance-actions.test.ts` garde le SERVEUR : ce qui est écrit, ce qui est refusé.
 * Il ne peut rien dire de ce que quelqu'un voit ni de ce que le navigateur envoie — et c'est là que
 * vivait A2 : les deux champs étaient `required`, donc une personne sans heure de naissance ne
 * pouvait pas non plus donner sa commune. Le serveur n'aurait jamais vu passer cet envoi-là.
 *
 * On garde ici trois choses que seule une montée réelle établit :
 *   • ce qui est DEMANDÉ (et ce qui ne l'est plus quand c'est déjà gravé) ;
 *   • ce que le navigateur ENVERRA — un champ `disabled` ne fait pas partie du FormData, et c'est
 *     ce qui empêche mécaniquement la contradiction « case cochée + heure remplie » ;
 *   • quand le bouton s'ouvre — un bouton ouvert sur un envoi qui n'a rien à écrire est une
 *     promesse qu'on ne tient pas.
 */

const chercherLieux = vi.fn();

vi.mock("@/app/heure-naissance/actions", () => ({
  chercherLieux: (q: string) => chercherLieux(q),
  enregistrerHeureEtLieu: async () => ({ statut: "saisie" as const }),
}));

const { default: FormulaireHeure } = await import("@/app/heure-naissance/formulaire-heure");

const RIEN = { heure: null, lieu: null };

beforeEach(() => {
  chercherLieux.mockReset();
  chercherLieux.mockResolvedValue([]);
});

/** Ce que le navigateur enverrait vraiment : `FormData` ignore les champs désactivés. */
function envoi(): FormData {
  const form = document.querySelector("form");
  if (!form) throw new Error("aucun formulaire monté");
  return new FormData(form);
}

describe("[A2] la commune se demande même quand l’heure manque", () => {
  it("[CONTRÔLE POSITIF] par défaut, les deux sont demandés", () => {
    render(<FormulaireHeure deja={RIEN} />);
    expect(screen.getByLabelText(/l’heure de ta naissance/i)).toBeTruthy();
    expect(screen.getByLabelText(/ta commune de naissance/i)).toBeTruthy();
  });

  it("l’heure est `required` tant qu’on ne déclare pas ne pas la connaître", () => {
    render(<FormulaireHeure deja={RIEN} />);
    expect((screen.getByLabelText(/l’heure de ta naissance/i) as HTMLInputElement).required).toBe(true);
  });

  it("[LE TEST QUI COMPTE] cocher « je ne connais pas mon heure » libère le champ", async () => {
    render(<FormulaireHeure deja={RIEN} />);
    await userEvent.click(screen.getByLabelText(/je ne connais pas mon heure/i));
    const champ = screen.getByLabelText(/l’heure de ta naissance/i) as HTMLInputElement;
    expect(champ.required, "un champ obligatoire bloquerait l’envoi côté navigateur").toBe(false);
    expect(champ.disabled).toBe(true);
  });

  it("[DUR] une heure saisie PUIS la case cochée ne part pas — le serveur refuserait la contradiction", async () => {
    // Le serveur refuse « case cochée + heure remplie » (il ne choisit pas à sa place), et il a
    // raison. Mais lui faire rencontrer ce refus serait un cul-de-sac fabriqué par l'écran : c'est
    // au formulaire de rendre la contradiction impossible, pas à elle de la démêler.
    render(<FormulaireHeure deja={RIEN} />);
    await userEvent.type(screen.getByLabelText(/l’heure de ta naissance/i), "07:15");
    expect(envoi().get("heure_naissance")).toBe("07:15");

    await userEvent.click(screen.getByLabelText(/je ne connais pas mon heure/i));
    expect(envoi().get("heure_naissance"), "un champ désactivé ne fait pas partie de l’envoi").toBeNull();
    expect(envoi().get("sans_heure")).toBe("oui");
  });

  it("décocher la case rend le champ, et son contenu repart", async () => {
    render(<FormulaireHeure deja={RIEN} />);
    await userEvent.type(screen.getByLabelText(/l’heure de ta naissance/i), "07:15");
    const case_ = screen.getByLabelText(/je ne connais pas mon heure/i);
    await userEvent.click(case_);
    await userEvent.click(case_);
    expect(envoi().get("heure_naissance")).toBe("07:15");
    expect(envoi().get("sans_heure")).toBeNull();
  });
});

describe("[A2] on ne redemande pas ce qui est déjà gravé", () => {
  it("commune déjà enregistrée : le champ disparaît, et elle est rappelée en clair", () => {
    render(<FormulaireHeure deja={{ heure: null, lieu: "Bordeaux (33)" }} />);
    expect(screen.queryByLabelText(/ta commune de naissance/i)).toBeNull();
    expect(screen.getByText(/Bordeaux \(33\)/)).toBeTruthy();
    // L'heure, elle, reste demandée : c'est exactement le parcours qu'ouvre le découplage.
    expect(screen.getByLabelText(/l’heure de ta naissance/i)).toBeTruthy();
  });

  it("heure déjà enregistrée : ni le champ, ni la case de déclaration d’absence", () => {
    render(<FormulaireHeure deja={{ heure: "07:15:00", lieu: null }} />);
    expect(screen.queryByLabelText(/l’heure de ta naissance/i)).toBeNull();
    expect(screen.queryByLabelText(/je ne connais pas mon heure/i)).toBeNull();
    expect(screen.getByLabelText(/ta commune de naissance/i)).toBeTruthy();
  });
});

describe("[A2] le bouton ne s’ouvre que sur un envoi qui a quelque chose à écrire", () => {
  const bouton = () => screen.getByRole("button", { name: /enregistrer/i }) as HTMLButtonElement;

  it("aucune commune choisie : fermé", () => {
    render(<FormulaireHeure deja={RIEN} />);
    expect(bouton().disabled).toBe(true);
  });

  it("commune déjà gravée, heure encore à donner : OUVERT sans rien choisir", () => {
    render(<FormulaireHeure deja={{ heure: null, lieu: "Bordeaux (33)" }} />);
    expect(bouton().disabled, "elle revient avec son heure : il n’y a plus de commune à choisir").toBe(false);
  });

  it("[LE BORD] tout est déjà gravé : fermé — un bouton ouvert promettrait un geste sans effet", () => {
    render(<FormulaireHeure deja={{ heure: "07:15:00", lieu: "Bordeaux (33)" }} />);
    expect(bouton().disabled).toBe(true);
  });

  it("une commune choisie dans la liste ouvre le bouton", async () => {
    chercherLieux.mockResolvedValue([
      { nom: "Bordeaux (33)", code: "33063", latitude: 44.84, longitude: -0.58, fuseau: "Europe/Paris" },
    ]);
    render(<FormulaireHeure deja={RIEN} />);
    await userEvent.type(screen.getByLabelText(/ta commune de naissance/i), "Bordeaux");
    const proposition = await screen.findByRole("button", { name: "Bordeaux (33)" }, { timeout: 3000 });
    await userEvent.click(proposition);
    expect(bouton().disabled).toBe(false);
    // Le CODE seul est posté : le serveur re-résout les coordonnées lui-même.
    expect(envoi().get("code_lieu")).toBe("33063");
    expect(envoi().get("lieu_latitude")).toBeNull();
  });
});
