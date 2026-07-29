import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { doitProposerAbonnement } from "@/lib/domain/proposer-abonnement";

/**
 * Story 3.2 (T3) — le GATE SERVEUR de la carte : le vrai verrou d'AC1/AC6 (AD-9). La carte ne se
 * propose QUE sous un bilan réellement émis (elle s'y ancre) ET si non-premium. La détresse est DÉJÀ
 * filtrée en amont (pas de bilan en détresse → pas de carte). Prédicat PUR + garde de LECTURE DE
 * SOURCE de la route (non invocable en env node : streaming + egress + Supabase).
 */

describe("doitProposerAbonnement — prédicat pur (AC1/AC6, AD-9)", () => {
  it("bilan émis + non premium → propose", () => {
    expect(doitProposerAbonnement({ bilanEmis: true, premium: false })).toBe(true);
  });
  it("bilan émis + premium → ne propose PAS (entitlement déjà actif)", () => {
    expect(doitProposerAbonnement({ bilanEmis: true, premium: true })).toBe(false);
  });
  it("PAS de bilan → ne propose JAMAIS (la carte s'ancre sous le bilan ; détresse = pas de bilan)", () => {
    expect(doitProposerAbonnement({ bilanEmis: false, premium: false })).toBe(false);
    expect(doitProposerAbonnement({ bilanEmis: false, premium: true })).toBe(false);
  });
});

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const route = sansCommentaires(readFileSync(resolve(racine, "app/api/anam/message/route.ts"), "utf-8"));

describe("Story 3.2 — la route branche le gate serveur (AC1/AC6)", () => {
  it("la route DÉCIDE via le prédicat pur ET l'état premium PROVIENT de la lecture d'entitlement (source unique 3.1)", () => {
    expect(route).toMatch(/doitProposerAbonnement/);
    // Le `premium` injecté dans la décision est bien CELUI produit par estPremiumCourante (pas une constante
    // ni une autre source) : l'affectation `premium = await estPremiumCourante()` est exigée littéralement.
    expect(route).toMatch(/premium\s*=\s*await\s+estPremiumCourante\(\)/);
  });

  it("la trame `paywall` est émise APRÈS la trame `bilan` (la carte s'ancre SOUS le bilan)", () => {
    const iBilan = route.indexOf('t: "bilan"');
    const iPaywall = route.indexOf('t: "paywall"');
    expect(iBilan, "émission du bilan présente").toBeGreaterThan(-1);
    expect(iPaywall, "émission du paywall présente").toBeGreaterThan(-1);
    expect(iPaywall, "le paywall suit le bilan").toBeGreaterThan(iBilan);
  });

  it("le paywall est COUPLÉ à la VALEUR `bilanEmis: !!structure` ET à `premium` (jamais une carte sans bilan, ni une constante)", () => {
    // On exige les VALEURS liées, pas la seule présence des clés : `bilanEmis: !!structure` (dérivé de la
    // structuration réelle du bilan) et `premium` (la lecture d'entitlement) — un `bilanEmis: true` en dur
    // ou un `premium` détaché échouerait ce test.
    expect(route).toMatch(/doitProposerAbonnement\(\s*\{\s*bilanEmis:\s*!!structure\s*,\s*premium\s*\}/);
  });

  it("la lecture premium est IMBRIQUÉE dans le bloc `if (doitProduireBilan)` (aucun surcoût DB les autres tours)", () => {
    // Portée réelle, pas simple ordre textuel : l'affectation premium suit l'OUVERTURE du bloc dans une
    // fenêtre courte (≤ 220 car.) → elle est bien DANS le bloc gaté, pas ailleurs dans le fichier.
    expect(
      route,
      "la lecture premium doit vivre dans le bloc doitProduireBilan (gate de coût)",
    ).toMatch(/if\s*\(doitProduireBilan\)\s*\{[\s\S]{0,220}?premium\s*=\s*await\s+estPremiumCourante\(\)/);
  });
});
