import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ITEMS } from "@/lib/domain/enneagramme-items";

/**
 * enneagramme-halte.test.ts — LE SERVEUR DE LA HALTE (Story 5.5, T8 — D9/D11).
 *
 * `tests/rendu/enneagramme-halte.test.tsx` monte les composants ; ce fichier-ci garde ce qu'aucune
 * montée ne peut atteindre : la page est un Server Component `async` qui ouvre une session Supabase,
 * et les Server Actions décident de ce qui s'écrit.
 *
 * Les gardes de SOURCE sont assumées comme telles — elles prouvent le CÂBLAGE, jamais le
 * comportement (leçon de la re-revue 4.6). Elles sont ici parce que la propriété gardée est
 * structurelle et qu'aucun montage ne l'atteint : une `key`, une barrière d'onboarding, une absence
 * d'écriture au rendu.
 */

const racine = resolve(__dirname, "..");
const lire = (chemin: string) => readFileSync(resolve(racine, chemin), "utf8");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les gardes de source de la page
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/D9] le composant du test est REMONTÉ, jamais remis à zéro", () => {
  const PAGE = "app/enneagramme/page.tsx";

  it("[LE CŒUR] `TestCourt` porte une `key` dérivée de la TENTATIVE", () => {
    // Mutation-cible : retirer la `key`. La scène monte ses trois régions en permanence et
    // `Conversation` n'est jamais démontée ; un `useState` local n'est donc JAMAIS réinitialisé par
    // une navigation. C'est mot pour mot le défaut n° 6 de la revue 4.6 — le champ de renommage qui
    // fuyait d'une branche à l'autre — et « refaire le test » est exactement le geste qui le
    // déclencherait : les réponses de la passe précédente resteraient à l'écran.
    const source = lire(PAGE);
    expect(source).toMatch(/<TestCourt\s+key=\{cleTentative\}/);
    // …et la clé vient bien de l'identifiant de la passe, pas d'une constante.
    expect(source).toMatch(/const cleTentative =[\s\S]*?tentative\.tentativeId/);
  });

  it("`localStorage` est BANNI de toute la halte", () => {
    // Contamination entre comptes sur un navigateur partagé (`render/arbre/ArbreInteractif.tsx`).
    for (const f of [
      "app/enneagramme/page.tsx",
      "app/enneagramme/test-court.tsx",
      "app/enneagramme/hypothese.tsx",
      "app/enneagramme/resultat.tsx",
      "app/enneagramme/actions.ts",
    ]) {
      // ⚠️ On cherche un USAGE (`localStorage.setItem`, `localStorage[…]`), pas le MOT : les
      // commentaires de ces fichiers expliquent justement pourquoi il est banni, et une garde qui
      // rougirait sur sa propre explication pousserait à effacer l'explication.
      expect(lire(f), f).not.toMatch(/\blocalStorage\s*[.[]/);
      expect(lire(f), f).not.toMatch(/\bsessionStorage\s*[.[]/);
    }
  });
});

describe("[5.5/D11] la halte porte la MÊME barrière d'état que les autres", () => {
  it("les cinq redirections d'onboarding sont là, recopiées", () => {
    // « Une barrière oubliée dans un seul chemin suffit à laisser passer un mineur »
    // (`etat-onboarding.ts`). Cet écran ÉCRIT une donnée art. 9 : il ne peut pas y échapper.
    const source = lire("app/enneagramme/page.tsx");
    for (const garde of [
      'if (etape === "barre") redirect("/barriere")',
      'if (etape === "naissance") redirect("/naissance")',
      'if (etape === "consentement") redirect("/consentement")',
      'if (etape === "revoque") redirect("/consentement/revoque")',
    ]) {
      expect(source, garde).toContain(garde);
    }
    expect(source).toContain('if (etape === "mineur")');
    expect(source).toContain("signOut()");
  });

  it("[LE CŒUR] la page N'ÉCRIT RIEN — elle ne marque pas l'hypothèse « dite »", () => {
    // Mutation-cible : appeler `marquerHypotheseDite` ici. Ce rendu se ré-exécute à chaque
    // rafraîchissement ; la faute a été payée deux fois (revue 4.10, migration 0045). `dite_le` ne
    // se pose que sur un geste du CLIENT, quand la région portant la phrase est active.
    const source = lire("app/enneagramme/page.tsx");
    for (const ecriture of ["marquerHypotheseDite", "creerDepotEnneagramme", "terminerTentative"]) {
      expect(source, ecriture).not.toContain(ecriture);
    }
  });

  it("le titre de la route ne dit pas l'intimité de la page (NFR-015)", () => {
    const source = lire("app/enneagramme/page.tsx");
    expect(source).toContain('metadata = { title: "Anam" }');
    expect(source).not.toMatch(/title:\s*"[^"]*[Ee]nn/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les Server Actions
// ══════════════════════════════════════════════════════════════════════════════════════════════

const enregistrerReponses = vi.fn();
const terminerTentative = vi.fn();
const lireTentative = vi.fn();

vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
  }),
}));
vi.mock("@/lib/data/depot-enneagramme", () => ({
  creerDepotEnneagramme: () => ({
    enregistrerReponses: (a: unknown) => enregistrerReponses(a),
    terminerTentative: (a: unknown) => terminerTentative(a),
  }),
}));
vi.mock("@/lib/data/lire-enneagramme", () => ({
  lireTentativeEnneagramme: () => lireTentative(),
}));

const { conclureTest, departagerExAequo } = await import("@/app/enneagramme/actions");

/** Dix-huit réponses qui donnent un vainqueur net : le type de `ITEMS[0]` seul à 3. */
function reponsesAvecVainqueur(): Record<string, number> {
  const gagnant = ITEMS[0].type;
  return Object.fromEntries(ITEMS.map((i) => [i.id, i.type === gagnant ? 3 : 0]));
}

beforeEach(() => {
  enregistrerReponses.mockReset().mockResolvedValue("t-1");
  terminerTentative.mockReset().mockResolvedValue(true);
  lireTentative.mockReset();
});

describe("[5.5/AC1] `conclureTest` — le barème vit côté serveur", () => {
  it("[CONTRÔLE DU CONTRÔLE] un test complet retient un type", async () => {
    const reponses = reponsesAvecVainqueur();
    lireTentative.mockResolvedValue({
      statut: "calcule",
      tentative: {
        tentativeId: "t-1",
        reponses: Object.entries(reponses).map(([itemId, niveau]) => ({ itemId, niveau })),
      },
    });
    expect(await conclureTest(reponses)).toEqual({ statut: "retenu" });
    expect(terminerTentative).toHaveBeenCalledWith({ type: ITEMS[0].type });
  });

  it("[LE CŒUR] ce qui vient du client est FILTRÉ : identifiants inconnus et niveaux hors 0..3", async () => {
    // Le client peut poster n'importe quoi. Un niveau `99` sur un item réel fausserait le score sans
    // que rien ne le dise ; un identifiant inventé passerait dans le JSONB et ferait échouer la
    // contrainte de forme de 0049 — donc une écriture refusée, donc un test bloqué à l'écran.
    lireTentative.mockResolvedValue({ statut: "calcule", tentative: { tentativeId: "t", reponses: [] } });
    await conclureTest({ [ITEMS[0].id]: 99, "e0z": 2, [ITEMS[1].id]: 1, pasUnObjet: null });
    expect(enregistrerReponses).toHaveBeenCalledWith({ reponses: [{ itemId: ITEMS[1].id, niveau: 1 }] });
  });

  it("un test INCOMPLET ne retient rien", async () => {
    lireTentative.mockResolvedValue({
      statut: "calcule",
      tentative: { tentativeId: "t", reponses: [{ itemId: ITEMS[0].id, niveau: 3 }] },
    });
    expect(await conclureTest({ [ITEMS[0].id]: 3 })).toEqual({ statut: "en_cours" });
    expect(terminerTentative).not.toHaveBeenCalled();
  });

  it("[LE CŒUR] à ÉGALITÉ, rien n'est écrit — le produit refuse de trancher", async () => {
    // Mutation-cible : prendre `exaequo[0]`. Le biais serait systématique vers le plus petit numéro,
    // parfaitement déterministe, donc invisible à tout test de reproductibilité.
    const toutes = Object.fromEntries(ITEMS.map((i) => [i.id, 2]));
    lireTentative.mockResolvedValue({
      statut: "calcule",
      tentative: {
        tentativeId: "t",
        reponses: Object.entries(toutes).map(([itemId, niveau]) => ({ itemId, niveau })),
      },
    });
    const r = await conclureTest(toutes);
    expect(r.statut).toBe("indecis");
    expect(terminerTentative, "aucun type ne s'écrit sur une égalité").not.toHaveBeenCalled();
  });

  it("une panne de relecture se DIT, elle ne prétend pas avoir conclu", async () => {
    lireTentative.mockResolvedValue({ statut: "indisponible", raison: "lecture_impossible" });
    expect((await conclureTest(reponsesAvecVainqueur())).statut).toBe("erreur");
    expect(terminerTentative).not.toHaveBeenCalled();
  });
});

describe("[5.5/AC1] `departagerExAequo` — elle tranche, mais pas n'importe quoi", () => {
  const toutes = Object.fromEntries(ITEMS.map((i) => [i.id, 2]));
  beforeEach(() => {
    lireTentative.mockResolvedValue({
      statut: "calcule",
      tentative: {
        tentativeId: "t",
        reponses: Object.entries(toutes).map(([itemId, niveau]) => ({ itemId, niveau })),
      },
    });
  });

  it("[CONTRÔLE POSITIF] un type À ÉGALITÉ est accepté", async () => {
    // Tous les items à 2 : les neuf types sont à égalité, donc n'importe lequel est légitime.
    expect(await departagerExAequo(5)).toEqual({ statut: "retenu" });
    expect(terminerTentative).toHaveBeenCalledWith({ type: 5 });
  });

  it("hors domaine → refus, et rien n'est écrit", async () => {
    for (const mauvais of [0, 10, "4", null, 4.5]) {
      expect((await departagerExAequo(mauvais)).statut, String(mauvais)).toBe("erreur");
    }
    expect(terminerTentative).not.toHaveBeenCalled();
  });

  it("[LE CŒUR] un type qui n'est PAS à égalité est refusé", async () => {
    // Sans cette garde, l'écran deviendrait un menu où l'on se choisit un type sans passer par le
    // test. C'est une garde de PRODUIT, pas de sécurité — la base, elle, accepte n'importe quel type
    // de sa part, et l'en-tête de 0049 dit pourquoi.
    const gagnant = ITEMS[0].type;
    const net = Object.fromEntries(ITEMS.map((i) => [i.id, i.type === gagnant ? 3 : 0]));
    lireTentative.mockResolvedValue({
      statut: "calcule",
      tentative: {
        tentativeId: "t",
        reponses: Object.entries(net).map(([itemId, niveau]) => ({ itemId, niveau })),
      },
    });
    const autre = gagnant === 1 ? 2 : 1;
    expect((await departagerExAequo(autre)).statut).toBe("erreur");
    expect(terminerTentative).not.toHaveBeenCalled();
  });
});
