import { describe, it, expect } from "vitest";
import { ligneRetourPaiement, type ResultatPaiement } from "@/lib/domain/retour-paiement";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";

/**
 * Story 3.1 (T5) — la ligne système de retour de paiement (AC5). Cœur PUR : sobre, registre produit
 * (jamais la voix d'Anam), et propre au contrôle lexique (texte utilisateur réel — pas une consigne
 * exclue du scan).
 */

const RESULTATS: ResultatPaiement[] = ["succes", "echec", "annule"];

describe("ligneRetourPaiement — ligne sobre, registre produit, jamais signée Anam (AC5)", () => {
  it("chaque résultat rend une ligne non vide", () => {
    for (const r of RESULTATS) expect(ligneRetourPaiement(r).length).toBeGreaterThan(0);
  });

  it("aucune dramatisation ni voix d'Anam (pas de « ! », pas de 1re personne)", () => {
    for (const r of RESULTATS) {
      const l = ligneRetourPaiement(r);
      expect(l, `dramatisation dans « ${l} »`).not.toContain("!");
      expect(l, `voix d'Anam (1re personne) dans « ${l} »`).not.toMatch(/\bje\b/i);
    }
  });

  it("le texte passe le contrôle lexique (aucun terme médical / banni)", () => {
    for (const r of RESULTATS) {
      expect(chercherInterdits(ligneRetourPaiement(r)), `lexique interdit dans « ${ligneRetourPaiement(r)} »`).toEqual([]);
    }
  });
});
