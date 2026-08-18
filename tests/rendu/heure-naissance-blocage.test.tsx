import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * heure-naissance-blocage.test.tsx — LE BOUTON MORT DIT POURQUOI (QA tour 1, T18).
 *
 * La QA a tapé « Zzzzville-sur-Néant » dans le champ commune sans rien choisir dans la liste, coché
 * la confirmation, et cliqué « Enregistrer ». Il ne s'est RIEN passé : le bouton était `disabled`
 * parce que le champ caché `code_lieu` était vide, et pas un mot ne le disait. À l'écran, un
 * formulaire d'apparence rempli et un bouton qui ne répond pas — ça se lit comme une panne du
 * produit, pas comme une saisie à finir.
 *
 * Le patron du correctif existait déjà, posé par l'écran de consentement (1.5, AC3) : le MOTIF du
 * blocage est écrit en toutes lettres, pas seulement l'état désactivé.
 *
 * ⚠️ `jest-dom` N'EST PAS DISPONIBLE dans le projet `rendu`.
 */

vi.mock("@/app/heure-naissance/actions", () => ({
  enregistrerHeureEtLieu: vi.fn(async () => ({ statut: "saisie" })),
}));

const FormulaireHeure = (await import("@/app/heure-naissance/formulaire-heure")).default;

const bouton = () => screen.getByRole("button", { name: /Enregistrer/ }) as HTMLButtonElement;
const communeChamp = () => document.getElementById("recherche_lieu") as HTMLInputElement;

beforeEach(() => {
  // L'autocomplétion interroge le réseau : ici elle ne rend jamais rien, ce qui EST le cas testé —
  // une commune que le référentiel ne reconnaît pas.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
  );
});

describe("[QA T18] la commune non choisie s'explique", () => {
  it("champ vide : on demande la commune, et le bouton est fermé", () => {
    render(<FormulaireHeure deja={{ heure: null, lieu: null }} />);
    expect(bouton().disabled, "rien à écrire tant que le lieu manque").toBe(true);
    expect(screen.getByText(/Indique ta commune de naissance/)).toBeTruthy();
  });

  it("⚠️ quelque chose de TAPÉ mais rien de choisi : le message change", () => {
    // Les deux cas appellent deux gestes différents. Les confondre dirait « saisis ta commune » à
    // quelqu'un qui vient de le faire — c'est-à-dire lui répondre à côté.
    render(<FormulaireHeure deja={{ heure: null, lieu: null }} />);
    fireEvent.change(communeChamp(), { target: { value: "Zzzzville-sur-Néant" } });

    expect(screen.getByText(/je ne reconnais pas encore ce que tu as tapé/)).toBeTruthy();
    expect(screen.queryByText(/Indique ta commune de naissance/)).toBeNull();
    expect(bouton().disabled).toBe(true);
  });

  it("le bouton PORTE son motif — un lecteur d'écran l'entend, pas seulement l'œil", () => {
    // `disabled` seul ne dit rien à personne. `aria-describedby` relie le bouton à sa raison.
    render(<FormulaireHeure deja={{ heure: null, lieu: null }} />);
    const id = bouton().getAttribute("aria-describedby");
    expect(id, "le bouton fermé doit désigner son motif").toBe("motif-blocage-heure");
    expect(document.getElementById(id!)?.textContent).toMatch(/commune/i);
  });

  it("plus rien à écrire : le motif le dit au lieu de laisser un bouton muet", () => {
    render(<FormulaireHeure deja={{ heure: 7.25, lieu: "33063" }} />);
    expect(bouton().disabled).toBe(true);
    expect(screen.getByText(/rien à écrire ici/)).toBeTruthy();
  });
});
