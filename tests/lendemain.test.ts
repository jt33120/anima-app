import { describe, it, expect } from "vitest";
import { estLendemainDEpisode, FENETRE_LENDEMAIN_MS, type EpisodeClos } from "@/lib/safety/lendemain";

/**
 * Story 2.6 (T8) — le prédicat PUR « le lendemain » (FR-045, AC5), COUTURE INERTE. La date est
 * injectée (aucune horloge cachée). Le doute penche vers NE RIEN DIRE : jamais de reprise fabriquée.
 */

const maintenant = new Date("2026-07-28T12:00:00Z");
const ilYA = (ms: number): Date => new Date(maintenant.getTime() - ms);
const H = 60 * 60 * 1000;

describe("estLendemainDEpisode — récence d'un épisode notable (pur)", () => {
  it("épisode ENCORE OUVERT (fin null) → false (on n'est pas « le lendemain »)", () => {
    expect(estLendemainDEpisode({ fin: null, niveauMax: 3 }, maintenant)).toBe(false);
  });

  it("niveau < 2 (détresse marquée sans idéation) → false, même clos récemment", () => {
    expect(estLendemainDEpisode({ fin: ilYA(12 * H), niveauMax: 1 }, maintenant)).toBe(false);
  });

  it("niveau ≥ 2 clos DANS la fenêtre → true", () => {
    expect(estLendemainDEpisode({ fin: ilYA(12 * H), niveauMax: 2 }, maintenant)).toBe(true);
    expect(estLendemainDEpisode({ fin: ilYA(30 * H), niveauMax: 3 }, maintenant)).toBe(true);
  });

  it("clos TROP ANCIEN (au-delà de la fenêtre) → false", () => {
    expect(estLendemainDEpisode({ fin: ilYA(40 * H), niveauMax: 3 }, maintenant)).toBe(false);
  });

  it("fin dans le FUTUR (horloge incohérente) → false (le doute ne dit rien)", () => {
    expect(estLendemainDEpisode({ fin: new Date(maintenant.getTime() + H), niveauMax: 3 }, maintenant)).toBe(false);
  });

  it("bornes : à la fenêtre exacte → true ; juste au-delà → false", () => {
    const pile: EpisodeClos = { fin: ilYA(FENETRE_LENDEMAIN_MS), niveauMax: 2 };
    expect(estLendemainDEpisode(pile, maintenant)).toBe(true);
    const auDela: EpisodeClos = { fin: ilYA(FENETRE_LENDEMAIN_MS + 1), niveauMax: 2 };
    expect(estLendemainDEpisode(auDela, maintenant)).toBe(false);
  });
});
