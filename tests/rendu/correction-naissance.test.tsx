import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CorrectionNaissance, {
  type CopieCorrection,
  type ReponseApercu,
  type ReponseEcriture,
} from "@/render/memoire/CorrectionNaissance";
import * as COPIE from "@/lib/domain/copie-naissance";

/**
 * correction-naissance.test.tsx — L'ÉCRAN DE LA CORRECTION, MONTÉ POUR DE VRAI (Story 6.5b).
 *
 * `correction-naissance-sql.test.ts` prouve que la base ouvre la bonne porte. Ce fichier prouve la
 * chose que la base ne peut pas prouver : **qu'on ne peut pas écrire sans avoir vu.** C'est la seule
 * contrepartie d'une correction non plafonnée — si elle tombe, la story perd sa justification.
 */

const COPIE_VUE: CopieCorrection = {
  titre: COPIE.TITRE_SECTION,
  introduction: COPIE.INTRODUCTION,
  heureAbsente: COPIE.HEURE_ABSENTE,
  lienAjouter: COPIE.LIEN_AJOUTER,
  etiquette: COPIE.ETIQUETTE_NOUVELLE_HEURE,
  aide: COPIE.AIDE_NOUVELLE_HEURE,
  voir: COPIE.ACTION_VOIR,
  confirmer: COPIE.ACTION_CONFIRMER,
  renoncer: COPIE.ACTION_RENONCER,
  corrige: COPIE.CORRIGE,
  dejaCorrigee: null,
  refusRevocation: null,
};

const APERCU: ReponseApercu = {
  statut: "apercu",
  heure: "04:30:00",
  phrases: ["Ton ascendant passe de Verseau à Balance, et tes maisons avec lui."],
};

function monter(sur: Partial<Parameters<typeof CorrectionNaissance>[0]> = {}) {
  const apercevoir = vi.fn<(h: string) => Promise<ReponseApercu>>(async () => APERCU);
  const confirmer = vi.fn<(h: string) => Promise<ReponseEcriture>>(async () => ({ statut: "ok" }));
  render(
    <CorrectionNaissance
      copie={COPIE_VUE}
      heureActuelle="14:30"
      apercevoir={apercevoir}
      confirmer={confirmer}
      {...sur}
    />,
  );
  return { apercevoir, confirmer };
}

afterEach(cleanup);

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b] On ne peut pas écrire sans avoir vu", () => {
  it("[LE CŒUR] au premier montage, AUCUN bouton n'écrit — seulement « voir »", () => {
    monter();
    expect(screen.getByRole("button", { name: COPIE.ACTION_VOIR })).toBeTruthy();
    expect(screen.queryByRole("button", { name: COPIE.ACTION_CONFIRMER })).toBeNull();
  });

  it("[LE CŒUR] l'aperçu s'affiche AVANT toute écriture, et rien n'a été envoyé", async () => {
    const u = userEvent.setup();
    const { apercevoir, confirmer } = monter();
    await u.type(screen.getByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE), "04:30");
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_VOIR }));

    expect(apercevoir).toHaveBeenCalledTimes(1);
    expect(confirmer, "une écriture est partie avant l'aperçu").not.toHaveBeenCalled();
    expect(screen.getByText(APERCU.phrases[0])).toBeTruthy();
  });

  it("[LE CŒUR] modifier le champ APRÈS l'aperçu retire le bouton d'écriture", async () => {
    // ⚠️ Le piège exact que cette étape existe pour fermer : regarder l'aperçu d'une heure, changer
    // le champ, et écrire une heure dont on n'a jamais vu les conséquences. Sans ce comportement,
    // l'aperçu deviendrait un décor.
    const u = userEvent.setup();
    monter();
    const champ = screen.getByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE);
    await u.type(champ, "04:30");
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_VOIR }));
    expect(screen.getByRole("button", { name: COPIE.ACTION_CONFIRMER })).toBeTruthy();

    await u.clear(champ);
    await u.type(champ, "09:15");
    expect(
      screen.queryByRole("button", { name: COPIE.ACTION_CONFIRMER }),
      "on peut encore écrire une heure dont l'aperçu n'a jamais été vu",
    ).toBeNull();
    expect(screen.queryByText(APERCU.phrases[0])).toBeNull();
  });

  it("[LE CŒUR] c'est l'heure DE L'APERÇU qui part, pas celle du champ", async () => {
    const u = userEvent.setup();
    const { confirmer } = monter();
    await u.type(screen.getByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE), "04:30");
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_VOIR }));
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_CONFIRMER }));
    expect(confirmer).toHaveBeenCalledWith(APERCU.heure);
  });

  it("le champ vide n'ouvre rien", () => {
    monter();
    expect((screen.getByRole("button", { name: COPIE.ACTION_VOIR }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("« renoncer » ramène à l'état de départ, sans rien écrire", async () => {
    const u = userEvent.setup();
    const { confirmer } = monter();
    await u.type(screen.getByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE), "04:30");
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_VOIR }));
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_RENONCER }));
    expect(confirmer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: COPIE.ACTION_VOIR })).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b] Les états où il n'y a rien à corriger", () => {
  it("[LE CŒUR] sans heure enregistrée : aucun champ, et un chemin vers l'AJOUT", () => {
    // Une question sans issue est un reproche (leçon de la 4.10). Un champ de correction sur une
    // heure qui n'existe pas écrirait dans le vide, ou pire, prétendrait corriger.
    monter({ heureActuelle: null });
    expect(screen.queryByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE)).toBeNull();
    expect(screen.getByText(COPIE.HEURE_ABSENTE)).toBeTruthy();
    const lien = screen.getByRole("link", { name: COPIE.LIEN_AJOUTER }) as HTMLAnchorElement;
    expect(lien.getAttribute("href")).toBe("/heure-naissance");
  });

  it("[LE CŒUR] après révocation : le refus est ANNONCÉ, et aucun champ n'est proposé", async () => {
    // Même geste que la section voisine (D2 de la 6.5) : laisser composer une correction pour la
    // rejeter à l'envoi serait la faire écrire dans le vide ; masquer sans rien dire ferait croire
    // à une panne.
    monter({
      copie: { ...COPIE_VUE, refusRevocation: COPIE.CORRECTION_APRES_REVOCATION },
    });
    expect(screen.getByText(COPIE.CORRECTION_APRES_REVOCATION)).toBeTruthy();
    expect(screen.queryByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE)).toBeNull();
    expect(screen.queryByRole("button", { name: COPIE.ACTION_VOIR })).toBeNull();
  });

  it("l'heure enregistrée est montrée, et sans ses secondes", () => {
    monter();
    expect(screen.getByText(/14:30/)).toBeTruthy();
    expect(screen.queryByText(/14:30:00/)).toBeNull();
  });

  it("la trace d'une correction passée est une DATE, jamais un nombre", () => {
    const phrase = COPIE.dejaCorrigeeLe(new Date("2026-08-16T10:00:00Z"));
    monter({ copie: { ...COPIE_VUE, dejaCorrigee: phrase } });
    expect(screen.getByText(phrase)).toBeTruthy();
    expect(phrase).toMatch(/16 août 2026/);
    expect(phrase).not.toMatch(/\b\d+\s*fois\b/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b] Les refus remontent, et l'écran ne ment pas sur ce qui s'est passé", () => {
  it("un aperçu refusé affiche le motif et n'ouvre PAS l'écriture", async () => {
    const u = userEvent.setup();
    const apercevoir = vi.fn<(h: string) => Promise<ReponseApercu>>(async () => ({
      statut: "erreur",
      message: COPIE.messageDeRefus("inexistante"),
    }));
    monter({ apercevoir });
    await u.type(screen.getByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE), "04:30");
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_VOIR }));
    expect(screen.getByRole("alert").textContent).toBe(COPIE.messageDeRefus("inexistante"));
    expect(screen.queryByRole("button", { name: COPIE.ACTION_CONFIRMER })).toBeNull();
  });

  it("[LE CŒUR] une écriture refusée n'annonce PAS que c'est corrigé", async () => {
    // La faute la plus coûteuse possible sur cet écran : dire « c'est corrigé » quand la base a
    // refusé. Elle repartirait avec la certitude que son socle a été recalculé.
    const u = userEvent.setup();
    const confirmer = vi.fn<(h: string) => Promise<ReponseEcriture>>(async () => ({
      statut: "erreur",
      message: COPIE.CORRECTION_APRES_REVOCATION,
    }));
    monter({ confirmer });
    await u.type(screen.getByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE), "04:30");
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_VOIR }));
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_CONFIRMER }));
    expect(screen.queryByText(COPIE.CORRIGE)).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(COPIE.CORRECTION_APRES_REVOCATION);
  });

  it("[CONTRÔLE POSITIF] une écriture acceptée annonce le recalcul à venir", async () => {
    const u = userEvent.setup();
    monter();
    await u.type(screen.getByLabelText(COPIE.ETIQUETTE_NOUVELLE_HEURE), "04:30");
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_VOIR }));
    await u.click(screen.getByRole("button", { name: COPIE.ACTION_CONFIRMER }));
    expect(screen.getByText(COPIE.CORRIGE)).toBeTruthy();
  });
});
