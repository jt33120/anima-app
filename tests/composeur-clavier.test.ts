import { describe, it, expect } from "vitest";
import { decisionEntree, estAncreEnBas } from "@/render/conversation/composeur-clavier";

/**
 * Story 2.2 (B3/B4) — la logique de décision du composeur et de l'ancrage bas, extraite en pur
 * pour être testée sans DOM (env node). L'« Entrée contextuelle » (UX-DR-21, AC7) et le suivi du
 * bas NON CAPTIF (AC3) sont des règles d'interaction ; le composant ne fait que les appliquer.
 */

describe("decisionEntree — Entrée contextuelle sm/md (AC7, UX-DR-21)", () => {
  it("en sm : Entrée insère une ligne (on n'envoie JAMAIS une confidence par accident)", () => {
    expect(decisionEntree("sm", { key: "Enter", shiftKey: false })).toBe("nouvelle-ligne");
    expect(decisionEntree("sm", { key: "Enter", shiftKey: true })).toBe("nouvelle-ligne");
  });

  it("en md : Entrée envoie, Maj+Entrée insère une ligne", () => {
    expect(decisionEntree("md", { key: "Enter", shiftKey: false })).toBe("envoyer");
    expect(decisionEntree("md", { key: "Enter", shiftKey: true })).toBe("nouvelle-ligne");
  });

  it("ne fait rien sur une autre touche", () => {
    expect(decisionEntree("md", { key: "a", shiftKey: false })).toBe("ignorer");
  });

  it("pendant une composition IME (jp/zh), Entrée valide le candidat — JAMAIS envoyer", () => {
    expect(decisionEntree("md", { key: "Enter", shiftKey: false, isComposing: true })).toBe(
      "nouvelle-ligne",
    );
  });
});

describe("estAncreEnBas — suivi du bas non captif (AC3)", () => {
  it("vrai quand le bas est visible (à la marge près)", () => {
    expect(estAncreEnBas({ scrollTop: 900, scrollHeight: 1000, clientHeight: 100 })).toBe(true);
  });

  it("faux dès que l'utilisatrice a remonté au-delà de la marge (on cesse de suivre)", () => {
    expect(estAncreEnBas({ scrollTop: 200, scrollHeight: 1000, clientHeight: 100 })).toBe(false);
  });

  it("marge configurable (tolérance de quelques pixels)", () => {
    // 1000 - (940 + 100) = -40 → dans la marge par défaut (48)
    expect(estAncreEnBas({ scrollTop: 940, scrollHeight: 1000, clientHeight: 100 })).toBe(true);
    // marge stricte 10 → 60px d'écart = plus ancré
    expect(estAncreEnBas({ scrollTop: 840, scrollHeight: 1000, clientHeight: 100 }, 10)).toBe(false);
  });
});
