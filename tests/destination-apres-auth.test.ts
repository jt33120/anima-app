import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * destination-apres-auth.test.ts — LA MACHINE D'ÉTAT PARTAGÉE PAR LES DEUX PORTES
 *
 * ══ POURQUOI CE FICHIER EXISTE, ET CE QU'IL A ATTRAPÉ ═════════════════════════════════════════
 *
 * Ces sept lignes vivaient dans `app/auth/confirm/route.ts`, seul chemin d'entrée. Le code à six
 * chiffres en a ouvert un second ; les recopier aurait fait DEUX machines d'état sur l'onboarding —
 * la faute que la revue 1.4 a payée (« une barrière oubliée dans un seul chemin suffit à laisser
 * passer un mineur »). Elles ont donc été extraites.
 *
 * ⚠️ ET L'EXTRACTION LES A LAISSÉES SANS ÉPREUVE DIRECTE. La campagne de mutation l'a dit : le
 * mutant qui retire le routage de la RÉVOCATION a SURVÉCU. `tests/barriere-minorite.test.ts` garde
 * la branche `barre` — sur la source, et par une regex qui lie condition et destination — mais rien
 * ne gardait les quatre autres. Quelqu'un dont le consentement art. 9 est révoqué serait entré dans
 * la scène, où toutes ses écritures échouent en base, au lieu d'arriver sur l'écran qui le lui dit.
 *
 * Chaque branche a désormais son cas, et chaque cas est un mutant mort.
 */

const getUser = vi.fn();
const signOut = vi.fn();
const etape = vi.fn();

vi.mock("@/app/(auth)/etat-onboarding", () => ({
  etapeOnboardingPour: () => etape(),
}));

const { destinationApresAuth } = await import("@/app/(auth)/destination-apres-auth");

// Un client Supabase réduit à ce que la fonction lui demande — rien de plus.
const client = () => ({ auth: { getUser, signOut } }) as never;

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  signOut.mockReset().mockResolvedValue(undefined);
  etape.mockReset();
});

describe("[entrée] chaque étape a SA destination — aucune ne tombe dans « suite »", () => {
  const cas = [
    ["barre", "/barriere"],
    ["mineur", "/entrer?refus=age"],
    ["naissance", "/naissance"],
    ["consentement", "/consentement"],
    ["revoque", "/consentement/revoque"],
  ] as const;

  for (const [e, cible] of cas) {
    it(`« ${e} » → ${cible}`, async () => {
      etape.mockResolvedValue(e);
      expect(await destinationApresAuth(client(), "/")).toBe(cible);
    });
  }

  it("[CONTRÔLE POSITIF] « suite » va où on allait — sinon tout le monde serait détourné", async () => {
    // Sans ce contrôle, une fonction qui renverrait /barriere à tout le monde passerait les cinq
    // cas ci-dessus. Un refus muet est aussi cassé qu'une porte ouverte, simplement plus discret.
    etape.mockResolvedValue("suite");
    expect(await destinationApresAuth(client(), "/naissance?x=1")).toBe("/naissance?x=1");
  });
});

describe("[entrée] ce que la fonction fait de la SESSION, et pas seulement de l'URL", () => {
  it("[LE CŒUR] « mineur » FERME la session — un mineur est refusé à chaque connexion (FR-070)", async () => {
    etape.mockResolvedValue("mineur");
    await destinationApresAuth(client(), "/");
    expect(signOut, "la session d'un mineur signalé est restée ouverte").toHaveBeenCalled();
  });

  it("[LA DISTINCTION QUI COÛTE] « barre » ne la ferme PAS — l'export en a besoin", async () => {
    // Un compte SUSPENDU pour minorité soupçonnée garde sa session : `/barriere` lui propose son
    // export RGPD (1.9), et le déconnecter ferait de la suspension une porte fermée à clé sur ses
    // propres données. C'est la seule différence entre ces deux branches, et elle est délibérée.
    etape.mockResolvedValue("barre");
    await destinationApresAuth(client(), "/");
    expect(signOut, "on a enfermé quelqu'un dehors de ses propres données").not.toHaveBeenCalled();
  });

  it("aucune session : on ne consulte même pas l'onboarding", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await destinationApresAuth(client(), "/quelque-part")).toBe("/quelque-part");
    expect(etape).not.toHaveBeenCalled();
  });
});
