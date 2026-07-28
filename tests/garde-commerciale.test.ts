import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.5 (T4) — la GARDE DE MONTAGE `<GardeCommerciale>` (AC4, AD-9). Une RSC async = une
 * fonction async : on l'appelle directement et on vérifie qu'elle rend `null` quand les limites
 * sont levées (le commerce « refuse de se monter »), ses enfants sinon. On prouve aussi les
 * invariants d'architecture : la DÉCISION vit dans `lib/safety` (render muet, AD-7), le prédicat
 * n'a aucun consommateur sauvage, et toute future UI commerciale devra passer par la garde.
 */

const limites = vi.fn();
vi.mock("@/lib/safety/limites-commerciales", () => ({
  limitesCommercialesLevees: (id: string) => limites(id),
}));

import { GardeCommerciale } from "@/app/_commerce/GardeCommerciale";

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function fichiersSource(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => resolve(racine, dir, f));
}

beforeEach(() => limites.mockReset());

describe("GardeCommerciale — refuse de monter le commerce quand limites levées (AC4, FR-043)", () => {
  it("limites LEVÉES → rend null (paywall/quota/carte/bilan ne se montent pas)", async () => {
    limites.mockResolvedValueOnce(true);
    const out = await GardeCommerciale({ utilisatriceId: "u1", children: "COMMERCE" });
    expect(out).toBeNull();
    expect(limites).toHaveBeenCalledWith("u1");
  });

  it("limites NON levées → monte ses enfants", async () => {
    limites.mockResolvedValueOnce(false);
    const out = await GardeCommerciale({ utilisatriceId: "u1", children: "COMMERCE" });
    expect(out).not.toBeNull();
    expect(out?.props?.children).toBe("COMMERCE");
  });
});

describe("GardeCommerciale — invariants d'architecture (AD-7, AD-9)", () => {
  const guard = resolve(racine, "app/_commerce/GardeCommerciale.tsx");
  const guardSrc = sansCommentaires(readFileSync(guard, "utf-8"));

  it("la DÉCISION vit dans lib/safety : la garde consomme le prédicat, ne dérive rien (render muet)", () => {
    expect(guardSrc).toMatch(/limitesCommercialesLevees/);
    expect(guardSrc).toMatch(/@\/lib\/safety\/limites-commerciales/);
    // render/ ne parle jamais à la base ni ne dérive `fin IS NULL` lui-même.
    expect(guardSrc).not.toMatch(/@\/lib\/data\/supabase|episode_detresse|fin IS NULL/);
  });

  it("le prédicat n'est appelé QUE par la garde (aucun consommateur sauvage)", () => {
    const DEF = resolve(racine, "lib/safety/limites-commerciales.ts");
    const tous = [...fichiersSource("app"), ...fichiersSource("render"), ...fichiersSource("lib")];
    for (const f of tous) {
      if (f === guard || f === DEF) continue;
      expect(
        sansCommentaires(readFileSync(f, "utf-8")),
        `appel sauvage du prédicat : ${f}`,
      ).not.toMatch(/limitesCommercialesLevees/);
    }
  });

  it("garde PROSPECTIVE : toute UI commerciale passe par la garde (armée pour 2.9/Epic 3)", () => {
    const MARQUEURS = /(paywall|abonnement|quota|bilan|checkout|premium)/i;
    // Le marqueur commercial vit dans le DOSSIER (App Router : la route est toujours `page.tsx`/
    // `route.ts`) → on matche le CHEMIN COMPLET, jamais le seul basename (sinon aveugle aux routes).
    const estCommerciale = (f: string) => MARQUEURS.test(f);
    // Preuve non-tautologique que le matcher attrape bien une route nommée par son dossier :
    expect(estCommerciale("app/(scene)/abonnement/page.tsx"), "route commerciale par dossier ratée").toBe(true);
    expect(estCommerciale("app/bilan/page.tsx")).toBe(true);
    expect(estCommerciale("app/aide/page.tsx"), "faux positif sur une route non commerciale").toBe(false);

    const uiCommerciales = [...fichiersSource("app"), ...fichiersSource("render")].filter(estCommerciale);
    for (const f of uiCommerciales) {
      // Exige la BALISE `<GardeCommerciale`, pas une simple mention d'import (tripwire, pas preuve
      // formelle : un placement en frère reste possible — l'enveloppement réel relève de la revue).
      expect(
        sansCommentaires(readFileSync(f, "utf-8")),
        `UI commerciale montée sans <GardeCommerciale> : ${f}`,
      ).toMatch(/<GardeCommerciale/);
    }
    // Aujourd'hui : aucune UI commerciale (Epic 3 / 2.9). La garde est ARMÉE, pas tautologique.
    console.info(
      `[garde-commerciale] ${uiCommerciales.length} UI commerciale(s) détectée(s) — garde en attente de consommateur.`,
    );
  });
});
