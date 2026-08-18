import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * effacer-tout-exerce.test.ts — « TOUT EFFACER » INVOQUÉ POUR DE VRAI
 * (revue adversariale du 2026-08-18, R1).
 *
 * ══ POURQUOI UN FICHIER À PART ════════════════════════════════════════════════════════════════
 *
 * `vi.mock` est à portée de FICHIER. Mettre ces moqueries à côté des tests unitaires de
 * `arreterFacturationAvantEffacement` remplaçait la fonction que ces tests-là existent pour
 * éprouver : ils vérifiaient alors le double, pas le code.
 *
 * ══ POURQUOI IL EXISTE ════════════════════════════════════════════════════════════════════════
 *
 * La garde de source du fichier voisin lit le TEXTE : elle prouve que l'appel est écrit, jamais
 * qu'il s'exécute. La campagne de mutation l'a montré en posant
 * `if (false) await arreterFacturationAvantEffacement(…)` — le texte reste, la garde reste verte, et
 * la carte continue d'être débitée. Sur un défaut qui prélève de l'argent à quelqu'un qui a quitté
 * le produit, la lecture de source ne suffit pas.
 */


// ── ET LE COMPORTEMENT DES DEUX CHEMINS, EXERCÉ ────────────────────────────────────────────────
//
// ⚠️ PARCE QU'UNE GARDE DE SOURCE NE VOIT PAS UN `if (false)`. La campagne de mutation a posé
// `if (false) await arreterFacturationAvantEffacement(…)` : le texte reste, la garde reste verte, et
// la facturation court. Sur un défaut qui prélève de l'argent, la lecture de source ne suffit pas.
const arret = vi.fn(async (id: string) => void id);
const effacerTout_ = vi.fn(async () => {});
const redirections: string[] = [];

vi.mock("@/lib/data/arret-facturation", () => ({
  arreterFacturationAvantEffacement: (id: string) => arret(id),
}));
vi.mock("@/lib/data/effacer-donnees", () => ({ effacerToutesSesDonnees: () => effacerTout_() }));
vi.mock("next/navigation", () => ({
  redirect: (c: string) => {
    redirections.push(c);
    throw new Error(`redirect:${c}`);
  },
}));
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
      signOut: async () => ({}),
    },
  }),
}));
vi.mock("@/lib/safety/rpc-repli", () => ({ journaliserIncidentSecurite: () => {} }));

const { effacerTout } = await import("@/app/mes-donnees/actions");

describe("[R1] « Tout effacer » exercé — la facturation s'arrête, ou rien ne s'efface", () => {
  beforeEach(() => {
    arret.mockReset().mockResolvedValue(undefined);
    effacerTout_.mockReset().mockResolvedValue(undefined);
    redirections.length = 0;
  });

  const donnees = () => {
    const f = new FormData();
    f.set("compris", "oui");
    return f;
  };

  it("[LE CŒUR] la facturation est arrêtée, et AVANT l'effacement", async () => {
    const ordre: string[] = [];
    arret.mockImplementation(async () => void ordre.push("arret"));
    effacerTout_.mockImplementation(async () => void ordre.push("efface"));
    await expect(effacerTout(donnees())).rejects.toThrow(/redirect/);
    expect(ordre).toEqual(["arret", "efface"]);
  });

  it("[LE TEST QUI COMPTE] si l'arrêt de facturation échoue, RIEN n'est effacé", async () => {
    arret.mockRejectedValueOnce(new Error("stripe down"));
    await expect(effacerTout(donnees())).rejects.toThrow(/redirect/);
    expect(effacerTout_, "un compte effacé dont la carte reste débitée").not.toHaveBeenCalled();
    expect(redirections.at(-1)).toContain("echec=facturation");
  });

  it("la confirmation manquante n'atteint ni Stripe ni l'effacement", async () => {
    await expect(effacerTout(new FormData())).rejects.toThrow(/redirect/);
    expect(arret).not.toHaveBeenCalled();
    expect(effacerTout_).not.toHaveBeenCalled();
  });
});
