import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 4.10 (T3) — l'endpoint `POST /api/anam/plan` et le dépôt. Client Supabase MOCKÉ : on prouve
 * l'auth, le routage vers les RPC possédées, le refus de forme AVANT toute RPC (AC1/AC3), et surtout la
 * distinction REFUS / PANNE. Le comportement base réel (RLS, premium, AD-17) est prouvé dans
 * `intention-sql.test.ts` — ici on prouve le CÂBLAGE, jamais les gardes.
 */

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));

import { POST } from "@/app/api/anam/plan/route";
import { creerDepotIntention } from "@/lib/data/depot-intention";
import { creerDepotArbitrage } from "@/lib/data/depot-arbitrage";

function req(body: unknown): Request {
  return new Request("http://local/api/anam/plan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/** Une échéance TOUJOURS recevable : après-demain (demain est la première date acceptée). */
function apresDemain(): string {
  const d = new Date(Date.now() + 2 * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

/** Les RPC prennent des `uuid` : la route valide la FORME avant d'appeler (revue 4.10). */
const BRANCHE = "11111111-1111-4111-8111-111111111111";
const INTENTION = "22222222-2222-4222-8222-222222222222";

const ETAPE = { declencheur: "si je remets à demain", alors: "je pose une minute maintenant" };

describe("POST /api/anam/plan — auth, routage, forme", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
  });

  it("401 sans session, et AUCUNE RPC n'est tentée", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const r = await POST(req({ action: "ajouter", brancheId: BRANCHE, ...ETAPE }));
    expect(r.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ajouter : route vers `ajouter_intention` avec les deux moitiés et l'échéance", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ data: "id-1", error: null });
    const e = apresDemain();
    const r = await POST(req({ action: "ajouter", brancheId: BRANCHE, ...ETAPE, echeance: e }));
    expect(r.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("ajouter_intention", {
      p_branche: BRANCHE,
      p_declencheur: ETAPE.declencheur,
      p_action: ETAPE.alors,
      p_echeance: e,
    });
  });

  it("[LE CŒUR / AC1] une seule moitié → 400 AVANT toute RPC", async () => {
    // Mutation-cible : retirer l'appel à `intentionRecevable`. La base refuserait quand même (le CHECK),
    // mais l'app aurait laissé partir une requête qui ne peut pas aboutir, et rendu un 500 illisible là
    // où un 400 explicite était dû.
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    for (const corps of [
      { declencheur: "si", alors: "  " },
      { declencheur: " ", alors: "alors" },
      { declencheur: "si", alors: 42 },
      { alors: "alors" },
    ]) {
      const r = await POST(req({ action: "ajouter", brancheId: BRANCHE, ...corps }));
      expect(r.status, JSON.stringify(corps)).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("[AC3] une échéance PASSÉE → 400 (elle ne se déclencherait jamais)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    const r = await POST(req({ action: "ajouter", brancheId: BRANCHE, ...ETAPE, echeance: "2020-01-01" }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ code: "echeance_invalide" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("une intention SANS échéance est légitime (le champ est facultatif)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ data: "id-2", error: null });
    const r = await POST(req({ action: "ajouter", brancheId: BRANCHE, ...ETAPE }));
    expect(r.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("ajouter_intention", expect.objectContaining({ p_echeance: null }));
  });

  it("[LE CŒUR — le zéro-ligne silencieux] réviser sans effet rend 409, jamais 200", async () => {
    // ⚠️ Une UPDATE bloquée par la RLS ne LÈVE RIEN : elle renvoie zéro ligne. Répondre 200 ferait lire
    // « c'est enregistré » à quelqu'un dont rien n'a été enregistré — et le prochain chargement du plan
    // afficherait l'ancienne version sans que personne ne comprenne pourquoi.
    // Mutation-cible : renvoyer `{ ok: true }` sans regarder le booléen.
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ data: false, error: null });
    const r = await POST(req({ action: "reviser", intentionId: INTENTION, ...ETAPE }));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ code: "refuse" });
  });

  it("retirer sans effet rend 409 aussi ; avec effet, 200", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(req({ action: "retirer", intentionId: INTENTION }))).status).toBe(409);
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await POST(req({ action: "retirer", intentionId: INTENTION }))).status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith("retirer_intention", { p_intention: INTENTION });
  });

  it("retirer ne demande NI forme NI échéance (alléger n'est pas écrire)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ data: true, error: null });
    const r = await POST(req({ action: "retirer", intentionId: INTENTION }));
    expect(r.status, "aucun `declencheur` dans le corps, et c'est normal").toBe(200);
  });

  it("identifiants manquants et action inconnue → 400", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    expect((await POST(req({ action: "ajouter", ...ETAPE }))).status, "sans brancheId").toBe(400);
    expect((await POST(req({ action: "reviser", ...ETAPE }))).status, "sans intentionId").toBe(400);
    expect((await POST(req({ action: "retirer" }))).status, "sans intentionId").toBe(400);
    expect((await POST(req({ action: "supprimer_tout" }))).status, "action inventée").toBe(400);
  });

  it("[NFR-022] une panne RPC ne fait REMONTER aucun art. 9 dans la réponse", async () => {
    // Mutation-cible : renvoyer `error.message` au lieu d'un code fermé. Un message Postgres peut
    // contenir la valeur refusée — c'est-à-dire le texte qu'elle vient d'écrire sur sa vie intérieure.
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: `échec sur « ${ETAPE.alors} »` } });
    const r = await POST(req({ action: "ajouter", brancheId: BRANCHE, ...ETAPE }));
    const json = JSON.stringify(await r.json());
    expect(json).not.toContain(ETAPE.declencheur);
    expect(json).not.toContain("je pose une minute");
  });
});

describe("le dépôt : il n'invente pas de succès, et il ne retrie pas", () => {
  beforeEach(() => rpc.mockReset());

  it("[LE CŒUR] il RESPECTE l'ordre de la base — jamais un second tri", async () => {
    // Mutation-cible : ajouter un `.sort((a,b) => a.rang - b.rang)` dans `chargerPlan`. Ça a l'air
    // inoffensif, et c'est la faute exacte corrigée en 0033 : deux ordres, dont l'un ne départage pas les
    // rangs égaux, donc un plan qui « bouge tout seul » entre deux ouvertures. L'ordre total vit dans
    // `charger_plan` et NULLE PART ailleurs.
    // ⚠️ LES RANGS DESCENDENT, ET C'EST VOLONTAIRE. La première version de ce test servait trois lignes
    // de rang ÉGAL — sur quoi un `.sort((a,b) => a.rang - b.rang)` glissé dans le dépôt ne changeait
    // rien (le tri de JS est stable) : le mutant survivait, et la garde ne gardait rien. La campagne de
    // mutation l'a trouvé (survivant n°14). Une base ne servira jamais cet ordre-là ; c'est le point —
    // la seule chose qu'on veut prouver est que le dépôt RECOPIE, quelle que soit la liste reçue.
    rpc.mockResolvedValue({
      data: [
        { id: "c", declencheur: "si 3", action: "alors 3", echeance: null, rang: 2 },
        { id: "a", declencheur: "si 1", action: "alors 1", echeance: null, rang: 0 },
        { id: "b", declencheur: "si 2", action: "alors 2", echeance: null, rang: 1 },
      ],
      error: null,
    });
    const plan = await creerDepotIntention({ rpc } as never).chargerPlan({ brancheId: BRANCHE });
    expect(plan.map((i) => i.id), "l'ordre servi, tel quel").toEqual(["c", "a", "b"]);
    expect(plan.map((i) => i.rang), "ni par rang…").toEqual([2, 0, 1]);
    expect(plan.map((i) => i.declencheur), "…ni par contenu").toEqual(["si 3", "si 1", "si 2"]);
  });

  it("un `ajouter` qui rend un identifiant vide sans lever est un succès FANTÔME : il lève", async () => {
    // Mutation-cible : rendre `data as string` sans contrôle. L'appelant croirait l'étape écrite, la
    // rafraîchirait, et ne la trouverait pas — sans aucune erreur nulle part.
    rpc.mockResolvedValue({ data: "", error: null });
    await expect(creerDepotIntention({ rpc } as never).ajouter({
      brancheId: BRANCHE,
      declencheur: "si",
      action: "alors",
      echeance: null,
    })).rejects.toThrow(/sans_identifiant/);
  });

  it("une erreur Postgres ne porte QUE son code (NFR-022)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "détail avec du verbatim" } });
    await expect(
      creerDepotIntention({ rpc } as never).chargerPlan({ brancheId: BRANCHE }),
    ).rejects.toThrow(/42501/);
    await expect(
      creerDepotIntention({ rpc } as never).chargerPlan({ brancheId: BRANCHE }),
    ).rejects.not.toThrow(/verbatim/);
  });

  it("`reviser`/`retirer` rendent FAUX sur zéro ligne, et ne lèvent pas", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const d = creerDepotIntention({ rpc } as never);
    expect(await d.reviser({ intentionId: INTENTION, declencheur: "si", action: "alors", echeance: null })).toBe(false);
    expect(await d.retirer({ intentionId: INTENTION })).toBe(false);
  });
});

describe("[REVUE 4.10] le dépôt d'arbitrage, EXÉCUTÉ pour de vrai", () => {
  /**
   * ⚠️ `depot-arbitrage.ts` et `depot-canal-courriel.ts` n'étaient JAMAIS exécutés : ils n'apparaissaient
   * dans les tests que comme cibles de `vi.mock`. Le marshaling des noms de colonnes RPC
   * (`branches_en_naissance`, `branche_cible`) et le repli défensif n'étaient vérifiés nulle part — un
   * renommage de colonne dans une migration future aurait cassé la production sans qu'un test rougisse.
   * `depot-intention.ts` suivait pourtant le bon patron (mocker `{rpc}`, tester le VRAI dépôt) ; il n'avait
   * pas été appliqué ici.
   */
  beforeEach(() => rpc.mockReset());

  it("[LE CŒUR] il lit les colonnes que la RPC rend RÉELLEMENT", async () => {
    // Mutation-cible : renommer `branches_en_naissance` en `nb` dans le dépôt (ou dans la migration).
    rpc.mockResolvedValue({ data: [{ branches_en_naissance: 4, branche_cible: "b-vieille" }], error: null });
    const f = await creerDepotArbitrage({ rpc } as never).faits();
    expect(f).toEqual({ branchesEnNaissance: 4, brancheCibleId: "b-vieille" });
    expect(rpc).toHaveBeenCalledWith("faits_arbitrage_ouverture");
  });

  it("un compte illisible retombe sur ZÉRO — le doute ne fait pas parler Anam", async () => {
    for (const brut of [null, undefined, "abc", -3, Number.NaN]) {
      rpc.mockResolvedValue({ data: [{ branches_en_naissance: brut, branche_cible: null }], error: null });
      const f = await creerDepotArbitrage({ rpc } as never).faits();
      expect(f.branchesEnNaissance, JSON.stringify(brut)).toBe(0);
      expect(f.brancheCibleId).toBeNull();
    }
  });

  it("une PANNE lève (elle ne se déguise pas en « zéro branche »)", async () => {
    // Rendre 0 sur une panne ferait taire l'arbitrage sans le dire — et l'appelant ne pourrait plus
    // distinguer « elle n'a pas trop de branches » de « je n'ai pas pu compter ».
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(creerDepotArbitrage({ rpc } as never).faits()).rejects.toThrow(/42501/);
  });

  it("la réservation de parole ne dit OUI que sur un `true` franc", async () => {
    // Mutation-cible : `return data` au lieu de `data === true`. Une valeur truthy inattendue ferait
    // parler Anam et consommerait sa fenêtre de sept jours.
    const d = creerDepotArbitrage({ rpc } as never);
    for (const brut of [null, undefined, 1, "true", {}]) {
      rpc.mockResolvedValue({ data: brut, error: null });
      expect(await d.reserverParole(168), JSON.stringify(brut)).toBe(false);
    }
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await d.reserverParole(168)).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("reserver_invitation_integration", { p_fenetre_heures: 168 });
  });
});
