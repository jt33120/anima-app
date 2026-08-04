import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluerRetourThemeDuTour, type DepotCandidatsRetour } from "@/lib/safety/retour-theme-pipeline";
import { classerDetresse } from "@/lib/safety/classer-detresse";
import type { AiPort, MessageIa } from "@/lib/ai/port";

/**
 * Story 4.7 (T3) — l'orchestrateur `evaluerRetourThemeDuTour`, dépendances FAUSSES (le vrai egress art. 9
 * est exercé ; l'adaptateur, le client et le dépôt sont des doublures). Ce qui est prouvé ici :
 *  - [AC6 DUR / AD-17] verdict qui supprime le schéma OU fenêtre détresse active → AUCUN appel fort,
 *    AUCUNE écriture — l'adaptateur n'est même pas interrogé ;
 *  - la présélection décide s'il y a lieu de dépenser un appel : aucun candidat → aucun appel ;
 *  - REPLI SÛR partout (AD-15) : panne de lecture, hang, egress bloqué, échec d'écriture → l'étage
 *    rend un résultat, ne lève jamais. Un tour ne casse pas parce que l'arbre n'a pas poussé.
 *  - l'échec d'UNE branche n'emporte pas les autres.
 */

const MESSAGES: MessageIa[] = [{ role: "user", content: "j'ai encore dit oui à ma mère hier soir" }];
const TOUR = "j'ai encore dit oui à ma mère hier soir";

/** Client JWT factice pour l'egress-guard : consentement OK, non barré. */
const supabaseOk = {
  rpc: async (name: string) => ({ data: name === "a_consenti_art9", error: null }),
} as unknown as SupabaseClient;

function fauxAdaptateur(texte: string) {
  const completer = vi.fn(async () => ({
    texte,
    tier: "fort" as const,
    modele: "factice-test",
    usage: { tokensEntree: 5, tokensSortie: 2 },
  }));
  const adaptateur = { estZdrProuve: () => true, completer, diffuser: async function* () {} } as unknown as AiPort;
  return { adaptateur, completer };
}

function fauxDepot(
  candidats = [
    { id: "b1", nom: "dire non à ma mère", extrait: "je n'arrive jamais à refuser à ma mère" },
    { id: "b2", nom: "changer de métier", extrait: "mon travail ne me ressemble plus" },
  ],
): DepotCandidatsRetour & { chargerCandidats: ReturnType<typeof vi.fn>; progresser: ReturnType<typeof vi.fn> } {
  return {
    chargerCandidats: vi.fn(async () => candidats),
    progresser: vi.fn(async () => true),
  };
}

/** `classerDetresse` prend le NIVEAU produit par le pipeline sécurité, pas un texte : 0 = tour ordinaire.
 *  (Passer une chaîne rendait un verdict de niveau 1 « repli_sûr » — et l'étage se supprimait tout seul.) */
const verdictNeutre = classerDetresse(0);

describe("[AC6 DUR / AD-17] la garde de pipeline : rien n'est évalué ni écrit dans la fenêtre", () => {
  it("fenêtre détresse ACTIVE → aucun appel fort, aucune écriture, aucune lecture de candidats", async () => {
    // Mutation-cible : le `|| (await deps.fenetreDetresseActive())` de la garde.
    const { adaptateur, completer } = fauxAdaptateur("RETOURS: 1");
    const depot = fauxDepot();
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => true },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: TOUR },
    );
    expect(r.supprime).toBe(true);
    expect(r.progressions).toBe(0);
    expect(completer, "aucun appel fort ne doit partir").not.toHaveBeenCalled();
    expect(depot.progresser, "l'arbre ne pousse pas pendant une détresse (FR-046)").not.toHaveBeenCalled();
    expect(depot.chargerCandidats, "on ne lit même pas les branches").not.toHaveBeenCalled();
  });

  it("le repli de lecture de la fenêtre est PROTECTEUR : le doute supprime", async () => {
    // `fenetreDetresseActive` rend `true` sur erreur (repli sûr, patron 4.4). Ici on le simule.
    const { adaptateur, completer } = fauxAdaptateur("RETOURS: 1");
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot: fauxDepot(), fenetreDetresseActive: async () => true },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: TOUR },
    );
    expect(r.supprime).toBe(true);
    expect(completer).not.toHaveBeenCalled();
  });
});

describe("La présélection décide s'il y a lieu de dépenser un appel fort", () => {
  it("aucun candidat apparié → aucun appel, aucun coût", async () => {
    const { adaptateur, completer } = fauxAdaptateur("RETOURS: 1");
    const depot = fauxDepot();
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: "il fait beau" },
    );
    expect(completer, "sans candidat plausible, on ne demande rien au modèle").not.toHaveBeenCalled();
    expect(r.usage).toBeNull();
    expect(r.progressions).toBe(0);
  });

  it("aucune branche du tout (première séance) → aucun appel", async () => {
    const { adaptateur, completer } = fauxAdaptateur("RETOURS: 1");
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot: fauxDepot([]), fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: TOUR },
    );
    expect(completer).not.toHaveBeenCalled();
    expect(r.progressions).toBe(0);
  });
});

describe("Le chemin nominal — et il ne fait progresser QUE ce que le modèle a confirmé", () => {
  it("`RETOURS: 1` fait progresser la PREMIÈRE branche présélectionnée, et elle seule", async () => {
    const { adaptateur } = fauxAdaptateur("RETOURS: 1");
    const depot = fauxDepot();
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "cle-42", tour: TOUR },
    );
    expect(r.progressions).toBe(1);
    expect(depot.progresser).toHaveBeenCalledTimes(1);
    expect(depot.progresser).toHaveBeenCalledWith({ brancheId: "b1", cleTour: "cle-42" });
    expect(r.usage, "le coût fort est métré (produit — FR-043 n'exempte que la détresse)").toMatchObject({
      tier: "fort",
    });
  });

  it("`RETOURS: aucun` → aucune écriture, mais l'usage EST métré (l'appel a bien eu lieu)", async () => {
    const { adaptateur } = fauxAdaptateur("RETOURS: aucun");
    const depot = fauxDepot();
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: TOUR },
    );
    expect(depot.progresser).not.toHaveBeenCalled();
    expect(r.usage).not.toBeNull();
  });

  it("une branche déjà vue ce jour (`progresser` rend false) n'est pas comptée comme une progression", async () => {
    const { adaptateur } = fauxAdaptateur("RETOURS: 1");
    const depot = fauxDepot();
    depot.progresser.mockResolvedValue(false);
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: TOUR },
    );
    expect(depot.progresser).toHaveBeenCalledTimes(1);
    expect(r.progressions, "consigné ≠ progressé : « au fil des semaines », pas au fil des minutes").toBe(0);
  });
});

describe("[AD-15] REPLI SÛR — cet étage ne fait JAMAIS échouer un tour", () => {
  it("une panne de lecture des candidats → aucun appel, aucun jet", async () => {
    const { adaptateur, completer } = fauxAdaptateur("RETOURS: 1");
    const depot = fauxDepot();
    depot.chargerCandidats.mockRejectedValue(new Error("branche.chargerCandidatsRetour: 42501"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: TOUR },
    );
    expect(r.progressions).toBe(0);
    expect(completer).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("un HANG du modèle au-delà du budget → aucune progression, aucun jet", async () => {
    const completer = vi.fn(() => new Promise(() => {})); // ne résout jamais
    const adaptateur = { estZdrProuve: () => true, completer, diffuser: async function* () {} } as unknown as AiPort;
    const depot = fauxDepot();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => false, delaiMs: 30 },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: TOUR },
    );
    expect(r.progressions).toBe(0);
    expect(depot.progresser).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("un échec d'écriture sur UNE branche n'emporte pas les autres", async () => {
    // Le refus d'une branche (effacée entre-temps, fenêtre détresse ouverte pendant le tour) ne doit pas
    // annuler la progression légitime des autres : chaque écriture est indépendante.
    const { adaptateur } = fauxAdaptateur("RETOURS: 1,2");
    const depot = fauxDepot();
    depot.progresser.mockImplementation(async ({ brancheId }: { brancheId: string }) => {
      if (brancheId === "b1") throw new Error("branche.progresserFeuillaison: P0001");
      return true;
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Un tour qui touche les DEUX thèmes, sinon la présélection n'en retiendrait qu'un et le second
    // numéro serait écarté comme hors bornes — le test ne prouverait alors rien sur l'indépendance.
    const r = await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => false },
      {
        messages: MESSAGES,
        verdict: verdictNeutre,
        cleTour: "t1",
        tour: "j'ai encore dit oui à ma mère, et mon travail me pèse",
      },
    );
    expect(depot.progresser).toHaveBeenCalledTimes(2);
    expect(r.progressions, "la branche saine a bien progressé").toBe(1);
    spy.mockRestore();
  });

  it("[NFR-022] un incident d'écriture ne journalise NI le nom NI le verbatim", async () => {
    const { adaptateur } = fauxAdaptateur("RETOURS: 1");
    const depot = fauxDepot();
    depot.progresser.mockRejectedValue(new Error("branche.progresserFeuillaison: P0001"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await evaluerRetourThemeDuTour(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => false },
      { messages: MESSAGES, verdict: verdictNeutre, cleTour: "t1", tour: TOUR },
    );
    const journal = spy.mock.calls.map((a) => JSON.stringify(a)).join("\n");
    expect(journal, "le nom de branche est de l'art. 9").not.toContain("dire non à ma mère");
    expect(journal, "le verbatim aussi").not.toContain("je n'arrive jamais à refuser");
    spy.mockRestore();
  });
});
