import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * entrer-verifier-code.test.ts — CE QUE LA GARDE DE SOURCE NE PEUT PAS VOIR
 *
 * `tests/code-a-six-chiffres.test.ts` prouve que le mécanisme Supabase marche, et une garde de
 * source prouve que l'adresse vient du cookie. Ni l'une ni l'autre n'EXÉCUTE l'action : un
 * `if (false)` posé devant, un `type` changé, un compteur d'essais retiré passeraient les deux.
 * Ici on l'appelle.
 */

const cookieGet = vi.fn();
const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const verifyOtp = vi.fn();
const signInWithOtp = vi.fn();
const getUser = vi.fn();
const destination = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, set: cookieSet, delete: cookieDelete }),
  headers: async () => new Map(),
}));
vi.mock("next/navigation", () => ({
  redirect: (chemin: string) => {
    throw new Error(`redirect:${chemin}`);
  },
}));
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { verifyOtp, signInWithOtp, getUser },
  }),
}));
vi.mock("@/lib/data/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/lib/safety/appliquer-barriere", () => ({ appliquerBarriereMinorite: vi.fn() }));
vi.mock("@/app/(auth)/destination-apres-auth", () => ({
  destinationApresAuth: (...a: unknown[]) => destination(...a),
}));

const { verifierCode, envoyerLien } = await import("@/app/(auth)/entrer/actions");

const COOKIE = "anam_entree_attente";
const attente = (adresse = "toi@exemple.fr", essais = 0) => ({
  value: JSON.stringify({ adresse, essais }),
});
const donnees = (code: string) => {
  const f = new FormData();
  f.set("code", code);
  return f;
};

beforeEach(() => {
  for (const m of [cookieGet, cookieSet, cookieDelete, verifyOtp, signInWithOtp, getUser, destination])
    m.mockReset();
  cookieGet.mockReturnValue(attente());
  verifyOtp.mockResolvedValue({ error: null });
  destination.mockResolvedValue("/");
  signInWithOtp.mockResolvedValue({ error: null });
});

describe("[entrée] `verifierCode` — l'adresse ne vient QUE du cookie", () => {
  it("[LE CŒUR] elle vérifie l'adresse du cookie, avec le type mesuré", async () => {
    await expect(verifierCode({}, donnees("123456"))).rejects.toThrow(/redirect:/);
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "toi@exemple.fr",
      token: "123456",
      type: "email",
    });
  });

  it("[L'EXPLOIT] une adresse GLISSÉE DANS LE FORMULAIRE est ignorée", async () => {
    // C'est la forme qu'aurait pris ici la fixation de session retirée le 2026-08-13 : faire
    // vérifier le code de l'attaquant contre une adresse qu'il désigne.
    const f = donnees("123456");
    f.set("email", "attaquant@exemple.fr");
    await expect(verifierCode({}, f)).rejects.toThrow(/redirect:/);
    expect(verifyOtp.mock.calls[0]?.[0]?.email, "l'adresse du formulaire a été suivie").toBe(
      "toi@exemple.fr",
    );
  });

  it("sans cookie, on ne devine AUCUNE adresse — on renvoie demander", async () => {
    cookieGet.mockReturnValue(undefined);
    const r = await verifierCode({}, donnees("123456"));
    expect(verifyOtp, "on a vérifié un code contre une adresse inventée").not.toHaveBeenCalled();
    expect(r.message).toMatch(/expiré/i);
  });

  it("un cookie ILLISIBLE vaut un cookie absent — jamais une adresse partielle", async () => {
    cookieGet.mockReturnValue({ value: "{pas du json" });
    const r = await verifierCode({}, donnees("123456"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(r.message).toMatch(/expiré/i);
  });

  it("un cookie sans « @ » est refusé — on n'envoie pas n'importe quoi à Supabase", async () => {
    cookieGet.mockReturnValue({ value: JSON.stringify({ adresse: "pasuneadresse", essais: 0 }) });
    expect((await verifierCode({}, donnees("123456"))).message).toMatch(/expiré/i);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("[entrée] ce qu'elle fait du code lui-même", () => {
  it("un code trop court n'atteint jamais Supabase", async () => {
    const r = await verifierCode({}, donnees("1234"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(r.message).toMatch(/six chiffres/i);
  });

  it("[LE CAS QUI A FAILLI TOUT FERMER] un code de HUIT chiffres passe", async () => {
    // ⚠️ TROUVÉ EN ENVOYANT UN VRAI COURRIEL, PAS EN LISANT DU CODE. Le stack local envoie six
    // chiffres (`otp_length = 6`) ; le projet de PRODUCTION en envoyait huit (`mailer_otp_length`,
    // valeur par défaut de Supabase). Un `!== 6` aurait refusé tous les codes réels — sur la porte
    // écrite exactement pour réparer une impossibilité d'entrer, et sans qu'aucun test local ne
    // puisse le voir, puisque ce sont deux projets. La production est ramenée à 6 ; la plage reste,
    // pour que la prochaine dérive dégrade au lieu de fermer (AD-15).
    await expect(verifierCode({}, donnees("83191016"))).rejects.toThrow(/redirect:/);
    expect(verifyOtp.mock.calls[0]?.[0]?.token).toBe("83191016");
  });

  it("neuf chiffres, en revanche, non — la plage a une borne haute", async () => {
    const r = await verifierCode({}, donnees("123456789"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(r.message).toMatch(/six chiffres/i);
  });

  it("les espaces et tirets recopiés du courriel sont tolérés", async () => {
    // On recopie « 123 456 » aussi souvent que « 123456 ». Refuser serait un mur pour rien.
    await expect(verifierCode({}, donnees("123 456"))).rejects.toThrow(/redirect:/);
    expect(verifyOtp.mock.calls[0]?.[0]?.token).toBe("123456");
  });

  it("un code refusé incrémente les essais et NE consomme pas l'attente", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "invalid" } });
    const r = await verifierCode({}, donnees("000000"));
    expect(r.message).toMatch(/ne correspond pas/i);
    expect(cookieDelete, "une erreur de frappe a effacé l'attente").not.toHaveBeenCalled();
    expect(JSON.parse(cookieSet.mock.calls[0]?.[1] ?? "{}").essais).toBe(1);
  });

  it("au cinquième essai, l'attente est EFFACÉE et on renvoie demander", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "invalid" } });
    cookieGet.mockReturnValue(attente("toi@exemple.fr", 4));
    const r = await verifierCode({}, donnees("000000"));
    expect(r.message).toMatch(/trop d'essais/i);
    expect(cookieDelete).toHaveBeenCalledWith(COOKIE);
  });
});

describe("[entrée] après le succès : une seule machine d'état, et rien qui traîne", () => {
  it("[LE CŒUR] elle redirige là où LA MACHINE PARTAGÉE l'envoie, jamais vers « / » en dur", async () => {
    destination.mockResolvedValue("/naissance");
    await expect(verifierCode({}, donnees("123456"))).rejects.toThrow("redirect:/naissance");
  });

  it("un compte SUSPENDU va sur /barriere — la garde vit dans le module partagé", async () => {
    destination.mockResolvedValue("/barriere");
    await expect(verifierCode({}, donnees("123456"))).rejects.toThrow("redirect:/barriere");
  });

  it("l'attente est effacée au succès — un cookie qui survit est un code qu'on croit encore valide", async () => {
    await expect(verifierCode({}, donnees("123456"))).rejects.toThrow(/redirect:/);
    expect(cookieDelete).toHaveBeenCalledWith(COOKIE);
  });
});

describe("[entrée] `envoyerLien` pose l'attente, et seulement quand le courriel est parti", () => {
  it("un envoi réussi note l'adresse et la rend à l'écran", async () => {
    const f = new FormData();
    f.set("email", "toi@exemple.fr");
    const r = await envoyerLien({ ok: false }, f);
    expect(r.ok).toBe(true);
    expect(r.adresse).toBe("toi@exemple.fr");
    expect(JSON.parse(cookieSet.mock.calls[0]?.[1] ?? "{}").adresse).toBe("toi@exemple.fr");
  });

  it("[LE BORD] un envoi ÉCHOUÉ ne pose AUCUNE attente", async () => {
    // Sinon l'écran demanderait un code qui n'existe pas, et le compteur d'essais tomberait sur
    // quelqu'un qui n'a jamais rien reçu.
    signInWithOtp.mockResolvedValue({ error: { message: "rate limit" } });
    const f = new FormData();
    f.set("email", "toi@exemple.fr");
    const r = await envoyerLien({ ok: false }, f);
    expect(r.ok).toBe(false);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("le cookie est httpOnly, `lax`, et borné dans le temps", async () => {
    const f = new FormData();
    f.set("email", "toi@exemple.fr");
    await envoyerLien({ ok: false }, f);
    const opts = cookieSet.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(3600);
  });
});
