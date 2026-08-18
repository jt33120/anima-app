import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 3.4 (T5) — le GATE serveur d'allocation résiduelle dans la route. Non invocable en env node
 * (streaming + egress + Supabase) → gardes de LECTURE DE SOURCE sur l'ORDRE et les COURT-CIRCUITS :
 * le gate vit APRÈS la sécurité (la détresse le lève, AC6) et AVANT la génération/extraction FORT (un
 * tour coupé ne coûte rien), court-circuité si premium (AC5), et pose `postPremiereSeance` au métrage.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const route = sansCommentaires(readFileSync(resolve(racine, "app/api/anam/message/route.ts"), "utf-8"));

describe("Story 3.4 (T5) — le gate d'allocation est ordonné APRÈS la sécurité, AVANT la génération", () => {
  it("le gate décide via la dérivation UNIQUE `doitCouperConversation`", () => {
    expect(route).toMatch(/doitCouperConversation/);
  });

  it("ORDRE : sécurité évaluée → gate d'allocation → extraction FORT / génération", () => {
    // On ancre sur les USAGES (pas les imports en tête de fichier).
    const iSecurite = route.indexOf("securite = await evaluerSecuriteDuTour");
    const iGate = route.indexOf("couper = doitCouperConversation");
    const iExtraction = route.indexOf("requeteExtractionArc(messages)");
    const iGen = route.indexOf("egress = await diffuserSousEgressArt9");
    expect(iSecurite, "sécurité présente").toBeGreaterThan(-1);
    expect(iGate, "usage du gate présent").toBeGreaterThan(-1);
    expect(iGate, "le gate suit la sécurité (la détresse le lève, AC6)").toBeGreaterThan(iSecurite);
    expect(iGate, "le gate précède l'extraction FORT (aucun coût sur un tour coupé)").toBeLessThan(iExtraction);
    expect(iGate, "le gate précède la génération").toBeLessThan(iGen);
  });

  it("la coupure retourne la SEULE trame `quota` AVANT toute génération (aucun delta, aucun fin)", () => {
    const iQuota = route.indexOf('t: "quota"');
    const iGen = route.indexOf("egress = await diffuserSousEgressArt9");
    const iMetrage = route.indexOf("after(async () =>"); // le métrage final
    expect(iQuota, "trame quota émise").toBeGreaterThan(-1);
    expect(iQuota, "la trame quota est renvoyée avant la génération").toBeLessThan(iGen);
    expect(iQuota, "la trame quota précède le métrage (aucune ligne usage_ia sur un tour coupé)").toBeLessThan(iMetrage);
    // Le `return new Response(corpsQuota)` est bien IMBRIQUÉ sous `if (couper)` ET avant l'étage arc
    // (revue 3.4, F12 : une garde de simple PRÉSENCE laisserait passer une relocation du return hors du
    // bloc). On borne sa POSITION entre `if (couper)` et l'entrée de l'étage arc `if (etatArcCharge)`.
    const iIf = route.indexOf("if (couper)");
    const iRet = route.indexOf("return new Response(corpsQuota");
    const iArc = route.indexOf("if (etatArcCharge)");
    expect(iIf, "garde `if (couper)` présente").toBeGreaterThan(-1);
    expect(iRet, "return early corpsQuota présent").toBeGreaterThan(-1);
    expect(iArc, "entrée de l'étage arc présente").toBeGreaterThan(-1);
    expect(iRet, "le return corpsQuota suit `if (couper)` (early-return sous la garde)").toBeGreaterThan(iIf);
    expect(iRet, "le return corpsQuota précède l'étage arc (coupe AVANT toute génération)").toBeLessThan(iArc);
  });
});

describe("Story 3.4 (T5) — les court-circuits (AC5 premium, AC6 détresse) et le repli sûr", () => {
  it("BYPASS détresse : le gate ne s'active pas en détresse (AC6), et passe les DEUX signaux", () => {
    // ⚠️ CETTE GARDE A GRAVÉ LE DÉFAUT (revue adversariale, R8). Elle exigeait littéralement
    // `if (!securite.limitesLevees && seanceClose)` — c'est-à-dire la MOITIÉ de « hors détresse ».
    // Il manquait le niveau effectif, et cette moitié coupait la conversation au tour qui éteint
    // l'épisode : `limites_levees` est déjà faux tandis que le verdict vaut encore 3. C'est la
    // troisième garde de ce dépôt qui rougit sur son propre correctif au lieu de rougir sur le
    // défaut. On mesure donc la RÈGLE : les deux signaux entrent, aucun n'est perdu.
    expect(route, "la dérivation « hors détresse » doit être nommée une fois").toMatch(
      /const horsDetresse = niveauSecurite === 0 && !securite\.limitesLevees;/,
    );
    expect(route, "le gate n'est pas entré en détresse").toMatch(
      /if \(horsDetresse && seanceClose\)/,
    );
    // Et le prédicat du domaine reçoit les DEUX — c'est lui qui décide, pas la condition d'entrée.
    const appel = route.slice(route.indexOf("doitCouperConversation({"));
    expect(appel.slice(0, 300)).toMatch(/limitesLevees:\s*securite\.limitesLevees/);
    expect(appel.slice(0, 300), "le niveau effectif n'atteint pas la dérivation").toMatch(
      /niveauSecurite,/,
    );
  });

  it("BYPASS premium : le comptage n'a lieu QUE si `!premiumConv` (AC5, court-circuit avant lecture DB)", () => {
    expect(route).toMatch(/estPremiumCourante\(\)/);
    expect(route).toMatch(/if\s*\(\s*!premiumConv\s*\)/);
  });

  it("repli sûr : premium par défaut `true` (doute → pas de coupure) et comptage en échec → pas de coupure (FR-058)", () => {
    // `premiumConv` initialisé prudemment ; le comptage dans un try dont le catch NE coupe PAS.
    expect(route).toMatch(/let\s+premiumConv\s*=\s*true/);
    expect(route).toMatch(/couper\s*=\s*false/); // le catch du comptage ne coupe jamais
  });
});

describe("Story 3.4 (T5) — post-séance dérivé de l'état CHARGÉ, métré sur la ligne principale (AC2)", () => {
  it("`seanceClose` dérive de `finProposee` de la trace CHARGÉE (avant avancerArc)", () => {
    expect(route).toMatch(/seanceClose\s*=\s*etatArcCharge\?\.finProposee/);
  });

  it("la trace est chargée UNE SEULE fois (partagée entre le gate et l'étage arc)", () => {
    const occurrences = route.match(/depotSeance\.charger\(\)/g) ?? [];
    expect(occurrences.length, "une seule lecture de trace (pas de double coût)").toBe(1);
  });

  it("le métrage PRINCIPAL porte `postPremiereSeance: tourAllocationResiduelle` (revue F10)", () => {
    // Marqué UNIQUEMENT quand le tour tire réellement sur l'allocation gratuite — jamais `seanceClose`
    // brut (qui compterait aussi les tours premium/détresse → un downgrade recompterait des tours illimités).
    expect(route).toMatch(/metrerUsageIa\(\{[\s\S]{0,140}?postPremiereSeance:\s*tourAllocationResiduelle/);
  });

  it("`tourAllocationResiduelle` n'est vrai QUE dans le bloc `if (!premiumConv)` (non premium, post-séance, hors détresse)", () => {
    // Il démarre à false et n'est armé QUE là où le tour décompte réellement l'allocation → les tours
    // premium (AC5) et de détresse (gate non entré, AC6) le gardent false et ne polluent pas le comptage.
    expect(route).toMatch(/let\s+tourAllocationResiduelle\s*=\s*false/);
    const iBloc = route.indexOf("if (!premiumConv)");
    const iArme = route.indexOf("tourAllocationResiduelle = true");
    const iCouper = route.indexOf("let couper = false");
    expect(iBloc, "bloc non-premium présent").toBeGreaterThan(-1);
    expect(iArme, "armement présent").toBeGreaterThan(-1);
    expect(iArme, "armé APRÈS l'entrée du bloc non-premium").toBeGreaterThan(iBloc);
    expect(iArme, "armé AVANT la décision de coupure (dans le bloc)").toBeLessThan(iCouper);
  });

  it("le comptage EXCLUT la propre ligne du tour logique courant (revue F4/F5 — gate idempotent au retry)", () => {
    expect(route).toMatch(/compterToursResiduelsDuMois\(user\.id,\s*cleIdempotence\)/);
  });
});
