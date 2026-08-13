import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { estBaseLocale, refusDeCible, AUTORISATION_DISTANTE } from "./_environnement";

/**
 * environnement-cible.test.ts — LA SUITE NE TOURNE PAS CONTRE LA BASE DE LANCEMENT (2026-08-13).
 *
 * Cette garde est née d'un dégât réel, pas d'une précaution. `.env.local` pointe sur le projet de
 * lancement depuis le 2026-08-12 ; la commande écrite dans tous les dossiers de story le source
 * avant vitest ; et `_environnement.ts` respecte scrupuleusement ce qui vient de l'environnement.
 * Résultat mesuré : 93 comptes de fixtures dans la vraie base, et 31 fichiers de tests qui
 * échouaient en accusant des privilèges de table.
 *
 * L'avertissement existait DÉJÀ, en toutes lettres, dans l'en-tête de `_environnement.ts`. Il n'a
 * arrêté personne — c'est précisément la démonstration que ce dépôt refait à chaque revue : une
 * garde qui vit dans un commentaire n'existe pas.
 */

describe("[garde d'environnement] estBaseLocale reconnaît la pile locale, et rien d'autre", () => {
  it("[CONTRÔLE DU CONTRÔLE] les formes locales sont bien acceptées", () => {
    // Sans ce test, une garde trop stricte ferait échouer la suite en permanence et on la
    // désactiverait — la façon habituelle dont les gardes meurent.
    for (const u of [
      "http://127.0.0.1:54321",
      "http://localhost:54321",
      "http://localhost:3000",
      "https://127.0.0.1:54321",
    ]) {
      expect(estBaseLocale(u), u).toBe(true);
    }
  });

  it("[LE CŒUR] une URL de projet hébergé est refusée", () => {
    for (const u of [
      "https://zlhlzoalmszohrxrnsmo.supabase.co",
      "https://exemple.supabase.co",
      "https://db.exemple.fr",
    ]) {
      expect(estBaseLocale(u), u).toBe(false);
    }
  });

  it("une URL inanalysable est refusée — on ne suppose jamais dans le bon sens", () => {
    expect(estBaseLocale("pas une url")).toBe(false);
    expect(estBaseLocale("127.0.0.1:54321")).toBe(false); // sans schéma : inanalysable
  });

  it("une absence de cible n'est pas un refus — les tests purs n'interrogent aucune base", () => {
    expect(estBaseLocale(undefined)).toBe(true);
  });

  it("un hôte qui CONTIENT « localhost » sans l'être ne passe pas", () => {
    // Le réflexe fautif est `url.includes("localhost")`. Un domaine acheté suffirait à le berner.
    expect(estBaseLocale("https://localhost.exemple.fr")).toBe(false);
    expect(estBaseLocale("https://127.0.0.1.exemple.fr")).toBe(false);
  });
});

describe("[garde d'environnement] refusDeCible bloque, explique, et laisse une porte explicite", () => {
  it("laisse passer une cible locale", () => {
    expect(
      refusDeCible({ SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }),
    ).toBeNull();
  });

  it("[LE CŒUR] refuse la base de lancement, et NOMME la cible dans le message", () => {
    const refus = refusDeCible({ SUPABASE_URL: "https://zlhlzoalmszohrxrnsmo.supabase.co" });
    expect(refus).not.toBeNull();
    // Un refus qui ne dit pas ce qu'il a vu oblige à relire le code pour le comprendre.
    expect(refus).toContain("zlhlzoalmszohrxrnsmo");
    expect(refus).toContain(".env.local");
  });

  it("refuse aussi quand SEULE la variable publique est distante", () => {
    // Les deux sont lues par des modules différents ; une seule suffit à écrire au mauvais endroit.
    expect(refusDeCible({ NEXT_PUBLIC_SUPABASE_URL: "https://zlhlzoalmszohrxrnsmo.supabase.co" })).not.toBeNull();
  });

  it("l'autorisation explicite rouvre la porte — l'usage légitime reste possible", () => {
    expect(
      refusDeCible({
        SUPABASE_URL: "https://zlhlzoalmszohrxrnsmo.supabase.co",
        ANIMA_TESTS_BASE_DISTANTE: AUTORISATION_DISTANTE,
      }),
    ).toBeNull();
  });

  it("une autorisation APPROXIMATIVE ne rouvre rien", () => {
    // `Boolean(env.ANIMA_TESTS_BASE_DISTANTE)` aurait suffi à faire passer « non ».
    for (const valeur of ["", "oui", "true", "1", "non"]) {
      expect(
        refusDeCible({ SUPABASE_URL: "https://exemple.supabase.co", ANIMA_TESTS_BASE_DISTANTE: valeur }),
        valeur,
      ).not.toBeNull();
    }
  });
});

describe("[garde d'environnement] la garde est réellement BRANCHÉE sur la suite", () => {
  it("[CONTRÔLE DU CONTRÔLE] `_environnement.ts` est bien le setup des deux projets Vitest", () => {
    // Une garde parfaite dans un fichier que personne ne charge ne garde rien. C'est exactement le
    // genre d'erreur que ce dépôt a déjà payée sur des gardes d'absence.
    const config = readFileSync("vitest.config.ts", "utf-8");
    const occurrences = config.match(/_environnement/g) ?? [];
    expect(occurrences.length, "le setup a disparu de vitest.config.ts").toBeGreaterThanOrEqual(2);
  });

  it("le refus est LEVÉ au chargement, pas seulement calculé", () => {
    const source = readFileSync("tests/_environnement.ts", "utf-8");
    expect(source).toMatch(/throw new Error\(refus\)/);
  });

  it("aucun dossier de story ne documente plus la commande qui vise la vraie base", () => {
    // La cause première n'était pas le code : c'était la commande recopiée de dossier en dossier.
    // La corriger sans garder la correction, c'est attendre qu'elle revienne au prochain copier.
    const fichiers = execSync("git ls-files _bmad-output", { encoding: "utf-8" })
      .split("\n")
      .filter((f) => f.endsWith(".md"));
    const fautifs = fichiers.filter((f) => /\.\s*\.\/\.env\.local\b[^\n]*vitest/.test(readFileSync(f, "utf-8")));
    expect(fautifs, `ces dossiers sourcent .env.local avant vitest : ${fautifs.join(", ")}`).toEqual([]);
  });
});
