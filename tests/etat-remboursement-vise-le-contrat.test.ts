import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * etat-remboursement-vise-le-contrat.test.ts
 * (revue adversariale du 2026-08-18, R3 · migration 0075).
 *
 * ══ CE QUE `lireEtatRemboursement` AFFICHAIT ══════════════════════════════════════════════════
 *
 * Elle lisait `remboursement` par la seule RLS propriétaire, en `.maybeSingle()`. Tant qu'il n'y
 * avait qu'une ligne par compte, ça désignait la bonne. Depuis que la garantie s'exerce par
 * CONTRAT, deux choses cassent en même temps :
 *
 *   • un `.maybeSingle()` sur deux lignes ne rend pas une ligne, il rend une ERREUR — donc la ligne
 *     d'état de la page disparaît en silence (l'appelant replie sur `null`) ;
 *   • et même à une seule ligne, celle d'un contrat CLOS faisait afficher, en permanence, « Ton
 *     remboursement est parti sur ton moyen de paiement » — à propos d'une souscription qui n'existe
 *     plus, à quelqu'un qui vient d'en payer une autre.
 *
 * ══ POURQUOI CE FICHIER MESURE LA REQUÊTE, ET PAS SEULEMENT LE RÉSULTAT ═══════════════════════
 *
 * Le rendu prouve que la page PASSE le contrat courant (`tests/rendu/porte-de-sortie.test.tsx`).
 * Il ne peut rien dire de ce que le dépôt en FAIT : un paramètre reçu et jeté passerait ce test-là
 * sans broncher. Ici on observe le filtre réellement posé sur PostgREST.
 */

const eq = vi.fn();
const is = vi.fn();
const maybeSingle = vi.fn();
const select = vi.fn();

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: () => ({ select }) }),
}));

const { lireEtatRemboursement } = await import("@/lib/data/depot-resiliation");

beforeEach(() => {
  eq.mockReset();
  is.mockReset();
  select.mockReset();
  maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  const filtres = { eq, is };
  eq.mockReturnValue({ maybeSingle });
  is.mockReturnValue({ maybeSingle });
  select.mockReturnValue(filtres);
});

describe("[R3] la lecture d'état est BORNÉE au contrat courant", () => {
  it("[LE CŒUR] un contrat courant : le filtre porte SA souscription", async () => {
    await lireEtatRemboursement("sub_neuf");
    expect(eq, "aucun filtre de contrat : l'état d'un ancien remboursement s'affiche").toHaveBeenCalledWith(
      "stripe_subscription_id",
      "sub_neuf",
    );
    expect(is).not.toHaveBeenCalled();
  });

  it("aucun contrat : on lit la ligne SANS souscription (chemin minorité, FR-071)", async () => {
    // Un compte détecté mineur qui n'a jamais payé porte bien une ligne de remboursement, à
    // `stripe_subscription_id` nul. `.eq(..., null)` ne la trouverait PAS — PostgREST traduit
    // l'égalité, et `col = null` est NULL en SQL. Il faut `is`.
    await lireEtatRemboursement(null);
    expect(is).toHaveBeenCalledWith("stripe_subscription_id", null);
    expect(eq, "un `.eq(col, null)` ne trouve jamais rien").not.toHaveBeenCalled();
  });

  it("les deux colonnes d'état sont demandées — sinon l'écran ne peut rien distinguer", async () => {
    await lireEtatRemboursement("sub_1");
    expect(select).toHaveBeenCalledWith("confirme_le, echec_le");
  });

  it("[LE REPLI] `confirme_le` domine `echec_le` — l'argent rendu est un fait", async () => {
    maybeSingle.mockResolvedValue({
      data: { confirme_le: "2027-06-01T00:00:00Z", echec_le: "2027-05-01T00:00:00Z" },
      error: null,
    });
    expect(await lireEtatRemboursement("sub_1")).toBe("confirme");
  });

  it("une panne LÈVE — l'appelant retire la ligne, jamais la page", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    await expect(lireEtatRemboursement("sub_1")).rejects.toThrow(/remboursement/i);
  });

  it("aucune ligne : `null`, et surtout pas une promesse", async () => {
    expect(await lireEtatRemboursement("sub_1")).toBeNull();
  });
});
