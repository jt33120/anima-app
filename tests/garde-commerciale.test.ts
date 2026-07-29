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

  it("le prédicat n'est appelé QUE par la garde ou une route commerciale autorisée (aucun consommateur sauvage)", () => {
    const DEF = resolve(racine, "lib/safety/limites-commerciales.ts");
    // Consommateurs AUTORISÉS : la garde de montage (render) + toute ROUTE commerciale app/api/** qui
    // applique la même garde AD-9 côté serveur (raffinement Story 3.1 — ex. checkout). Tout autre appel
    // serait une 2ᵉ dérivation sauvage de limites_levees (interdit : source unique, AD-17).
    const MARQUEURS = /(paywall|abonnement|quota|bilan|checkout|premium)/i;
    const estRouteCommercialeAutorisee = (f: string) => /[/\\]app[/\\]api[/\\]/.test(f) && MARQUEURS.test(f);
    const tous = [...fichiersSource("app"), ...fichiersSource("render"), ...fichiersSource("lib")];
    for (const f of tous) {
      if (f === guard || f === DEF || estRouteCommercialeAutorisee(f)) continue;
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

    // Une ROUTE handler (app/api/**) n'est PAS de l'UI React : elle ne peut pas être enveloppée d'une
    // balise `<GardeCommerciale>`. Elle applique la garde AD-9 CÔTÉ SERVEUR (limitesCommercialesLevees).
    // On sépare donc les deux surfaces (raffinement Story 3.1 : `checkout/route.ts` matche `checkout`).
    // `fichiersSource` renvoie des chemins ABSOLUS → `app` y est toujours précédé d'un séparateur.
    const estRoute = (f: string) => /[/\\]app[/\\]api[/\\]/.test(f);
    expect(estRoute("/repo/app/api/stripe/checkout/route.ts"), "matcher de route API cassé").toBe(true);
    expect(estRoute("/repo/app/(scene)/abonnement/page.tsx"), "une page n'est pas une route API").toBe(false);

    const uiCommerciales = [...fichiersSource("app"), ...fichiersSource("render")]
      .filter(estCommerciale)
      .filter((f) => !estRoute(f));
    for (const f of uiCommerciales) {
      // Exige la BALISE `<GardeCommerciale`, pas une simple mention d'import (tripwire, pas preuve
      // formelle : un placement en frère reste possible — l'enveloppement réel relève de la revue).
      expect(
        sansCommentaires(readFileSync(f, "utf-8")),
        `UI commerciale montée sans <GardeCommerciale> : ${f}`,
      ).toMatch(/<GardeCommerciale/);
    }

    // Les ROUTES commerciales (app/api/**) appliquent la garde côté serveur, pas via la balise.
    const routesCommerciales = fichiersSource("app").filter(estCommerciale).filter(estRoute);
    for (const f of routesCommerciales) {
      expect(
        sansCommentaires(readFileSync(f, "utf-8")),
        `route commerciale sans garde serveur limites_levees : ${f}`,
      ).toMatch(/limitesCommercialesLevees/);
    }
    // Non-vacuité : depuis 3.1, la route Checkout EXISTE et doit être gardée (sinon la garde ne prouve rien).
    expect(routesCommerciales.length, "aucune route commerciale détectée — la garde serveur est vide").toBeGreaterThan(0);

    console.info(
      `[garde-commerciale] ${uiCommerciales.length} UI + ${routesCommerciales.length} route(s) commerciale(s) gardée(s).`,
    );
  });
});

describe("Story 2.9 — point de montage gardé du paywall (placement, PAS la carte)", () => {
  const MONTAGE = resolve(racine, "app/_commerce/MontagePaywall.tsx");
  const src = sansCommentaires(readFileSync(MONTAGE, "utf-8"));

  it("le point de montage EXISTE et enveloppe son contenu dans <GardeCommerciale utilisatriceId> (AD-9)", () => {
    expect(src).toMatch(/<GardeCommerciale\s+utilisatriceId=/);
  });

  it("2.9 pose le PLACEMENT, jamais la carte : aucun prix / Stripe / bouton d'abonnement (= Epic 3)", () => {
    // Périmètre dur : la carte (prix 69 €, « M'abonner », Stripe Checkout, garantie) relève de la 3.2.
    expect(src, "le tarif est Epic 3").not.toMatch(/69|abonner|stripe|checkout|€/i);
  });

  it("le montage vit dans app/ (composition), jamais dans render/ (muet) — server-only", () => {
    expect(src).toMatch(/server-only/);
  });
});
