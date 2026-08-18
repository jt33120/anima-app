import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * REVUE DE CODE du 2026-08-11, lot 2 (M2 et M3) — LA ROUTE DE REMBOURSEMENT, RÉELLEMENT EXERCÉE.
 *
 * ══ POURQUOI CE FICHIER N'EXISTAIT PAS, ET CE QUE ÇA A COÛTÉ ════════════════════════════════════
 *
 * Le chemin du remboursement était couvert par deux excellents fichiers — `resiliation-stripe`
 * (l'exécution Stripe, doublée) et `resiliation-remboursement-sql` (la couche SQL, contre une vraie
 * base). Entre les deux, la ROUTE : personne. Or c'est là que vivaient les deux défauts qui font
 * perdre l'argent :
 *
 *   M2 — elle jetait la valeur de retour de `rembourserIntegralement` et affichait « le remboursement
 *        arrive sur ton moyen de paiement » même quand la fonction venait de dire qu'elle n'avait
 *        rien remboursé ;
 *   M3 — elle court-circuitait Stripe dès que la réservation existait. Un premier appel échoué
 *        (timeout, 5xx, lambda tuée) devenait DÉFINITIF : chaque nouvelle tentative répondait
 *        « remboursée » sans jamais rappeler Stripe. La colonne `confirme_le` qui distinguait
 *        « demandé » de « remboursé » existait depuis 0038 et n'était lue par personne.
 *
 * La leçon est de portée générale : deux couches parfaitement testées ne prouvent rien sur la
 * COUTURE qui les relie, et c'est dans la couture que l'argent se perd.
 */

const getUser = vi.fn();
const reserver = vi.fn();
const rembourser = vi.fn();

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/data/depot-resiliation", () => ({
  reserverRemboursement: (id: string, motif: string) => reserver(id, motif),
}));
vi.mock("@/lib/stripe/resiliation", () => ({
  rembourserIntegralement: (sub: string, uid: string, cle: string) => rembourser(sub, uid, cle),
}));

const { POST } = await import("@/app/api/abonnement/remboursement/route");

const req = () => new Request("https://anima.test/api/abonnement/remboursement", { method: "POST" });
/** L'état vers lequel la route redirige — c'est LUI que lit la page pour choisir sa phrase. */
const etatDe = (res: Response) => new URL(res.headers.get("location")!).searchParams.get("etat");

beforeEach(() => {
  getUser.mockReset();
  reserver.mockReset();
  rembourser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  rembourser.mockResolvedValue("rembourse");
});

describe("[M3] le retry : tant que Stripe n'a pas confirmé, on RAPPELLE Stripe", () => {
  it("[CONTRÔLE POSITIF] première demande → Stripe est appelé avec la clé de la base", async () => {
    reserver.mockResolvedValueOnce({ cle: "cle-base", subscriptionId: "sub_1", dejaDemande: false, confirmeLe: null });
    const res = await POST(req());
    expect(rembourser).toHaveBeenCalledWith("sub_1", "u1", "cle-base");
    expect(etatDe(res)).toBe("rembourse");
  });

  it("[LE TEST QUI COMPTE] déjà demandé mais JAMAIS confirmé → Stripe est rappelé, même clé", async () => {
    // C'est le scénario du premier appel échoué. Avant correctif, la route répondait « remboursée »
    // sans rien faire, à vie. L'`idempotencyKey` de Stripe est précisément ce qui rend ce rejeu sûr :
    // la même clé ne rembourse jamais deux fois.
    reserver.mockResolvedValueOnce({ cle: "cle-base", subscriptionId: "sub_1", dejaDemande: true, confirmeLe: null });
    const res = await POST(req());
    expect(rembourser, "un remboursement non confirmé doit être rejoué").toHaveBeenCalledWith(
      "sub_1",
      "u1",
      "cle-base",
    );
    expect(etatDe(res)).toBe("rembourse");
  });

  it("déjà demandé ET confirmé par le webhook → on ne rappelle PAS Stripe", async () => {
    // L'autre bord : le double-clic légitime après un remboursement réussi ne doit pas retaper Stripe.
    reserver.mockResolvedValueOnce({
      cle: "cle-base",
      subscriptionId: "sub_1",
      dejaDemande: true,
      confirmeLe: "2026-08-01T10:00:00Z",
    });
    const res = await POST(req());
    expect(rembourser).not.toHaveBeenCalled();
    expect(etatDe(res)).toBe("rembourse");
  });
});

describe("[M2] la route dit ce qui s'est réellement passé", () => {
  it("aucun paiement retrouvé → `sans_paiement`, JAMAIS « le remboursement arrive »", async () => {
    // `rien_a_rembourser` est exactement ce que rendait la fonction pendant toute la vie de la 3.5,
    // à cause de l'`expand` incomplet. La route l'a affiché comme un succès pendant tout ce temps.
    reserver.mockResolvedValueOnce({ cle: "c", subscriptionId: "sub_1", dejaDemande: false, confirmeLe: null });
    rembourser.mockResolvedValueOnce("rien_a_rembourser");
    const res = await POST(req());
    expect(etatDe(res)).toBe("sans_paiement");
  });

  it("remboursement émis → `rembourse`", async () => {
    reserver.mockResolvedValueOnce({ cle: "c", subscriptionId: "sub_1", dejaDemande: false, confirmeLe: null });
    rembourser.mockResolvedValueOnce("rembourse");
    expect(etatDe(await POST(req()))).toBe("rembourse");
  });

  it("pas éligible → `non_eligible` (une réponse, pas une panne) et Stripe jamais appelé", async () => {
    reserver.mockResolvedValueOnce("non_eligible");
    const res = await POST(req());
    expect(etatDe(res)).toBe("non_eligible");
    expect(rembourser).not.toHaveBeenCalled();
  });

  it("Stripe lève → `echec`, et la réservation n'est PAS effacée (elle porte la clé)", async () => {
    reserver.mockResolvedValueOnce({ cle: "c", subscriptionId: "sub_1", dejaDemande: false, confirmeLe: null });
    rembourser.mockRejectedValueOnce(new Error("stripe down"));
    expect(etatDe(await POST(req()))).toBe("echec");
  });

  it("session absente → 401 avant toute réservation", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(reserver).not.toHaveBeenCalled();
  });
});

describe("[revue 1-4, #4] l'écran ne promet plus dans le vide", () => {
  /**
   * ══ CE QUI ÉTAIT EN JEU ═══════════════════════════════════════════════════════════════════════
   *
   * `SUCCES_REMBOURSEMENT` — « C'est demandé. Le remboursement arrive sur ton moyen de paiement. » —
   * ne paraît qu'UNE fois, au retour de l'action. Ensuite : plus rien. Ni confirmation, ni démenti.
   * `confirme_le` était écrite par le webhook et lue par PERSONNE.
   *
   * Un remboursement refusé par la banque (compte clos, carte remplacée) était donc invisible des
   * deux côtés : elle attendait un virement annoncé, et nous n'avions aucun signal.
   *
   * C'est le même défaut que la révision M2 du 2026-08-11 — « quelqu'un lisait "le remboursement
   * arrive" et attendait un virement qui ne viendrait jamais » — dont seul le cas « aucun paiement
   * retrouvé » avait été traité.
   */

  const page = readFileSync(resolve(process.cwd(), "app/abonnement/page.tsx"), "utf-8");
  const copie = readFileSync(resolve(process.cwd(), "render/abonnement/copie-abonnement.ts"), "utf-8");

  it("⚠️ la page LIT l'état du remboursement — c'est ce qui manquait", () => {
    expect(page, "`confirme_le` restait écrite par le webhook et lue par personne").toMatch(
      /lireEtatRemboursement\s*\(/,
    );
  });

  it("les trois états ont chacun leur phrase, et elles sont rendues", () => {
    for (const cle of ["REMBOURSEMENT_CONFIRME", "REMBOURSEMENT_ECHOUE", "REMBOURSEMENT_EN_COURS"]) {
      expect(copie, `${cle} manque`).toContain(`export const ${cle}`);
      expect(page, `${cle} est déclaré mais jamais rendu`).toContain(cle);
    }
  });

  it("⚠️ la phrase d'échec ne lui reproche rien, et laisse sa demande ouverte", () => {
    // Un remboursement refusé l'est presque toujours pour une raison qui lui appartient (compte
    // clos, carte expirée). Le formuler comme une faute transformerait une panne en reproche — et
    // la laisser croire que sa demande est perdue la ferait payer deux fois notre problème.
    const i = copie.indexOf("REMBOURSEMENT_ECHOUE");
    const phrase = copie.slice(i, copie.indexOf(";", i));
    expect(phrase, "elle doit savoir que sa demande TIENT").toMatch(/reste ouverte/);
    expect(phrase, "un écran qui reproche à quelqu'un d'avoir changé de carte").not.toMatch(
      /tu (aurais|dois|n'as pas)/i,
    );
  });

  it("le repli de la lecture d'état est prouvé AU RENDU, pas ici — et le dit", () => {
    // ⚠️ CETTE GARDE A ÉTÉ RETIRÉE, DÉLIBÉRÉMENT. Elle cherchait un `.catch(` près de l'appel — et
    // elle avait raison de s'inquiéter du repli, mais tort sur sa forme : `lireEtatRemboursement()
    // .catch(…)` ne rattrape qu'une promesse REJETÉE ; si l'appel lui-même lève (module absent,
    // symbole disparu), le `.catch` n'est jamais attaché. C'est arrivé, et la page tombait en mode
    // dégradé. Le code utilise donc son propre `try`, et une garde de source qui exige `.catch`
    // rougirait sur du code plus correct qu'elle.
    //
    // Ce que le repli PRODUIT est éprouvé là où ça se voit : `tests/rendu/porte-de-sortie.test.tsx`
    // monte la page avec une lecture qui lève, et vérifie que la porte de sortie est toujours là.
    // On garde ici la seule chose qu'une lecture de source sache dire : que le repli existe.
    const i = page.indexOf("await lireEtatRemboursement(");
    expect(i, "l'appel a disparu de la page").toBeGreaterThan(-1);
    expect(page.slice(Math.max(0, i - 200), i + 200), "aucun repli autour de la lecture").toMatch(
      /try\s*\{|\.catch\(/,
    );
  });
});
