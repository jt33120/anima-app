import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * entree-code-survit-au-rechargement.test.tsx — LE PIÈGE FERMÉ DU 2026-08-19
 *
 * ⚠️ CE QUI A ÉTÉ MESURÉ, sur le téléphone de Julian, en production.
 *
 * L'écran « tape ton code » ne vivait que dans la mémoire de React (`useActionState`). Or le geste
 * NORMAL sur un téléphone est : demander le code, basculer sur l'application de courrier pour le
 * lire, revenir. iOS recharge alors très souvent l'onglet — et la page repartait au formulaire
 * d'adresse. Le code reçu, valide une heure, n'avait plus AUCUN endroit où être tapé. Redemander
 * un code n'y changeait rien : le second courriel ramenait au même écran perdu.
 *
 * ── POURQUOI ON MONTE LA PAGE, ET PAS LE FORMULAIRE ────────────────────────────────────────────
 *
 * Le formulaire n'a jamais eu tort : il affichait bien l'écran de code quand on le lui demandait.
 * Ce qui manquait était le CÂBLAGE — la page ne relisait pas le cookie. Une garde montée sur le
 * seul formulaire, à qui on passerait la propriété à la main, serait verte alors même que la page
 * ne la passe pas. Elle ne prouverait rien de la panne. On exécute donc la page.
 */

const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Map(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/data/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/data/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/lib/safety/appliquer-barriere", () => ({ appliquerBarriereMinorite: vi.fn() }));
vi.mock("@/app/(auth)/destination-apres-auth", () => ({ destinationApresAuth: vi.fn() }));

const { default: PageEntrer } = await import("@/app/(auth)/entrer/page");

const COOKIE = "anam_entree_attente";

/** Le rechargement d'onglet : la page est rendue à neuf, le cookie est ce qui a survécu. */
async function rendreLaPage(): Promise<void> {
  render(await PageEntrer({ searchParams: Promise.resolve({}) }));
}

beforeEach(() => {
  cookieGet.mockReset();
  cookieGet.mockReturnValue(undefined);
});

describe("[entrée] le code reste tapable après un rechargement d'onglet", () => {
  it("[LE CŒUR] une attente en cours ramène l'écran de code, pas le formulaire d'adresse", async () => {
    cookieGet.mockImplementation((nom: string) =>
      nom === COOKIE ? { value: JSON.stringify({ adresse: "toi@exemple.fr", essais: 0 }) } : undefined,
    );

    await rendreLaPage();

    expect(screen.queryByLabelText(/code reçu/i), "l'écran de code a disparu au rechargement").toBeTruthy();
    expect(
      screen.queryByLabelText(/adresse e-mail/i),
      "la page est repartie demander une adresse, avec un code déjà en main",
    ).toBeNull();
  });

  it("l'adresse visée est affichée — on doit pouvoir voir AVANT de taper que ce n'est pas la sienne", async () => {
    cookieGet.mockImplementation((nom: string) =>
      nom === COOKIE ? { value: JSON.stringify({ adresse: "toi@exemple.fr", essais: 2 }) } : undefined,
    );

    await rendreLaPage();

    expect(document.body.textContent).toContain("toi@exemple.fr");
  });

  it("[SORTIR N'EST JAMAIS GARDÉ] l'écran de code offre toujours de repartir d'une autre adresse", async () => {
    // Sans cette porte, une adresse tapée de travers enferme une heure sur un écran qui réclame
    // un code qui n'arrivera jamais : un piège échangé contre un autre.
    cookieGet.mockImplementation((nom: string) =>
      nom === COOKIE ? { value: JSON.stringify({ adresse: "faute-de-frappe@exemple.fr", essais: 0 }) } : undefined,
    );

    await rendreLaPage();

    expect(screen.queryByRole("button", { name: /recommencer/i })).toBeTruthy();
  });

  it("sans attente, la page demande une adresse — et n'invente pas un écran de code", async () => {
    await rendreLaPage();

    expect(screen.queryByLabelText(/adresse e-mail/i)).toBeTruthy();
    expect(screen.queryByLabelText(/code reçu/i)).toBeNull();
  });

  it("un cookie illisible ne bloque pas la porte : on redemande une adresse", async () => {
    // AD-15 — le repli penche du côté qui protège : on ne peut pas vérifier un code sans adresse
    // sûre, donc on repart du début plutôt que d'afficher un écran de code sans cible.
    cookieGet.mockImplementation((nom: string) =>
      nom === COOKIE ? { value: "{ceci n'est pas du JSON" } : undefined,
    );

    await rendreLaPage();

    expect(screen.queryByLabelText(/adresse e-mail/i)).toBeTruthy();
  });

  it("l'écran ne se contredit pas : plus d'invitation à laisser une adresse une fois le code parti", async () => {
    cookieGet.mockImplementation((nom: string) =>
      nom === COOKIE ? { value: JSON.stringify({ adresse: "toi@exemple.fr", essais: 0 }) } : undefined,
    );

    await rendreLaPage();

    expect(document.body.textContent).not.toContain("Laisse-moi ton adresse");
  });
});
