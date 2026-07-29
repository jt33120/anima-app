import { describe, it, expect } from "vitest";
import { structurerBilan } from "@/lib/domain/bilan";

/**
 * Story 2.9 (T4) — la STRUCTURATION du bilan, cœur PUR (AD-1). Le texte généré (tier fort, consigne
 * document) est transformé SERVEUR en un bloc document `{titre, points}` : le rendu ne parse aucun
 * markdown (il reste muet, AD-7). Fail-safe : rien de structurable → `null` → la route n'émet PAS de
 * bilan (jamais un bloc vide/malformé).
 */

describe("Story 2.9 — structurerBilan : prose générée → bloc document {titre, points}", () => {
  it("titre = 1re ligne, points = lignes suivantes (puces retirées)", () => {
    const texte = "Ce qu'on a vu ce soir\n- tu portes beaucoup\n- tu veux souffler";
    expect(structurerBilan(texte)).toEqual({
      titre: "Ce qu'on a vu ce soir",
      points: ["tu portes beaucoup", "tu veux souffler"],
    });
  });

  it("retire les numéros de liste et le # de titre markdown", () => {
    const texte = "# Bilan\n1. premier point\n2) deuxième";
    expect(structurerBilan(texte)).toEqual({ titre: "Bilan", points: ["premier point", "deuxième"] });
  });

  it("ignore les lignes vides (paragraphes espacés)", () => {
    const texte = "Titre\n\n- un\n\n- deux\n";
    expect(structurerBilan(texte)).toEqual({ titre: "Titre", points: ["un", "deux"] });
  });

  it("FAIL-SAFE : moins de deux lignes utiles → null (la route n'émet pas de bilan)", () => {
    expect(structurerBilan("")).toBeNull();
    expect(structurerBilan("une seule ligne")).toBeNull();
    expect(structurerBilan("\n\n   \n")).toBeNull();
  });

  it("PUR : ne dépend d'aucune I/O — même entrée, même sortie", () => {
    const texte = "Titre\n- a\n- b";
    expect(structurerBilan(texte)).toEqual(structurerBilan(texte));
  });
});
