import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import { calculerThemeNatal } from "@/lib/astro/theme-natal";
import type { Corps, EphemerisPort } from "@/lib/astro/port";

/**
 * Story 5.4 (T7) — LE CHEMIN DE LECTURE DU SOCLE QUOTIDIEN.
 *
 * ══ CE QUE CE FICHIER GARDE ══════════════════════════════════════════════════════════════════════
 *
 * Trois choses que le domaine ne peut pas garder tout seul, parce qu'elles n'existent que dans cette
 * couche : la résolution du JOUR CIVIL (D3, et ses deux jours de changement d'heure), la
 * MÉMOÏSATION du ciel (D7, et sa borne), et la DÉGRADATION — le mantra doit sortir même quand tout
 * le reste échoue (AC6).
 */

const { lireThemeNatalMock, mantraEspion } = vi.hoisted(() => ({
  lireThemeNatalMock: vi.fn(),
  mantraEspion: vi.fn(),
}));
vi.mock("@/lib/data/depot-theme-natal", () => ({
  lireThemeNatal: lireThemeNatalMock,
}));

/**
 * Le mantra reste RÉEL — on ne fait qu'observer ce qui lui est passé.
 *
 * ⚠️ NÉCESSAIRE parce que les 60 créneaux sont `non_ecrit` : deux mantras sont indiscernables par
 * leur valeur, donc comparer les SORTIES ne prouve rien sur ce qui a été demandé. C'est ce qui a
 * laissé survivre le mutant M22 (« indexer le mantra sur l'utilisatrice ») à la première campagne.
 */
vi.mock("@/lib/corpus/mantra", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/corpus/mantra")>();
  return {
    ...reel,
    mantraDuJour: (j: Parameters<typeof reel.mantraDuJour>[0]) => {
      mantraEspion(j);
      return reel.mantraDuJour(j);
    },
  };
});

const { jourCivilParis, jourResoluParis, lireSocleQuotidien, viderMemoCiel } = await import(
  "@/lib/data/lire-quotidien"
);

const ephemeride = ephemerideAstronomyEngine();

const THEME = calculerThemeNatal(
  { date: "1990-06-15", heure: "07:15", fuseau: "Europe/Paris", latitude: 48.8566, longitude: 2.3522 },
  ephemeride,
);

/** Un client factice : ce fichier ne touche jamais la base — `lireThemeNatal` est doublé. */
const supabase = {} as unknown as SupabaseClient;

/** Un port qui compte ses lectures, pour prouver ce que la mémoïsation évite RÉELLEMENT. */
function compteur(reel: EphemerisPort): { port: EphemerisPort; lectures: () => number } {
  let n = 0;
  return {
    lectures: () => n,
    port: {
      identifiant: reel.identifiant,
      longitudeEcliptique(corps: Corps, t: Date) {
        n += 1;
        return reel.longitudeEcliptique(corps, t);
      },
      tempsSideralGreenwich: (t: Date) => reel.tempsSideralGreenwich(t),
      obliquiteVraie: (t: Date) => reel.obliquiteVraie(t),
    },
  };
}

beforeEach(() => {
  lireThemeNatalMock.mockReset();
  mantraEspion.mockReset();
  lireThemeNatalMock.mockResolvedValue({ statut: "calcule", theme: THEME, version: 1 });
  viderMemoCiel();
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le jour civil parisien (D3)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7 / D3] jourCivilParis — la bascule est à minuit À PARIS, pas à minuit UTC", () => {
  it("en été (UTC+2), 22 h 30 UTC est DÉJÀ le lendemain à Paris", () => {
    // Le mutant : lire le jour en UTC. Pendant 2 h chaque soir d'été, le produit servirait le
    // mantra de la veille — invisible pour qui teste en journée.
    expect(jourCivilParis(new Date("2026-08-11T21:30:00Z"))).toEqual({ a: 2026, m: 8, j: 11 });
    expect(jourCivilParis(new Date("2026-08-11T22:30:00Z"))).toEqual({ a: 2026, m: 8, j: 12 });
  });

  it("en hiver (UTC+1), la bascule est une heure plus tard", () => {
    expect(jourCivilParis(new Date("2026-01-11T22:30:00Z"))).toEqual({ a: 2026, m: 1, j: 11 });
    expect(jourCivilParis(new Date("2026-01-11T23:30:00Z"))).toEqual({ a: 2026, m: 1, j: 12 });
  });

  it("passe une fin d'année", () => {
    expect(jourCivilParis(new Date("2026-12-31T23:30:00Z"))).toEqual({ a: 2027, m: 1, j: 1 });
  });
});

describe("[T7 / D2 / P5] jourResoluParis — 23, 24 ou 25 h, jamais « minuit + 24 h »", () => {
  const heures = (d: Date, f: Date) => (f.getTime() - d.getTime()) / 3_600_000;

  it("un jour ordinaire dure 24 h et sa référence est midi", () => {
    const r = jourResoluParis(new Date("2026-08-11T10:00:00Z"));
    expect(heures(r.fenetre.min, r.fenetre.max)).toBe(24);
    // Midi à Paris en été = 10 h UTC.
    expect(r.reference.toISOString()).toBe("2026-08-11T10:00:00.000Z");
  });

  it("[LE CAS QUI COMPTE] le 29 mars 2026, la journée parisienne dure 23 h", () => {
    // Passage à l'heure d'été. Le mutant `min + 24 h` mordrait sur le 30 mars, et le ciel du jour
    // détecterait un changement de signe qui n'appartient pas à ce jour-là.
    const r = jourResoluParis(new Date("2026-03-29T10:00:00Z"));
    expect(heures(r.fenetre.min, r.fenetre.max)).toBe(23);
    expect(r.reference.toISOString()).toBe("2026-03-29T10:00:00.000Z");
  });

  it("[LE CAS QUI COMPTE] le 25 octobre 2026, elle dure 25 h", () => {
    const r = jourResoluParis(new Date("2026-10-25T10:00:00Z"));
    expect(heures(r.fenetre.min, r.fenetre.max)).toBe(25);
  });

  it("la référence est toujours DANS la fenêtre", () => {
    for (const iso of ["2026-01-15", "2026-03-29", "2026-08-11", "2026-10-25", "2026-12-31"]) {
      const r = jourResoluParis(new Date(`${iso}T10:00:00Z`));
      expect(r.reference.getTime(), iso).toBeGreaterThan(r.fenetre.min.getTime());
      expect(r.reference.getTime(), iso).toBeLessThan(r.fenetre.max.getTime());
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La mémoïsation (D7, P6, P7)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7 / D7 / AC1] le ciel du jour est mémoïsé — le personnel ne l'est jamais", () => {
  it("[PRÉSENCE AVANT ABSENCE] la PREMIÈRE lecture d'un jour calcule bien le ciel", () => {
    // Sans ce témoin, « la seconde lecture ne coûte rien » serait vrai d'un cache qui ne calcule
    // jamais rien du tout.
    const { port, lectures } = compteur(ephemeride);
    return lireSocleQuotidien(supabase, "u1", new Date("2026-08-11T10:00:00Z"), port).then(() => {
      expect(lectures()).toBeGreaterThan(100);
    });
  });

  it("[AC1] la SECONDE lecture du même jour ne relit AUCUNE éphéméride", () => {
    const { port, lectures } = compteur(ephemeride);
    const t = new Date("2026-08-11T10:00:00Z");
    return lireSocleQuotidien(supabase, "u1", t, port)
      .then(() => lectures())
      .then((apresPremiere) =>
        lireSocleQuotidien(supabase, "u2", t, port).then(() => {
          // « u2 » : une AUTRE utilisatrice. Le ciel est impersonnel — c'est ce qui rend la
          // mémoïsation légitime, et ce test le prouve.
          expect(lectures()).toBe(apresPremiere);
        }),
      );
  });

  it("un jour DIFFÉRENT recalcule — le cache n'est pas figé sur le premier jour vu", async () => {
    const { port, lectures } = compteur(ephemeride);
    await lireSocleQuotidien(supabase, "u1", new Date("2026-08-11T10:00:00Z"), port);
    const apres = lectures();
    await lireSocleQuotidien(supabase, "u1", new Date("2026-08-12T10:00:00Z"), port);
    expect(lectures()).toBeGreaterThan(apres);
  });

  it("[P6/DUR] la mémoïsation est BORNÉE — le troisième jour évince le premier", async () => {
    const { port, lectures } = compteur(ephemeride);
    for (const j of [11, 12, 13]) {
      await lireSocleQuotidien(supabase, "u1", new Date(`2026-08-${j}T10:00:00Z`), port);
    }
    const avant = lectures();
    // Le 11 a été évincé : le relire doit RECALCULER.
    await lireSocleQuotidien(supabase, "u1", new Date("2026-08-11T10:00:00Z"), port);
    expect(lectures()).toBeGreaterThan(avant);

    // …tandis que le 13, encore en mémoire au moment de sa relecture, ne coûte rien.
    viderMemoCiel();
    await lireSocleQuotidien(supabase, "u1", new Date("2026-08-13T10:00:00Z"), port);
    const apres13 = lectures();
    await lireSocleQuotidien(supabase, "u1", new Date("2026-08-13T10:00:00Z"), port);
    expect(lectures()).toBe(apres13);
  });

  it("[P7/DUR] l'horoscope PERSONNEL n'est jamais mémoïsé — un thème qui change est vu", async () => {
    // Le mutant : mémoïser `assemblerHoroscope`. Le thème natal BOUGE (la 5.3 le recalcule le jour
    // où l'heure de naissance arrive) ; l'horoscope resterait alors juste-en-apparence, pour
    // toujours, pour cette personne.
    // Deux thèmes dont les Soleils sont dans des signes DIFFÉRENTS (gémeaux / capricorne) : la
    // Lune relative du jour DOIT différer. Prendre deux variantes du même jour de naissance ne
    // prouverait rien — elles donnent parfois exactement le même horoscope, et ce test-là serait
    // vert avec une mémoïsation fautive.
    const t = new Date("2026-08-11T10:00:00Z");
    const autre = calculerThemeNatal({ date: "1990-01-15" }, ephemeride);

    lireThemeNatalMock.mockResolvedValue({ statut: "calcule", theme: autre, version: 1 });
    const avant = await lireSocleQuotidien(supabase, "u1", t, ephemeride);

    lireThemeNatalMock.mockResolvedValue({ statut: "calcule", theme: THEME, version: 2 });
    const apres = await lireSocleQuotidien(supabase, "u1", t, ephemeride);

    expect(avant.horoscope.statut).toBe("calcule");
    expect(apres.horoscope.statut).toBe("calcule");
    // Le CIEL, lui, est le même objet mémoïsé — c'est bien le personnel qui a été recalculé.
    expect(JSON.stringify(avant.horoscope)).not.toBe(JSON.stringify(apres.horoscope));
    if (avant.horoscope.statut === "calcule" && apres.horoscope.statut === "calcule") {
      expect(avant.horoscope.horoscope.luneRelative).not.toEqual(
        apres.horoscope.horoscope.luneRelative,
      );
      expect(avant.horoscope.horoscope.ciel).toBe(apres.horoscope.horoscope.ciel);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La dégradation (AC6) et le chemin d'écriture (P10)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7 / AC6] le mantra sort TOUJOURS — il ne demande rien à personne", () => {
  it.each(["naissance_absente", "lecture_impossible", "ecriture_refusee"] as const)(
    "thème indisponible (%s) : le mantra est servi, l'horoscope déclare SA raison",
    async (raison) => {
      lireThemeNatalMock.mockResolvedValue({ statut: "indisponible", raison });
      const socle = await lireSocleQuotidien(
        supabase,
        "u1",
        new Date("2026-08-11T10:00:00Z"),
        ephemeride,
      );
      expect(socle.mantra).toEqual({ statut: "non_ecrit" });
      expect(socle.horoscope).toEqual({ statut: "indisponible", raison });
      expect(socle.jour).toEqual({ a: 2026, m: 8, j: 11 });
    },
  );

  it("[DUR / FR-033] le mantra est demandé pour LE JOUR, et rien d'autre n'y entre", async () => {
    // ⚠️ TEST RÉÉCRIT APRÈS UN MUTANT SURVIVANT (M22). Comparer les deux SORTIES ne prouvait rien :
    // tous les créneaux sont `non_ecrit`, donc égaux. Ce qu'il faut observer, c'est l'ARGUMENT — la
    // seule chose qui distingue « impersonnel » de « personnalisé ».
    const t = new Date("2026-08-11T10:00:00Z");
    await lireSocleQuotidien(supabase, "u1", t, ephemeride);
    await lireSocleQuotidien(supabase, "une-tout-autre-utilisatrice", t, ephemeride);

    expect(mantraEspion).toHaveBeenCalledTimes(2);
    for (const appel of mantraEspion.mock.calls) {
      expect(appel).toHaveLength(1); // un seul argument : aucun identifiant n'a pu se glisser
      expect(appel[0]).toEqual({ a: 2026, m: 8, j: 11 });
    }
    expect(mantraEspion.mock.calls[0]).toEqual(mantraEspion.mock.calls[1]);
  });
});

describe("[T7 / P10] `lireThemeNatal` peut ÉCRIRE — il est appelé une fois, jamais en boucle", () => {
  it("une lecture du socle = exactement UN appel", async () => {
    await lireSocleQuotidien(supabase, "u1", new Date("2026-08-11T10:00:00Z"), ephemeride);
    expect(lireThemeNatalMock).toHaveBeenCalledTimes(1);
  });

  it("l'éphéméride composée ICI est celle qui est PASSÉE au thème — une seule source", async () => {
    // Deux instances distinctes donneraient deux thèmes calculés sous deux objets différents. Sans
    // conséquence aujourd'hui, mais le jour où l'adaptateur porte un état (un cache de Chiron),
    // c'en aurait une.
    await lireSocleQuotidien(supabase, "u1", new Date("2026-08-11T10:00:00Z"), ephemeride);
    expect(lireThemeNatalMock).toHaveBeenCalledWith(supabase, "u1", ephemeride);
  });
});
