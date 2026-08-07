import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 3.5 (AC3) — LA SORTIE NE SE FERME JAMAIS.
 *
 * Ce fichier existe parce que `tests/garde-commerciale.test.ts` déroge aux deux routes de sortie. Une
 * dérogation sans preuve comportementale est une allowlist — c'est-à-dire un trou qu'on a documenté. La
 * preuve est ici, et elle est l'INVERSE de celle que la garde commerciale apporte partout ailleurs :
 * là-bas on prouve qu'une surface REFUSE de se monter en détresse, ici on prouve qu'elle S'OUVRE.
 *
 * ── POURQUOI L'INVERSION, EN UNE PHRASE ─────────────────────────────────────────────────────────────────
 *
 * `limites_levees` est vrai pendant un épisode de détresse OUVERT. Appliquer la garde AD-9 aux routes de
 * sortie signifierait : « tant que tu es en crise, tu ne peux ni résilier ton abonnement ni récupérer ton
 * argent ». C'est le dark pattern maximal, appliqué à la personne la plus vulnérable du produit, au nom
 * d'une garde de sécurité. AD-9 protège du commerce ENTRANT ; sortir n'en est pas.
 *
 * ── LES TROIS DIRECTIONS DE DOUTE DU PROJET, QUI NE SONT PAS INTERCHANGEABLES ────────────────────────────
 *
 *   • `limitesCommercialesLevees` → défaut `true`  : le doute SUSPEND le commerce (3.2/3.4) ;
 *   • `premiumSousJwt`            → défaut `false` : le doute FERME l'écriture (3.3/4.10) ;
 *   • la sortie                   → aucune garde   : rien ne la ferme, jamais (3.5).
 */

const racine = process.cwd();

/**
 * Même stripper que `tests/garde-commerciale.test.ts`. Nécessaire, et pas cosmétique : les en-têtes des
 * deux routes de sortie EXPLIQUENT pourquoi `limitesCommercialesLevees` n'y est pas — donc le nom y
 * figure, en prose. Sans ce nettoyage, la garde attrapait sa propre documentation et interdisait
 * d'écrire pourquoi la garde n'était pas là. (Trouvé en écrivant ce fichier : le test a rougi sur la
 * bonne route pour la mauvaise raison.)
 */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const lire = (p: string) => sansCommentaires(readFileSync(resolve(racine, p), "utf-8"));

/** Le texte BRUT — pour le contrôle positif, où l'on veut voir l'appel réel du Checkout. */
const lireBrut = (p: string) => readFileSync(resolve(racine, p), "utf-8");

const ROUTES_SORTIE = [
  "app/api/abonnement/resilier/route.ts",
  "app/api/abonnement/remboursement/route.ts",
];

describe("[AC3] les routes de sortie n'appliquent AUCUNE garde de détresse", () => {
  it("CONTRÔLE POSITIF : la route Checkout, elle, applique bien la garde (sinon ce fichier ne prouve rien)", () => {
    // Sur le CODE, pas sur la prose : sinon un simple commentaire mentionnant la garde suffirait à
    // faire passer ce contrôle, et il ne contrôlerait plus rien.
    expect(
      lire("app/api/stripe/checkout/route.ts"),
      "la garde AD-9 a disparu du Checkout — c'est ELLE qui donne son sens à l'inversion",
    ).toMatch(/limitesCommercialesLevees\(/);
    // Et le stripper ne doit pas être si vorace qu'il avale le code : contrôle du contrôle.
    expect(lireBrut("app/api/stripe/checkout/route.ts")).toMatch(/limitesCommercialesLevees/);
  });

  for (const route of ROUTES_SORTIE) {
    it(`${route} n'appelle jamais limitesCommercialesLevees`, () => {
      expect(
        lire(route),
        "cette route refuserait de résilier/rembourser pendant un épisode de détresse ouvert (AC3)",
      ).not.toMatch(/limitesCommercialesLevees/);
    });

    it(`${route} n'appelle aucune AUTRE garde de détresse déguisée`, () => {
      // La faute peut revenir sous un autre nom : c'est le même mur, repeint. On interdit la FAMILLE.
      const source = lire(route);
      for (const interdit of [/episodeDetresseOuvert/, /gestesSuspendus/, /branche_bloquee_par_detresse/, /limites_levees/]) {
        expect(source, `garde de détresse déguisée dans une route de sortie : ${interdit}`).not.toMatch(interdit);
      }
    });
  }

  it("aucune des deux routes ne prend de corps de requête — pas de questionnaire de départ possible (AC2)", () => {
    for (const route of ROUTES_SORTIE) {
      const source = lire(route);
      // `request.json()` / `request.text()` / `formData()` : les trois façons de lire ce qu'elle envoie.
      // Aucune n'a de raison d'être ici, et leur absence rend le questionnaire de départ INÉCRIVABLE —
      // il n'existe aucun paramètre où le loger. Même stratégie que la signature de `PortCourriel`.
      expect(source, `un corps de requête est lu par ${route} — un questionnaire y tiendrait`).not.toMatch(
        /request\.(json|text|formData)\(\)/,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LE CHEMIN VERS LA SORTIE RESTE VISIBLE PENDANT UN ÉPISODE — la preuve comportementale
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

const chargerBranches = vi.fn();
vi.mock("@/lib/data/depot-branche", () => ({
  creerDepotBranche: vi.fn(() => ({ chargerBranches })),
}));

const { chargerProjectionArbre } = await import("@/lib/safety/projection-arbre");

/**
 * Un client qui répond à TROIS choses distinctes — la détresse, le premium, et la lecture d'abonnement.
 *
 * ⚠️ Un client qui rendrait la même valeur à tous les `rpc` ferait passer ce test pour la mauvaise
 * raison : c'est le piège trouvé en 3.3 sur `socle-jamais-coupe`, où un `data: false` universel faisait
 * lever `chargerBranches`, tombait dans le `catch`, et rendait un objet qui satisfaisait l'assertion.
 */
const client = (opts: { enDetresse: boolean; abonnement: string | null }) =>
  ({
    rpc: async (nom: string) => {
      if (nom === "branche_bloquee_par_detresse") return { data: opts.enDetresse, error: null };
      if (nom === "est_premium_courante") return { data: true, error: null };
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({
          data: opts.abonnement ? { stripe_subscription_id: opts.abonnement } : null,
          error: null,
        }),
      }),
    }),
  }) as unknown as SupabaseClient;

describe("[AC3] le CHEMIN vers /abonnement survit à un épisode de détresse", () => {
  it("hors détresse : le chemin est là ET les gestes sont ouverts (contrôle positif)", async () => {
    chargerBranches.mockResolvedValue([]);
    const p = await chargerProjectionArbre(client({ enDetresse: false, abonnement: "sub_123" }));
    expect(p.indisponible, "témoin : on a pris le chemin nominal, pas le repli").toBeUndefined();
    expect(p.abonnementGerable).toBe(true);
    expect(p.planOuvert).toBe(true);
  });

  it("[LE TEST QUI COMPTE] en détresse : les gestes se ferment, le chemin de sortie RESTE", async () => {
    chargerBranches.mockResolvedValue([]);
    const p = await chargerProjectionArbre(client({ enDetresse: true, abonnement: "sub_123" }));
    expect(p.indisponible, "témoin : on a pris le chemin nominal, pas le repli").toBeUndefined();
    // Ce que AD-9 ferme, il le ferme bien — sans ça, l'assertion suivante ne prouverait rien.
    expect(p.gestesSuspendus, "la garde de détresse ne mord plus").toBe(true);
    expect(p.planOuvert, "le plan devrait être fermé en détresse").toBeUndefined();
    // Et ce qu'il ne doit PAS fermer reste ouvert.
    expect(
      p.abonnementGerable,
      "le chemin de résiliation a disparu pendant un épisode : quelqu'un en crise ne peut plus sortir",
    ).toBe(true);
  });

  it("sans souscription Stripe, aucun chemin — un compte gratuit n'a rien à résilier", async () => {
    chargerBranches.mockResolvedValue([]);
    const p = await chargerProjectionArbre(client({ enDetresse: false, abonnement: null }));
    expect(p.abonnementGerable).toBeUndefined();
  });

  it("[DUR] `abonnementGerable` n'est PAS un miroir de `planOuvert` : paiement en échec, sortie ouverte", async () => {
    // `past_due` chez Stripe projette `etat = 'expire'` → `est_premium_courante` rend false → `planOuvert`
    // absent. Mais la souscription VIT toujours et sera relancée. Si la sortie avait réutilisé
    // `planOuvert` (le réflexe R1-bis), cette personne n'aurait plus aucun moyen de résilier : accès
    // fermé, contrat ouvert.
    chargerBranches.mockResolvedValue([]);
    const impaye = {
      rpc: async (nom: string) => {
        if (nom === "branche_bloquee_par_detresse") return { data: false, error: null };
        if (nom === "est_premium_courante") return { data: false, error: null };
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({ maybeSingle: async () => ({ data: { stripe_subscription_id: "sub_impaye" }, error: null }) }),
      }),
    } as unknown as SupabaseClient;
    const p = await chargerProjectionArbre(impaye);
    expect(p.planOuvert, "témoin : l'entitlement est bien fermé").toBeUndefined();
    expect(p.abonnementGerable, "sortie fermée sur un paiement en échec — personne piégée").toBe(true);
  });
});
