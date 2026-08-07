import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Story 5.2 (T4) — LA CAPTURE DU PRÉNOM ET DU NOM COMPLET, montée pour de vrai (jsdom).
 *
 * Une garde de source prouverait que les champs sont écrits dans le fichier ; elle ne prouverait ni
 * qu'ils sont ÉTIQUETÉS (donc atteignables au clavier et au lecteur d'écran), ni que l'obligation
 * porte sur le bon champ, ni que l'utilisatrice comprend ce qu'on lui demande. C'est la leçon
 * structurelle de la re-revue 4.6 et la raison d'être de ce projet de test.
 *
 * Ce qui est vérifié ici est VÉCU :
 *  - FR-048 : le prénom est OBLIGATOIRE, le nom complet ne l'est pas ;
 *  - P13    : l'étiquette du nom complet dit « prénoms compris » — sans quoi la moitié des saisies
 *             ne porteraient que le patronyme et le nombre d'expression serait faux, en silence ;
 *  - honnêteté : l'optionnalité et le « pourquoi » sont écrits, jamais laissés au flou.
 */

// L'action serveur ne peut pas s'exécuter en jsdom : on la neutralise. Le sujet du test est le
// FORMULAIRE, pas l'écriture en base (couverte par les gardes de source de `naissance-actions`).
vi.mock("@/app/(auth)/naissance/actions", () => ({
  declarerAge: vi.fn(async () => ({ statut: "saisie" })),
}));
vi.mock("@/app/(auth)/naissance/naissance.module.css", () => ({ default: {} }));

const { default: FormulaireNaissance } = await import(
  "@/app/(auth)/naissance/formulaire-naissance"
);

describe("[T4/FR-048] le seuil demande le prénom, et propose le nom complet", () => {
  it("les trois champs existent et sont ÉTIQUETÉS — jamais un placeholder en guise d'étiquette", () => {
    render(<FormulaireNaissance />);
    // `getByLabelText` échoue si l'étiquette n'est pas réellement associée au champ : c'est la
    // propriété qu'on veut, pas la présence d'un `<input>` quelque part.
    expect(screen.getByLabelText(/ton prénom/i)).toBeDefined();
    expect(screen.getByLabelText(/ta date de naissance/i)).toBeDefined();
    expect(screen.getByLabelText(/ton nom complet de naissance/i)).toBeDefined();
  });

  it("[FR-048] le prénom et la date sont REQUIS, le nom complet ne l'est pas", () => {
    render(<FormulaireNaissance />);
    // Mutation-cible : poser `required` sur le nom complet. FR-048 le déclare optionnel, et un
    // champ obligatoire de plus au seuil est exactement ce que ce produit refuse de faire.
    expect(screen.getByLabelText(/ton prénom/i).hasAttribute("required")).toBe(true);
    expect(screen.getByLabelText(/ta date de naissance/i).hasAttribute("required")).toBe(true);
    expect(screen.getByLabelText(/ton nom complet de naissance/i).hasAttribute("required")).toBe(false);
  });

  it("[P13] l'étiquette du nom complet dit « prénoms compris »", () => {
    render(<FormulaireNaissance />);
    // LE piège de la story, et il est invisible : si elle ne saisit que « Dupont » alors que le
    // calcul attend « Marie Dupont », le nombre d'expression est faux et rien ne le signale.
    const etiquette = screen.getByLabelText(/ton nom complet de naissance/i);
    expect(etiquette).toBeDefined();
    expect(screen.getByText(/prénoms compris/i)).toBeDefined();
  });

  it("dit que le nom complet est facultatif ET à quoi il sert", () => {
    render(<FormulaireNaissance />);
    const aide = screen.getByText(/facultatif/i);
    expect(aide.textContent).toMatch(/numérologie/i);
    // Et surtout : que rien ne se bloque sans lui (FR-048/FR-049, registre honnête).
    expect(aide.textContent).toMatch(/se calcule quand même|sans lui/i);
    // L'aide est RATTACHÉE au champ (aria-describedby), pas juste posée à côté.
    const champ = screen.getByLabelText(/ton nom complet de naissance/i);
    expect(champ.getAttribute("aria-describedby")).toBe(aide.id);
  });

  it("porte les bons noms de champ — c'est ce que l'action serveur lit", () => {
    render(<FormulaireNaissance />);
    expect(screen.getByLabelText(/ton prénom/i).getAttribute("name")).toBe("prenom");
    expect(screen.getByLabelText(/ta date de naissance/i).getAttribute("name")).toBe("date_naissance");
    expect(screen.getByLabelText(/ton nom complet de naissance/i).getAttribute("name")).toBe("nom_complet");
  });

  it("borne la saisie sans la rendre absurde (noms composés, particules)", () => {
    render(<FormulaireNaissance />);
    expect(screen.getByLabelText(/ton prénom/i).getAttribute("maxLength")).toBe("100");
    expect(screen.getByLabelText(/ton nom complet de naissance/i).getAttribute("maxLength")).toBe("200");
  });

  it("[FR-023/NFR-008] aucun mot du registre interdit dans les libellés du seuil", () => {
    const { container } = render(<FormulaireNaissance />);
    const texte = container.textContent ?? "";
    expect(texte.length, "rien de rendu — garde vide").toBeGreaterThan(30);
    for (const interdit of [/\bsoin\b/i, /santé mentale/i, /thérapi/i, /diagnostic/i]) {
      expect(texte, `registre interdit dans le seuil : ${interdit}`).not.toMatch(interdit);
    }
  });
});
