import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * bibliotheque-lecture.test.ts — LA COMPOSITION SERVEUR DE L'ACCUEIL (Story 5.6, T4).
 *
 * Deux propriétés s'y jouent, et **aucune des deux ne se voit à l'exécution** :
 *
 *   1. `lireThemeNatal` n'est appelé QU'UNE FOIS. Deux appels rendraient le même thème — donc rien
 *      ne les distinguerait à l'écran. Ce qui les distingue, c'est le COÛT (~663 lectures
 *      d'éphéméride au premier calcul dans le cas dégradé) et l'ÉCRITURE tentée deux fois, en
 *      concurrence, dans le même `Promise.all` que `chargerProjectionArbre`.
 *
 *   2. L'échec d'une lecture n'emporte pas les autres. Une carte vide, jamais un accueil vide —
 *      c'est la leçon de la revue 5.4/B4 (un chemin fragile placé en amont d'un chemin robuste).
 */

const lireThemeNatal = vi.fn();
const lireNumerologie = vi.fn();
const lireEnneagramme = vi.fn();

vi.mock("@/lib/data/depot-theme-natal", () => ({
  lireThemeNatal: (...a: unknown[]) => lireThemeNatal(...a),
}));
vi.mock("@/lib/data/lire-numerologie", () => ({
  lireNumerologie: (...a: unknown[]) => lireNumerologie(...a),
  anneeCouranteParis: () => 2026,
}));
vi.mock("@/lib/data/lire-enneagramme", () => ({
  lireEnneagramme: (...a: unknown[]) => lireEnneagramme(...a),
}));

const { lireBibliotheque } = await import("@/lib/data/lire-bibliotheque");

const SUPABASE = {} as never;
const UID = "11111111-1111-4111-8111-111111111111";
const MAINTENANT = new Date("2026-08-14T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  lireThemeNatal.mockResolvedValue({ statut: "indisponible", raison: "naissance_absente" });
  lireNumerologie.mockResolvedValue({ statut: "indisponible", raison: "naissance_absente" });
  lireEnneagramme.mockResolvedValue({ statut: "indisponible", raison: "sans_type" });
});

describe("[5.6/T4] le thème natal est lu UNE SEULE FOIS", () => {
  it("[LE TEST QUI COMPTE] sans thème fourni, exactement un appel — jamais deux", () => {
    return lireBibliotheque(SUPABASE, UID, MAINTENANT, false).then(() => {
      expect(
        lireThemeNatal.mock.calls.length,
        "deux appels = deux calculs concurrents et deux écritures en course (piège P10)",
      ).toBe(1);
    });
  });

  it("[LE TEST QUI COMPTE] quand la PAGE l'a déjà lu, ZÉRO appel", async () => {
    // C'est le cas réel depuis la 5.6 : `app/page.tsx` lit le thème une fois et le passe aux deux
    // consommateurs (`chargerProjectionArbre` et cette lecture), qui sont dans le même `Promise.all`.
    await lireBibliotheque(SUPABASE, UID, MAINTENANT, false, undefined, {
      statut: "indisponible",
      raison: "naissance_absente",
    });
    expect(lireThemeNatal).not.toHaveBeenCalled();
  });
});

describe("[5.6/AC7] l'échec d'une lecture n'emporte jamais les autres", () => {
  it("les cinq cartes sont là même quand TOUT est indisponible", async () => {
    const b = await lireBibliotheque(SUPABASE, UID, MAINTENANT, false);
    expect(b.cartes.map((c) => c.cle).sort()).toEqual([
      "enneagramme",
      "horoscope",
      "mantra",
      "nombres",
      "theme",
    ]);
    // Aucune n'a rien à montrer aujourd'hui : il n'y a donc pas de carte du jour, et rien ne casse.
    expect(b.enAvant).toBeNull();
  });

  it("[LE TEST QUI COMPTE] une numérologie qui LÈVE ne fait pas disparaître l'ennéagramme", async () => {
    lireNumerologie.mockRejectedValue(new Error("timeout"));
    lireEnneagramme.mockResolvedValue({
      statut: "calcule",
      type: 4,
      origine: "test",
      texte: { statut: "non_ecrit" },
    });
    const b = await lireBibliotheque(SUPABASE, UID, MAINTENANT, false);
    expect(b.cartes).toHaveLength(5);
    const e9 = b.cartes.find((c) => c.cle === "enneagramme");
    expect(e9?.faits, "l'ennéagramme est tombé avec la numérologie").toEqual([
      { intitule: "Type", valeur: "4" },
    ]);
    // Et c'est la seule carte présentable, donc c'est elle qui est mise en avant.
    expect(b.enAvant).toBe("enneagramme");
  });

  it("un ennéagramme qui LÈVE ne fait pas disparaître les nombres", async () => {
    lireEnneagramme.mockRejectedValue(new Error("timeout"));
    lireNumerologie.mockResolvedValue({
      statut: "calcule",
      numerologie: {
        schema: 1,
        methodeCheminDeVie: "reduction_separee",
        regleY: "voyelle",
        basculeAnneePersonnelle: "premier_janvier",
        anneeDeReference: 2026,
        nombres: {
          chemin_de_vie: { statut: "calcule", valeur: 7, maitre: false },
          expression: { statut: "non_calcule", raison: "nom_absent" },
          intime: { statut: "non_calcule", raison: "nom_absent" },
          personnalite: { statut: "non_calcule", raison: "nom_absent" },
          jour_de_naissance: { statut: "calcule", valeur: 4, maitre: false },
          annee_personnelle: { statut: "calcule", valeur: 9, maitre: false },
        },
      },
    });
    const b = await lireBibliotheque(SUPABASE, UID, MAINTENANT, false);
    expect(b.cartes.find((c) => c.cle === "nombres")?.faits).toHaveLength(3);
    expect(b.enAvant).toBe("nombres");
  });

  it("[NFR-022] aucune donnée personnelle ne sort dans un log d'erreur", async () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    lireNumerologie.mockRejectedValue(new Error(`échec pour ${UID}`));
    await lireBibliotheque(SUPABASE, UID, MAINTENANT, false);
    for (const appel of espion.mock.calls) {
      expect(JSON.stringify(appel), "un identifiant a fuité dans un log").not.toContain(UID);
    }
    expect(espion, "contrôle positif : la panne EST journalisée").toHaveBeenCalled();
  });
});

describe("[5.6/AC1] le jour porté par la bibliothèque est celui de Paris", () => {
  it("le jour civil accompagne la bibliothèque jusqu'au rendu", async () => {
    const b = await lireBibliotheque(SUPABASE, UID, MAINTENANT, false);
    // Sans lui, deux jours d'horoscope identiques (la Lune met ~2,5 jours à changer de signe) se
    // liraient comme une application bloquée — report explicite de la 5.4.
    expect(b.jour).toEqual({ a: 2026, m: 8, j: 14 });
  });

  it("juste avant minuit à Paris, on est encore la veille", async () => {
    // 2026-08-14 21:59 UTC = 23:59 à Paris (heure d'été). Le jour ne bascule pas encore.
    const b = await lireBibliotheque(SUPABASE, UID, new Date("2026-08-14T21:59:00Z"), false);
    expect(b.jour).toEqual({ a: 2026, m: 8, j: 14 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le CÂBLAGE de la page — la seule chose que les mocks ci-dessus ne peuvent pas voir
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/T8] `app/page.tsx` lit le thème UNE FOIS et le passe à ses DEUX consommateurs", () => {
  /**
   * ⚠️ CE DÉFAUT NE SE VOIT PAS À L'EXÉCUTION, ET C'EST TOUT LE PROBLÈME. Deux appels à
   * `lireThemeNatal` rendent le même thème : l'écran est identique. Ce qui diffère, c'est le coût
   * (~663 lectures d'éphéméride au premier calcul dans le cas dégradé) et le fait que les deux
   * chemins vivent dans le MÊME `Promise.all` — donc que les deux ÉCRITURES partent en concurrence,
   * aucune ne voyant l'autre.
   *
   * Avant la 5.6, un seul chemin lisait le thème (`chargerProjectionArbre`, pour le drapeau de tronc
   * incomplet). L'accueil en ajoute un second. C'est cette story qui crée la course, donc c'est à
   * elle de la fermer — et de laisser une garde derrière elle.
   *
   * Garde de SOURCE, faute de mieux : une page Server Component ne se monte pas dans ce harnais.
   * Elle est grossière et c'est dit — elle prouve le câblage, pas le comportement.
   */
  const PAGE = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf-8");
  const sansCommentaires = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("[CONTRÔLE DU CONTRÔLE] la page a bien été lue et dépouillée", () => {
    expect(sansCommentaires).toContain("SceneDom");
    expect(sansCommentaires.length).toBeGreaterThan(400);
  });

  it("[LE TEST QUI COMPTE] `lireThemeNatal` n'est appelé qu'UNE fois dans la page", () => {
    const appels = [...sansCommentaires.matchAll(/lireThemeNatal\s*\(/g)];
    expect(
      appels.length,
      "deux appels dans la page = deux calculs concurrents et deux écritures en course",
    ).toBe(1);
  });

  it("les DEUX consommateurs reçoivent le thème déjà lu", () => {
    // Si l'un des deux ne le recevait pas, il le relirait lui-même — et la course reviendrait
    // sans qu'une ligne de la page ne change de forme.
    expect(sansCommentaires, "chargerProjectionArbre relit le thème").toMatch(
      /chargerProjectionArbre\s*\([^)]*theme[^)]*\)/,
    );
    expect(sansCommentaires, "lireBibliotheque relit le thème").toMatch(
      /lireBibliotheque\s*\([^)]*theme[^)]*\)/,
    );
  });

  it("[AC7] la bibliothèque a un repli sûr — une panne n'emporte pas la scène", () => {
    // L'accueil est une région parmi quatre. Une lecture de socle en échec ne doit fermer ni la
    // conversation ni l'arbre : la page rend `null` et la scène s'ouvre quand même.
    expect(sansCommentaires).toMatch(/lireBibliotheque[\s\S]{0,200}?\.catch\(/);
  });

  it("une seule éphéméride est composée, et elle est partagée", () => {
    expect([...sansCommentaires.matchAll(/ephemerideAstronomyEngine\s*\(/g)]).toHaveLength(1);
  });
});
