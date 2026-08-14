import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * tirage-depot.test.ts — ON TIRE D'ABORD, ON ÉCRIT ENSUITE (Story 5.7, AC2 · AD-11 / AD-12).
 *
 * ══ POURQUOI L'ORDRE EST UN INVARIANT, ET PAS UN DÉTAIL D'IMPLÉMENTATION ════════════════════════
 *
 * AD-11 : « l'identité ne sert qu'à l'ÉCRITURE RLS de la lecture, jamais comme entrée de
 * sélection ». Traduit en code : deux fonctions, et un ordre.
 *
 *     tirerUneCarte()                 → ne connaît personne (arité nulle, verrou d'imports)
 *     deposerTirage(supabase, id, t)  → connaît l'utilisatrice, mais ne tire pas
 *
 * Si un jour quelqu'un fusionne les deux — « ce serait plus simple d'écrire directement » —, la
 * fonction fusionnée aurait accès à l'identité AU MOMENT DE CHOISIR, et FR-016 redeviendrait une
 * question de discipline. L'ordre est donc espionné : le tirage doit se produire avant que la
 * moindre requête ne parte.
 *
 * ⚠️ CE TEST NE SE SUFFIT PAS À LUI-MÊME, et il faut le dire. Il prouve l'ORDRE, pas l'AVEUGLEMENT.
 * L'aveuglement est prouvé ailleurs, et autrement : par l'arité et le verrou d'imports
 * (`tests/tirage-architecture.test.ts`). Les deux gardes sont nécessaires, aucune ne remplace
 * l'autre.
 */

const journal = vi.hoisted(() => ({ ordre: [] as string[] }));

vi.mock("@/lib/tirage/tirer", async (original) => {
  // On enveloppe l'implémentation RÉELLE plutôt que de la remplacer : un faux tirage rendrait le
  // test vert sur un échantillonneur cassé.
  const reel = await original<typeof import("@/lib/tirage/tirer")>();
  return {
    ...reel,
    tirerUneCarte: vi.fn(() => {
      journal.ordre.push("tirage");
      return reel.tirerUneCarte();
    }),
  };
});

const { deposerTirage, tirerEtDeposer } = await import("@/lib/data/depot-tirage");
const { TAILLE_JEU, CLES_JEU } = await import("@/lib/tirage/jeu");

/** Un faux client Supabase qui note ses insertions dans l'ordre où elles arrivent. */
function fauxClient(erreur: { code: string } | null = null) {
  const insertions: Record<string, unknown>[] = [];
  return {
    insertions,
    client: {
      from: (table: string) => ({
        insert: (ligne: Record<string, unknown>) => {
          journal.ordre.push(`insert:${table}`);
          insertions.push(ligne);
          return Promise.resolve({ error: erreur });
        },
      }),
    },
  };
}

beforeEach(() => {
  journal.ordre = [];
});

describe("[AC2] l'identité n'entre qu'à l'écriture", () => {
  it("`tirerEtDeposer` TIRE avant d'écrire", () => {
    const { client } = fauxClient();
    return tirerEtDeposer(client as never, "11111111-1111-1111-1111-111111111111").then(() => {
      expect(journal.ordre).toEqual(["tirage", "insert:tirage"]);
    });
  });

  it("`deposerTirage` NE TIRE PAS — elle écrit ce qu'on lui donne, à l'identique", async () => {
    const { client, insertions } = fauxClient();
    await deposerTirage(client as never, "22222222-2222-2222-2222-222222222222", {
      cle: "barque",
      graine: "0000002a",
      tailleJeu: 24,
    });
    expect(journal.ordre).toEqual(["insert:tirage"]);
    expect(insertions[0]).toEqual({
      utilisatrice_id: "22222222-2222-2222-2222-222222222222",
      carte: "barque",
      graine: "0000002a",
      taille_jeu: 24,
    });
  });

  it("la ligne écrite ne porte AUCUN horodatage — la base le pose (0046, trigger `tirage_horodatage`)", async () => {
    // Envoyer `tire_a` d'ici serait l'heure du processus : falsifiable, sujette à la dérive
    // d'horloge, et donc une mauvaise pièce dans un journal d'audit.
    const { client, insertions } = fauxClient();
    await tirerEtDeposer(client as never, "33333333-3333-3333-3333-333333333333");
    expect(Object.keys(insertions[0]).sort()).toEqual(["carte", "graine", "taille_jeu", "utilisatrice_id"]);
  });

  it("la ligne écrite est rejouable : carte du jeu, graine au format, taille journalisée", async () => {
    const { client, insertions } = fauxClient();
    const tirage = await tirerEtDeposer(client as never, "44444444-4444-4444-4444-444444444444");
    const ligne = insertions[0];
    expect(CLES_JEU).toContain(ligne.carte);
    expect(ligne.graine).toMatch(/^[0-9a-f]{8}$/);
    expect(ligne.taille_jeu).toBe(TAILLE_JEU);
    // Ce qui est écrit est exactement ce qui a été tiré — pas une reconstruction.
    expect(ligne).toMatchObject({ carte: tirage.cle, graine: tirage.graine, taille_jeu: tirage.tailleJeu });
  });
});

describe("[AC2] l'échec d'écriture ne se rattrape pas par un second tirage", () => {
  it("une garde qui refuse (42501) fait remonter le code, et RIEN d'autre ne part", async () => {
    // 42501 = une des quatre gardes du `with check` a refusé : propriété, consentement art. 9,
    // barrière de minorité, ou fenêtre de détresse. La 5.8 devra les distinguer avec des mots.
    const { client } = fauxClient({ code: "42501" });
    await expect(tirerEtDeposer(client as never, "55555555-5555-5555-5555-555555555555")).rejects.toThrow(
      /tirage\.deposer: 42501/,
    );
    // ⚠️ UN SEUL TIRAGE, UNE SEULE TENTATIVE. Rejouer après un échec serait un SECOND tirage —
    // exactement le re-tirage silencieux que l'UX interdit (« ne jamais faire : proposer un
    // re-tirage »). La carte est perdue, et c'est la bonne issue : une carte tirée sans trace
    // journalisée est une carte qu'on ne peut pas auditer.
    expect(journal.ordre).toEqual(["tirage", "insert:tirage"]);
  });

  it("l'erreur ne porte ni la carte, ni la graine, ni l'identité (NFR-022)", async () => {
    const { client } = fauxClient({ code: "42501" });
    const echec = await tirerEtDeposer(client as never, "66666666-6666-6666-6666-666666666666").catch(
      (e: Error) => e.message,
    );
    expect(echec).toBe("tirage.deposer: 42501");
    for (const cle of CLES_JEU) expect(echec).not.toContain(cle);
    expect(echec).not.toContain("6666");
  });
});
