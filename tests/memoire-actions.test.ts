import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as COPIE from "@/lib/domain/copie-memoire";

/**
 * Story 6.5 (T4) — LES ACTIONS SERVEUR ET LA LECTURE, SUR DOUBLURE.
 *
 * ⚠️ ET LA DOUBLURE EST LÉGITIME ICI, contrairement à `memoire-sql.test.ts`. Ce qu'on éprouve n'est
 * pas une propriété de la base — c'est du CONTRÔLE DE FLUX : quels arguments partent, et ce qui
 * arrive quand la réponse est une erreur. Le vrai Postgres ne sait pas produire une 5xx PostgREST
 * sur commande ; une doublure, si.
 *
 * ── CES DEUX BLOCS SONT NÉS D'UNE CAMPAGNE DE MUTATION ─────────────────────────────────────────
 *
 * Deux mutants ont SURVÉCU au premier passage, et tous les deux pour la même raison : ces chemins
 * n'étaient exercés par aucun test. Le rendu doublait les actions, la base doublait la lecture, et
 * personne ne regardait entre les deux.
 */

const corriger = vi.fn();
const supprimer = vi.fn();
vi.mock("@/lib/data/depot-faits", () => ({
  creerDepotFaits: () => ({ corriger, supprimer, fusionner: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { annulerSuppression, corrigerFait, supprimerFait } from "@/app/memoire/actions";
import { lireFaitsRetenus } from "@/lib/data/lire-memoire";

beforeEach(() => {
  corriger.mockReset().mockResolvedValue(undefined);
  supprimer.mockReset().mockResolvedValue(undefined);
});

describe("[6.5/AC2] corriger — ce qui part, et ce qui est refusé AVANT de partir", () => {
  it("une correction ordinaire part NETTOYÉE", async () => {
    expect(await corrigerFait("k-1", "  elle a déménagé  ", "ancien")).toEqual({ statut: "ok" });
    expect(corriger).toHaveBeenCalledWith("k-1", "elle a déménagé");
  });

  it("[LE CŒUR] une correction VIDE n'atteint JAMAIS la base", async () => {
    // ⚠️ La base la refuse depuis 0056 ; ce refus-ci est là pour le DIRE. Sans lui, l'écran
    // remonterait une erreur Postgres — dont le texte cite la valeur refusée, c'est-à-dire du
    // contenu art. 9 affiché par la porte du diagnostic (NFR-022).
    expect(await corrigerFait("k-1", "   ", "ancien")).toEqual({
      statut: "erreur",
      message: COPIE.REFUS_VIDE,
    });
    expect(corriger, "une correction vide est partie vers la base").not.toHaveBeenCalled();
  });

  it("une réécriture à l'identique est refusée sans partir", async () => {
    expect(await corrigerFait("k-1", "elle aime la mer", "elle aime la mer")).toEqual({
      statut: "erreur",
      message: COPIE.REFUS_INCHANGEE,
    });
    expect(corriger).not.toHaveBeenCalled();
  });

  it("[NFR-022] un refus de la base ne recopie PAS son message", async () => {
    // Le trigger de 0018 lève avec sa propre règle art. 9 ; 0056 citerait la valeur refusée.
    corriger.mockRejectedValue(new Error("fait_extrait : contenu « elle a un cancer » refusé"));
    const issue = await corrigerFait("k-1", "quelque chose", "ancien");
    expect(issue).toEqual({ statut: "erreur", message: COPIE.CORRECTION_APRES_REVOCATION });
    expect(JSON.stringify(issue), "le message de Postgres a fuité à l'écran").not.toMatch(/cancer/);
  });
});

describe("[6.5/AC3] supprimer et annuler", () => {
  it("supprimer part tout de suite, sur la seule clé", async () => {
    expect(await supprimerFait("k-1")).toEqual({ statut: "ok" });
    expect(supprimer).toHaveBeenCalledWith("k-1");
  });

  it("[LE CŒUR] annuler RE-DÉPOSE la phrase — et n'est pas refusée comme « inchangée »", async () => {
    // ⚠️ MUTANT SURVIVANT DU PREMIER PASSAGE. `annulerSuppression` passe une chaîne VIDE comme
    // « texte actuel », et ce n'est pas un détail : le fait vient d'être vidé par le tombstone, donc
    // son contenu actuel EST vide. Passer la phrase elle-même la ferait comparer à elle-même, et
    // `validerCorrection` la refuserait comme « inchangée » — l'annulation serait alors cassée pour
    // toujours, en silence, et le seul symptôme serait un message qui n'a aucun sens à cet endroit.
    expect(await annulerSuppression("k-1", "elle a quitté Paris")).toEqual({ statut: "ok" });
    expect(corriger).toHaveBeenCalledWith("k-1", "elle a quitté Paris");
  });

  it("annuler une phrase vide est refusé — ce serait recréer la ligne que 0056 interdit", async () => {
    expect(await annulerSuppression("k-1", "  ")).toMatchObject({ statut: "erreur" });
    expect(corriger).not.toHaveBeenCalled();
  });
});

describe("[6.5/AC5] « je n'arrive pas à lire » n'est PAS « tu n'as rien »", () => {
  const client = (reponse: unknown) =>
    ({ rpc: async () => reponse }) as unknown as SupabaseClient;

  it("[LE CŒUR] une erreur de lecture LÈVE, elle ne rend pas une liste vide", async () => {
    // ⚠️ MUTANT SURVIVANT DU PREMIER PASSAGE, et le plus grave des deux. Sans le `error` déstructuré,
    // `data` vaut `null` sur une 5xx PostgREST et l'écran afficherait « Anam ne retient encore rien
    // de précis sur toi. » à quelqu'un qui a trente lignes. C'est le défaut déjà corrigé en 4.6 puis
    // en 4.9 — et il est ici PIRE qu'ailleurs : sur cette page-là, le vide se lit comme un
    // effacement réussi. Quelqu'un pourrait croire que ses données ont disparu.
    await expect(lireFaitsRetenus(client({ data: null, error: { code: "PGRST500" } }))).rejects.toThrow(
      /memoire/,
    );
  });

  it("[NFR-022] le message d'erreur ne porte que le CODE, jamais le détail", async () => {
    await expect(
      lireFaitsRetenus(client({ data: null, error: { code: "PGRST500", message: "row: elle a un cancer" } })),
    ).rejects.toThrow(/^memoire: PGRST500$/);
  });

  it("[CONTRÔLE POSITIF] une réponse vide SANS erreur rend bien une liste vide", async () => {
    // Sans ce contrôle, la garde ci-dessus passerait aussi avec une fonction qui lève toujours.
    expect(await lireFaitsRetenus(client({ data: [], error: null }))).toEqual([]);
  });

  it("une ligne MUTILÉE est écartée, jamais rendue avec un champ vide", async () => {
    // Une ligne vide dans cette liste-ci se lirait comme un fait effacé qui serait revenu.
    const data = [
      { cle: "k-1", contenu: "vraie phrase", statut: "actif", jour: "2026-08-04" },
      { cle: null, contenu: "sans clé", statut: "actif", jour: "2026-08-04" },
      { cle: "k-3", contenu: "", statut: "actif", jour: "2026-08-04" },
      { cle: "k-4", contenu: "sans date", statut: "actif", jour: null },
    ];
    const faits = await lireFaitsRetenus(client({ data, error: null }));
    expect(faits.map((f) => f.contenu)).toEqual(["vraie phrase"]);
    expect(faits[0].jour).toBe("2026-08-04");
  });
});
