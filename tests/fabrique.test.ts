import { describe, it, expect, afterEach } from "vitest";
import { creerAiPort } from "@/lib/ai/fabrique";
import { AdaptateurFactice } from "@/lib/ai/adapters/factice";

/**
 * Story 2.1 (revue) — le repli factice est INTERDIT en production (AD-4 : échec dur, jamais de
 * dégradation silencieuse). Contrôles positif (dev/preview → factice) ET négatif (prod → refuse).
 */
describe("creerAiPort — repli factice interdit en production (revue 2.1, AD-4)", () => {
  afterEach(() => {
    delete process.env.AI_ADAPTER;
    delete process.env.VERCEL_ENV;
  });

  it("dev (pas de VERCEL_ENV) → adaptateur factice", async () => {
    delete process.env.AI_ADAPTER;
    delete process.env.VERCEL_ENV;
    expect(await creerAiPort()).toBeInstanceOf(AdaptateurFactice);
  });

  it("Vercel PREVIEW → factice autorisé (données synthétiques, pas de vraies art. 9)", async () => {
    process.env.VERCEL_ENV = "preview";
    delete process.env.AI_ADAPTER;
    expect(await creerAiPort()).toBeInstanceOf(AdaptateurFactice);
  });

  it("Vercel PRODUCTION sans AI_ADAPTER=mistral → REFUSE (pas de stub silencieux)", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.AI_ADAPTER;
    await expect(creerAiPort()).rejects.toThrow(/production|AI_ADAPTER/i);
  });

  it("Vercel PRODUCTION avec AI_ADAPTER mal orthographié (typo) → REFUSE aussi", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.AI_ADAPTER = "Mistral"; // ≠ "mistral" → non-match
    await expect(creerAiPort()).rejects.toThrow();
  });
});
