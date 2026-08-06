import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * REVUE 4.9 — LA HALTE `/synthese`, MONTÉE POUR DE VRAI.
 *
 * La 4.9 a livré `app/synthese/page.tsx` et `render/synthese/FicheSynthese.tsx` sans une seule ligne de
 * test, alors que ce projet Vitest existe précisément pour cette classe de défaut : il a été créé après
 * la re-revue 4.6, où sept défauts sur dix-sept vivaient dans `render/`. Deux des corrections du lot A
 * sont ici, et aucune n'aurait pu être prouvée autrement :
 *
 *   • T1-3 — la GARDE D'ÉTAT. C'était le seul écran authentifié du produit sans elle, sur la page qui
 *     affiche de l'art. 9, et celle dont l'entrée normale est un lien de courriel — donc un accès direct,
 *     hors du chemin gardé. La RLS ne rattrape rien : la policy propriétaire autorise la lecture de SES
 *     lignes sans regarder ni la barrière de minorité ni le consentement.
 *   • T1-6 — L'ERREUR QUI MENTAIT. `error` n'était pas déstructuré, donc une 5xx PostgREST affichait
 *     « Il n'y en a pas encore » à quelqu'un qui en a trente — dans la minute même où un courriel venait
 *     de lui annoncer le contraire. C'est le défaut corrigé en 4.6, réintroduit trois fichiers plus loin.
 */

const redirections: string[] = [];
const deconnexions: number[] = [];

class RedirectionSimulee extends Error {
  constructor(readonly cible: string) {
    super(`REDIRECT:${cible}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (cible: string) => {
    redirections.push(cible);
    // `redirect()` de Next lève une exception spéciale : la simuler est indispensable, sinon le code qui
    // suit continuerait de s'exécuter et le test prouverait l'inverse de ce qu'il annonce.
    throw new RedirectionSimulee(cible);
  },
}));

let etapeCourante = "suite";
vi.mock("@/app/(auth)/etat-onboarding", () => ({
  etapeOnboardingPour: async () => etapeCourante,
}));

let reponseLecture: { data: unknown; error: unknown } = { data: [], error: null };
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
      signOut: async () => {
        deconnexions.push(1);
      },
    },
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => reponseLecture,
        }),
      }),
    }),
  }),
}));

const { default: Page } = await import("@/app/synthese/page");

async function monter() {
  render(await Page());
}

/** Rend la page en absorbant la redirection simulée, et rend la cible atteinte. */
async function monterEnAttendantRedirection(): Promise<string | null> {
  try {
    await monter();
    return null;
  } catch (e) {
    if (e instanceof RedirectionSimulee) return e.cible;
    throw e;
  }
}

const SYNTHESE = {
  id: "s1",
  periode_debut: "2026-08-01T10:00:00Z",
  periode_fin: "2026-08-07T10:00:00Z",
  contenu: "## Ta semaine\nTu as repris le dessin.",
  tronquee: false,
};

beforeEach(() => {
  redirections.length = 0;
  deconnexions.length = 0;
  etapeCourante = "suite";
  reponseLecture = { data: [SYNTHESE], error: null };
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[T1-3] la garde d'état — aucune barrière ne s'arrête à la porte de cette page", () => {
  it("[LE CŒUR] une minorité BARRÉE ne lit pas son récit, elle est renvoyée à la barrière", async () => {
    // Sa session n'est délibérément PAS détruite (1.9, pour que l'export fonctionne). Elle avait reçu un
    // courriel la semaine d'avant ; il est toujours dans sa boîte. Sans cette garde, le lien l'ouvre et
    // lui rend l'intégralité de son contenu art. 9, pendant que tout le reste du produit la renvoie à
    // `/barriere`. Mutation-cible : retirer `if (etape === "barre") redirect("/barriere")`.
    etapeCourante = "barre";
    expect(await monterEnAttendantRedirection()).toBe("/barriere");
    expect(screen.queryByText(/repris le dessin/), "rien n'a été rendu").toBeNull();
  });

  it("[LE CŒUR] un consentement art. 9 RÉVOQUÉ ferme la page aussi", async () => {
    // La consultation est un traitement (art. 4.2 RGPD), et AD-13 dit que la révocation bascule
    // l'utilisatrice en traitement art. 9 suspendu. `app/page.tsx` la renvoie déjà à l'écran de
    // révocation ; cette page continuait de servir ses récits.
    etapeCourante = "revoque";
    expect(await monterEnAttendantRedirection()).toBe("/consentement/revoque");
  });

  it("un mineur signalé est déconnecté, pas seulement redirigé (FR-070)", async () => {
    etapeCourante = "mineur";
    expect(await monterEnAttendantRedirection()).toBe("/entrer?refus=age");
    expect(deconnexions, "la barrière est persistante : la session tombe").toHaveLength(1);
  });

  it("les étapes d'onboarding inachevées renvoient à leur halte", async () => {
    for (const [etape, cible] of [
      ["naissance", "/naissance"],
      ["consentement", "/consentement"],
    ] as const) {
      etapeCourante = etape;
      expect(await monterEnAttendantRedirection()).toBe(cible);
    }
  });

  it("[CONTRÔLE POSITIF] le seuil franchi, la synthèse s'affiche", async () => {
    // Sans lui, les quatre tests ci-dessus seraient satisfaits par une page qui redirige TOUJOURS.
    await monter();
    expect(screen.getByText(/repris le dessin/)).toBeTruthy();
    expect(redirections).toEqual([]);
  });
});

describe("[T1-6] une panne de lecture ne s'annonce jamais comme un vide", () => {
  it("[LE CŒUR] une erreur PostgREST dit la PANNE, jamais « il n'y en a pas encore »", async () => {
    // Mutation-cible : retirer `error` de la déstructuration (revenir à `const { data }`). Le test rougit
    // parce que la page dirait alors à quelqu'un qui a trente synthèses qu'elle n'en a aucune — et le
    // dirait dans la minute où un courriel vient de lui annoncer le contraire.
    reponseLecture = { data: null, error: { code: "PGRST500" } };
    await monter();

    expect(screen.getByText(/Je n’arrive pas à relire/), "la panne est dite").toBeTruthy();
    expect(screen.queryByText(/Il n’y en a pas encore/), "et surtout : pas le vide").toBeNull();
  });

  it("[CONTRÔLE POSITIF] un vrai vide, lui, se dit sobrement", async () => {
    // La distinction est tout l'objet du correctif : sans ce contrôle, une page qui dirait TOUJOURS
    // « panne » passerait le test précédent.
    reponseLecture = { data: [], error: null };
    await monter();

    expect(screen.getByText(/Il n’y en a pas encore/)).toBeTruthy();
    expect(screen.queryByText(/Je n’arrive pas à relire/)).toBeNull();
  });
});

describe("[T6-1] la période est datée en Europe/Paris, pas dans le fuseau du serveur", () => {
  it("[LE CŒUR] une entrée de 00 h 30 heure de Paris reste au 3 août, même sur un serveur en UTC", async () => {
    // `2026-08-02T22:30:00Z` est le 3 août à 00 h 30 à Paris — heure de journal intime s'il en est. Sans
    // `timeZone` explicite, le rendu affichait « 2 août » une fois déployé sur Vercel (TZ=UTC), et
    // seulement là : le défaut était invisible en développement. Mutation-cible : retirer `timeZone`.
    reponseLecture = {
      data: [{ ...SYNTHESE, periode_debut: "2026-08-02T22:30:00Z", periode_fin: "2026-08-07T10:00:00Z" }],
      error: null,
    };
    await monter();
    expect(screen.getByText(/Du 3 août 2026 au 7 août 2026/)).toBeTruthy();
  });

  it("une tranche qui tient dans une seule journée s'écrit comme quelqu'un l'écrirait", async () => {
    reponseLecture = {
      data: [{ ...SYNTHESE, periode_debut: "2026-08-03T08:00:00Z", periode_fin: "2026-08-03T20:00:00Z" }],
      error: null,
    };
    await monter();
    expect(screen.getByText(/^Le 3 août 2026$/)).toBeTruthy();
  });
});

describe("[AD-7] le rendu DESSINE — il ne parse pas, il ne décide pas", () => {
  it("le texte du modèle est rendu tel quel, sans balise interprétée", async () => {
    // La leçon 4.7 : un parseur d'un texte de modèle est soit trop strict et perd la structure, soit trop
    // souple et invente la sienne. Ici on vérifie qu'aucun HTML n'est interprété — ce qui vaut aussi
    // garantie anti-XSS sur un contenu que le produit n'écrit pas lui-même.
    reponseLecture = {
      data: [{ ...SYNTHESE, contenu: "<img src=x onerror=alert(1)> et **gras**" }],
      error: null,
    };
    await monter();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)> et \*\*gras\*\*/)).toBeTruthy();
    expect(document.querySelector("img"), "aucune balise n'a été interprétée").toBeNull();
  });

  it("la troncature est DITE — la taire ferait lire son silence comme « il ne s'est rien passé »", async () => {
    reponseLecture = { data: [{ ...SYNTHESE, tronquee: true }], error: null };
    await monter();
    expect(screen.getByText(/s’arrête avant la fin de la période/)).toBeTruthy();
  });

  it("[FR-031] aucun compte, aucun chiffre, aucune position affichés", async () => {
    reponseLecture = {
      data: [SYNTHESE, { ...SYNTHESE, id: "s2" }, { ...SYNTHESE, id: "s3" }],
      error: null,
    };
    await monter();
    const texte = document.body.textContent ?? "";
    expect(texte, "pas de compte").not.toMatch(/\b3 synthèses?\b/);
    expect(texte, "pas de rang").not.toMatch(/\b\d+(ᵉ|ème|e) synthèse/);
  });
});
