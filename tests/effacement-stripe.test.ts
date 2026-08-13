import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * REVUE DE CODE du 2026-08-12, lot 2 (M7, côté TypeScript) — ARRÊTER LA FACTURATION AVANT D'EFFACER.
 *
 * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
 *
 * `effacerCompteCourant` appelait `auth.admin.deleteUser`, la cascade emportait la ligne
 * `abonnement` — et personne ne parlait à Stripe. La souscription restait `active`, avec
 * `cancel_at_period_end = false`. À l'échéance, la carte d'une personne qui n'a plus de compte est
 * débitée de 69 €. Plus de page `/abonnement`, plus de bouton, plus de session : aucun recours
 * depuis le produit, seulement une opposition bancaire.
 *
 * C'est le seul défaut de la revue qui PRÉLÈVE DE L'ARGENT à quelqu'un qui a explicitement quitté.
 *
 * ══ LA DÉCISION QUI DEMANDE À ÊTRE GARDÉE ═══════════════════════════════════════════════════════
 *
 * Si Stripe est injoignable, ON N'EFFACE PAS. C'est un arbitrage entre deux obligations, et il est
 * délibéré : le droit à l'effacement (art. 17) supporte un délai raisonnable et la personne garde sa
 * session pour réessayer ; une facturation sur un compte inexistant, elle, est irréversible et
 * impossible à rattraper depuis le produit. C'est exactement la doctrine « jamais d'effacement
 * silencieux sur un chemin RGPD » acquise en revue 1.5 — appliquée dans l'autre sens.
 *
 * Un futur relecteur trouvera cette suspension bizarre et voudra « simplifier ». Ce fichier est là
 * pour qu'il tombe sur la raison avant de tomber sur le code.
 */

/** Trace d'ORDRE : le geste Stripe doit précéder l'effacement, pas seulement coexister avec lui. */
const ordre: string[] = [];
/** Sur QUI chaque geste a porté — un ordre correct sur les mauvaises cibles ne vaudrait rien. */
const cibles: string[] = [];

const getUser = vi.fn();
const signOut = vi.fn(async () => {
  ordre.push("signOut");
});
const deleteUser = vi.fn(async (id: string): Promise<{ error: { message: string } | null }> => {
  ordre.push("deleteUser");
  cibles.push(`deleteUser:${id}`);
  return { error: null };
});
const lireAbonnement = vi.fn();
const resilier = vi.fn(async (sub: string) => {
  ordre.push("stripe");
  cibles.push(`stripe:${sub}`);
});

/** `redirect` de Next lève (NEXT_REDIRECT) : on reproduit la levée pour capturer la destination. */
class Redirection extends Error {
  constructor(readonly chemin: string) {
    super(`redirect:${chemin}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (chemin: string) => {
    ordre.push(`redirect:${chemin}`);
    throw new Redirection(chemin);
  },
}));

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser, signOut } }),
}));

vi.mock("@/lib/data/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: lireAbonnement }) }) }),
    auth: { admin: { deleteUser } },
  }),
}));

vi.mock("@/lib/stripe/resiliation", () => ({
  resilierEnFinDePeriode: (sub: string) => resilier(sub),
}));

const { refuser, supprimerCompteRevoque } = await import("@/app/(auth)/consentement/actions");

/** L'action lève toujours (redirect) : on capte la destination plutôt que de laisser tomber le test. */
async function destination(action: () => Promise<void>): Promise<string> {
  try {
    await action();
  } catch (e) {
    if (e instanceof Redirection) return e.chemin;
    throw e;
  }
  throw new Error("l'action n'a redirigé nulle part — elle doit TOUJOURS conclure par une redirection");
}

beforeEach(() => {
  ordre.length = 0;
  cibles.length = 0;
  getUser.mockReset();
  signOut.mockClear();
  deleteUser.mockClear();
  lireAbonnement.mockReset();
  resilier.mockClear();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  lireAbonnement.mockResolvedValue({ data: { stripe_subscription_id: "sub_1" } });
  deleteUser.mockImplementation(async (id: string) => {
    ordre.push("deleteUser");
    cibles.push(`deleteUser:${id}`);
    return { error: null };
  });
  resilier.mockImplementation(async (sub: string) => {
    ordre.push("stripe");
    cibles.push(`stripe:${sub}`);
  });
});

describe("[M7] effacer son compte annule d'abord l'abonnement chez Stripe", () => {
  it("[LE TEST QUI COMPTE] l'annulation Stripe précède `deleteUser` — l'ordre EST la garde", async () => {
    // Appeler Stripe APRÈS l'effacement ne servirait à rien : la ligne `abonnement` a disparu avec
    // la cascade, donc le `stripe_subscription_id` aussi. Il n'y a plus rien à annuler, et plus
    // aucun moyen de savoir quoi.
    expect(await destination(refuser)).toBe("/entrer");
    expect(resilier).toHaveBeenCalledWith("sub_1");
    expect(ordre.indexOf("stripe")).toBeGreaterThanOrEqual(0);
    expect(ordre.indexOf("stripe")).toBeLessThan(ordre.indexOf("deleteUser"));
    // Le bon ordre sur les mauvaises cibles ne vaudrait rien : c'est SON abonnement et SON compte.
    expect(cibles).toEqual(["stripe:sub_1", "deleteUser:u1"]);
  });

  it("succès : la session est fermée APRÈS l'effacement, et la sortie va vers `/entrer`", async () => {
    expect(await destination(refuser)).toBe("/entrer");
    expect(ordre).toEqual(["stripe", "deleteUser", "signOut", "redirect:/entrer"]);
  });

  it("aucun abonnement : Stripe n'est PAS appelé, et l'effacement se fait quand même", async () => {
    lireAbonnement.mockResolvedValueOnce({ data: null });
    expect(await destination(refuser)).toBe("/entrer");
    expect(resilier).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("une ligne `abonnement` sans identifiant Stripe n'appelle rien non plus", async () => {
    lireAbonnement.mockResolvedValueOnce({ data: { stripe_subscription_id: null } });
    expect(await destination(refuser)).toBe("/entrer");
    expect(resilier).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalled();
  });
});

describe("[M7 — l'arbitrage] Stripe injoignable : on suspend l'effacement plutôt que de facturer un fantôme", () => {
  it("[DUR] Stripe lève → `deleteUser` n'est JAMAIS appelé", async () => {
    resilier.mockRejectedValueOnce(new Error("stripe down"));
    expect(await destination(refuser)).toBe("/consentement?erreur=suppression");
    expect(deleteUser, "effacer ici, c'est garantir un prélèvement sans recours").not.toHaveBeenCalled();
  });

  it("[DUR] Stripe lève → la SESSION est conservée : elle peut réessayer", async () => {
    // Sans session, il n'y a plus de chemin vers la suppression du tout. L'échec doit laisser la
    // porte ouverte, jamais enfermer quelqu'un dans un compte qu'il a demandé à quitter.
    resilier.mockRejectedValueOnce(new Error("stripe down"));
    await destination(refuser);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("une panne de LECTURE de l'abonnement suspend aussi — on ne devine pas qu'il n'y a rien", async () => {
    // `maybeSingle` qui rejette n'est pas « aucun abonnement » : c'est « on ne sait pas ». Continuer
    // reviendrait à traiter l'ignorance comme une absence, ce que la revue 4.6 a déjà payé sur l'arbre.
    lireAbonnement.mockRejectedValueOnce(new Error("réseau"));
    expect(await destination(refuser)).toBe("/consentement?erreur=suppression");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("le chemin RÉVOQUÉ a la même garde, et son PROPRE écran d'échec", async () => {
    // Deux points d'entrée, un seul effacement : si la garde ne vivait que dans `refuser`, la sortie
    // après révocation (1.6) resterait trouée — et c'est le chemin de quelqu'un qui a déjà tout retiré.
    resilier.mockRejectedValueOnce(new Error("stripe down"));
    expect(await destination(supprimerCompteRevoque)).toBe("/consentement/revoque?erreur=suppression");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("[CONTRÔLE] sans panne, le chemin révoqué efface bien (la garde ne bloque pas tout)", async () => {
    expect(await destination(supprimerCompteRevoque)).toBe("/entrer");
    expect(ordre).toEqual(["stripe", "deleteUser", "signOut", "redirect:/entrer"]);
  });

  it("l'échec de `deleteUser` LUI-MÊME conserve la session (acquis revue 1.5, non-régression)", async () => {
    deleteUser.mockImplementationOnce(async (id: string) => {
      ordre.push("deleteUser");
      cibles.push(`deleteUser:${id}`);
      return { error: { message: "boom" } };
    });
    expect(await destination(refuser)).toBe("/consentement?erreur=suppression");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("session absente → `/entrer`, sans toucher ni Stripe ni l'effacement", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await destination(refuser)).toBe("/entrer");
    expect(resilier).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
