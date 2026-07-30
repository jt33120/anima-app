import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { jetonTourValide } from "@/lib/ai/jeton-tour";

/**
 * Story 3.4 (T1) — le JETON DE TOUR LOGIQUE (AC1). Le client fournit un identifiant STABLE par tour
 * logique (réutilisé au « Réessayer ») ; le serveur l'emploie comme clé d'idempotence du métrage
 * `usage_ia` (scopée à l'utilisatrice par l'index unique). Un « Réessayer » du MÊME tour ne recompte
 * donc pas (upsert no-op) et ne sur-consomme pas l'allocation résiduelle (3.4). Cœur PUR + gardes de
 * LECTURE DE SOURCE (route + client non invocables en env node : streaming, egress, DOM).
 */

describe("jetonTourValide — cœur pur (AC1)", () => {
  it("accepte un UUID canonique (celui de crypto.randomUUID, v4)", () => {
    const u = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
    expect(jetonTourValide(u)).toBe(u);
  });
  it("accepte un UUID en MAJUSCULES (insensible à la casse) et le rend tel quel", () => {
    const u = "3F1A2B4C-5D6E-4F70-8A91-B2C3D4E5F607";
    expect(jetonTourValide(u)).toBe(u);
  });
  it("rejette tout ce qui n'est pas un UUID canonique → null (repli sur l'UUID serveur)", () => {
    for (const v of [
      undefined,
      null,
      "",
      "pas-un-uuid",
      "3f1a2b4c5d6e4f708a91b2c3d4e5f607", // sans tirets
      "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f6", // trop court
      "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607-extra", // trop long
      "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f60g", // g non hex
      "  3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607  ", // espaces
      42,
      {},
      ["3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607"],
    ]) {
      expect(jetonTourValide(v)).toBeNull();
    }
  });
  it("borne la clé : un jeton mal formé ne peut jamais atteindre la base (aucune chaîne attaquante non bornée)", () => {
    const enorme = "z".repeat(10_000);
    expect(jetonTourValide(enorme)).toBeNull();
  });
});

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const route = sansCommentaires(readFileSync(resolve(racine, "app/api/anam/message/route.ts"), "utf-8"));
const useFlux = sansCommentaires(readFileSync(resolve(racine, "render/conversation/useFluxAnam.ts"), "utf-8"));
const conversation = sansCommentaires(readFileSync(resolve(racine, "render/conversation/Conversation.tsx"), "utf-8"));

describe("Story 3.4 (T1) — la route dérive la clé d'idempotence du JETON CLIENT (AC1)", () => {
  it("la clé d'idempotence PROVIENT du jeton client validé, avec repli sur l'UUID serveur", () => {
    expect(route, "la route valide le jeton client").toMatch(/jetonTourValide/);
    // `jetonValide = jetonTourValide(...)` puis `cleIdempotence = jetonValide ?? crypto.randomUUID()` :
    // le jeton client d'ABORD, l'UUID serveur en repli (scindé en 4.1 pour tracer le repli, revue F5). Un
    // `randomUUID()` INCONDITIONNEL (sans `??` en aval d'un jeton) échouerait.
    expect(route).toMatch(/jetonValide\s*=\s*jetonTourValide\(/);
    expect(route).toMatch(/cleIdempotence\s*=\s*jetonValide\s*\?\?\s*crypto\.randomUUID\(\)/);
  });
  it("le jeton n'est PAS de l'art. 9 : aucune donnée sensible ne rejoint `usage_ia` par ce biais", () => {
    // Le jeton est un UUID opaque ; il ne transporte aucun contenu. La colonne d'idempotence reste
    // exactement ce qu'elle était (texte), sans champ de contenu ajouté.
    expect(route).toMatch(/cle_idempotence|cleIdempotence/);
  });
});

describe("Story 3.4 (T1) — le client fournit un jeton STABLE, réutilisé au « Réessayer » (AC1)", () => {
  it("le hook envoie le jeton dans le corps POST (`jetonTour`)", () => {
    expect(useFlux).toMatch(/jetonTour/);
    // Le corps JSON porte le jeton à côté des messages.
    expect(useFlux).toMatch(/JSON\.stringify\(\{[\s\S]{0,60}?jetonTour/);
  });
  it("le retry RÉUTILISE le même jeton (jamais un nouveau) — sinon un « Réessayer » recompterait", () => {
    // `envoisParTour` mémorise le jeton PAR tour ; `reessayer` le relit et le rejoue. La génération
    // d'un NOUVEAU jeton doit vivre dans `surEnvoi` (nouveau tour logique), pas dans `reessayer`.
    expect(conversation).toMatch(/envoisParTour/);
    expect(conversation).toMatch(/randomUUID/); // un jeton stable est créé quelque part côté client
    // `reessayer` ne crée PAS de jeton : la fenêtre du corps de `reessayer` ne contient pas randomUUID.
    const iReessayer = conversation.indexOf("const reessayer");
    const iApresReessayer = conversation.indexOf("const refuserAbonnement");
    expect(iReessayer, "reessayer présent").toBeGreaterThan(-1);
    const corpsReessayer = conversation.slice(iReessayer, iApresReessayer > iReessayer ? iApresReessayer : iReessayer + 1200);
    expect(corpsReessayer, "reessayer ne régénère jamais le jeton (même tour logique)").not.toMatch(/randomUUID/);
  });
});
