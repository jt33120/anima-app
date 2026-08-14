import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * depot-lecture.test.ts — LA COURSE, ET CE QUI SÉPARE UNE GARDE D'UN `if` (Story 5.8, AC5).
 *
 * ══ LE DÉFAUT QUE CE FICHIER EMPÊCHE ════════════════════════════════════════════════════════════
 *
 * 0051 pose l'index qui interdit deux lectures en attente. Un index, seul, transforme le second
 * appel en ERREUR — et une erreur, dans un rituel, c'est une femme qui a demandé une lecture et qui
 * voit un échec. La garde de base doit donc être doublée d'un COMPORTEMENT : relire, et rendre la
 * MÊME carte.
 *
 * Deux onglets ouverts, ce n'est pas un cas de laboratoire : c'est le parcours de quelqu'un qui a
 * rechargé une page qui mettait du temps.
 *
 * ⚠️ CE TEST NE PROUVE PAS L'UNICITÉ — elle est prouvée en SQL (`tests/lecture-sql.test.ts`), là où
 * l'index vit réellement. Il prouve la RÉACTION à l'unicité. Les deux gardes sont nécessaires et
 * aucune ne remplace l'autre : sans l'index, ce code lit puis écrit sans atomicité ; sans ce code,
 * l'index produit une erreur au lieu d'une carte.
 */

const journal = vi.hoisted(() => ({ ordre: [] as string[] }));

vi.mock("@/lib/data/depot-tirage", () => ({
  tirerEtDeposer: vi.fn(async () => {
    journal.ordre.push("tirage");
    return { cle: "puits", graine: "0000002a", tailleJeu: 24, id: "TIRAGE-1" };
  }),
}));

const { ouvrirLecture, lectureEnAttente, cloreLecture } = await import("@/lib/data/depot-lecture");

const CHAMPS_LECTURE = {
  id: "LECT-1",
  reponse: null,
  restitution: null,
  cle_tour_source: null,
  ouverte_a: "2026-08-14T10:00:00Z",
  tirage: { carte: "puits" },
};

/**
 * Un faux client PostgREST. `selects` scripte ce que rend chaque `.select().is().maybeSingle()`
 * successif ; `insertErreur` scripte l'échec d'insert.
 */
function fauxClient(options: {
  enAttente?: (typeof CHAMPS_LECTURE | null)[];
  insertErreur?: { code: string } | null;
  ligneInseree?: typeof CHAMPS_LECTURE;
}) {
  const enAttente = [...(options.enAttente ?? [])];
  const maj: Record<string, unknown>[] = [];
  return {
    maj,
    client: {
      from: () => ({
        select: () => ({
          is: () => ({
            maybeSingle: () => {
              journal.ordre.push("select:enAttente");
              return Promise.resolve({ data: enAttente.shift() ?? null, error: null });
            },
          }),
        }),
        insert: () => {
          journal.ordre.push("insert:lecture");
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: options.insertErreur ? null : (options.ligneInseree ?? CHAMPS_LECTURE),
                  error: options.insertErreur ?? null,
                }),
            }),
          };
        },
        update: (ligne: Record<string, unknown>) => {
          journal.ordre.push("update:lecture");
          maj.push(ligne);
          return { eq: () => ({ is: () => Promise.resolve({ error: null }) }) };
        },
      }),
    },
  };
}

beforeEach(() => {
  journal.ordre = [];
});

describe("[AC5] rappeler le rituel ne tire pas une seconde carte", () => {
  it("une lecture DÉJÀ ouverte → aucun tirage, la MÊME carte", async () => {
    const { client } = fauxClient({ enAttente: [CHAMPS_LECTURE] });
    const r = await ouvrirLecture(client as never, "u1");
    expect(r.lecture.carte).toBe("puits");
    expect(r.dejaOuverte).toBe(true);
    // ⚠️ AUCUN « tirage » DANS LE JOURNAL. C'est l'assertion de la story : le point d'entrée rappelé
    // ne produit pas de seconde carte.
    expect(journal.ordre).toEqual(["select:enAttente"]);
  });

  it("aucune lecture ouverte → on lit D'ABORD, on tire ENSUITE, on écrit APRÈS", async () => {
    const { client } = fauxClient({ enAttente: [null] });
    const r = await ouvrirLecture(client as never, "u1");
    expect(r.dejaOuverte).toBe(false);
    expect(journal.ordre).toEqual(["select:enAttente", "tirage", "insert:lecture"]);
  });
});

describe("[AC5] la course entre deux onglets converge, elle n'échoue pas", () => {
  it("un 23505 fait RELIRE et rendre la carte de la gagnante — jamais une erreur", async () => {
    // Le scénario réel : deux onglets lisent « rien en attente » en même temps, tirent chacun, et le
    // second insert heurte l'index partiel. Sans la relecture, cette femme voit un échec après avoir
    // demandé une lecture — et la carte de l'autre onglet l'attend pourtant.
    const gagnante = { ...CHAMPS_LECTURE, id: "LECT-GAGNANTE", tirage: { carte: "pont" } };
    const { client } = fauxClient({ enAttente: [null, gagnante], insertErreur: { code: "23505" } });
    const r = await ouvrirLecture(client as never, "u1");
    expect(r.lecture.carte).toBe("pont");
    expect(r.lecture.id).toBe("LECT-GAGNANTE");
    expect(r.dejaOuverte).toBe(true);
    expect(journal.ordre).toEqual(["select:enAttente", "tirage", "insert:lecture", "select:enAttente"]);
  });

  it("un 23505 SANS gagnante relisible remonte l'échec — jamais un silence", async () => {
    // Cas dégénéré (la gagnante a été close entre les deux lectures) : on ne boucle pas, on ne
    // retire pas, on dit. Reboucler ici serait un re-tirage déguisé en robustesse.
    const { client } = fauxClient({ enAttente: [null, null], insertErreur: { code: "23505" } });
    await expect(ouvrirLecture(client as never, "u1")).rejects.toThrow(/lecture\.ouvrir: 23505/);
  });

  it("une AUTRE erreur (42501 : une des cinq gardes) remonte SANS relire", async () => {
    const { client } = fauxClient({ enAttente: [null], insertErreur: { code: "42501" } });
    await expect(ouvrirLecture(client as never, "u1")).rejects.toThrow(/lecture\.ouvrir: 42501/);
    expect(journal.ordre.filter((o) => o === "select:enAttente")).toHaveLength(1);
  });

  it("l'erreur ne porte ni carte, ni graine, ni identité (NFR-022)", async () => {
    const { client } = fauxClient({ enAttente: [null], insertErreur: { code: "42501" } });
    const message = await ouvrirLecture(client as never, "u1").catch((e: Error) => e.message);
    expect(message).toBe("lecture.ouvrir: 42501");
    expect(message).not.toContain("puits");
    expect(message).not.toContain("u1");
  });
});

describe("[AC6] la clôture écrit SES mots, la restitution et le lien vers l'échange source", () => {
  it("les trois champs partent ensemble — jamais l'un sans les autres", async () => {
    const { client, maj } = fauxClient({});
    await cloreLecture(client as never, "LECT-1", {
      reponse: "je vois une ouverture",
      restitution: "Tu as parlé d'ouverture.",
      cleTourSource: "TOUR-42",
    });
    expect(maj[0]).toEqual({
      reponse: "je vois une ouverture",
      restitution: "Tu as parlé d'ouverture.",
      cle_tour_source: "TOUR-42",
    });
  });

  it("la clôture n'écrit AUCUN horodatage — la base les pose (0046, trigger `lecture_horodatage`)", async () => {
    const { client, maj } = fauxClient({});
    await cloreLecture(client as never, "LECT-1", { reponse: "a", restitution: "b", cleTourSource: "c" });
    expect(Object.keys(maj[0]).sort()).toEqual(["cle_tour_source", "reponse", "restitution"]);
  });
});

describe("la jointure au tirage est normalisée, quelle que soit la forme rendue par PostgREST", () => {
  it("`tirage` rendu en TABLEAU est accepté", async () => {
    const enTableau = { ...CHAMPS_LECTURE, tirage: [{ carte: "braise" }] };
    const { client } = fauxClient({ enAttente: [enTableau as never] });
    expect((await lectureEnAttente(client as never))?.carte).toBe("braise");
  });

  it("`tirage` absent LÈVE — une lecture sans sa carte n'est pas une lecture", async () => {
    const sansTirage = { ...CHAMPS_LECTURE, tirage: null };
    const { client } = fauxClient({ enAttente: [sansTirage as never] });
    await expect(lectureEnAttente(client as never)).rejects.toThrow(/tirage absent/);
  });
});
