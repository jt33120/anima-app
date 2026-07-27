import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AdaptateurMistral } from "@/lib/ai/adapters/mistral";

/**
 * Story 2.1 — l'adaptateur Mistral : boot-guard art. 9 (AC3) + endpoints stateless (AC2).
 *
 * Contrôles POSITIF **et** NÉGATIF (non tautologique, cf. leçon revue 1.9) : avec les 3 flags il
 * se construit ; sans, il refuse (échec dur). Le boot-guard rend la porte ZDR/DPA exécutoire.
 */

const FLAGS = [
  "MISTRAL_ZDR_CONFIRMED",
  "MISTRAL_DPA_SIGNED",
  "MISTRAL_PLAN",
  "MISTRAL_API_KEY",
] as const;

function nettoyer(): void {
  for (const k of FLAGS) delete process.env[k];
}

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("Adaptateur Mistral — boot-guard art. 9 (AC3) + stateless-only (AC2)", () => {
  beforeEach(nettoyer);
  afterEach(nettoyer);

  it("POSITIF : avec ZDR+DPA+scale+clé, il se construit et atteste le ZDR", () => {
    process.env.MISTRAL_ZDR_CONFIRMED = "true";
    process.env.MISTRAL_DPA_SIGNED = "true";
    process.env.MISTRAL_PLAN = "scale";
    process.env.MISTRAL_API_KEY = "cle-de-test";
    const a = new AdaptateurMistral();
    expect(a.estZdrProuve()).toBe(true);
  });

  it("NÉGATIF : sans les flags, il REFUSE de démarrer (échec dur)", () => {
    process.env.MISTRAL_API_KEY = "cle-de-test"; // clé présente, mais ZDR/DPA absents
    expect(() => new AdaptateurMistral()).toThrow(/art\.? ?9|ZDR/i);
  });

  it("NÉGATIF : un seul flag manquant (plan) suffit à refuser", () => {
    process.env.MISTRAL_ZDR_CONFIRMED = "true";
    process.env.MISTRAL_DPA_SIGNED = "true";
    // MISTRAL_PLAN manquant
    process.env.MISTRAL_API_KEY = "cle-de-test";
    expect(() => new AdaptateurMistral()).toThrow();
  });

  it("NÉGATIF : conforme mais SANS clé serveur → refuse aussi", () => {
    process.env.MISTRAL_ZDR_CONFIRMED = "true";
    process.env.MISTRAL_DPA_SIGNED = "true";
    process.env.MISTRAL_PLAN = "scale";
    // MISTRAL_API_KEY manquante
    expect(() => new AdaptateurMistral()).toThrow(/MISTRAL_API_KEY/);
  });

  it("ne lie QUE des endpoints stateless (jamais agents/conversations/batch/…)", () => {
    const src = sansCommentaires(
      readFileSync(resolve(process.cwd(), "lib/ai/adapters/mistral.ts"), "utf-8"),
    );
    expect(src).toMatch(/chat\.(complete|stream)/);
    for (const stateful of ["agents", "conversations", "batch", "fineTuning", "libraries"]) {
      expect(src, `endpoint stateful interdit : ${stateful}`).not.toMatch(
        new RegExp(`\\.${stateful}\\b`),
      );
    }
  });
});
