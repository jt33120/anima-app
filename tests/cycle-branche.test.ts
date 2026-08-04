import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { transitionner, progresseOuStagne, PAS_FEUILLAISON, type EtatCycle } from "@/lib/domain/cycle-branche";
import { ORDRE_ETAT, type EtatBranche } from "@/lib/scene/projection";

/**
 * Story 4.7 (T2) — la fonction de transition UNIQUE, éprouvée sur l'ENSEMBLE des couples (état, événement).
 * Le domaine est pur : ces gardes tournent sans base. La seule qui touche Postgres est l'équivalence du
 * pas de feuillaison — deux copies d'un même nombre qui divergent, c'est R1-bis appliqué à l'arithmétique.
 */

const ETATS: EtatBranche[] = ["naissance", "feuillaison", "rayonnement"];
const INTENSITES = [0, 0.2, 0.5, 0.8, 1];

describe("[AC1 DUR] la transition ne fait JAMAIS reculer une branche — sur TOUS les couples possibles", () => {
  it("aucun (état, intensité, événement) ne produit un résultat inférieur", () => {
    for (const etat of ETATS) {
      for (const intensite of INTENSITES) {
        // Un état incohérent (rayonnement à 0) reste un cas d'entrée légitime : la fonction ne doit pas
        // s'appuyer sur une cohérence qu'elle n'impose pas elle-même.
        const courant: EtatCycle = { etat, intensite };
        for (const type of ["retour", "declaration"] as const) {
          const r = transitionner(courant, { type });
          if (!r.change) continue;
          expect(
            progresseOuStagne(courant, r.suivant),
            `${etat}/${intensite} + ${type} → ${r.suivant.etat}/${r.suivant.intensite} recule`,
          ).toBe(true);
        }
      }
    }
  });

  it("[MÉTA] le prédicat de non-régression sait dire NON (il n'est pas vrai par construction)", () => {
    expect(progresseOuStagne({ etat: "rayonnement", intensite: 1 }, { etat: "feuillaison", intensite: 1 })).toBe(false);
    expect(progresseOuStagne({ etat: "feuillaison", intensite: 0.8 }, { etat: "feuillaison", intensite: 0.2 })).toBe(
      false,
    );
    expect(progresseOuStagne({ etat: "naissance", intensite: 0 }, { etat: "naissance", intensite: 0 })).toBe(true);
  });
});

describe("[AC3 DUR] un RETOUR ne mène JAMAIS à la pleine lumière, quel qu'en soit le nombre", () => {
  it("cent retours d'affilée laissent la branche en feuillaison", () => {
    let e: EtatCycle = { etat: "naissance", intensite: 0 };
    for (let i = 0; i < 100; i++) {
      const r = transitionner(e, { type: "retour" });
      if (r.change) e = r.suivant;
    }
    expect(e.etat, "la pleine lumière n'est pas au bout d'un compteur, c'est un geste").toBe("feuillaison");
    expect(e.intensite).toBe(1);
  });

  it("le premier retour AMORCE la feuillaison d'un pas exactement (jamais un flip d'enum, FR-028)", () => {
    const r = transitionner({ etat: "naissance", intensite: 0 }, { type: "retour" });
    expect(r.change).toBe(true);
    if (!r.change) return;
    expect(r.suivant.etat).toBe("feuillaison");
    expect(r.suivant.intensite).toBeCloseTo(PAS_FEUILLAISON, 10);
  });

  it("l'intensité plafonne à 1 sans jamais la dépasser", () => {
    const r = transitionner({ etat: "feuillaison", intensite: 0.9 }, { type: "retour" });
    expect(r.change).toBe(true);
    if (!r.change) return;
    expect(r.suivant.intensite).toBe(1);
  });

  it("un retour sur une branche déjà pleine, ou déjà rayonnante, ne change RIEN (et le dit)", () => {
    expect(transitionner({ etat: "feuillaison", intensite: 1 }, { type: "retour" })).toEqual({
      change: false,
      motif: "deja_au_maximum",
    });
    expect(transitionner({ etat: "rayonnement", intensite: 1 }, { type: "retour" })).toEqual({
      change: false,
      motif: "deja_rayonnante",
    });
  });
});

describe("La DÉCLARATION — le seul chemin vers la pleine lumière, idempotent", () => {
  it("depuis la feuillaison comme depuis la naissance (le saut direct est légal)", () => {
    for (const etat of ["naissance", "feuillaison"] as const) {
      const r = transitionner({ etat, intensite: etat === "naissance" ? 0 : 0.6 }, { type: "declaration" });
      expect(r.change, `déclaration depuis ${etat}`).toBe(true);
      if (r.change) expect(r.suivant.etat).toBe("rayonnement");
    }
  });

  it("l'intensité acquise n'est PAS écrasée par la déclaration (rien ne recule, même invisiblement)", () => {
    const r = transitionner({ etat: "feuillaison", intensite: 0.8 }, { type: "declaration" });
    expect(r.change).toBe(true);
    if (r.change) expect(r.suivant.intensite).toBe(0.8);
  });

  it("déclarer DEUX FOIS ne change rien et ne lève pas (un double-tap n'est pas une erreur)", () => {
    expect(transitionner({ etat: "rayonnement", intensite: 1 }, { type: "declaration" })).toEqual({
      change: false,
      motif: "deja_rayonnante",
    });
  });
});

describe("Bornes de domaine : une intensité corrompue ne contamine pas la transition", () => {
  it("NaN / ±Infinity / hors bornes retombent dans [0,1] avant tout calcul", () => {
    for (const sale of [NaN, Infinity, -Infinity, -3, 42]) {
      const r = transitionner({ etat: "feuillaison", intensite: sale }, { type: "retour" });
      if (!r.change) continue;
      expect(Number.isFinite(r.suivant.intensite), `intensite=${sale}`).toBe(true);
      expect(r.suivant.intensite).toBeGreaterThanOrEqual(0);
      expect(r.suivant.intensite).toBeLessThanOrEqual(1);
    }
  });
});

describe("[R1-bis] une seule règle, deux implémentations qui doivent coïncider", () => {
  it("l'ordre monotone du domaine est bien celui de la projection (une seule définition, importée)", () => {
    expect(ORDRE_ETAT.naissance).toBeLessThan(ORDRE_ETAT.feuillaison);
    expect(ORDRE_ETAT.feuillaison).toBeLessThan(ORDRE_ETAT.rayonnement);
    expect(Object.keys(ORDRE_ETAT).sort(), "aucun état fantôme, aucun état manquant").toEqual(
      ["feuillaison", "naissance", "rayonnement"].sort(),
    );
  });

  it("le PAS de feuillaison de la base vaut exactement celui du domaine", async () => {
    // Sans cette garde, l'app annoncerait une progression que la base n'écrit pas (ou l'inverse) : la
    // fiche dirait « ça a bougé » et le rechargement suivant démentirait. C'est R1-bis en arithmétique.
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.rpc("branche_pas_feuillaison");
    expect(error).toBeNull();
    expect(Number(data), "base et domaine doivent avancer du même pas").toBeCloseTo(PAS_FEUILLAISON, 6);
  });
});
