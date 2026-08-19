import { describe, it, expect } from "vitest";
import { creerDepotMotifsAnam } from "@/lib/data/depot-motifs-anam";
import { ligneAnam } from "@/lib/domain/carte-anam";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * depot-motifs-anam.test.ts — LA NORMALISATION À LA FRONTIÈRE (Story 6.3, T5).
 *
 * ⚠️ CE FICHIER EST NÉ D'UN MUTANT SURVIVANT. Remplacer `typeof l.titre === "string" ? l.titre : null`
 * par `String(l.titre ?? "")` laissait toute la suite verte : le dépôt n'avait AUCUN test. Les
 * clauses SQL étaient prouvées (`motifs-anam-sql`), le domaine était prouvé (`carte-anam`), et la
 * traduction de l'un vers l'autre ne l'était pas.
 *
 * Ce qui s'y joue tient en une phrase : le domaine distingue « pas de mots » (carte neutre) de
 * « des mots vides » (phrase à trous). Aplatir les deux ici ferait sauter le fail-closed d'`ligneAnam`
 * sans qu'aucune de ses gardes ne rougisse — elles reçoivent ce que ce fichier leur donne.
 */

function clientFactice(reponse: { data?: unknown; error?: { code?: string } | null }) {
  const appels: string[] = [];
  const client = {
    async rpc(nom: string) {
      appels.push(nom);
      return { data: reponse.data ?? null, error: reponse.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { client, appels };
}

describe("[6.3] le dépôt lit `motifs_anam_du`, et rien d’autre", () => {
  it("il appelle LA fonction, sans paramètre", async () => {
    // Mutation-cible : lui passer un `p_utilisatrice`. La fonction est `security invoker` et se
    // borne à `auth.uid()` — un paramètre serait la porte par laquelle un job pourrait s'en servir.
    const { client, appels } = clientFactice({ data: [] });
    await creerDepotMotifsAnam(client).motifs();
    expect(appels).toEqual(["motifs_anam_du"]);
  });

  it("une erreur de la base LÈVE — elle ne devient pas « aucun motif »", async () => {
    // ⚠️ La direction du doute se décide UNE FOIS, et elle se décide dans `lireBibliotheque`, qui
    // attrape et rend une carte neutre. Si le dépôt avalait l'erreur ici, l'appelant ne pourrait
    // plus distinguer « elle n'a rien à dire » d'« on n'a pas pu lire » — et le journal d'incident
    // serait vide le jour où la RPC tombe.
    const { client } = clientFactice({ error: { code: "PGRST202" } });
    await expect(creerDepotMotifsAnam(client).motifs()).rejects.toThrow(/motifs_anam/);
  });

  it("une réponse qui n’est pas une liste devient une liste VIDE, jamais un plantage", async () => {
    for (const data of [null, undefined, {}, "rien", 42]) {
      const { client } = clientFactice({ data });
      expect(await creerDepotMotifsAnam(client).motifs(), `data = ${JSON.stringify(data)}`).toEqual([]);
    }
  });
});

describe("[6.3, AD-15] « pas de mots » ne devient JAMAIS « des mots vides »", () => {
  it("[LE CŒUR] une colonne absente ou non-texte devient `null`", async () => {
    // Mutation-cible : `String(l.titre ?? "")`, ou `l.titre ?? ""`. Les deux produisent une chaîne
    // vide là où le domaine attend `null` — et une chaîne vide est ce qui fabrique « si , alors . ».
    const { client } = clientFactice({
      data: [{ motif: "echeance_intention", jour: "2026-08-14", titre: null, detail: undefined }],
    });
    expect(await creerDepotMotifsAnam(client).motifs()).toEqual([
      { motif: "echeance_intention", jour: "2026-08-14", titre: null, detail: null },
    ]);
  });

  it("un nombre arrivé dans une colonne de texte devient `null`, pas « 42 »", async () => {
    const { client } = clientFactice({
      data: [{ motif: "echeance_intention", jour: 20260814, titre: 42, detail: true }],
    });
    const [l] = await creerDepotMotifsAnam(client).motifs();
    expect(l).toEqual({ motif: "echeance_intention", jour: null, titre: null, detail: null });
  });

  it("[LE TEST QUI COMPTE] la carte reste NEUTRE sur une ligne mutilée, de bout en bout", async () => {
    // La chaîne complète, depuis la réponse de la base jusqu'à la ligne affichée. C'est ce que ni
    // le test du domaine ni celui du SQL ne couvrent : chacun prouve son bout.
    const { client } = clientFactice({
      data: [{ motif: "echeance_intention", jour: "2026-08-14", titre: null, detail: "j’écris" }],
    });
    expect(ligneAnam(await creerDepotMotifsAnam(client).motifs())).toBeNull();
  });

  it("…et elle porte bien la ligne quand la base rend une ligne complète", async () => {
    // Le contrôle positif : sans lui, un dépôt qui rendrait toujours `[]` passerait tout ce fichier.
    const { client } = clientFactice({
      data: [{ motif: "echeance_intention", jour: "2026-08-14", titre: "je bloque", detail: "j’écris" }],
    });
    expect(ligneAnam(await creerDepotMotifsAnam(client).motifs())).toBe(
      "Pour aujourd’hui : si je bloque, alors j’écris.",
    );
  });

  it("un motif inconnu traverse le dépôt SANS être filtré — le refus vit dans le domaine", async () => {
    // ⚠️ Délibéré, et c'est une décision : filtrer ici ferait DEUX endroits qui décident de
    // l'ensemble fermé, et deux endroits finissent toujours par diverger. Le dépôt traduit ; il
    // n'arbitre pas. `motifPrioritaire` refuse, et lui seul.
    const { client } = clientFactice({
      data: [{ motif: "reengagement", jour: "2026-08-14", titre: "reviens", detail: "vite" }],
    });
    const lignes = await creerDepotMotifsAnam(client).motifs();
    expect(lignes.map((l) => l.motif), "le dépôt ne filtre pas").toEqual(["reengagement"]);
    expect(ligneAnam(lignes), "…et le domaine refuse").toBeNull();
  });
});
