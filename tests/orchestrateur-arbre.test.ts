import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 4.6 (T4) — l'orchestrateur de projection à REPLI SÛR + la route d'incident de régression. Le dépôt et
 * le client Supabase sont MOCKÉS : on prouve la composition (branches → ProjectionScene), le repli sûr (panne →
 * arbre vide, jamais un 500), et que l'incident de régression ne journalise QUE le champ (jamais l'art. 9).
 */

const chargerBranches = vi.fn();
vi.mock("@/lib/data/depot-branche", () => ({
  creerDepotBranche: vi.fn(() => ({ chargerBranches })),
}));

const getUser = vi.fn();
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

import { chargerProjectionArbre } from "@/lib/safety/projection-arbre";
import { codeJournalisable } from "@/lib/safety/rpc-repli";
import { POST as incident } from "@/app/api/incident/route";

const supa = {} as SupabaseClient;
/** Client JWT factice qui répond à `branche_bloquee_par_detresse` — hors fenêtre par défaut. */
const supaFenetre = (bloquee: boolean) =>
  ({ rpc: async () => ({ data: bloquee, error: null }) }) as unknown as SupabaseClient;

describe("chargerProjectionArbre — composition & repli sûr", () => {
  beforeEach(() => chargerBranches.mockReset());

  it("mappe les branches chargées en ProjectionScene (verbatim + date pour la fiche)", async () => {
    chargerBranches.mockResolvedValue([
      {
        id: "b1",
        nom: "un nom",
        etat: "feuillaison",
        intensite: 0.4,
        dateNaissance: "2026-03-12T10:00:00Z",
        extraitSourceId: "e1",
        extraitContenu: "le verbatim exact",
        extraitCreeLe: "2026-03-11T09:00:00Z",
      },
    ]);
    const projection = await chargerProjectionArbre(supa);
    expect(projection.tronc.present).toBe(true);
    expect(projection.branches).toHaveLength(1);
    expect(projection.branches[0]).toMatchObject({
      id: "b1",
      etat: "feuillaison",
      intensite: 0.4,
      extraitSourceId: "e1",
      nom: "un nom",
      extraitContenu: "le verbatim exact",
    });
  });

  it("repli sûr : une panne du dépôt → arbre marqué INDISPONIBLE (jamais « rien n'a été nommé »), incident journalisé", async () => {
    chargerBranches.mockResolvedValue(null); // `null.map` lève DANS le try → exerce le catch proprement
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const projection = await chargerProjectionArbre(supa);
    // [AC2 / revue 4.6] Une PANNE doit être distinguable d'un arbre vide : sans ce marqueur, l'écran
    // affichait « Rien n'a encore été nommé » à quelqu'un qui a des branches — la pire régression (FR-029).
    expect(projection.indisponible, "une panne n'est pas un arbre vide").toBe(true);
    expect(projection.branches).toEqual([]);
    expect(spy, "l'incident est journalisé (repli AD-15)").toHaveBeenCalled();
    spy.mockRestore();
  });

  it("[REVUE] pendant la fenêtre de détresse, la projection SUSPEND les gestes (AD-17/D3)", async () => {
    // Sans ce drapeau, la fiche offrait le geste irréversible, faisait lire « elle y restera », puis le
    // point d'écriture refusait — à quelqu'un qui venait de traverser une crise. La décision vit ICI
    // (lib/scene), pas dans le rendu : le rendu constate, il ne déduit pas (AD-7).
    chargerBranches.mockResolvedValue([]);
    const dedans = await chargerProjectionArbre(supaFenetre(true));
    expect(dedans.gestesSuspendus).toBe(true);
    const dehors = await chargerProjectionArbre(supaFenetre(false));
    expect(dehors.gestesSuspendus, "hors fenêtre, rien n'est suspendu").toBeUndefined();
  });

  it("[REVUE] le repli de la fenêtre est PROTECTEUR : le doute suspend", async () => {
    // Se tromper en suspendant coûte à Sanela un geste différé de quelques heures ; se tromper dans
    // l'autre sens lui fait vivre un refus juste après un engagement irréversible. L'asymétrie tranche.
    chargerBranches.mockResolvedValue([]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const enPanne = { rpc: async () => ({ data: null, error: { code: "42501" } }) } as unknown as SupabaseClient;
    expect((await chargerProjectionArbre(enPanne)).gestesSuspendus).toBe(true);
    const quiLeve = { rpc: async () => { throw new Error("réseau"); } } as unknown as SupabaseClient;
    expect((await chargerProjectionArbre(quiLeve)).gestesSuspendus).toBe(true);
    spy.mockRestore();
  });

  it("[NFR-022] le code Postgres est PRÉSERVÉ pour le journal (un refus RLS reste distinguable d'une panne)", () => {
    // Le dépôt lève une Error dont le message ne porte QUE le code Postgres. Sans extraction, le
    // journaliseur (qui ne lit que `.code`) jetait l'information : tout devenait « panne inconnue ».
    expect(codeJournalisable(new Error("branche.chargerBranches: 42501"))).toBe("42501");
    expect(codeJournalisable({ code: "PGRST116" })).toBe("PGRST116");
  });

  it("[NFR-022 / re-revue] AUCUN texte libre ne peut atteindre le journal, même en queue de message", () => {
    // Le repli d'origine renvoyait la queue du message quelle qu'elle soit. Or Postgres met souvent la
    // VALEUR REJETÉE dans le message d'une violation de CHECK — donc potentiellement un nom de branche
    // (art. 9). On ne journalise plus que ce qui a la FORME d'un code ; sinon, le nom de l'exception seul.
    expect(codeJournalisable(new Error("branche: mon secret le plus intime"))).toBe("Error");
    expect(codeJournalisable(new Error('violates check constraint: "ce que j\'ai compris hier"'))).toBe("Error");
    expect(codeJournalisable(new Error("sans deux-points"))).toBe("Error");
    // …et un vrai code passe toujours (sinon la garde serait un bâillon, pas un filtre).
    expect(codeJournalisable(new Error("depot: 22P02"))).toBe("22P02");
  });
});

describe("POST /api/incident — régression d'affichage signalée par le client (AC2)", () => {
  beforeEach(() => getUser.mockReset());

  function req(body: unknown): Request {
    return new Request("http://local/api/incident", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("401 sans session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await incident(req({ champ: "etat" }))).status).toBe(401);
  });

  it("journalise le TYPE d'anomalie et renvoie ok — jamais d'id/nom en clair", async () => {
    getUser.mockResolvedValue({ data: { user: { id: `u-${Math.random()}` } } });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await incident(req({ champ: "etat", id: "BRANCHE_ID_SECRET" }));
    expect(r.status).toBe(200);
    const dump = spy.mock.calls.map((a) => JSON.stringify(a)).join("\n");
    expect(dump).toContain("etat");
    // [revue 4.6] Le libellé décrit une ANOMALIE D'AFFICHAGE, pas une « indisponibilité de RPC de sécurité »
    // (le message mentait sur la nature de l'événement et noyait les vrais incidents de sûreté).
    expect(dump).toMatch(/régression d'affichage/);
    expect(dump, "l'id de branche ne fuit pas dans le log").not.toContain("BRANCHE_ID_SECRET");
    spy.mockRestore();
  });

  it("« disparition » est un type d'anomalie reconnu (la pire régression : une branche connue s'efface)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: `u-${Math.random()}` } } });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await incident(req({ champ: "disparition" }));
    expect(spy.mock.calls.map((a) => JSON.stringify(a)).join("\n")).toContain("disparition");
    spy.mockRestore();
  });

  it("[re-revue] UNE régression touchant plusieurs branches tient dans UN seul signalement", async () => {
    // Avant : une requête PAR incident. Une régression sur 7 branches partait en 14 requêtes et franchissait
    // le plafond à elle seule — la régression était avalée par son propre bruit, l'inverse du but du plafond.
    getUser.mockResolvedValue({ data: { user: { id: `u-groupe-${Math.random()}` } } });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await incident(req({ champs: ["etat", "intensite", "disparition", "etat"] }));
    expect(r.status).toBe(200);
    expect(spy, "un signalement groupé = UNE ligne de journal").toHaveBeenCalledTimes(1);
    const dump = JSON.stringify(spy.mock.calls);
    for (const c of ["etat", "intensite", "disparition"]) expect(dump).toContain(c);
    // Dédupliqué : « etat » n'apparaît qu'une fois dans la liste rendue.
    expect(spy.mock.calls[0][1]).toEqual({ champs: ["etat", "intensite", "disparition"] });
    spy.mockRestore();
  });

  it("[re-revue] un type inconnu est neutralisé, jamais rendu tel quel (pas d'injection dans le journal)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: `u-inconnu-${Math.random()}` } } });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await incident(req({ champs: ["etat", "MON_NOM_DE_BRANCHE_SECRET"] }));
    const dump = JSON.stringify(spy.mock.calls);
    expect(dump).not.toContain("MON_NOM_DE_BRANCHE_SECRET");
    expect(dump).toContain("inconnu");
    spy.mockRestore();
  });

  it("un client bavard est PLAFONNÉ : le journal partagé (incidents de détresse) ne peut pas être noyé", async () => {
    const id = `u-flood-${Math.random()}`;
    getUser.mockResolvedValue({ data: { user: { id } } });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 40; i++) await incident(req({ champ: "etat" }));
    expect(spy.mock.calls.length, "le nombre de lignes journalisées est borné").toBeLessThanOrEqual(12);
    spy.mockRestore();
  });
});
