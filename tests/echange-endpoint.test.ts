import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 4.6 (AC4) — `GET /api/anam/echange`, la route qui SERT LE VERBATIM art. 9 (« Voir dans la conversation »).
 *
 * RE-REVUE (HAUTE) — ce fichier n'existait pas. La route neuve n'était importée par AUCUN test : sa garde
 * d'état art. 9 pouvait être supprimée sans qu'une seule assertion du dépôt vire au rouge. Et la conséquence
 * a été REPRODUITE en base : la policy de lecture d'`entree_journal` (migration 0016) n'a volontairement
 * AUCUN prédicat de consentement — c'est voulu, pour que l'export FR-067 survive à une révocation. Cette
 * route est donc la SEULE barrière entre « exporter ses données » et « continuer à consommer le produit
 * après avoir retiré son consentement ». Elle est ici gardée pour de bon.
 *
 * L'asymétrie qui l'avait laissée passer : l'AUTRE route neuve du même correctif (`/api/incident`) était,
 * elle, importée et testée.
 */

// `vi.hoisted` : les factories de `vi.mock` sont remontées en tête de fichier, donc elles ne peuvent pas
// lire un `const` déclaré plus bas (ReferenceError à l'évaluation de la factory).
const { getUser, etapeOnboardingPour, chargerEchangeSource } = vi.hoisted(() => ({
  getUser: vi.fn(),
  etapeOnboardingPour: vi.fn(),
  chargerEchangeSource: vi.fn(),
}));

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock("@/app/(auth)/etat-onboarding", () => ({ etapeOnboardingPour }));
vi.mock("@/lib/data/depot-branche", () => ({
  creerDepotBranche: () => ({ chargerEchangeSource }),
}));

import { GET } from "@/app/api/anam/echange/route";

const EXTRAIT = "11111111-2222-4333-8444-555555555555";
const req = (extrait: string = EXTRAIT) => new Request(`http://local/api/anam/echange?extrait=${extrait}`);

const VERBATIM = "je crois que je m'en veux depuis longtemps";

describe("GET /api/anam/echange — le verbatim art. 9 n'est servi qu'à un état LÉGITIME", () => {
  beforeEach(() => {
    getUser.mockReset();
    etapeOnboardingPour.mockReset();
    chargerEchangeSource.mockReset();
    chargerEchangeSource.mockResolvedValue([
      { id: "m1", role: "utilisatrice", contenu: VERBATIM, estCible: true },
    ]);
  });

  it("401 sans session (AD-2)", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const r = await GET(req());
    expect(r.status).toBe(401);
    expect(chargerEchangeSource, "aucune lecture art. 9 sans identité").not.toHaveBeenCalled();
  });

  it("chemin heureux : l'utilisatrice à jour reçoit son verbatim", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    etapeOnboardingPour.mockResolvedValue("suite");
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(JSON.stringify(await r.json())).toContain(VERBATIM);
  });

  // Mutation-cible de ce bloc : la ligne `if (etape !== "suite") return … 403` de la route.
  // Chacun de ces états doit fermer la porte — c'est la garde que la RLS de lecture ne porte PAS.
  for (const etape of ["consentement", "revoque", "naissance", "mineur", "cgu"]) {
    it(`[HAUTE / AD-13] état « ${etape} » → 403, et le verbatim n'est même pas LU`, async () => {
      getUser.mockResolvedValue({ data: { user: { id: "u" } } });
      etapeOnboardingPour.mockResolvedValue(etape);
      const r = await GET(req());
      expect(r.status, `un compte en état « ${etape} » ne consomme pas de contenu art. 9`).toBe(403);
      const body = JSON.stringify(await r.json());
      expect(body).not.toContain(VERBATIM);
      expect(chargerEchangeSource, "la garde doit mordre AVANT la base, pas après").not.toHaveBeenCalled();
    });
  }

  it("identifiant mal formé → 400 propre (pas un 22P02 journalisé comme une panne)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    etapeOnboardingPour.mockResolvedValue("suite");
    for (const mauvais of ["", "pas-un-uuid", "11111111-2222-4333-8444"]) {
      const r = await GET(req(mauvais));
      expect(r.status).toBe(400);
    }
    expect(chargerEchangeSource).not.toHaveBeenCalled();
  });

  it("[NFR-022] une panne ne fait fuir NI le verbatim NI le message d'erreur", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    etapeOnboardingPour.mockResolvedValue("suite");
    chargerEchangeSource.mockRejectedValue(new Error(`echange: ${VERBATIM}`));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await GET(req());
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain(VERBATIM);
    expect(JSON.stringify(spy.mock.calls), "le journal ne doit pas porter le verbatim").not.toContain(VERBATIM);
    spy.mockRestore();
  });

  it("[art. 9] la réponse n'est JAMAIS mise en cache (ni par Next, ni par un intermédiaire)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    etapeOnboardingPour.mockResolvedValue("suite");
    const r = await GET(req());
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
});
