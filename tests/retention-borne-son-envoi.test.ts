import { describe, it, expect, vi } from "vitest";
import {
  executerRetention,
  RESERVE_RETENTION_MS,
  DELAI_AVIS_MS,
  DELAI_JOB_RETENTION_MS,
} from "@/lib/ordonnanceur/jobs/retention";
import { DELAI_ENVOI_MS, RESERVE_ENVOI_MS } from "@/lib/ordonnanceur/jobs/rappel-echeance";

/**
 * retention-borne-son-envoi.test.ts — R4 (revue adversariale du 2026-08-18)
 *
 * ══ UNE RÉSERVE PLUS COURTE QUE CE QU'ELLE PROTÈGE ════════════════════════════════════════════
 *
 * `RESERVE_RETENTION_MS` valait 2 400 ms — « de quoi tenter AU MOINS une personne ». Une personne,
 * dans la phase 2, c'est `annoncer()` PUIS `poserEcheance()`. Or `annoncer()` n'était borné nulle
 * part dans ce job : la seule limite était celle de l'adaptateur Resend, à 10 000 ms — quatre fois
 * la réserve censée la couvrir.
 *
 * Le job pouvait donc entrer dans une itération avec 2,5 s de budget, appeler un envoi qui prend
 * dix secondes, et se faire couper ENTRE l'envoi et la pose de l'échéance. L'avis part
 * (« ton compte sera supprimé »), aucune échéance n'est posée, et rien ne le dit.
 *
 * ⚠️ LE JOB JUMEAU AVAIT DÉJÀ RAISON. `rappel-echeance` borne son envoi à `DELAI_ENVOI_MS` et en
 * DÉRIVE sa réserve : `RESERVE_ENVOI_MS = DELAI_ENVOI_MS + 1 500`. Le correctif ne pose donc aucun
 * mécanisme neuf : il applique au moteur de rétention ce que son voisin fait depuis la 4.10.
 */

const ctxAvec = (msRestants: number) => ({
  echeance: new Date(Date.now() + msRestants),
  nom: "retention",
});

function depot(overrides: Record<string, unknown> = {}) {
  return {
    comptesAEffacer: vi.fn(async () => []),
    comptesAPrevenir: vi.fn(async () => ["u1"]),
    trancher: vi.fn(async () => "efface"),
    poserEcheance: vi.fn(async () => undefined),
    purgerJournal: vi.fn(async () => 0),
    ...overrides,
  };
}

describe("[R4] la réserve couvre réellement ce qu'elle protège", () => {
  it("[LE CŒUR] la borne d'envoi tient DANS la réserve, avec de quoi poser l'échéance", () => {
    // C'est l'invariant, et il ne se lit nulle part ailleurs : la réserve doit couvrir l'envoi ET
    // l'écriture qui le suit. Une réserve plus courte que son envoi ne réserve rien.
    expect(
      DELAI_AVIS_MS,
      "l'envoi peut déborder la réserve : le job serait coupé entre l'avis et l'échéance",
    ).toBeLessThan(RESERVE_RETENTION_MS);
    expect(
      RESERVE_RETENTION_MS - DELAI_AVIS_MS,
      "il ne reste pas de quoi poser l'échéance après l'envoi",
    ).toBeGreaterThanOrEqual(1_000);
  });

  it("le job garde de quoi tenter AU MOINS une personne", () => {
    expect(DELAI_JOB_RETENTION_MS).toBeGreaterThanOrEqual(RESERVE_RETENTION_MS);
  });

  it("[LE PATRON] la même relation que le job jumeau, qui l'avait déjà écrite", () => {
    expect(RESERVE_ENVOI_MS).toBe(DELAI_ENVOI_MS + 1_500);
    expect(RESERVE_RETENTION_MS).toBe(DELAI_AVIS_MS + 1_500);
  });
});

describe("[R4] un envoi qui traîne est COUPÉ, et ne laisse pas de compte à moitié prévenu", () => {
  it("[LE CŒUR] un `annoncer` interminable n'emporte pas le job — et rien n'est écrit", async () => {
    // ⚠️ SANS BORNE, CE TEST NE FINIT PAS. C'est la mesure : la promesse ci-dessous ne résout
    // jamais, et seul `avecDelai` peut rendre la main.
    const d = depot();
    const jamais = () => new Promise<boolean>(() => {});
    await executerRetention(ctxAvec(DELAI_JOB_RETENTION_MS) as never, {
      depot: d as never,
      annoncer: jamais,
    });
    expect(
      d.poserEcheance,
      "une échéance a été posée alors que l'avis n'est jamais parti",
    ).not.toHaveBeenCalled();
  }, 15_000);

  it("[CONTRÔLE POSITIF] un envoi normal pose bien l'échéance", async () => {
    // Sans lui, un `avecDelai(…, 0)` qui couperait TOUT passerait le test ci-dessus.
    const d = depot();
    await executerRetention(ctxAvec(DELAI_JOB_RETENTION_MS) as never, {
      depot: d as never,
      annoncer: async () => true,
    });
    expect(d.poserEcheance).toHaveBeenCalledWith("u1", expect.any(Number));
  });

  it("un envoi qui rend `false` ne pose rien non plus — la règle d'origine tient", async () => {
    const d = depot();
    await executerRetention(ctxAvec(DELAI_JOB_RETENTION_MS) as never, {
      depot: d as never,
      annoncer: async () => false,
    });
    expect(d.poserEcheance).not.toHaveBeenCalled();
  });

  it("[LA SUITE N'EST PAS PERDUE] la personne suivante est servie après un envoi coupé", async () => {
    // Un compte qui traîne ne doit pas emporter le lot : les autres attendent leur avis depuis
    // trois mois, et rien ne les rattrape ailleurs.
    const d = depot({ comptesAPrevenir: vi.fn(async () => ["lente", "suivante"]) });
    let appels = 0;
    await executerRetention(ctxAvec(DELAI_JOB_RETENTION_MS) as never, {
      depot: d as never,
      annoncer: async (id: string) => {
        appels += 1;
        if (id === "lente") return new Promise<boolean>(() => {});
        return true;
      },
    });
    expect(appels, "la seconde personne n'a jamais été tentée").toBe(2);
    expect(d.poserEcheance).toHaveBeenCalledWith("suivante", expect.any(Number));
  }, 20_000);
});
