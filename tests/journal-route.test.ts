import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.1 (T5) — le hook du JOURNAL BRUT dans la route. Non invocable en env node (streaming +
 * egress + Supabase) → gardes de LECTURE DE SOURCE sur l'ORDRE et le contrat : le verbatim est gravé
 * APRÈS la garde sécurité (`securite.bloque` — un tour mineur/ZDR/consentement révoqué n'est jamais
 * journalisé), AVANT le gate d'allocation (3.4) et AVANT la génération (capture indépendante du
 * traitement, NFR-017), idempotent par le jeton de tour, 500 sur échec (aucune perte silencieuse).
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const route = sansCommentaires(readFileSync(resolve(racine, "app/api/anam/message/route.ts"), "utf-8"));

describe("Story 4.1 (T5) — le journal est gravé au bon endroit, avec le bon contrat", () => {
  it("appelle le dépôt journal, awaité, avec le jeton de tour et le rôle utilisatrice", () => {
    expect(route).toMatch(/await creerDepotJournal\(user\.id\)\.consigner\(/);
    expect(route).toMatch(/cleTour:\s*cleIdempotence/); // idempotence = même clé que le métrage (3.4)
    expect(route).toMatch(/role:\s*"utilisatrice"/);
  });

  it("ne grave que le DERNIER message et seulement s'il est de l'utilisatrice", () => {
    expect(route).toMatch(/messages\[messages\.length - 1\]/);
    // Ancré au garde du bloc journal (`dernierMessage?.`), pas à l'occurrence arc `m.role === "user"` (revue 4.1, F3).
    expect(route).toMatch(/if \(dernierMessage\?\.role === "user"\)/);
  });

  it("ORDRE : garde sécurité (bloque) → journal → gate d'allocation → génération", () => {
    const iBloque = route.indexOf("if (securite.bloque)");
    const iJournal = route.indexOf("creerDepotJournal(user.id).consigner");
    const iGate = route.indexOf("couper = doitCouperConversation");
    const iGen = route.indexOf("egress = await diffuserSousEgressArt9");
    expect(iBloque, "garde sécurité présente").toBeGreaterThan(-1);
    expect(iJournal, "hook journal présent").toBeGreaterThan(-1);
    expect(iJournal, "journal APRÈS la garde bloque (un tour bloqué n'est jamais gravé)").toBeGreaterThan(iBloque);
    // Revue 4.1 (F1, mirror 3.4/F12) : borner APRÈS le return 403 DU bloc bloqué — sinon une relocation
    // du hook DANS `if (securite.bloque){...}` graverait un tour mineur/ZDR avant le 403, test toujours vert.
    const iRetourSecurite = route.indexOf("egress_bloque_${securite.raison}");
    expect(iRetourSecurite, "return 403 du bloc securite.bloque présent").toBeGreaterThan(iBloque);
    expect(iJournal, "journal APRÈS le 403 du bloc bloqué (jamais gravé DANS le if)").toBeGreaterThan(iRetourSecurite);
    expect(iJournal, "journal AVANT le gate d'allocation (un tour coupé garde quand même le verbatim)").toBeLessThan(iGate);
    expect(iJournal, "journal AVANT la génération (capture indépendante du traitement, NFR-017)").toBeLessThan(iGen);
  });

  it("AD-16/AC4 — la détresse n'annule PAS le journal : verbatim gravé AVANT la dérivation du niveau", () => {
    const iBloque = route.indexOf("if (securite.bloque)");
    const iJournal = route.indexOf("creerDepotJournal(user.id).consigner");
    const iNiveau = route.indexOf("niveauSecurite: NiveauSecurite = securite.verdict.niveau");
    expect(iNiveau, "niveauSecurite dérivé").toBeGreaterThan(-1);
    // Le verbatim est gravé AVANT même que le niveau de détresse existe → structurellement non-gatable dessus.
    expect(iJournal, "journal AVANT la dérivation du niveau (AD-16)").toBeLessThan(iNiveau);
    // Entre la garde egress (bloque) et le journal : AUCUNE référence à la détresse → un futur early-return
    // détresse (ex. `if (securite.verdict.niveau >= 1) return`) inséré là ferait échouer ce test (revue 4.1, F6).
    expect(route.slice(iBloque, iJournal)).not.toMatch(/niveauSecurite|verdict\.niveau|detresse|limitesLevees/i);
  });

  it("échec d'écriture → 500 (aucune perte silencieuse ; le client garde + réessaie)", () => {
    const iCatch = route.indexOf("journal brut illisible");
    const iGate = route.indexOf("couper = doitCouperConversation");
    expect(iCatch, "catch du hook journal présent").toBeGreaterThan(-1);
    expect(iCatch, "le catch précède le gate d'allocation").toBeLessThan(iGate);
    expect(route.slice(iCatch, iCatch + 400)).toMatch(/status:\s*500/);
  });
});
