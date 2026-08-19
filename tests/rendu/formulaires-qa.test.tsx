import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * formulaires-qa.test.tsx — DEUX FORMULAIRES QUI PUNISSAIENT L'ERREUR (QA tour 1, T19 et T31).
 *
 * Ces deux défauts ne vivent NI dans le domaine NI dans le serveur : ils vivent dans ce que React
 * fait d'un formulaire après une action. Aucun test de `lib/` ne pouvait les voir — il fallait
 * monter les composants. C'est précisément la classe de défauts que la QA humaine a trouvée et que
 * 4 685 tests avaient laissée passer.
 *
 * ⚠️ `jest-dom` N'EST PAS DISPONIBLE dans le projet `rendu` : on assert avec `toBeTruthy()` et
 * `getAttribute()`, jamais `toBeInTheDocument()` / `toHaveAttribute()`.
 */

// ── T19 ─────────────────────────────────────────────────────────────────────────────────────────

const declarerAge = vi.fn();
vi.mock("@/app/(auth)/naissance/actions", () => ({
  declarerAge: (prev: unknown, donnees: FormData) => declarerAge(prev, donnees),
}));

// ── T31 ─────────────────────────────────────────────────────────────────────────────────────────

const donnerConsentement = vi.fn();
vi.mock("@/app/(auth)/consentement/actions", () => ({
  donnerConsentement: (prev: unknown, donnees: FormData) => donnerConsentement(prev, donnees),
}));

const FormulaireNaissance = (await import("@/app/(auth)/naissance/formulaire-naissance")).default;
const FormulaireConsentement = (await import("@/app/(auth)/consentement/formulaire-consentement"))
  .default;

const envoyerLien = vi.fn();
vi.mock("@/app/(auth)/entrer/actions", () => ({
  envoyerLien: (prev: unknown, donnees: FormData) => envoyerLien(prev, donnees),
  // La seconde porte (code à six chiffres). Muette ici : ce fichier mesure la validation NATIVE.
  verifierCode: async () => ({}),
  // La sortie de l'écran de code (AD-9). Muette pour la même raison.
  recommencer: async () => {},
}));
const FormulaireEntree = (await import("@/app/(auth)/entrer/formulaire-entree")).default;

const champ = (nom: string) => document.querySelector(`input[name="${nom}"]`) as HTMLInputElement;
const formulaire = () => document.querySelector("form") as HTMLFormElement;

describe("[QA T19] une date refusée n’efface plus ce qui était déjà tapé", () => {
  it("le prénom, la date et le nom complet reviennent après un refus", async () => {
    // ⚠️ CE QUE MESURE CE TEST. `useActionState` réinitialise un formulaire non contrôlé après
    // chaque action : une date au futur effaçait AUSSI le prénom et le nom, et tout était à
    // ressaisir. Le correctif est que l'action renvoie la saisie et que les champs la reprennent
    // en `defaultValue` — ce que ce test éprouve de bout en bout, pas par lecture du source.
    declarerAge.mockResolvedValue({
      statut: "erreur",
      message: "Cette date est dans le futur.",
      saisie: { prenom: "Camille", date: "2030-01-01", nomComplet: "Camille Perrin" },
    });

    render(<FormulaireNaissance />);
    fireEvent.submit(formulaire());

    await waitFor(() => expect(screen.getByText("Cette date est dans le futur.")).toBeTruthy());
    expect(champ("prenom").value, "le prénom était perdu").toBe("Camille");
    expect(champ("date_naissance").value, "la date était perdue").toBe("2030-01-01");
    expect(champ("nom_complet").value, "le nom complet était perdu").toBe("Camille Perrin");
  });

  it("sur le chemin MINEUR, rien ne revient — l’écran de refus remplace le formulaire", async () => {
    // La branche < 18 ans n'écrit rien, pas même en mémoire de formulaire (AD-14, FR-071).
    // Repeupler un écran qu'on vient de refuser serait une invitation à retenter avec une
    // autre date.
    declarerAge.mockResolvedValue({ statut: "mineur" });

    render(<FormulaireNaissance />);
    fireEvent.submit(formulaire());

    await waitFor(() => expect(screen.getByText(/réservé aux adultes/i)).toBeTruthy());
    expect(document.querySelector('input[name="prenom"]'), "plus de formulaire du tout").toBeNull();
  });
});

describe("[QA T31] l’erreur de consentement s’efface dès qu’on touche à quelque chose", () => {
  const cases = () =>
    Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];

  it("après un refus, cocher une case retire le message périmé", async () => {
    donnerConsentement.mockResolvedValue({
      statut: "erreur",
      message: "Coche les deux accords pour continuer.",
    });

    render(<FormulaireConsentement />);
    fireEvent.submit(formulaire());
    await waitFor(() =>
      expect(screen.getByText("Coche les deux accords pour continuer.")).toBeTruthy(),
    );

    fireEvent.click(cases()[0]);
    expect(
      screen.queryByText("Coche les deux accords pour continuer."),
      "le message périmé cohabitait avec l’indication permanente, deux phrases quasi identiques",
    ).toBeNull();
  });

  it("⚠️ un message qui n’est PAS périmé survit à l’état « prêt »", async () => {
    // LE MUTANT QUI COMPTE : masquer l'erreur sur `pret` (les deux cases cochées). Ce serait plus
    // simple et FAUX — « Enregistrement impossible. Réessaie. » survient précisément quand les deux
    // cases SONT cochées. Le masquer ferait disparaître le seul message qui dit que rien n'a été
    // enregistré. Ce qui périme une erreur, ce n'est pas l'état du formulaire, c'est qu'on l'ait
    // modifié DEPUIS.
    donnerConsentement.mockResolvedValue({
      statut: "erreur",
      message: "Enregistrement impossible. Réessaie.",
    });

    render(<FormulaireConsentement />);
    fireEvent.click(cases()[0]);
    fireEvent.click(cases()[1]);
    fireEvent.submit(formulaire());

    await waitFor(() =>
      expect(screen.getByText("Enregistrement impossible. Réessaie.")).toBeTruthy(),
    );
    // Les deux cases sont cochées : `pret` est vrai, et le message doit rester.
    expect(screen.getByText("Enregistrement impossible. Réessaie.")).toBeTruthy();
  });
});

describe("[QA T31-bis] l’écran de consentement n’affiche pas le contraire de ce qu’il croit", () => {
  const cases = () =>
    Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];

  it("les cases restent COCHÉES après un envoi qui échoue", async () => {
    // ⚠️ TROUVÉ EN ÉCRIVANT LE TEST DE T31, PAS EN LE CHERCHANT. React 19 réinitialise le DOM du
    // formulaire après chaque action ; les cases sont contrôlées, donc leur état React reste vrai,
    // et React ne réécrit pas une propriété DOM dont la valeur rendue n'a pas changé.
    //
    // Mesuré avant correctif : `[false, false]` à l'écran, `pret` vrai dans l'état. Sur l'écran de
    // consentement art. 9 : deux cases visuellement décochées, « Je commence » actif, aucun motif
    // de blocage — et un nouveau clic postait un `FormData` vide, à quoi le serveur répondait
    // « Coche les deux accords pour continuer. » à quelqu'un qui venait de les cocher.
    donnerConsentement.mockResolvedValue({
      statut: "erreur",
      message: "Enregistrement impossible. Réessaie.",
    });

    render(<FormulaireConsentement />);
    fireEvent.click(cases()[0]);
    fireEvent.click(cases()[1]);
    fireEvent.submit(formulaire());

    await waitFor(() =>
      expect(screen.getByText("Enregistrement impossible. Réessaie.")).toBeTruthy(),
    );
    expect(
      cases().map((c) => c.checked),
      "l’écran doit montrer ce que l’état croit",
    ).toEqual([true, true]);
  });

  it("et l’état « prêt » reste cohérent : aucun motif de blocage ne s’affiche", async () => {
    // Le motif « Coche les deux accords ci-dessus pour commencer. » ne paraît que si `pret` est
    // faux. Son absence, cases cochées, prouve que l'affichage et l'état disent la même chose.
    donnerConsentement.mockResolvedValue({ statut: "erreur", message: "Enregistrement impossible. Réessaie." });
    render(<FormulaireConsentement />);
    fireEvent.click(cases()[0]);
    fireEvent.click(cases()[1]);
    fireEvent.submit(formulaire());
    await waitFor(() =>
      expect(screen.getByText("Enregistrement impossible. Réessaie.")).toBeTruthy(),
    );
    expect(screen.queryByText(/ci-dessus pour commencer/)).toBeNull();
  });
});

describe("[QA T28] le produit porte ses propres messages, en français", () => {
  it("les deux formulaires du chemin d’entrée coupent la validation NATIVE", () => {
    // Sans ça, le navigateur affiche « Please fill in this field. » à quiconque ne l'a pas en
    // français — sur le premier écran d'un produit qui ne parle que français. Ce texte suit la
    // langue DU NAVIGATEUR : le produit ne peut pas le traduire, il peut seulement cesser de s'en
    // remettre à lui.
    for (const Formulaire of [FormulaireEntree, FormulaireNaissance]) {
      const { unmount } = render(<Formulaire />);
      const f = document.querySelector("form") as HTMLFormElement;
      expect(f.noValidate, "la bulle native doit être coupée").toBe(true);
      unmount();
    }
  });

  it("⚠️ mais `required` RESTE — il n’était pas là pour la bulle", () => {
    // MUTATION-CIBLE : retirer `required` en même temps que la bulle. Ce serait plus simple et
    // FAUX : `required` est annoncé par les lecteurs d'écran (« obligatoire »), et c'est sa vraie
    // fonction. La bulle n'en était qu'un effet de bord du navigateur.
    render(<FormulaireEntree />);
    expect((document.querySelector('input[name="email"]') as HTMLInputElement).required).toBe(true);
  });

  it("et le serveur, lui, répond en français", async () => {
    envoyerLien.mockResolvedValue({ ok: false, message: "Entre une adresse e-mail valide." });
    render(<FormulaireEntree />);
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByText("Entre une adresse e-mail valide.")).toBeTruthy());
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA SECONDE PORTE — l'écran de saisie du code (2026-08-18)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[entrée] l’écran du code à six chiffres", () => {
  /**
   * Le test d'intégration prouve que le code OUVRE une session ; il ne monte aucun écran. Or ce
   * qui décide qu'on tapera le bon code au bon endroit se joue ici — et deux attributs font
   * toute la différence sur un téléphone.
   */
  async function apresEnvoi() {
    envoyerLien.mockResolvedValue({ ok: true, adresse: "toi@exemple.fr" });
    render(<FormulaireEntree />);
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);
    await screen.findByLabelText(/le code reçu/i);
  }

  it("[LE CŒUR] l’adresse visée est AFFICHÉE — c’est ce qui rend la fixation visible", async () => {
    // L'adresse vérifiée vient d'un cookie, jamais du formulaire. L'écrire ici est ce qui permet
    // de voir, AVANT de taper, qu'un code demandé ne concerne pas son adresse.
    await apresEnvoi();
    expect(screen.getByText(/toi@exemple\.fr/)).toBeTruthy();
  });

  it("le champ appelle le clavier NUMÉRIQUE et le remplissage automatique du code", async () => {
    // `inputMode="numeric"` évite le clavier alphabétique sur un champ de six chiffres, et
    // `autoComplete="one-time-code"` fait proposer le code par iOS et Android depuis la
    // notification — c'est la différence entre recopier et appuyer une fois.
    await apresEnvoi();
    const champ = document.querySelector('input[name="code"]') as HTMLInputElement;
    expect(champ.getAttribute("inputMode")).toBe("numeric");
    expect(champ.getAttribute("autoComplete")).toBe("one-time-code");
    // 8, pas 6 : la production envoyait des codes à HUIT chiffres. Un champ tronqué à six les
    // aurait rendus intapables — sans rien afficher, sur la porte d'entrée.
    expect(champ.getAttribute("maxLength")).toBe("8");
  });

  it("l’écran dit que le LIEN est lié à ce navigateur — sinon le code paraît redondant", async () => {
    // Sans cette phrase, quelqu'un qui a le courriel sous les yeux clique le lien (le geste court)
    // et se heurte au mur PKCE. Le code n'existe que parce que ce mur existe : il faut le dire.
    await apresEnvoi();
    expect(screen.getByText(/n’ouvre que dans ce navigateur/i)).toBeTruthy();
  });

  it("le champ de code coupe aussi la validation native (même règle que les autres)", async () => {
    // ⚠️ ON VISE LE FORMULAIRE QUI PORTE LE CHAMP, PAS « LE DERNIER DE LA PAGE ». Écrite ainsi,
    // la garde a rougi le 2026-08-19 quand la sortie « Recommencer » — un second formulaire, sans
    // aucun champ, donc sans validation native possible — est devenue le dernier. Elle mesurait
    // une position ; la règle porte sur le formulaire où l'on tape.
    await apresEnvoi();
    const champ = document.querySelector('input[name="code"]') as HTMLInputElement;
    expect(champ.form?.hasAttribute("noValidate")).toBe(true);
  });
});
