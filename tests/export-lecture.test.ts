import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chargerExport } from "@/lib/data/exporter-donnees";

/**
 * export-lecture.test.ts — LES QUATRE REFUS DE `chargerExport` (Story 6.6, AC1).
 *
 * ⚠️ ET LA DOUBLURE EST LÉGITIME ICI. Ce qu'on éprouve n'est pas une propriété de la base — c'est ce
 * qui arrive QUAND LA BASE RÉPOND MAL. Le vrai Postgres ne sait pas produire une 5xx PostgREST sur
 * commande ; une doublure, si.
 *
 * Ces quatre chemins sont écrits AVANT la campagne de mutation, parce que le patron est connu et
 * qu'il a déjà coûté deux mutants survivants en 6.5 : ce qui n'est exercé par personne survit à
 * tout. Le rendu double la lecture, la base double le rendu, et personne ne regarde entre les deux.
 *
 * L'enjeu est plus grave ici qu'ailleurs. Un `chargerExport` qui rendrait `{}` au lieu de lever
 * produirait un FICHIER — daté, nommé, téléchargé, ouvert. Elle y lirait « Rien dans cette partie »
 * vingt-neuf fois de suite, et conclurait que ses données ont disparu.
 */

const client = (reponse: unknown) => ({ rpc: async () => reponse }) as unknown as SupabaseClient;

const DOCUMENT = { version: 1, genere_le: "2026-08-16T10:00:00+00:00", retraits: [], branche: [] };

describe("[6.6/AC1] Une lecture qui échoue LÈVE — elle ne rend jamais un document", () => {
  it("[LE CŒUR] une erreur PostgREST lève, elle ne rend pas un export vide", async () => {
    await expect(chargerExport(client({ data: null, error: { code: "PGRST500" } }))).rejects.toThrow(
      /^export: PGRST500$/,
    );
  });

  it("[NFR-022] le message de Postgres ne remonte JAMAIS — il citerait la valeur fautive", async () => {
    await expect(
      chargerExport(client({ data: null, error: { code: "42501", message: "ligne : elle a un cancer" } })),
    ).rejects.toThrow(/^export: 42501$/);
    await expect(
      chargerExport(client({ data: null, error: { code: "42501", message: "elle a un cancer" } })),
    ).rejects.not.toThrow(/cancer/);
  });

  it("une erreur SANS code reste une erreur — jamais un succès silencieux", async () => {
    await expect(chargerExport(client({ data: null, error: {} }))).rejects.toThrow(/^export: echec$/);
  });

  it("une réponse `null` sans erreur lève aussi — un document absent n'est pas un document vide", async () => {
    await expect(chargerExport(client({ data: null, error: null }))).rejects.toThrow(/document_absent/);
  });

  it("un tableau n'est pas un document — la RPC rend un objet, jamais une liste", async () => {
    await expect(chargerExport(client({ data: [], error: null }))).rejects.toThrow(/document_absent/);
  });

  it("un document SANS date est refusé — il ne pourrait être ni daté ni nommé", async () => {
    await expect(chargerExport(client({ data: { version: 1 }, error: null }))).rejects.toThrow(
      /document_sans_date/,
    );
  });

  it("[CONTRÔLE POSITIF] un document valide passe intact — sinon les six gardes ci-dessus ne prouvent rien", async () => {
    // Sans lui, une fonction qui lèverait TOUJOURS satisfait tout ce qui précède.
    expect(await chargerExport(client({ data: DOCUMENT, error: null }))).toEqual(DOCUMENT);
  });
});
