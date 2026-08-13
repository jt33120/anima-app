import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluerHypotheseEnneagramme,
  type DepotHypothese,
} from "@/lib/safety/hypothese-enneagramme-pipeline";
import { classerDetresse } from "@/lib/safety/classer-detresse";
import type { AiPort, MessageIa } from "@/lib/ai/port";

/**
 * hypothese-enneagramme-pipeline.test.ts — L'ÉTAGE QUI SÈME LE GERME (Story 5.5, T7).
 *
 * Dépendances FAUSSES, sauf l'egress art. 9 qui est le vrai. Ce qui est prouvé ici :
 *  - [AD-17] verdict qui supprime le schéma OU fenêtre détresse active → AUCUN appel fort, AUCUNE
 *    écriture — l'adaptateur n'est même pas interrogé, et le dépôt non plus ;
 *  - `momentDeProposer` décide s'il y a lieu de dépenser : elle a déjà un type, ou Anam a déjà
 *    proposé → rien ne part ;
 *  - le PARSER commande l'écriture : `aucun` ou une ligne bavarde → aucun germe, mais l'usage EST
 *    métré (l'appel a bien coûté) ;
 *  - REPLI SÛR partout (AD-15) : panne de lecture, hang, egress bloqué, refus d'écriture → l'étage
 *    rend un résultat, ne lève jamais. Un tour ne casse pas parce qu'Anam n'a rien proposé.
 */

const MESSAGES: MessageIa[] = [{ role: "user", content: "je dis oui, puis je m'en veux" }];

/** Client JWT factice pour l'egress-guard : consentement OK, non barré. */
const supabaseOk = {
  rpc: async (name: string) => ({ data: name === "a_consenti_art9", error: null }),
} as unknown as SupabaseClient;

function fauxAdaptateur(texte: string) {
  const completer = vi.fn(async () => ({
    texte,
    tier: "fort" as const,
    modele: "factice-test",
    usage: { tokensEntree: 9, tokensSortie: 3 },
  }));
  const adaptateur = { estZdrProuve: () => true, completer, diffuser: async function* () {} } as unknown as AiPort;
  return { adaptateur, completer };
}

function fauxDepot(
  faits = { aUnType: false, aDejaEteProposee: false },
): DepotHypothese & { faits: ReturnType<typeof vi.fn>; semer: ReturnType<typeof vi.fn> } {
  return {
    faits: vi.fn(async () => faits),
    semer: vi.fn(async () => "germe-1"),
  };
}

const verdictNeutre = classerDetresse(0);
const jamaisEnDetresse = async () => false;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AD-17 — la garde de pipeline
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC4 DUR / AD-17] proposer une typologie en détresse : jamais", () => {
  it("fenêtre détresse ACTIVE → aucun appel fort, aucune lecture, aucune écriture", async () => {
    // Mutation-cible : le `|| (await deps.fenetreDetresseActive())` de la garde. Le germe serait de
    // toute façon refusé par la policy de 0049 — mais l'appel FORT, lui, serait dépensé. Les deux
    // défenses ont donc des signatures différentes, et deux tests distincts.
    const { adaptateur, completer } = fauxAdaptateur("TYPE_HYPOTHESE: 4");
    const depot = fauxDepot();
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: async () => true },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(r).toEqual({ supprime: true, germeId: null, usage: null });
    expect(completer, "aucun appel fort ne doit partir").not.toHaveBeenCalled();
    expect(depot.semer, "aucun germe pendant un épisode (FR-037)").not.toHaveBeenCalled();
    expect(depot.faits, "on ne lit même pas les faits").not.toHaveBeenCalled();
  });

  it("un verdict qui SUPPRIME le travail de schéma suffit SEUL à tout arrêter", async () => {
    // Fenêtre INACTIVE, mais verdict de détresse : la première moitié de la garde doit mordre toute
    // seule. Sans ce contrôle, le test ci-dessus serait satisfait par une garde à une seule branche.
    const { adaptateur, completer } = fauxAdaptateur("TYPE_HYPOTHESE: 4");
    const depot = fauxDepot();
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: classerDetresse(2) },
    );
    expect(r.supprime).toBe(true);
    expect(completer).not.toHaveBeenCalled();
    expect(depot.semer).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le moment — le gate de coût ET de produit
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC2] Anam ne propose qu'une fois", () => {
  it("elle a déjà un type → aucun appel fort", async () => {
    const { adaptateur, completer } = fauxAdaptateur("TYPE_HYPOTHESE: 4");
    const depot = fauxDepot({ aUnType: true, aDejaEteProposee: false });
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(r).toEqual({ supprime: true, germeId: null, usage: null });
    expect(completer).not.toHaveBeenCalled();
  });

  it("[LE CŒUR] elle a déjà REFUSÉ une hypothèse → aucun appel fort, jamais", async () => {
    const { adaptateur, completer } = fauxAdaptateur("TYPE_HYPOTHESE: 7");
    const depot = fauxDepot({ aUnType: false, aDejaEteProposee: true });
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(r.supprime).toBe(true);
    expect(completer, "reproposer après un refus est le message récurrent que FR-034 interdit").not.toHaveBeenCalled();
    expect(depot.semer).not.toHaveBeenCalled();
  });

  it("une PANNE de lecture des faits fait SE TAIRE — jamais proposer dans le doute", async () => {
    const { adaptateur, completer } = fauxAdaptateur("TYPE_HYPOTHESE: 4");
    const depot = fauxDepot();
    depot.faits.mockRejectedValueOnce(new Error("42501"));
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(r).toEqual({ supprime: true, germeId: null, usage: null });
    expect(completer).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le chemin nominal, et ce que le parser commande
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC2] du numéro au germe", () => {
  it("[CONTRÔLE DU CONTRÔLE] le chemin nominal SÈME — sinon tous les tests d'absence sont vrais", async () => {
    const { adaptateur, completer } = fauxAdaptateur("TYPE_HYPOTHESE: 4");
    const depot = fauxDepot();
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(completer).toHaveBeenCalledTimes(1);
    expect(depot.semer).toHaveBeenCalledWith({ type: 4 });
    expect(r.germeId).toBe("germe-1");
    expect(r.usage).toEqual({ tier: "fort", modele: "factice-test", tokensEntree: 9, tokensSortie: 3 });
  });

  it("la requête part au tier FORT et sous egress art. 9", async () => {
    const { adaptateur, completer } = fauxAdaptateur("TYPE_HYPOTHESE: 2");
    await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot: fauxDepot(), fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    const requete = (completer.mock.calls as unknown as [{ capacite: string; contientArt9: boolean }][])[0][0];
    expect(requete.capacite).toBe("hypothese_enneagramme");
    expect(requete.contientArt9).toBe(true);
  });

  it("`aucun` → AUCUN germe, mais l'usage est métré (l'appel a coûté)", async () => {
    const { adaptateur } = fauxAdaptateur("TYPE_HYPOTHESE: aucun");
    const depot = fauxDepot();
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(depot.semer).not.toHaveBeenCalled();
    expect(r.germeId).toBeNull();
    // FR-043 n'exempte QUE la détresse : un appel qui n'a rien produit se compte quand même.
    expect(r.usage).not.toBeNull();
  });

  it("[LE TEST QUI COMPTE] une ligne BAVARDE ne sème rien", async () => {
    // « TYPE_HYPOTHESE: aucun, mais si je devais choisir, ce serait plutôt le 4. » Un parser
    // tolérant écrirait un germe « type 4 » à partir d'une réponse qui disait NON. Invisible : cet
    // étage tourne dans `after()`, et personne ne relit la sortie.
    const { adaptateur } = fauxAdaptateur("TYPE_HYPOTHESE: aucun, mais ce serait plutôt le 4.");
    const depot = fauxDepot();
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(depot.semer).not.toHaveBeenCalled();
    expect(r.germeId).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Repli sûr — l'étage ne fait JAMAIS échouer un tour
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AD-15] rien ici ne casse un tour", () => {
  it("un HANG du modèle est borné, et rend un résultat", async () => {
    const jamais = { estZdrProuve: () => true, completer: () => new Promise(() => {}), diffuser: async function* () {} };
    const depot = fauxDepot();
    const r = await evaluerHypotheseEnneagramme(
      {
        supabase: supabaseOk,
        adaptateur: jamais as unknown as AiPort,
        depot,
        fenetreDetresseActive: jamaisEnDetresse,
        delaiMs: 20,
      },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(r).toEqual({ supprime: false, germeId: null, usage: null });
    expect(depot.semer).not.toHaveBeenCalled();
  });

  it("un egress BLOQUÉ (consentement absent) ne sème rien et ne lève pas", async () => {
    const sansConsentement = { rpc: async () => ({ data: false, error: null }) } as unknown as SupabaseClient;
    const { adaptateur, completer } = fauxAdaptateur("TYPE_HYPOTHESE: 4");
    const depot = fauxDepot();
    const r = await evaluerHypotheseEnneagramme(
      { supabase: sansConsentement, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(r.germeId).toBeNull();
    expect(completer, "l'egress-guard bloque AVANT le premier octet (AD-13)").not.toHaveBeenCalled();
    expect(depot.semer).not.toHaveBeenCalled();
  });

  it("un REFUS d'écriture (`null`) est un état normal, pas une exception", async () => {
    const { adaptateur } = fauxAdaptateur("TYPE_HYPOTHESE: 4");
    const depot = fauxDepot();
    depot.semer.mockResolvedValueOnce(null);
    const r = await evaluerHypotheseEnneagramme(
      { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
      { messages: MESSAGES, verdict: verdictNeutre },
    );
    expect(r.germeId).toBeNull();
    expect(r.usage).not.toBeNull();
  });

  it("une EXCEPTION d'écriture est avalée et journalisée", async () => {
    const { adaptateur } = fauxAdaptateur("TYPE_HYPOTHESE: 4");
    const depot = fauxDepot();
    depot.semer.mockRejectedValueOnce(new Error("panne"));
    await expect(
      evaluerHypotheseEnneagramme(
        { supabase: supabaseOk, adaptateur, depot, fenetreDetresseActive: jamaisEnDetresse },
        { messages: MESSAGES, verdict: verdictNeutre },
      ),
    ).resolves.toEqual({ supprime: false, germeId: null, usage: expect.any(Object) });
  });
});
