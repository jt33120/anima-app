import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anneeCouranteParis, lireNumerologie } from "@/lib/data/lire-numerologie";

/**
 * Story 5.2 (T5) — LE CHEMIN DE LECTURE de la numérologie.
 *
 * Deux natures de contrôle, comme `tests/lire-abonnement.test.ts` : des gardes de SOURCE (sous quel
 * client on lit, ce qu'on n'écrit pas) et des tests COMPORTEMENTAUX sur un double qui compte ses
 * appels. Les premières prouvent l'intention, les secondes prouvent l'effet.
 */

const racine = process.cwd();
function sansCommentaires(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SRC = sansCommentaires(readFileSync(resolve(racine, "lib/data/lire-numerologie.ts"), "utf-8"));

/** Double minimal : `from(...).select(...).eq(...).maybeSingle()`, avec un compteur d'écritures. */
function supabaseDouble(reponse: { data: unknown; error: unknown }) {
  const ecritures = { insert: 0, update: 0, upsert: 0, delete: 0, rpc: 0 };
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => reponse }) }),
      insert: () => (ecritures.insert++, { select: () => ({}) }),
      update: () => (ecritures.update++, { eq: async () => ({ error: null }) }),
      upsert: () => (ecritures.upsert++, Promise.resolve({ error: null })),
      delete: () => (ecritures.delete++, { eq: async () => ({ error: null }) }),
    }),
    rpc: async () => (ecritures.rpc++, { data: null, error: null }),
  } as unknown as SupabaseClient;
  return { client, ecritures };
}

const MAINTENANT = new Date("2026-08-07T12:00:00Z");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Gardes de source
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-12] la numérologie se lit sous le JWT de l'utilisatrice", () => {
  it("n'emploie jamais le client admin ni `service_role`", () => {
    expect(SRC, "un client admin contournerait la RLS").not.toMatch(/createSupabaseAdminClient/);
    expect(SRC).not.toMatch(/service_role/);
    expect(SRC).toMatch(/import "server-only"/);
  });

  it("[P6] n'ÉCRIT nulle part — la numérologie ne se stocke pas", () => {
    // Mutation-cible : ajouter un `upsert` « pour le cache ». Le nom est corrigeable (FR-064,
    // migration 0039:69) : un cache produirait un jour un nom corrigé et une numérologie périmée
    // qui a parfaitement l'air juste.
    for (const ecriture of [/\.insert\(/, /\.update\(/, /\.upsert\(/, /\.delete\(/]) {
      expect(SRC, `écriture trouvée : ${ecriture}`).not.toMatch(ecriture);
    }
    // Contrôle du contrôle : on prouve qu'on lit bien la bonne table, sinon « aucune écriture »
    // serait vrai d'un fichier qui ne fait rien du tout.
    expect(SRC).toMatch(/from\("utilisatrice"\)/);
    expect(SRC).toMatch(/date_naissance/);
  });

  it("[P13] ne lit PAS `prenom` — il n'entre dans aucun calcul", () => {
    // Le concaténer au nom complet, qui contient déjà les prénoms, compterait le prénom deux fois
    // et rendrait le nombre d'expression faux sans que rien ne le signale.
    expect(SRC).not.toMatch(/\bprenom\b/);
    expect(SRC).toMatch(/nom_complet/);
  });

  it("[NFR-022] ne fait sortir ni nom, ni date, ni nombre dans une erreur", () => {
    expect(SRC).toMatch(/raison: "lecture_impossible"/);
    expect(SRC).toMatch(/raison: "naissance_absente"/);
    // Aucune interpolation d'une donnée dans un message.
    expect(SRC).not.toMatch(/throw new Error\(`[^`]*\$\{[^}]*(nom|date|naissance)/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Comportement
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T5] le comportement du chemin de lecture", () => {
  it("calcule à partir de la date et du nom complet", async () => {
    const { client, ecritures } = supabaseDouble({
      data: { date_naissance: "1970-11-28", nom_complet: "Marie Dupont" },
      error: null,
    });
    const r = await lireNumerologie(client, "u1", MAINTENANT);
    expect(r.statut).toBe("calcule");
    if (r.statut !== "calcule") throw new Error("inatteignable");
    expect(r.numerologie.nombres.chemin_de_vie).toEqual({
      statut: "calcule",
      valeur: 2,
      maitre: false,
    });
    expect(r.numerologie.nombres.expression.statut).toBe("calcule");
    expect(r.numerologie.anneeDeReference).toBe(2026);
    // La mesure, pas l'intention : AUCUNE écriture n'a eu lieu.
    expect(ecritures).toEqual({ insert: 0, update: 0, upsert: 0, delete: 0, rpc: 0 });
  });

  it("aboutit sans nom complet — les trois nombres de date restent là (FR-048)", async () => {
    const { client } = supabaseDouble({
      data: { date_naissance: "1970-11-28", nom_complet: null },
      error: null,
    });
    const r = await lireNumerologie(client, "u1", MAINTENANT);
    if (r.statut !== "calcule") throw new Error("la numérologie devrait aboutir sans nom");
    expect(r.numerologie.nombres.chemin_de_vie.statut).toBe("calcule");
    expect(r.numerologie.nombres.expression).toEqual({
      statut: "non_calcule",
      raison: "nom_absent",
    });
  });

  it("distingue une PANNE de lecture d'une absence de date de naissance", async () => {
    const panne = supabaseDouble({ data: null, error: { code: "57014" } });
    expect(await lireNumerologie(panne.client, "u1", MAINTENANT)).toEqual({
      statut: "indisponible",
      raison: "lecture_impossible",
    });

    const sansDate = supabaseDouble({ data: { date_naissance: null, nom_complet: null }, error: null });
    expect(await lireNumerologie(sansDate.client, "u1", MAINTENANT)).toEqual({
      statut: "indisponible",
      raison: "naissance_absente",
    });

    const sansLigne = supabaseDouble({ data: null, error: null });
    expect(await lireNumerologie(sansLigne.client, "u1", MAINTENANT)).toEqual({
      statut: "indisponible",
      raison: "naissance_absente",
    });
  });

  it("[AC3] deux lectures au même instant rendent exactement la même chose", async () => {
    const faire = async () => {
      const { client } = supabaseDouble({
        data: { date_naissance: "1970-11-28", nom_complet: "Marie Dupont" },
        error: null,
      });
      return JSON.stringify(await lireNumerologie(client, "u1", MAINTENANT));
    };
    expect(await faire()).toBe(await faire());
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'année de référence — le seul endroit où le temps entre
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[P5] l'année de référence est résolue à Paris, pas en UTC", () => {
  it("[LE CAS QUI SÉPARE] le 1ᵉʳ janvier à 00 h 30 à Paris, UTC est encore en décembre", () => {
    // 2026-12-31T23:30:00Z = 2027-01-01T00:30 à Paris (UTC+1 en hiver).
    // `getUTCFullYear()` rendrait 2026 et l'année personnelle serait celle de l'an passé pendant une
    // heure chaque année, pour tout le monde. Mutation-cible exacte.
    const instant = new Date("2026-12-31T23:30:00Z");
    expect(anneeCouranteParis(instant)).toBe(2027);
    expect(instant.getUTCFullYear()).toBe(2026);
    expect(anneeCouranteParis(instant)).not.toBe(instant.getUTCFullYear());
  });

  it("rend l'année civile parisienne le reste du temps", () => {
    expect(anneeCouranteParis(new Date("2026-08-07T12:00:00Z"))).toBe(2026);
    expect(anneeCouranteParis(new Date("2026-01-01T12:00:00Z"))).toBe(2026);
    // Heure d'été : Paris est à UTC+2, aucune bascule d'année en jeu.
    expect(anneeCouranteParis(new Date("2026-06-30T22:30:00Z"))).toBe(2026);
  });

  it("l'année traverse bien jusqu'au calcul", async () => {
    const { client } = supabaseDouble({
      data: { date_naissance: "1970-11-28", nom_complet: null },
      error: null,
    });
    const r = await lireNumerologie(client, "u1", new Date("2026-12-31T23:30:00Z"));
    if (r.statut !== "calcule") throw new Error("inatteignable");
    expect(r.numerologie.anneeDeReference).toBe(2027);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La frontière : la couche data peut importer le socle, jamais l'inverse
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-1] le sens des dépendances", () => {
  it("cette couche importe le socle — c'est le seul sens sûr", () => {
    expect(SRC).toMatch(/from "@\/lib\/astro\/numerologie"/);
  });

  it("le socle, lui, n'importe jamais la couche data (gardé aussi par astro-architecture)", () => {
    const socle = readFileSync(resolve(racine, "lib/astro/numerologie.ts"), "utf-8");
    expect(sansCommentaires(socle)).not.toMatch(/@\/lib\/data/);
  });

  it("aucun appel de modèle n'existe sur ce chemin", () => {
    expect(SRC).not.toMatch(/@\/lib\/ai/);
    const spy = vi.spyOn(globalThis, "fetch");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
