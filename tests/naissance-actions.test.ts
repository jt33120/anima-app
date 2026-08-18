import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Story 5.2 (T4) — L'ÉCRITURE DU SEUIL : date de naissance, prénom, nom complet.
 *
 * ⚠️ `app/(auth)/naissance/actions.ts` n'avait AUCUN test avant cette story : la Story 1.4 avait
 * livré le contrôle de majorité côté serveur (NFR-023) sans jamais l'exercer. Cette story ajoute
 * deux colonnes à la même écriture ; on couvre donc à la fois ce qu'elle ajoute ET ce qu'elle ne
 * doit pas casser — en particulier le chemin MINEUR, où RIEN ne doit être écrit.
 */

const update = vi.fn<(valeurs: Record<string, unknown>) => void>();
const eq = vi.fn<(colonne: string, valeur: unknown) => void>();
const signOut = vi.fn(async () => ({}));
const redirect = vi.fn((chemin: string) => {
  // `next/navigation`.redirect lève par conception : on reproduit ce contrat, sinon le code qui
  // suit un redirect s'exécuterait dans le test et pas en production.
  throw new Error(`REDIRECT:${chemin}`);
});

let utilisateur: { id: string } | null = { id: "u1" };

vi.mock("next/navigation", () => ({ redirect: (c: string) => redirect(c) }));
/**
 * Revue Epics 1-4 (#11) : la minorité DÉCLARÉE ne passe plus par un UPDATE sous JWT. `mineur_detecte`
 * seul laissait un compte que le moteur de rétention n'atteignait jamais — `echeance_suppression` est
 * une colonne système, hors du grant client depuis 0041, donc l'action ne POUVAIT pas la poser.
 * `declarerMinorite` (service_role) écrit les deux d'un coup.
 */
const declarerMinorite = vi.fn<(cible: string) => Promise<void>>(async () => {});
vi.mock("@/lib/safety/appliquer-barriere", () => ({
  declarerMinorite: (cible: string) => declarerMinorite(cible),
}));
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: utilisateur } }),
      signOut,
    },
    from: () => ({
      update: (valeurs: Record<string, unknown>) => {
        update(valeurs);
        return {
          eq: async (colonne: string, valeur: unknown) => {
            eq(colonne, valeur);
            return { error: null };
          },
        };
      },
    }),
  }),
}));

const { declarerAge } = await import("@/app/(auth)/naissance/actions");

/** Une date de naissance majeure et stable, indépendante de l'année d'exécution. */
const MAJEURE = "1970-11-28";

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

async function appeler(champs: Record<string, string>) {
  try {
    return await declarerAge({ statut: "saisie" }, formulaire(champs));
  } catch (e) {
    // Le redirect de succès remonte ici : on le rend lisible au test.
    return { statut: "redirige" as const, message: (e as Error).message };
  }
}

beforeEach(() => {
  update.mockClear();
  eq.mockClear();
  signOut.mockClear();
  redirect.mockClear();
  utilisateur = { id: "u1" };
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Ce que la Story 5.2 ajoute
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T4/FR-048] le prénom est obligatoire, le nom complet ne l'est pas", () => {
  it("écrit les trois valeurs dans UNE seule mise à jour", async () => {
    const r = await appeler({
      date_naissance: MAJEURE,
      prenom: "Marie",
      nom_complet: "Marie Dupont",
    });
    expect(r.message).toContain("/consentement");
    // Une seule écriture : aucun état intermédiaire où le prénom existerait sans la date.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      date_naissance: MAJEURE,
      prenom: "Marie",
      nom_complet: "Marie Dupont",
    });
  });

  it("refuse un prénom vide, sans rien écrire", async () => {
    const r = await appeler({ date_naissance: MAJEURE, prenom: "   ", nom_complet: "X" });
    expect(r.statut).toBe("erreur");
    expect(update).not.toHaveBeenCalled();
  });

  it("un nom complet vide devient `null`, jamais une chaîne vide", async () => {
    // La numérologie distingue « jamais renseigné » (`nom_absent`) de « renseigné mais
    // inexploitable » (`nom_sans_lettre`). Une chaîne vide en base brouillerait les deux.
    await appeler({ date_naissance: MAJEURE, prenom: "Marie", nom_complet: "" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ nom_complet: null }));

    update.mockClear();
    await appeler({ date_naissance: MAJEURE, prenom: "Marie", nom_complet: "   " });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ nom_complet: null }));
  });

  it("détoure les espaces autour des saisies", async () => {
    await appeler({ date_naissance: MAJEURE, prenom: "  Marie  ", nom_complet: "  Marie Dupont " });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ prenom: "Marie", nom_complet: "Marie Dupont" }),
    );
  });

  it("borne la longueur, sans rien écrire au-delà", async () => {
    const trop = "a".repeat(101);
    expect((await appeler({ date_naissance: MAJEURE, prenom: trop })).statut).toBe("erreur");
    expect(
      (await appeler({ date_naissance: MAJEURE, prenom: "Marie", nom_complet: "a".repeat(201) }))
        .statut,
    ).toBe("erreur");
    expect(update).not.toHaveBeenCalled();
    // Contrôle du contrôle : juste en dessous de la borne, ça passe.
    await appeler({ date_naissance: MAJEURE, prenom: "a".repeat(100) });
    expect(update).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Ce que la Story 5.2 ne doit PAS casser (Story 1.4, NFR-023, FR-071)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[non-régression 1.4] le contrôle de majorité reste intact", () => {
  it("[LE CŒUR] un compte MINEUR n'écrit ni prénom, ni nom, ni date", async () => {
    // Mutation-cible : déplacer l'écriture du nom AVANT la branche d'âge. La minorité ne pose que
    // `mineur_detecte` puis déconnecte — aucune autre donnée n'est conservée (AD-14, FR-071).
    const mineure = new Date();
    mineure.setFullYear(mineure.getFullYear() - 15);
    const r = await declarerAge(
      { statut: "saisie" },
      formulaire({
        date_naissance: mineure.toISOString().slice(0, 10),
        prenom: "Marie",
        nom_complet: "Marie Dupont",
      }),
    );
    expect(r.statut).toBe("mineur");
    // ⚠️ AUCUN `update` SOUS JWT — c'est le point de la revue 1-4 (#11). Le drapeau posé seul
    // fabriquait un compte que rien n'effacerait jamais ; il passe par le chemin système, qui pose
    // aussi l'échéance de suppression.
    expect(update, "l'action écrit encore sous JWT : l'échéance ne suivra pas").not.toHaveBeenCalled();
    expect(declarerMinorite).toHaveBeenCalledTimes(1);
    expect(declarerMinorite).toHaveBeenCalledWith(utilisateur!.id);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("⚠️ et si la pose de l'échéance ÉCHOUE, elle est quand même déconnectée", async () => {
    // Refuser une mineure est une décision de SÉCURITÉ ; elle ne doit pas dépendre du succès d'une
    // écriture de rétention. Laisser la session ouverte parce qu'une RPC a eu un timeout ferait
    // exactement l'inverse de ce que la barrière existe pour faire.
    declarerMinorite.mockRejectedValueOnce(new Error("timeout"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const mineure = new Date();
    mineure.setFullYear(mineure.getFullYear() - 15);
    const r = await declarerAge(
      { statut: "saisie" },
      formulaire({ date_naissance: mineure.toISOString().slice(0, 10), prenom: "Marie" }),
    );
    expect(r.statut).toBe("mineur");
    expect(signOut, "une mineure est restée connectée à cause d'un timeout").toHaveBeenCalledTimes(1);
    expect(err, "l'échec doit au moins laisser une trace").toHaveBeenCalled();
    err.mockRestore();
  });

  it("refuse une date malformée, une date future et un âge absurde", async () => {
    const futur = new Date();
    futur.setFullYear(futur.getFullYear() + 1);
    const cas = ["", "28/11/1970", "1970-11", futur.toISOString().slice(0, 10), "1800-01-01"];
    for (const date of cas) {
      const r = await appeler({ date_naissance: date, prenom: "Marie" });
      expect(r.statut, date).toBe("erreur");
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("sans session, redirige vers l'entrée sans rien écrire", async () => {
    utilisateur = null;
    const r = await appeler({ date_naissance: MAJEURE, prenom: "Marie" });
    expect(r.message).toContain("/entrer");
    expect(update).not.toHaveBeenCalled();
  });

  it("[AD-12] écrit sous la session RLS, jamais via un client admin", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const brut = readFileSync(resolve(process.cwd(), "app/(auth)/naissance/actions.ts"), "utf-8");
    // On scanne le CODE, pas les commentaires : l'en-tête dit légitimement « jamais `service_role` »
    // et le prendre pour un usage rendrait la garde impossible à satisfaire sans effacer sa propre
    // explication. (Le balayage de `socle-jamais-coupe.test.ts`, lui, garde volontairement les
    // commentaires : là-bas c'est le REGISTRE qui est visé, pas un appel.)
    const src = brut.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(src.length, "source vide après retrait des commentaires — garde vide").toBeGreaterThan(400);
    expect(src).toMatch(/createSupabaseServerClient/);
    expect(src).not.toMatch(/createSupabaseAdminClient|service_role/);
  });
});
