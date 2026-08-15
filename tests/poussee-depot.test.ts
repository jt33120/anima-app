import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Story 6.2 — LE DÉPÔT DE POUSSÉE, avec une base qui répond ce qu'elle ne répond pas d'elle-même.
 *
 * ⚠️ CE FICHIER EST NÉ D'UN MUTANT SURVIVANT, et c'est le MÊME mutant qu'en 6.1a (T7, `data ?? null`).
 * Remplacer `data === true` par `data !== false` dans `reserverPoussee` ne faisait rougir personne :
 * `socle-sql.test.ts` appelle les RPC directement sans passer par le dépôt, et `socle-job.test.ts`
 * double le dépôt entièrement. Le vrai `depot-poussee.ts` n'était exercé par AUCUN test.
 *
 * Ce n'est pas une équivalence — contre le vrai Postgres, `reserver_notification` ne rend jamais qu'un
 * booléen, donc les deux écritures s'y comportent pareil. C'est un TROU, et le seul moyen de
 * l'atteindre est de faire répondre à la base autre chose qu'un booléen.
 *
 * Ce que ça protège, concrètement : PostgREST rend `null` (une régression de sérialisation, une
 * surcharge de fonction supprimée, un `returns void` par accident). Avec `data !== false`, `null`
 * n'est pas `false` — le job conclut donc que la réservation est acquise et POUSSE. Sur un rythme
 * quotidien, c'est une notification par tick au lieu d'une par jour.
 *
 * La règle est celle du dépôt depuis la 4.8 : **dans le doute, NE PAS pousser.**
 */

let reponseRpc: { data: unknown; error: unknown } = { data: true, error: null };
const appels: { nom: string; args: Record<string, unknown> }[] = [];

vi.mock("@/lib/data/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (nom: string, args: Record<string, unknown>) => {
      appels.push({ nom, args });
      return reponseRpc;
    },
  }),
}));

const { creerDepotPoussee } = await import("@/lib/data/depot-poussee");

afterEach(() => {
  reponseRpc = { data: true, error: null };
  appels.length = 0;
});

describe("[6.2] `reserverPoussee` — dans le doute, ne pas pousser", () => {
  it.each([[null], [undefined], ["true"], [1], [{}], [[]], [0]])(
    "[LE CŒUR] une réponse `%s` n'autorise PAS la poussée",
    async (data) => {
      // ⚠️ Mutation-cible : `data !== false`. Elle passe tous les tests SQL, parce que la vraie RPC ne
      // rend qu'un booléen. Elle ne passe pas celui-ci.
      reponseRpc = { data, error: null };
      expect(
        await creerDepotPoussee().reserverPoussee("u1", "socle_quotidien", "2026-08-15", 20),
        `réponse ${JSON.stringify(data)}`,
      ).toBe(false);
    },
  );

  it("[CONTRÔLE POSITIF] un `true` franc autorise — sans quoi la garde serait un dépôt qui ne réserve jamais", async () => {
    reponseRpc = { data: true, error: null };
    expect(await creerDepotPoussee().reserverPoussee("u1", "socle_quotidien", "2026-08-15", 20)).toBe(true);
  });

  it("une erreur de base LÈVE — elle ne se déguise pas en refus", async () => {
    // La distinction compte pour le job : un refus est un non-événement qu'on passe en silence, une
    // panne de base doit remonter au `catch` de l'itération et se journaliser. Les confondre ferait
    // disparaître une base en panne dans le bruit des refus ordinaires.
    reponseRpc = { data: null, error: { code: "42501" } };
    await expect(
      creerDepotPoussee().reserverPoussee("u1", "socle_quotidien", "2026-08-15", 20),
    ).rejects.toThrow(/reserver_notification: 42501/);
  });

  it("le motif et le plafond passent tels quels — aucune valeur n'est inventée en route", async () => {
    await creerDepotPoussee().reserverPoussee("u1", "socle_quotidien", "2026-08-15", 20);
    expect(appels[0]).toEqual({
      nom: "reserver_notification",
      args: {
        p_utilisatrice: "u1",
        p_motif: "socle_quotidien",
        p_cle: "2026-08-15",
        p_plafond_heures: 20,
      },
    });
  });
});

describe("[6.2] `endpoints` — une réponse qu'on ne comprend pas n'est pas une liste d'appareils", () => {
  it("une réponse non-tableau rend une liste VIDE, pas une exception", async () => {
    // Le job traite `[]` comme « elle s'est désabonnée entre-temps » : il passe à la suivante sans
    // consommer de réservation. C'est le repli le moins affirmatif.
    for (const data of [null, undefined, {}, "trois"]) {
      reponseRpc = { data, error: null };
      expect(await creerDepotPoussee().endpoints("u1"), `réponse ${JSON.stringify(data)}`).toEqual([]);
    }
  });

  it("[CONTRÔLE POSITIF] les colonnes de la base sont renommées vers le port", async () => {
    // `cle_p256dh` / `cle_auth` en base, `p256dh` / `auth` dans le port : la traduction vit ICI, et
    // une inversion silencieuse produirait des poussées que personne ne peut déchiffrer le jour où
    // une charge utile arrivera (6.3).
    reponseRpc = {
      data: [{ endpoint: "https://web.push.apple.com/x", cle_p256dh: "P", cle_auth: "A" }],
      error: null,
    };
    expect(await creerDepotPoussee().endpoints("u1")).toEqual([
      { endpoint: "https://web.push.apple.com/x", p256dh: "P", auth: "A" },
    ]);
  });

  it("une erreur de base LÈVE", async () => {
    reponseRpc = { data: null, error: { code: "42501" } };
    await expect(creerDepotPoussee().endpoints("u1")).rejects.toThrow(/endpoints_poussee: 42501/);
  });
});

describe("[6.2] le ménage ne fait échouer personne", () => {
  it("[LE CŒUR] `oublierEndpoint` et `libererPoussee` ne LÈVENT pas, même sur erreur", async () => {
    // ⚠️ Les deux s'appellent sur un chemin qui a DÉJÀ raté. Les faire lever ferait sortir le tour de
    // boucle par le `catch`, et priverait les personnes suivantes de leur journée — pour un ménage
    // qui peut parfaitement attendre le lendemain.
    reponseRpc = { data: null, error: { code: "42501" } };
    const depot = creerDepotPoussee();
    await expect(depot.oublierEndpoint("https://web.push.apple.com/x")).resolves.toBeUndefined();
    await expect(depot.libererPoussee("u1", "socle_quotidien", "2026-08-15")).resolves.toBeUndefined();
  });

  it("elles appellent bien la RPC — sans quoi « ne lève pas » serait satisfait par un corps vide", async () => {
    const depot = creerDepotPoussee();
    await depot.oublierEndpoint("https://web.push.apple.com/x");
    await depot.libererPoussee("u1", "socle_quotidien", "2026-08-15");
    expect(appels.map((a) => a.nom)).toEqual(["oublier_endpoint_poussee", "liberer_notification"]);
    expect(appels[0].args).toEqual({ p_endpoint: "https://web.push.apple.com/x" });
  });
});
