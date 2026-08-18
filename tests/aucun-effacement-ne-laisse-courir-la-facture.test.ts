import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { sansCommentaires } from "./_absence";

/**
 * aucun-effacement-ne-laisse-courir-la-facture.test.ts
 * (revue adversariale du 2026-08-18, R1 · RGPD art. 17 · FR-060)
 *
 * ══ LE MÊME DÉFAUT, DEUX FOIS, À DEUX EPICS D'ÉCART ═══════════════════════════════════════════
 *
 * La revue du 2026-08-11 (M7) l'avait trouvé sur le chemin de RÉVOCATION, et le correctif porte
 * encore sa phrase dans `app/(auth)/consentement/actions.ts` :
 *
 *     « C'est le seul défaut de la revue qui prélève de l'argent à quelqu'un
 *       qui a explicitement quitté le produit. »
 *
 * L'Epic 6 a ensuite écrit un SECOND chemin d'effacement — « Tout effacer », sur `/mes-donnees` —
 * et la garde n'a pas suivi. C'est celui qu'emprunte une utilisatrice installée : elle a un
 * abonnement, elle s'en va, la cascade efface `abonnement` en base et ne dit rien à Stripe.
 *
 * Ce qui se passe alors : la souscription reste `active`, `cancel_at_period_end = false`. À
 * l'échéance, 69 € sont prélevés sur la carte de quelqu'un qui n'a plus de compte. Et rien ne peut
 * le signaler — `reserver_information_reconduction` rend `false` sur compte absent (0044), donc le
 * courriel de l'art. L215-1 ne part pas ; `traiter_evenement_abonnement` rend `compte_absent`, donc
 * aucune projection. Plus de compte, plus de `/abonnement`, plus de session : le seul recours est
 * une opposition bancaire.
 *
 * ══ POURQUOI CE FICHIER GARDE LA FAMILLE, ET PAS LES DEUX FICHIERS ════════════════════════════
 *
 * Nommer les deux chemins connus refermerait le cas d'hier. Le défaut, lui, est que la garde vit
 * RECOPIÉE dans l'appelant : le troisième chemin d'effacement l'oubliera comme le deuxième l'a
 * oubliée. La garde ci-dessous est donc structurelle — TOUT module qui sait effacer un compte doit
 * passer par `arreterFacturationAvantEffacement`, et c'est ELLE qui parle à Stripe.
 */

const RACINE = process.cwd();
const lire = (p: string) => sansCommentaires(readFileSync(resolve(RACINE, p), "utf-8"));

/** Tout le code applicatif — on ne suppose pas où vivra le prochain chemin d'effacement. */
function sources(): string[] {
  const out: string[] = [];
  const marcher = (rel: string) => {
    for (const e of readdirSync(resolve(RACINE, rel), { withFileTypes: true })) {
      if (e.isDirectory()) marcher(join(rel, e.name));
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(join(rel, e.name));
    }
  };
  for (const r of ["app", "lib"]) marcher(r);
  return out;
}

/** Les gestes qui font disparaître un compte, et rien d'autre. */
const EFFACE_UN_COMPTE = /auth\.admin\.deleteUser|effacerToutesSesDonnees|effacer_toutes_mes_donnees/;
/** Le seul module autorisé à savoir comment on arrête une facturation. */
const LE_MODULE = "lib/data/arret-facturation.ts";

describe("[R1] aucun chemin d'effacement ne laisse la facturation courir", () => {
  const tous = sources();

  it("[CONTRÔLE DU CONTRÔLE] on a bien scanné du code applicatif", () => {
    expect(tous.length).toBeGreaterThan(100);
  });

  it("[LE CŒUR] tout module qui efface un compte arrête d'abord la facturation", () => {
    const fautifs: string[] = [];
    for (const f of tous) {
      if (f === LE_MODULE || f.startsWith("lib/data/effacer-donnees")) continue;
      const src = lire(f);
      if (!EFFACE_UN_COMPTE.test(src)) continue;
      // ⚠️ L'APPEL, PAS LE NOM — le mutant qui SUPPRIMAIT ce bloc survivait, parce que la ligne
      // d'`import` porte encore le nom. C'est le même piège que l'ordre ci-dessous, et il s'est
      // refermé deux fois dans le même fichier de test.
      if (!/await\s+arreterFacturationAvantEffacement\s*\(/.test(src)) fautifs.push(f);
    }
    expect(
      fautifs,
      "un compte effacé dont la souscription court encore est débité de 69 € sans recours",
    ).toEqual([]);
  });

  it("[L'ORDRE] on arrête la facturation AVANT d'effacer, jamais après", () => {
    // Après, c'est trop tard et c'est même pire : l'identifiant de souscription vient de partir avec
    // la ligne `abonnement`, donc plus rien ne sait quoi résilier.
    //
    // ⚠️ ANCRÉ SUR L'APPEL, PAS SUR LE NOM. La première version cherchait `effacerToutesSesDonnees`
    // n'importe où : elle trouvait la ligne d'IMPORT, en tête de fichier, donc mesurait un ordre qui
    // n'est celui d'aucun code exécuté. C'est la troisième fois que ce piège se referme dans ce
    // dépôt — un nom qui apparaît n'est pas un nom qui s'exécute.
    const APPEL_EFFACEMENT =
      /await\s+(effacerToutesSesDonnees|admin\.auth\.admin\.deleteUser|supabase\.rpc\(\s*["']effacer_toutes_mes_donnees)/;
    for (const f of tous) {
      const src = lire(f);
      const appel = src.indexOf("await arreterFacturationAvantEffacement");
      if (appel < 0) continue;
      const efface = src.search(APPEL_EFFACEMENT);
      expect(efface, `dans ${f}, on n'a pas retrouvé l'APPEL d'effacement`).toBeGreaterThan(-1);
      expect(appel, `dans ${f}, l'arrêt de facturation doit précéder l'effacement`).toBeLessThan(
        efface,
      );
    }
  });

  it("[LA FRONTIÈRE] un seul module sait comment on arrête une facturation", () => {
    // La garde vivait RECOPIÉE dans l'appelant — c'est pour ça qu'elle a été oubliée une fois.
    const ailleurs = tous.filter(
      (f) =>
        f !== LE_MODULE &&
        f !== "lib/stripe/resiliation.ts" &&
        !f.startsWith("app/api/abonnement/") &&
        /resilierEnFinDePeriode/.test(lire(f)),
    );
    expect(ailleurs, "la résiliation avant effacement passe par le module dédié").toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE COMPORTEMENT — mesuré, pas lu
// ══════════════════════════════════════════════════════════════════════════════════════════════

const resilier = vi.fn(async (_id: string) => null as string | null);
const abonnementLu = vi.fn();

vi.mock("@/lib/stripe/resiliation", () => ({
  resilierEnFinDePeriode: (id: string) => resilier(id),
}));
vi.mock("@/lib/data/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: abonnementLu }) }) }),
  }),
}));

const { arreterFacturationAvantEffacement } = await import("@/lib/data/arret-facturation");

describe("[R1] `arreterFacturationAvantEffacement` — ce qu'elle fait et ce qu'elle refuse", () => {
  beforeEach(() => {
    resilier.mockReset().mockResolvedValue(null);
    abonnementLu.mockReset();
  });

  it("une souscription vivante est résiliée en fin de période", async () => {
    abonnementLu.mockResolvedValue({ data: { stripe_subscription_id: "sub_1" } });
    await arreterFacturationAvantEffacement("u1");
    expect(resilier).toHaveBeenCalledWith("sub_1");
  });

  it("un compte gratuit ne fait AUCUN appel — le cas nominal ne paie rien", async () => {
    abonnementLu.mockResolvedValue({ data: null });
    await arreterFacturationAvantEffacement("u1");
    expect(resilier).not.toHaveBeenCalled();
  });

  it("une ligne sans identifiant Stripe non plus", async () => {
    abonnementLu.mockResolvedValue({ data: { stripe_subscription_id: null } });
    await arreterFacturationAvantEffacement("u1");
    expect(resilier).not.toHaveBeenCalled();
  });

  it("[LE TEST QUI COMPTE] si Stripe refuse, elle LÈVE — l'effacement ne doit pas avoir lieu", async () => {
    // ⚠️ LE DROIT À L'EFFACEMENT SUPPORTE UN DÉLAI ; UN DÉBIT SUR UN COMPTE INEXISTANT, NON.
    // L'art. 17 admet un délai raisonnable. Une facturation sur un compte disparu est irréversible
    // depuis le produit : plus de page, plus de session, plus de bouton — une opposition bancaire.
    // Entre les deux, on suspend, on le dit, et elle peut réessayer.
    abonnementLu.mockResolvedValue({ data: { stripe_subscription_id: "sub_1" } });
    resilier.mockRejectedValueOnce(new Error("stripe down"));
    await expect(arreterFacturationAvantEffacement("u1")).rejects.toThrow();
  });

  it("une panne de LECTURE lève aussi — on n'efface pas dans l'ignorance", async () => {
    // Ne pas savoir s'il y a un abonnement n'est pas savoir qu'il n'y en a pas. Le repli penche du
    // côté qui ne débite personne (AD-15).
    abonnementLu.mockRejectedValueOnce(new Error("db down"));
    await expect(arreterFacturationAvantEffacement("u1")).rejects.toThrow();
  });
});
