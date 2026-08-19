import { describe, it, expect } from "vitest";
import { phraseProposition, nomValide } from "@/lib/domain/branche";
import { REPONSE_REFUS, INVITE_NOMMAGE, SOUS_TITRE_NOMMAGE } from "@/render/conversation/copie-proposition";

/**
 * Story 4.5 (T2) — le domaine PUR de la naissance de branche (aucune base, aucun modèle, aucun DOM).
 *  - `phraseProposition` : proposition déterministe, adaptée au délai en jours civils Paris (hier / l'autre jour) ;
 *  - `nomValide` : miroir applicatif du garde-fou AC2 (le doute — chaîne d'espaces — n'est pas un nom) ;
 *  - libellés de voix (charte §6.3, chrome de rendu) : « Ok. » exact (aucun « ! »), « Tes mots, pas les miens. ».
 */

describe("phraseProposition — proposition déterministe, jamais un décret (AC1)", () => {
  it("un signal de la veille → « hier » (jamais « hier soir » : on n’affirme pas l’heure, revue #5) + question fermée-douce", () => {
    const maintenant = new Date("2026-03-15T10:00:00+01:00");
    const signalCreeLe = new Date("2026-03-14T08:00:00+01:00"); // la veille, le MATIN → « hier soir » mentirait
    const p = phraseProposition({ signalCreeLe, maintenant });
    expect(p).toContain("hier");
    expect(p).not.toContain("hier soir");
    expect(p).toContain("Tu veux en faire une branche ?");
  });

  it("un signal plus ancien → « l’autre jour » (le délai peut dépasser un jour si elle n’est pas revenue)", () => {
    const maintenant = new Date("2026-03-15T10:00:00+01:00");
    const signalCreeLe = new Date("2026-03-12T22:00:00+01:00"); // 3 jours civils avant
    const p = phraseProposition({ signalCreeLe, maintenant });
    expect(p).toContain("l’autre jour");
    expect(p).not.toContain("hier");
    expect(p).toContain("Tu veux en faire une branche ?");
  });

  it("ne décrète rien, ne félicite pas : aucune « prise de conscience », aucun « bravo », aucun « ! »", () => {
    const p = phraseProposition({
      signalCreeLe: new Date("2026-03-14T22:00:00+01:00"),
      maintenant: new Date("2026-03-15T10:00:00+01:00"),
    });
    const bas = p.toLowerCase();
    expect(bas).not.toContain("prise de conscience");
    expect(bas).not.toContain("bravo");
    expect(bas).not.toContain("félicit");
    expect(p).not.toContain("!");
  });
});

describe("nomValide — le doute n’est pas un nom (AC2 [DUR], miroir du garde-fou serveur)", () => {
  it("vide / espaces → invalide (une branche sans nom n’existe pas)", () => {
    expect(nomValide("")).toBe(false);
    expect(nomValide("   ")).toBe(false);
    expect(nomValide("\t\n")).toBe(false);
  });
  it("un nom donné par elle → valide (trim des bords)", () => {
    expect(nomValide("arrêter de payer la mauvaise facture")).toBe(true);
    expect(nomValide("  mes mots  ")).toBe(true);
  });
});

describe("constantes de voix (charte §6.3)", () => {
  it("le refus est « Ok. » exactement — rien d’autre, aucun point d’exclamation (AC4)", () => {
    expect(REPONSE_REFUS).toBe("Ok.");
  });
  it("le nommage invite avec ses mots, sans suggérer (AC2)", () => {
    expect(INVITE_NOMMAGE).toBe("Comment tu l’appelles ?");
    expect(SOUS_TITRE_NOMMAGE).toBe("Tes mots, pas les miens.");
  });
});
