import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sansCommentaires } from "./_absence";

/**
 * deconnexion.test.ts — REFERMER SA SESSION (QA tour 1, T22).
 *
 * ══ CE QUI ÉTAIT EN JEU ═════════════════════════════════════════════════════════════════════════
 *
 * La QA du 2026-08-15 n'a trouvé, sur aucun écran, un moyen de se déconnecter. Les seuls `signOut`
 * du dépôt étaient des chemins de SUSPENSION de minorité — le produit fermait la session de
 * quelqu'un qu'il refusait, jamais de quelqu'un qui le demandait.
 *
 * Sur un téléphone partagé, ça veut dire qu'on ne peut pas refermer ce qu'on vient d'écrire. C'est
 * en contradiction directe avec l'attention portée partout ailleurs à la discrétion — l'aperçu de
 * notification neutre, les titres d'onglet qui disent tous « Anam » et rien d'autre (NFR-015).
 *
 * ══ LE MUTANT QUI COMPTE ════════════════════════════════════════════════════════════════════════
 *
 * Une déconnexion qui NAVIGUE sans fermer la session est pire que pas de déconnexion du tout : elle
 * donne la certitude d'être partie à quelqu'un qui ne l'est pas. `redirect()` de Next LÈVE — donc
 * l'ordre n'est pas un détail de style, c'est la garde elle-même : `signOut` après `redirect` ne
 * s'exécuterait jamais.
 */

const signOut = vi.fn(async () => ({ error: null }));
const getUser = vi.fn(async () => ({ data: { user: { id: "u-1" } } }));

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser, signOut } }),
}));

// `redirect` lève, exactement comme dans Next — c'est ce qui rend l'ORDRE observable.
class Redirection extends Error {
  constructor(readonly cible: string) {
    super(`NEXT_REDIRECT:${cible}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (cible: string) => {
    throw new Redirection(cible);
  },
}));

const { seDeconnecter } = await import("@/app/reglages/actions");
const copie = await import("@/lib/domain/copie-reglages");

const racine = process.cwd();
const lire = (p: string) => sansCommentaires(readFileSync(resolve(racine, p), "utf-8"));

async function deconnecter(): Promise<string> {
  try {
    await seDeconnecter();
  } catch (e) {
    if (e instanceof Redirection) return e.cible;
    throw e;
  }
  throw new Error("`seDeconnecter` a rendu la main sans rediriger");
}

describe("[QA T22] `seDeconnecter` — la session se referme VRAIMENT", () => {
  beforeEach(() => {
    signOut.mockClear();
    getUser.mockClear();
  });

  it("ferme la session AVANT de naviguer", async () => {
    // ⚠️ LE MUTANT : intervertir les deux lignes. `redirect` lève, donc un `signOut` placé après ne
    // s'exécute jamais — l'écran dirait « c'est fermé » sur une session toujours ouverte.
    const cible = await deconnecter();
    expect(signOut, "la session doit être fermée, pas seulement quittée").toHaveBeenCalledTimes(1);
    expect(cible).toBe("/entrer?deconnexion=1");
  });

  it("ne demande RIEN avant — ni consentement, ni état de détresse", async () => {
    // Même doctrine qu'en 3.5 pour la résiliation et qu'en R7 pour les courriels : on ne garde
    // jamais une SORTIE. Garder celle-ci empêcherait quelqu'un en crise de refermer son écran.
    const src = lire("app/reglages/actions.ts");
    const debut = src.indexOf("export async function seDeconnecter");
    // ⚠️ SANS CETTE LIGNE, LE TEST PASSAIT À VIDE. `indexOf` rend -1 quand la fonction n'existe
    // pas ; `slice(-1)` puis `slice(0, -1)` donnaient la chaîne vide, qui ne contient évidemment
    // aucune garde. Un test qui se réjouit de l'absence de son propre sujet ne garde rien.
    expect(debut, "la fonction doit exister pour que ce test veuille dire quelque chose").
      toBeGreaterThan(-1);
    const corps = src.slice(debut);
    const fin = corps.indexOf("\n}");
    expect(fin, "le corps de la fonction doit être délimitable").toBeGreaterThan(0);
    expect(corps.slice(0, fin), "aucune garde d'état sur une sortie").not.toMatch(
      /etapeOnboarding|consentement|detresse|limites_levees/i,
    );
  });

  it("ferme la session même si la lecture de session échoue", async () => {
    // ⚠️ `if (!user) return` SERAIT UN DÉFAUT ICI. Une session illisible est exactement le cas où
    // l'on veut le plus fermer : le refus laisserait le cookie en place sur un appareil partagé.
    getUser.mockResolvedValueOnce({ data: { user: null } } as never);
    await deconnecter();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe("[QA T22] ce que l'écran DIT, et où il le dit", () => {
  it("`/reglages` rend le bouton — pas seulement la constante importée", () => {
    // La famille de défauts du dépôt : la garde vérifie qu'un nom APPARAÎT, pas qu'il SERT.
    const src = lire("app/reglages/page.tsx");
    expect(src).toMatch(/\{copie\.SE_DECONNECTER\}/);
    expect(src).toMatch(/action=\{seDeconnecter\}/);
  });

  it("la phrase annonce le COÛT du geste : il faudra un nouveau lien", () => {
    // Sans mot de passe, se déconnecter n'est pas gratuit — il faut rouvrir sa boîte mail. Le dire
    // AVANT le clic, c'est la différence entre un geste et un piège.
    expect(copie.DESCRIPTION_SESSION).toMatch(/lien/i);
    expect(copie.SE_DECONNECTER, "le mot que les gens cherchent").toMatch(/déconnect/i);
  });

  it("`/entrer` confirme la fermeture, et dans le registre PRODUIT", () => {
    // Précédent posé par l'effacement (6.7) : `t-anam` serait la voix d'Anam, et Anam n'a rien à
    // dire ici — c'est un fait de session, pas une parole.
    const src = lire("app/(auth)/entrer/page.tsx");
    expect(src).toMatch(/deconnexion === "1"/);
    expect(src).toMatch(/SESSION_FERMEE/);
    expect(src).not.toMatch(/t-anam"[^>]*>\s*\{SESSION_FERMEE\}/);
  });
});
