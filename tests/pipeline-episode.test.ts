import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, NiveauSecurite, ReponseIa } from "@/lib/ai/port";
import { evaluerSecuriteDuTour, type DepotEpisode } from "@/lib/safety/pipeline";

/**
 * Story 2.4 (T6) — le pipeline branche l'épisode CROSS-TOUR. Les deux points de fond :
 *   1. `enregistrerTour` est appelé à CHAQUE tour (même niveau 0), avec le niveau DÉTECTÉ BRUT
 *      (jamais l'effectif forcé) — sinon un épisode ouvert ne s'éteint jamais (paywall à vie).
 *   2. `ResultatSecurite` porte désormais `limitesLevees`, plombé depuis le retour du dépôt.
 */

function supabaseFactice(): SupabaseClient {
  return {
    rpc: async (nom: string) => {
      if (nom === "a_consenti_art9") return { data: true, error: null };
      if (nom === "est_barre_minorite") return { data: false, error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
}

function adaptateur(texte: string): AiPort {
  return {
    estZdrProuve: () => true,
    completer: async (): Promise<ReponseIa> => ({ texte, tier: "fort", modele: "factice", usage: { tokensEntree: 0, tokensSortie: 0 } }),
    diffuser: async function* () {},
  };
}

const messages = [{ role: "user" as const, content: "coucou" }];

/**
 * `plancher` = le niveau ATTEINT par l'épisode ouvert, 0 s'il n'y en a pas (revue Epics 1-4 : ce
 * paramètre était un booléen, et le forçage valait donc TOUJOURS 1 — voir le dernier bloc du fichier).
 */
function depot(plancher: NiveauSecurite, limitesApres: boolean) {
  const enregistrerTour = vi.fn(async () => ({ limitesLevees: limitesApres }));
  const d: DepotEpisode = { plancherEpisode: async () => plancher, enregistrerTour };
  return { d, enregistrerTour };
}

async function evaluer(texte: string, plancher: NiveauSecurite, limitesApres: boolean) {
  const { d, enregistrerTour } = depot(plancher, limitesApres);
  const r = await evaluerSecuriteDuTour(
    { supabase: supabaseFactice(), adaptateur: adaptateur(texte), depotEpisode: d, emettreAudit: async () => {} },
    messages,
  );
  return { r, enregistrerTour };
}

describe("pipeline — enregistrerTour à chaque tour, niveau BRUT (piège central 2.4)", () => {
  it("niveau 0 sans épisode : enregistrerTour(0) appelé quand même (compter/rien), limitesLevees=false", async () => {
    const { r, enregistrerTour } = await evaluer("NIVEAU: 0", 0, false);
    expect(enregistrerTour).toHaveBeenCalledWith(0);
    expect(r.bloque).toBe(false);
    if (!r.bloque) expect(r.limitesLevees).toBe(false);
  });

  it("niveau 2 : enregistrerTour(2) appelé, limitesLevees=true (épisode ouvert par ce tour)", async () => {
    const { r, enregistrerTour } = await evaluer("NIVEAU: 2", 0, true);
    expect(enregistrerTour).toHaveBeenCalledWith(2);
    if (!r.bloque) expect(r.limitesLevees).toBe(true);
  });

  it("ÉPISODE OUVERT + détecté 0 : enregistrerTour reçoit le BRUT 0 (PAS l'effectif 1) — sinon inextinguible", async () => {
    const { r, enregistrerTour } = await evaluer("NIVEAU: 0", 1, true);
    // Le forçage donne un verdict effectif 1 (réponse au fort)…
    if (!r.bloque) expect(r.verdict.niveau).toBe(1);
    // …mais le comptage d'extinction voit le niveau DÉTECTÉ brut 0.
    expect(enregistrerTour).toHaveBeenCalledWith(0);
    expect(enregistrerTour).not.toHaveBeenCalledWith(1);
  });

  it("dernier tour d'un épisode qui s'éteint : verdict encore forcé (1) mais limitesLevees=false (retombées)", async () => {
    // Épisode ouvert au début du tour (force 1), mais enregistrerTour(0) l'éteint → limites retombées.
    const { r } = await evaluer("NIVEAU: 0", 1, false);
    if (!r.bloque) {
      expect(r.verdict.niveau).toBe(1);
      expect(r.limitesLevees).toBe(false);
    }
  });

  it("repli sûr (sortie illisible) : enregistrerTour reçoit le niveau de repli (1), l'épisode s'ouvre/persiste", async () => {
    const { r, enregistrerTour } = await evaluer("blabla illisible", 0, true);
    if (!r.bloque) expect(r.verdict.decision).toBe("repli_sur");
    expect(enregistrerTour).toHaveBeenCalledWith(1); // repli = niveau 1
  });

  it("blocage d'egress : enregistrerTour PAS appelé (rien classé)", async () => {
    const supa = {
      rpc: async (nom: string) => (nom === "a_consenti_art9" ? { data: false, error: null } : { data: false, error: null }),
    } as unknown as SupabaseClient;
    const { d, enregistrerTour } = depot(0, false);
    const r = await evaluerSecuriteDuTour(
      { supabase: supa, adaptateur: adaptateur("NIVEAU: 3"), depotEpisode: d, emettreAudit: async () => {} },
      messages,
    );
    expect(r.bloque).toBe(true);
    expect(enregistrerTour).not.toHaveBeenCalled();
  });
});

describe("[revue 1-4] le plancher d'épisode est le niveau ATTEINT, pas 1", () => {
  it("⚠️ épisode monté à 3 + fournisseur dégradé (repli → 1) : le tour vaut encore 3", async () => {
    // LE DÉFAUT, TEL QU'IL SE PRODUISAIT. Une femme classée « idéation active » au tour N ; au tour
    // N+1 la sortie du modèle est illisible, `repliSur()` rend 1. Avec l'ancien plancher booléen, le
    // niveau effectif retombait à 1 — et `blocRessourcesDetresse` ne rend rien sous 2. L'écran
    // cessait de porter le moindre numéro d'urgence, alors que l'épisode était toujours ouvert.
    const { r } = await evaluer("blabla illisible", 3, true);
    expect(r.bloque).toBe(false);
    if (!r.bloque) expect(r.verdict.niveau, "le filet a quitté l'écran pendant l'épisode").toBe(3);
  });

  it("le comptage d'extinction voit toujours le niveau DÉTECTÉ brut, jamais le plancher", async () => {
    // La règle de la 2.4 tient telle quelle : compter l'effectif rendrait l'épisode inextinguible.
    const { enregistrerTour } = await evaluer("NIVEAU: 0", 3, true);
    expect(enregistrerTour).toHaveBeenCalledWith(0);
    expect(enregistrerTour).not.toHaveBeenCalledWith(3);
  });

  it("et un tour détecté PLUS HAUT que le plancher garde son niveau détecté", async () => {
    // `max()`, pas « le plancher gagne » : un épisode monté à 2 ne plafonne pas une idéation active.
    const { r } = await evaluer("NIVEAU: 3", 2, true);
    if (!r.bloque) expect(r.verdict.niveau).toBe(3);
  });

  it("aucun épisode ouvert : le plancher 0 ne force rien (le tour vaut ce qu'il vaut)", async () => {
    const { r } = await evaluer("NIVEAU: 0", 0, false);
    if (!r.bloque) expect(r.verdict.niveau).toBe(0);
  });
});
