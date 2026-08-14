import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { CATALOGUE_CARTES } from "@/lib/domain/bibliotheque";

/**
 * ancrage-frontiere.test.ts — LA GARDE D'ACCÈS (Story 5.9, AC3/AC4 · FR-056, FR-031, FR-055).
 *
 * ── POURQUOI CE FICHIER EST LA VRAIE GARDE DE LA STORY ────────────────────────────────────────
 *
 * Il n'y a ni table ni RPC ici, donc pas de policy à écrire : la doctrine « une garde qui ne vit que
 * dans une route ne garde rien » vise le contournement par `authenticated` sur une table `public`,
 * et il n'y a pas de table. La ressource est une CONSTANTE de module.
 *
 * La seule fuite possible est donc l'ENTRÉE DANS LE BUNDLE CLIENT — un `import` depuis un composant
 * `"use client"`, depuis `render/`, ou depuis une route d'API non gardée. C'est ce que ce fichier
 * refuse, mécaniquement, sur toute l'arborescence.
 */

const racine = process.cwd();

function fichiers(dir: string): string[] {
  const abs = resolve(racine, dir);
  if (!existsSync(abs)) return [];
  return (readdirSync(abs, { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => `${dir}/${f}`);
}

const MODULES_SERVEUR = [
  "@/lib/corpus/ancrage",
  "@/lib/data/lire-ancrage",
];

describe("[AC3] les textes d'ancrage ne peuvent pas atteindre le client", () => {
  const tous = [...fichiers("app"), ...fichiers("render"), ...fichiers("lib")];

  it("le balayage trouve bien des fichiers — la garde n'est pas vide", () => {
    expect(tous.length).toBeGreaterThan(50);
    // Et il voit bien le fichier qui a le DROIT d'importer le corpus, sinon on ne prouverait rien.
    expect(tous).toContain("lib/data/lire-ancrage.ts");
  });

  it("aucun fichier `\"use client\"` n'importe le corpus ni la lecture d'ancrages", () => {
    const fautifs: string[] = [];
    for (const f of tous) {
      const src = readFileSync(resolve(racine, f), "utf-8");
      if (!/^\s*["']use client["']/m.test(src)) continue;
      for (const m of MODULES_SERVEUR) if (src.includes(m)) fautifs.push(`${f} → ${m}`);
    }
    expect(fautifs).toEqual([]);
  });

  it("aucun module de `render/` ne les importe, client ou non", () => {
    const fautifs: string[] = [];
    for (const f of fichiers("render")) {
      const src = readFileSync(resolve(racine, f), "utf-8");
      for (const m of MODULES_SERVEUR) if (src.includes(m)) fautifs.push(`${f} → ${m}`);
    }
    expect(fautifs).toEqual([]);
  });

  it("aucune route d'API ne sert le corpus des ancrages", () => {
    const fautifs = fichiers("app")
      .filter((f) => f.startsWith("app/api/"))
      .filter((f) => readFileSync(resolve(racine, f), "utf-8").includes("@/lib/corpus/ancrage"));
    expect(fautifs).toEqual([]);
  });

  it("la lecture d'ancrages porte `server-only` — la compilation casse si un client la touche", () => {
    const src = readFileSync(resolve(racine, "lib/data/lire-ancrage.ts"), "utf-8");
    expect(src).toMatch(/^import "server-only";/m);
  });
});

describe("[AC3] le refus ne construit RIEN", () => {
  beforeEach(() => vi.resetModules());

  it("un compte sans l'offre reçoit `refuse`, et aucun texte n'est assemblé", async () => {
    vi.doMock("@/lib/data/lire-abonnement", () => ({ estPremiumCourante: async () => false }));
    const { lireAncrages } = await import("@/lib/data/lire-ancrage");
    const acces = await lireAncrages();
    expect(acces.statut).toBe("refuse");
    // L'union est ce qui rend ce test possible : avec un tableau vide, « pas l'offre » et « rien
    // d'écrit » seraient indiscernables, ici comme à l'écran.
    expect(JSON.stringify(acces)).not.toContain("temps");
  });

  it("un compte avec l'offre reçoit les quatre ancrages assemblés", async () => {
    vi.doMock("@/lib/data/lire-abonnement", () => ({ estPremiumCourante: async () => true }));
    const { lireAncrages } = await import("@/lib/data/lire-ancrage");
    const acces = await lireAncrages();
    expect(acces.statut).toBe("ouvert");
    if (acces.statut !== "ouvert") return;
    expect(acces.ancrages.length).toBe(4);
    expect(acces.ancrages[0].temps.length).toBe(5);
  });

  it("une PANNE de lecture d'abonnement remonte — elle ne se dégrade jamais en refus", async () => {
    // « Le doute suspend le commerce » (3.1). Un `?? false` ici lirait une panne comme « tu n'as pas
    // l'offre » et retirerait le contenu à une abonnée active.
    vi.doMock("@/lib/data/lire-abonnement", () => ({
      estPremiumCourante: async () => {
        throw new Error("lecture abonnement a échoué (57014).");
      },
    }));
    const { lireAncrages } = await import("@/lib/data/lire-ancrage");
    await expect(lireAncrages()).rejects.toThrow(/abonnement/);
  });

  it("l'assemblage vient APRÈS la décision, dans la source", () => {
    // Le mutant naturel est d'assembler puis de filtrer : ça marche aujourd'hui, et ça laisse les
    // textes construits dans la portée d'un chemin de refus le jour où quelqu'un déplace un `return`.
    const src = readFileSync(resolve(racine, "lib/data/lire-ancrage.ts"), "utf-8");
    const iPremium = src.indexOf("estPremiumCourante(");
    const iRefus = src.indexOf('return { statut: "refuse" }');
    const iAssemble = src.indexOf("map(assemblerAncrage)");
    expect(iPremium).toBeGreaterThan(0);
    expect(iRefus).toBeGreaterThan(iPremium);
    expect(iAssemble).toBeGreaterThan(iRefus);
  });
});

describe("[AC3/AC6] la halte elle-même — ce qu'un rendu de Server Component ne peut pas prouver", () => {
  // Une page `async` de l'App Router ne se monte pas dans jsdom. Ces gardes lisent donc la source —
  // c'est un moindre mal assumé, et elles visent les mutants EXACTS que le reste ne couvre pas.
  const src = readFileSync(resolve(racine, "app/ancrages/page.tsx"), "utf-8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("l'ancrage incomplet est ÉCARTÉ avant le rendu — jamais un exercice à trous à l'écran", () => {
    expect(code).toMatch(/\.filter\(estTraversable\)/);
    // Et c'est bien la liste FILTRÉE qui est rendue, pas `acces.ancrages`.
    expect(code).toMatch(/traversables\.map\(/);
    expect(code).not.toMatch(/acces\.ancrages\.map\(/);
  });

  it("les trois issues restent distinctes : panne ≠ refus d'offre ≠ rien d'écrit", () => {
    expect(code).toContain("INDISPONIBLE");
    expect(code).toContain("REFUS_OFFRE");
    expect(code).toContain("AUCUN_ECRIT");
  });

  it("la garde d'état d'onboarding précède la lecture de l'offre", () => {
    const iEtape = code.indexOf("etapeOnboardingPour");
    const iAcces = code.indexOf("lireAncrages()");
    expect(iEtape).toBeGreaterThan(0);
    expect(iAcces).toBeGreaterThan(iEtape);
    for (const redirection of ["/barriere", "/consentement", "/entrer"]) {
      expect(code).toContain(redirection);
    }
  });

  it("la route n'est ni pré-rendue ni mise en cache", () => {
    expect(code).toMatch(/export const dynamic = "force-dynamic"/);
    expect(code).toMatch(/export const revalidate = 0/);
  });
});

describe("[AC4] le socle gratuit n'est pas dégradé, et rien ne se teaser", () => {
  it("la bibliothèque reste à CINQ cartes — l'ancrage n'y entre pas (D1)", () => {
    expect(CATALOGUE_CARTES.length).toBe(5);
    expect(CATALOGUE_CARTES).not.toContain("ancrage");
  });

  it("le modèle de vue n'a AUCUN champ capable de porter un badge, un compte ou un cadenas", () => {
    const src = readFileSync(resolve(racine, "render/ancrage/types.ts"), "utf-8");
    const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const interdit of ["total", "restant", "verrouille", "premium", "badge", "nouveau", "compte"]) {
      expect(sansCommentaires, `champ interdit « ${interdit} »`).not.toMatch(
        new RegExp(`\\b${interdit}\\b`, "i"),
      );
    }
  });

  it("le composant ne fabrique aucun compteur d'inventaire ni aucun élément audio", () => {
    const src = readFileSync(resolve(racine, "render/ancrage/Ancrage.tsx"), "utf-8");
    const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(sansCommentaires).not.toMatch(/<audio|new Audio|\.play\(/);
    expect(sansCommentaires).not.toMatch(/setTimeout|setInterval/); // aucune minuterie imposée
  });
});
