import { describe, it, expect } from "vitest";
import {
  CORPS_TRANSITANTS,
  cielDuJour,
  assemblerHoroscope,
  configurations,
  horoscopeDuJour,
  luneRelative,
  type CielDuJour,
  ecartAngulaire,
  indiceDuJour,
  numeroDeJour,
  type JourCivil,
  type JourResolu,
} from "@/lib/astro/quotidien";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import { CORPS, type Corps, type EphemerisPort } from "@/lib/astro/port";
import {
  calculerThemeNatal,
  maisonsSignesEntiers,
  normaliserDegres,
  placer,
  type PositionCorps,
  type ThemeNatal,
} from "@/lib/astro/theme-natal";

/**
 * Story 5.4 (T1) — LE SOCLE ARITHMÉTIQUE DU JOUR.
 *
 * ══ CE QUE CE FICHIER GARDE ══════════════════════════════════════════════════════════════════════
 *
 * Trois fonctions minuscules dont dépend tout le reste de la story, et dont les modes d'échec sont
 * tous SILENCIEUX : un écart angulaire calculé par soustraction rate tout aspect à cheval sur 0°
 * (P3), un modulo JavaScript sur un nombre négatif rend un index négatif (le piège déjà payé dans
 * `normaliserDegres`), et `Date.UTC(99, …)` désigne 1999 sans prévenir personne.
 *
 * Aucune ne plante. Toutes rendent un nombre plausible.
 */

const jour = (a: number, m: number, j: number): JourCivil => ({ a, m, j });

// ══════════════════════════════════════════════════════════════════════════════════════════════
// numeroDeJour — le compteur de jours
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T1] numeroDeJour — un entier qui avance de 1 par jour, sans exception", () => {
  it("deux jours consécutifs diffèrent exactement de 1", () => {
    expect(numeroDeJour(jour(2026, 8, 12)) - numeroDeJour(jour(2026, 8, 11))).toBe(1);
  });

  it("[LE CAS QUI COMPTE] passe un changement d'heure sans sauter ni doubler", () => {
    // Le 29 mars 2026, Paris passe à l'heure d'été : la journée locale dure 23 h. Un compteur bâti
    // sur des millisecondes locales avancerait de 0,958 jour et `Math.round` masquerait l'erreur
    // une fois sur deux. Celui-ci compte des jours de CALENDRIER, pas des durées.
    expect(numeroDeJour(jour(2026, 3, 30)) - numeroDeJour(jour(2026, 3, 29))).toBe(1);
    expect(numeroDeJour(jour(2026, 10, 26)) - numeroDeJour(jour(2026, 10, 25))).toBe(1);
  });

  it("passe une fin de mois, une fin d'année et un 29 février", () => {
    expect(numeroDeJour(jour(2026, 2, 1)) - numeroDeJour(jour(2026, 1, 31))).toBe(1);
    expect(numeroDeJour(jour(2027, 1, 1)) - numeroDeJour(jour(2026, 12, 31))).toBe(1);
    expect(numeroDeJour(jour(2028, 3, 1)) - numeroDeJour(jour(2028, 2, 29))).toBe(1);
    // 2028 est bissextile : du 28 février au 1ᵉʳ mars, il y a DEUX jours.
    expect(numeroDeJour(jour(2028, 3, 1)) - numeroDeJour(jour(2028, 2, 28))).toBe(2);
    // 2026 ne l'est pas : il n'y en a qu'un.
    expect(numeroDeJour(jour(2026, 3, 1)) - numeroDeJour(jour(2026, 2, 28))).toBe(1);
  });

  it("[P-JS] refuse une année à deux chiffres — `Date.UTC(99, …)` désigne 1999", () => {
    // Le piège JavaScript le plus ancien du lot. Il ne plante pas : il décale de 1900 ans.
    expect(() => numeroDeJour(jour(99, 1, 1))).toThrow(/année/i);
  });

  it("est déterministe", () => {
    expect(numeroDeJour(jour(2026, 8, 11))).toBe(numeroDeJour(jour(2026, 8, 11)));
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// indiceDuJour — la rotation du corpus
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T1 / D8] indiceDuJour — la rotation, et rien d'autre que le jour", () => {
  it("avance de 1 chaque jour et boucle sur le cardinal", () => {
    const suite = Array.from({ length: 8 }, (_, k) => indiceDuJour(jour(2026, 8, 11 + k), 3));
    // Peu importe où la suite commence : elle avance de 1 modulo 3, sans trou.
    for (let k = 1; k < suite.length; k++) {
      expect((suite[k - 1] + 1) % 3).toBe(suite[k]);
    }
  });

  it("[DUR] rend TOUJOURS un indice dans [0, cardinal) — même avant l'époque", () => {
    // `%` garde le signe du dividende en JavaScript : un jour antérieur à l'époque donnerait un
    // indice NÉGATIF, donc `CLES[-2]` === `undefined`, donc un mantra manquant sans erreur.
    for (const j of [jour(1970, 1, 1), jour(1999, 12, 31), jour(2000, 1, 1), jour(2100, 6, 15)]) {
      const i = indiceDuJour(j, 60);
      expect(i, `${j.a}-${j.m}-${j.j}`).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(60);
      expect(Number.isInteger(i)).toBe(true);
    }
  });

  it("[CONTRÔLE POSITIF] la rotation couvre bien TOUTES les valeurs — sinon elle ne tourne pas", () => {
    // Sans ce témoin, une fonction qui rendrait toujours 0 passerait les deux tests ci-dessus.
    const vus = new Set(Array.from({ length: 60 }, (_, k) => indiceDuJour(jour(2026, 1, 1 + k), 60)));
    expect(vus.size).toBe(60);
  });

  it("un cardinal de 1 rend toujours 0 — un corpus d'un seul texte est un cas légitime", () => {
    expect(indiceDuJour(jour(2026, 8, 11), 1)).toBe(0);
    expect(indiceDuJour(jour(2031, 2, 3), 1)).toBe(0);
  });

  it("refuse un cardinal absurde plutôt que de rendre NaN", () => {
    for (const mauvais of [0, -1, 2.5, Number.NaN]) {
      expect(() => indiceDuJour(jour(2026, 8, 11), mauvais), `${mauvais}`).toThrow(/cardinal/i);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ecartAngulaire — le piège P3
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T1 / P3] ecartAngulaire — l'arc le plus court, jamais une soustraction", () => {
  it("les cas simples", () => {
    expect(ecartAngulaire(10, 10)).toBe(0);
    expect(ecartAngulaire(100, 10)).toBeCloseTo(90, 10);
    expect(ecartAngulaire(10, 100)).toBeCloseTo(90, 10);
  });

  it("[LE CŒUR DE P3] 359° et 2° sont à 3° l'un de l'autre, pas à 357°", () => {
    // Une soustraction naïve rate TOUT aspect à cheval sur 0° du Bélier — c'est-à-dire un
    // douzième du zodiaque, sans jamais rien signaler.
    expect(ecartAngulaire(359, 2)).toBeCloseTo(3, 10);
    expect(ecartAngulaire(2, 359)).toBeCloseTo(3, 10);
    expect(ecartAngulaire(0, 358)).toBeCloseTo(2, 10);
  });

  it("est SYMÉTRIQUE et borné à [0, 180]", () => {
    for (let a = 0; a < 360; a += 17) {
      for (let b = 0; b < 360; b += 23) {
        const d = ecartAngulaire(a, b);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(180);
        expect(d).toBeCloseTo(ecartAngulaire(b, a), 10);
      }
    }
  });

  it("l'opposition exacte vaut 180, et 181 « d'écart » en vaut 179", () => {
    expect(ecartAngulaire(0, 180)).toBeCloseTo(180, 10);
    expect(ecartAngulaire(0, 181)).toBeCloseTo(179, 10);
  });

  it("accepte des longitudes hors [0,360) — elles sont normalisées, pas refusées", () => {
    expect(ecartAngulaire(720 + 10, 10)).toBeCloseTo(0, 10);
    expect(ecartAngulaire(-10, 10)).toBeCloseTo(20, 10);
  });

  it("refuse une valeur non finie plutôt que de rendre NaN", () => {
    expect(() => ecartAngulaire(Number.NaN, 10)).toThrow();
    expect(() => ecartAngulaire(10, Number.POSITIVE_INFINITY)).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// T2 — Le ciel du jour
// ══════════════════════════════════════════════════════════════════════════════════════════════

const ephemeride = ephemerideAstronomyEngine();

/**
 * Un jour d'AOÛT 2026 résolu à la main, en heure d'été de Paris (UTC+2).
 *
 * Résolu à la main EXPRÈS : la résolution du fuseau appartient à la couche data (D3), et un test du
 * domaine qui l'appellerait testerait deux choses à la fois. Minuit à Paris = 22 h UTC la veille.
 */
function jourAout(j: number): JourResolu {
  return {
    jour: { a: 2026, m: 8, j },
    fenetre: {
      min: new Date(Date.UTC(2026, 7, j - 1, 22, 0, 0)),
      max: new Date(Date.UTC(2026, 7, j, 22, 0, 0)),
    },
    reference: new Date(Date.UTC(2026, 7, j, 10, 0, 0)), // midi Paris
  };
}

/** Un port qui compte les lectures par corps, pour prouver ce qui est échantillonné et ce qui ne l'est pas. */
function compteur(reel: EphemerisPort): { port: EphemerisPort; lectures: Map<Corps, number> } {
  const lectures = new Map<Corps, number>();
  return {
    lectures,
    port: {
      identifiant: reel.identifiant,
      longitudeEcliptique(corps, t) {
        lectures.set(corps, (lectures.get(corps) ?? 0) + 1);
        return reel.longitudeEcliptique(corps, t);
      },
      tempsSideralGreenwich: (t) => reel.tempsSideralGreenwich(t),
      obliquiteVraie: (t) => reel.obliquiteVraie(t),
    },
  };
}

describe("[T2] cielDuJour — les positions à midi, et ce qui manque", () => {
  it("[PRÉSENCE AVANT ABSENCE] les douze corps calculables sont placés, Chiron seul est absent", () => {
    // Condition de validité de tout ce bloc : si `positions` était vide, chaque assertion
    // d'absence ci-dessous serait vraie pour rien.
    const ciel = cielDuJour(jourAout(11), ephemeride);
    expect(ciel.positions.length).toBe(CORPS.length - 1);
    expect(ciel.absents).toEqual([{ corps: "chiron", raison: "ephemeride_sans_asteroides" }]);
  });

  it("aucune position ne porte de MAISON — le ciel n'a pas d'angles", () => {
    // Une maison est le rapport d'un corps à l'horizon d'un LIEU et d'un INSTANT de naissance. Le
    // ciel du jour n'appartient à personne : lui en attribuer serait fabriquer du sens personnel.
    for (const p of cielDuJour(jourAout(11), ephemeride).positions) {
      expect(p.maison, `${p.corps}`).toBeUndefined();
    }
  });

  it("les positions sont rapportées à l'instant de RÉFÉRENCE, pas à une borne du jour", () => {
    const jour = jourAout(11);
    const ciel = cielDuJour(jour, ephemeride);
    expect(ciel.instantReference.getTime()).toBe(jour.reference.getTime());

    const lune = ciel.positions.find((p) => p.corps === "lune")!;
    const attendu = ephemeride.longitudeEcliptique("lune", jour.reference);
    expect(attendu.statut).toBe("calcule");
    expect(lune.longitude).toBeCloseTo(
      attendu.statut === "calcule" ? attendu.longitude : Number.NaN,
      10,
    );
  });

  it("est déterministe — deux appels rendent exactement la même chose", () => {
    expect(JSON.stringify(cielDuJour(jourAout(11), ephemeride))).toBe(
      JSON.stringify(cielDuJour(jourAout(11), ephemeride)),
    );
  });
});

describe("[T2 / D1 / P1] un changement de signe est un FAIT, jamais une absence", () => {
  it("[FAIT VÉRIFIÉ] le 13 août 2026, la Lune passe du lion à la vierge", () => {
    const ciel = cielDuJour(jourAout(13), ephemeride);
    expect(ciel.changementsDeSigne).toContainEqual({
      corps: "lune",
      depuis: "lion",
      vers: "vierge",
    });
  });

  it("[LE CŒUR DE P1] ce jour-là, la Lune est TOUJOURS placée — elle n'est pas déclarée absente", () => {
    // Le mutant : réutiliser `signeAmbigu` de la 5.3 et pousser la Lune dans `absents`. La 5.3 a
    // raison pour une naissance (l'instant est inconnu) et tort pour une journée (l'instant est
    // celui de midi, parfaitement défini). Deux jours sur cinq, l'horoscope perdrait sa Lune.
    const ciel = cielDuJour(jourAout(13), ephemeride);
    expect(ciel.positions.map((p) => p.corps)).toContain("lune");
    expect(ciel.absents.map((a) => a.corps)).not.toContain("lune");
  });

  it("[FAIT VÉRIFIÉ] le 12 août 2026, la Lune ne change PAS de signe", () => {
    // Sans ce contre-exemple, une fonction qui déclarerait un changement tous les jours passerait
    // le test précédent.
    const ciel = cielDuJour(jourAout(12), ephemeride);
    expect(ciel.changementsDeSigne.filter((c) => c.corps === "lune")).toEqual([]);
  });

  it("[FAIT VÉRIFIÉ] le Soleil aussi change de signe — le 23 août 2026, lion → vierge", () => {
    // La preuve que la détection n'est pas un cas particulier de la Lune (même raisonnement que la
    // décision D1 de la 5.3). Le Soleil change de signe un jour sur trente, et c'est LE nombre que
    // tout le monde connaît.
    expect(cielDuJour(jourAout(23), ephemeride).changementsDeSigne).toContainEqual({
      corps: "soleil",
      depuis: "lion",
      vers: "vierge",
    });
  });

  it("[MESURE] sur les 31 jours d'août 2026, la Lune change de signe entre 12 et 15 fois", () => {
    // Une garde qui ne vérifierait qu'un seul jour serait satisfaite par une fonction qui rend
    // toujours ce changement-là. La Lune parcourt le zodiaque en 27,3 jours : ~13 fois en 31 jours.
    const n = Array.from({ length: 31 }, (_, k) => k + 1)
      .map((j) => cielDuJour(jourAout(j), ephemeride).changementsDeSigne)
      .filter((cs) => cs.some((c) => c.corps === "lune")).length;
    expect(n).toBeGreaterThanOrEqual(12);
    expect(n).toBeLessThanOrEqual(15);
  });

  it("Chiron ne produit aucun changement fantôme — une lecture illisible est ignorée", () => {
    for (let j = 1; j <= 28; j++) {
      expect(
        cielDuJour(jourAout(j), ephemeride).changementsDeSigne.map((c) => c.corps),
      ).not.toContain("chiron");
    }
  });
});

describe("[T2 / D4 / P2] seuls les corps RAPIDES sont échantillonnés", () => {
  it("les lents sont lus UNE fois (la position de midi), les rapides le sont ~25 fois", () => {
    // Ce n'est pas une optimisation : c'est la preuve que la liste `CORPS_TRANSITANTS` est
    // réellement celle qui pilote l'échantillonnage, et pas une décoration.
    const { port, lectures } = compteur(ephemeride);
    cielDuJour(jourAout(11), port);

    for (const corps of CORPS) {
      const n = lectures.get(corps) ?? 0;
      if (CORPS_TRANSITANTS.includes(corps)) {
        expect(n, `${corps} devrait être échantillonné`).toBeGreaterThan(20);
      } else {
        expect(n, `${corps} ne devrait être lu qu'une fois`).toBe(1);
      }
    }
  });

  it("[DUR] la liste des transitants ne contient AUCUN corps lent", () => {
    // Le mutant le plus tentant de la story : « pourquoi pas Jupiter ? ». Un aspect de Pluton reste
    // dans l'orbe DEUX ANS — l'horoscope du jour dirait la même chose pendant deux ans.
    for (const lent of ["jupiter", "saturne", "uranus", "neptune", "pluton", "chiron"]) {
      expect(CORPS_TRANSITANTS, `${lent} est trop lent pour faire un JOUR`).not.toContain(lent);
    }
    expect([...CORPS_TRANSITANTS].sort()).toEqual(["lune", "mars", "mercure", "soleil", "venus"]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// T3 — Les configurations
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un thème natal FABRIQUÉ, aux longitudes choisies.
 *
 * Fabriqué et non calculé : la géométrie des aspects se teste sur des valeurs qu'on maîtrise au
 * centième de degré. Un thème réel ne tombe jamais sur un aspect exact, donc ne prouverait ni la
 * borne d'orbe, ni le départage, ni la traversée de 0°.
 */
function themeFictif(o: {
  soleil?: number;
  lune?: number;
  ascendant?: number;
  autres?: Partial<Record<Corps, number>>;
}): ThemeNatal {
  const positions: PositionCorps[] = [];
  const ajouter = (corps: Corps, longitude: number) => {
    const { signe, degre } = placer(longitude);
    positions.push({ corps, longitude, signe, degre });
  };
  if (o.soleil !== undefined) ajouter("soleil", o.soleil);
  if (o.lune !== undefined) ajouter("lune", o.lune);
  for (const [corps, l] of Object.entries(o.autres ?? {})) ajouter(corps as Corps, l as number);

  return {
    schema: 2,
    adaptateur: "fictif",
    positions: Object.freeze(positions),
    absents: Object.freeze([]),
    angles:
      o.ascendant === undefined
        ? { statut: "non_calcule", raison: "heure_absente" }
        : {
            statut: "calcule",
            ascendant: o.ascendant,
            milieuDuCiel: normaliserDegres(o.ascendant + 270),
            maisons: maisonsSignesEntiers(o.ascendant),
            systeme: "signes_entiers",
          },
    precision: o.ascendant === undefined ? "midi_par_defaut" : "heure_connue",
  };
}

/** Un ciel du jour FABRIQUÉ, aux longitudes choisies. */
function cielFictif(longitudes: Partial<Record<Corps, number>>): CielDuJour {
  const positions: PositionCorps[] = [];
  for (const [corps, l] of Object.entries(longitudes)) {
    const { signe, degre } = placer(l as number);
    positions.push({ corps: corps as Corps, longitude: l as number, signe, degre });
  }
  return {
    instantReference: new Date(Date.UTC(2026, 7, 11, 10, 0, 0)),
    positions: Object.freeze(positions),
    absents: Object.freeze([]),
    changementsDeSigne: Object.freeze([]),
  };
}

describe("[T3] configurations — la géométrie", () => {
  it("[PRÉSENCE AVANT ABSENCE] une conjonction exacte est trouvée, d'orbe 0", () => {
    const c = configurations(cielFictif({ lune: 10 }), themeFictif({ soleil: 10 }));
    expect(c).toEqual([{ corpsTransitant: "lune", aspect: "conjonction", cible: "soleil", orbe: 0 }]);
  });

  it("les cinq aspects majeurs sont reconnus, et eux seuls", () => {
    const theme = themeFictif({ soleil: 0 });
    const trouve = (separation: number) =>
      configurations(cielFictif({ lune: separation }), theme).map((c) => c.aspect);

    expect(trouve(0)).toEqual(["conjonction"]);
    expect(trouve(60)).toEqual(["sextile"]);
    expect(trouve(90)).toEqual(["carre"]);
    expect(trouve(120)).toEqual(["trigone"]);
    expect(trouve(180)).toEqual(["opposition"]);
    // 45° (semi-carré) et 150° (quinconce) sont des aspects MINEURS : hors périmètre v1.
    expect(trouve(45)).toEqual([]);
    expect(trouve(150)).toEqual([]);
  });

  it("[BORNE D'ORBE] 3° est dedans, 3,01° est dehors", () => {
    const theme = themeFictif({ soleil: 0 });
    expect(configurations(cielFictif({ lune: 3 }), theme).map((c) => c.orbe)).toEqual([3]);
    expect(configurations(cielFictif({ lune: 3.01 }), theme)).toEqual([]);
    expect(configurations(cielFictif({ lune: 357 }), theme).map((c) => c.orbe)).toEqual([3]);
  });

  it("[LE CŒUR DE P3] un aspect à cheval sur 0° du Bélier est trouvé", () => {
    // Soleil natal à 359°, Lune du jour à 2° : conjonction à 3° d'orbe. Une soustraction naïve
    // donnerait 357° d'écart et ne trouverait RIEN — sans jamais rien signaler.
    const c = configurations(cielFictif({ lune: 2 }), themeFictif({ soleil: 359 }));
    expect(c).toEqual([{ corpsTransitant: "lune", aspect: "conjonction", cible: "soleil", orbe: 3 }]);
  });

  it("est triée du plus SERRÉ au plus lâche", () => {
    const c = configurations(
      cielFictif({ lune: 10, soleil: 100, mars: 200 }),
      themeFictif({ soleil: 12, lune: 101, ascendant: 200 }),
    );
    expect(c.length).toBeGreaterThan(1);
    for (let k = 1; k < c.length; k++) expect(c[k].orbe).toBeGreaterThanOrEqual(c[k - 1].orbe);
    expect(c[0].orbe).toBe(0); // mars sur l'ascendant
  });

  it("[P4/DUR] deux configurations d'orbe ÉGALE sont départagées de façon STABLE", () => {
    // Lune à 0°, Soleil natal à 2° et Lune natale à 2° : deux conjonctions d'orbe 2 exactement.
    // Sans départage, `Array.sort` peut rendre l'un ou l'autre ordre — et l'horoscope changerait
    // d'une exécution à l'autre sans qu'aucun test ponctuel ne s'en aperçoive.
    const ciel = cielFictif({ lune: 0 });
    const theme = themeFictif({ soleil: 2, lune: 2 });
    const attendu = configurations(ciel, theme);
    expect(attendu.map((c) => c.cible)).toEqual(["soleil", "lune"]); // l'ordre de CIBLES_NATALES
    for (let k = 0; k < 20; k++) {
      expect(configurations(cielFictif({ lune: 0 }), themeFictif({ soleil: 2, lune: 2 }))).toEqual(
        attendu,
      );
    }
  });

  it("[P4/DUR] à orbe égale, l'ASPECT départage avant la cible — et l'ordre d'insertion NE suffit pas", () => {
    /*
     * ⚠️ TEST NÉ D'UN MUTANT SURVIVANT (M4). Le test précédent était satisfait par un tri sur la
     * seule orbe : `Array.prototype.sort` est STABLE depuis ES2019, et l'ordre d'insertion
     * (transitants × cibles) coïncide avec le départage… sauf pour l'ASPECT, qui est bouclé en
     * dernier à l'insertion et départagé AVANT la cible.
     *
     * Lune du jour à 0° · Soleil natal à 62° → sextile, orbe 2 · Lune natale à 2° → conjonction,
     * orbe 2. Insertion : soleil-sextile d'abord (cible soleil bouclée avant lune). Départage :
     * conjonction d'abord (aspect index 0 < 1). Les deux ordres DIVERGENT — c'est le seul cas où
     * la règle explicite est réellement portante, et donc le seul qui la prouve.
     */
    const c = configurations(cielFictif({ lune: 0 }), themeFictif({ soleil: 62, lune: 2 }));
    expect(c.map((x) => x.orbe)).toEqual([2, 2]);
    expect(c.map((x) => `${x.aspect}/${x.cible}`)).toEqual(["conjonction/lune", "sextile/soleil"]);
  });

  it("[P4] à orbe égale, l'ordre des TRANSITANTS départage avant celui des cibles", () => {
    const c = configurations(cielFictif({ lune: 0, mars: 0 }), themeFictif({ soleil: 1 }));
    expect(c.map((x) => x.corpsTransitant)).toEqual(["lune", "mars"]);
  });
});

describe("[T3 / P11] une cible ABSENTE ne produit jamais de configuration fantôme", () => {
  it("sans heure de naissance, l'ascendant n'est pas aspecté — et rien n'est inventé", () => {
    // Le mutant : lire `theme.angles.ascendant` sans vérifier le statut → `undefined` → `NaN` →
    // orbe 0 après coercition → une configuration PARFAITEMENT SERRÉE sur un ascendant inexistant.
    // C'est le mensonge le plus plausible que cette story puisse produire.
    const c = configurations(cielFictif({ lune: 0, soleil: 0, mars: 0 }), themeFictif({ soleil: 0 }));
    expect(c.map((x) => x.cible)).not.toContain("ascendant");
    for (const x of c) expect(Number.isFinite(x.orbe)).toBe(true);
  });

  it("[CONTRÔLE POSITIF] avec l'heure, l'ascendant EST aspecté — sinon la garde ne prouve rien", () => {
    const c = configurations(cielFictif({ lune: 0 }), themeFictif({ soleil: 180, ascendant: 0 }));
    expect(c.map((x) => x.cible)).toContain("ascendant");
  });

  it("un corps natal absent du thème (Chiron, signe indéterminable) n'est pas aspecté", () => {
    // Les cibles se prennent dans ce que le thème CONTIENT, jamais dans la liste des corps possibles.
    const c = configurations(cielFictif({ lune: 0 }), themeFictif({ lune: 0 }));
    expect(c.map((x) => x.cible)).toEqual(["lune"]);
    expect(c.map((x) => x.cible)).not.toContain("soleil");
  });

  it("un thème SANS AUCUNE cible ne produit aucune configuration, et n'explose pas", () => {
    expect(configurations(cielFictif({ lune: 0, mars: 0 }), themeFictif({}))).toEqual([]);
  });

  it("un corps transitant absent du ciel n'est pas aspecté", () => {
    expect(configurations(cielFictif({}), themeFictif({ soleil: 0, ascendant: 0 }))).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// T4bis — La Lune du jour rapportée au Soleil natal (D11)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T4bis / D11] luneRelative — la distance en SIGNES, toujours dans [0, 11]", () => {
  it("Lune et Soleil natal dans le même signe : distance 0", () => {
    expect(luneRelative(cielFictif({ lune: 5 }), themeFictif({ soleil: 25 }))).toEqual({
      statut: "calcule",
      distance: 0,
    });
  });

  it("compte des SIGNES, pas des degrés", () => {
    // 35° = 5° du taureau ; 5° = 5° du bélier. Un signe d'écart, pas trente degrés.
    expect(luneRelative(cielFictif({ lune: 35 }), themeFictif({ soleil: 5 }))).toEqual({
      statut: "calcule",
      distance: 1,
    });
  });

  it("[LE PIÈGE DU MODULO] Lune en poissons, Soleil natal en bélier → 11, jamais −1", () => {
    // `%` garde le signe du dividende : sans le `+ 12`, la distance vaudrait −1, et le créneau de
    // corpus `lune_relative:-1` n'existerait pas — texte manquant, aucune erreur.
    const r = luneRelative(cielFictif({ lune: 340 }), themeFictif({ soleil: 5 }));
    expect(r).toEqual({ statut: "calcule", distance: 11 });
  });

  it("[LE PIÈGE DU MODULO, DANS L'AUTRE SENS] Lune en bélier, Soleil natal en poissons → 1", () => {
    // ⚠️ TEST NÉ D'UN MUTANT SURVIVANT (M13). Le cas précédent (11) ne produit AUCUN négatif :
    // 11 − 0 = 11. Il faut l'index de Lune INFÉRIEUR à celui du Soleil pour que la soustraction
    // passe sous zéro — et c'est là seulement que le `+ 12` est portant.
    expect(luneRelative(cielFictif({ lune: 5 }), themeFictif({ soleil: 340 }))).toEqual({
      statut: "calcule",
      distance: 1,
    });
    // Le pire cas : un signe d'écart « à l'envers » de onze.
    expect(luneRelative(cielFictif({ lune: 5 }), themeFictif({ soleil: 35 }))).toEqual({
      statut: "calcule",
      distance: 11,
    });
  });

  it("[CONTRÔLE POSITIF] les douze valeurs sont atteignables — sinon la rotation ne tourne pas", () => {
    const vues = new Set(
      Array.from({ length: 12 }, (_, k) => {
        const r = luneRelative(cielFictif({ lune: k * 30 + 15 }), themeFictif({ soleil: 15 }));
        return r.statut === "calcule" ? r.distance : -1;
      }),
    );
    expect([...vues].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("[DUR] sans Soleil natal, l'absence est DÉCLARÉE — jamais un signe deviné", () => {
    // Le Soleil natal manque quand son signe est indéterminable sans heure (5.3). Le repli tentant
    // serait de le déduire de la date de naissance : ce serait exactement le calcul que la 5.3 a
    // refusé, refait ailleurs.
    expect(luneRelative(cielFictif({ lune: 10 }), themeFictif({ lune: 10 }))).toEqual({
      statut: "non_calcule",
      raison: "soleil_natal_absent",
    });
  });

  it("sans Lune du jour, l'absence a SA PROPRE raison", () => {
    expect(luneRelative(cielFictif({ soleil: 10 }), themeFictif({ soleil: 10 }))).toEqual({
      statut: "non_calcule",
      raison: "lune_du_jour_absente",
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// T4 — L'horoscope du jour
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Un thème natal RÉEL, calculé par l'éphéméride réelle — pour les mesures sur données vraies. */
const THEME_REEL = calculerThemeNatal(
  { date: "1990-06-15", heure: "07:15", fuseau: "Europe/Paris", latitude: 48.8566, longitude: 2.3522 },
  ephemeride,
);

describe("[T4] horoscopeDuJour — l'assemblage", () => {
  it("la dominante EST la configuration la plus serrée", () => {
    const h = horoscopeDuJour(THEME_REEL, jourAout(11), ephemeride);
    if (h.configurations.length === 0) {
      expect(h.dominante).toBeUndefined();
    } else {
      expect(h.dominante).toEqual(h.configurations[0]);
    }
  });

  it("un jour SANS configuration est un vrai jour — `dominante` est absente, pas inventée", () => {
    const theme = themeFictif({ soleil: 0 }); // rien dans l'orbe pour un ciel choisi
    const h = {
      ...horoscopeDuJour(theme, jourAout(11), ephemeride),
    };
    // On ne peut pas garantir qu'un jour réel n'a rien ; on vérifie l'invariant dans les deux cas.
    expect(h.dominante === undefined || h.configurations.length > 0).toBe(true);
  });

  it("[DUR] avec PLUSIEURS configurations, la dominante est la plus SERRÉE — pas la dernière", () => {
    // ⚠️ TEST NÉ D'UN MUTANT SURVIVANT (M17). Le test précédent comparait `dominante` à
    // `configurations[0]` sur un jour réel qui n'en portait qu'une : `[0]` et `[length-1]` y sont le
    // même élément. Il faut un cas à plusieurs configurations d'orbes DIFFÉRENTES.
    const h = assemblerHoroscope(
      themeFictif({ soleil: 1, lune: 91, ascendant: 182 }),
      { a: 2026, m: 8, j: 11 },
      cielFictif({ lune: 0 }),
    );
    expect(h.configurations.length).toBe(3);
    expect(h.configurations.map((c) => c.orbe)).toEqual([1, 1, 2]);
    expect(h.dominante).toEqual(h.configurations[0]);
    expect(h.dominante).not.toEqual(h.configurations[h.configurations.length - 1]);
  });

  it("est déterministe sur données réelles", () => {
    expect(JSON.stringify(horoscopeDuJour(THEME_REEL, jourAout(11), ephemeride))).toBe(
      JSON.stringify(horoscopeDuJour(THEME_REEL, jourAout(11), ephemeride)),
    );
  });

  it("[AC5 / FR-049] aboutit sur un thème SANS HEURE — moins de cibles, jamais moins d'horoscope", () => {
    const sansHeure = calculerThemeNatal({ date: "1990-06-15" }, ephemeride);
    expect(sansHeure.angles.statut).toBe("non_calcule");

    const h = horoscopeDuJour(sansHeure, jourAout(11), ephemeride);
    expect(h.ciel.positions.length).toBeGreaterThan(0);
    expect(h.configurations.map((c) => c.cible)).not.toContain("ascendant");
    expect(h.luneRelative.statut).toBe("calcule"); // le Soleil natal du 15 juin 1990 est déterminable
  });

  it("[(a)] l'extracteur de chaînes MORD — prouvé sur un objet fabriqué", () => {
    // Sans ce contrôle, « aucune phrase trouvée » serait vrai d'un extracteur cassé. Le mode
    // d'échec relevé DEUX FOIS en revue 4.10 sur `tronc-absence.test.ts`.
    expect(extraireChaines({ a: "belier", b: [{ c: "Tu vas vivre une belle journée." }] })).toEqual([
      "belier",
      "Tu vas vivre une belle journée.",
    ]);
    expect(extraireChaines({ n: 12, d: new Date(0) })).toEqual([]);
    // Et le critère « énumération » distingue bien les deux :
    expect(/^[a-z_]+$/.test("belier")).toBe(true);
    expect(/^[a-z_]+$/.test("Tu vas vivre une belle journée.")).toBe(false);
  });

  it("[FR-053/DUR] la sortie ne porte AUCUNE chaîne de caractères libre", () => {
    // Miroir de la garde de la 5.1 sur `ThemeNatal` : ce qui rend FR-053 structurel, c'est qu'il
    // n'existe aucun endroit où écrire une prédiction. Toute chaîne trouvée doit être une valeur
    // d'ÉNUMÉRATION (signe, corps, aspect, raison) — jamais une phrase.
    const chaines = extraireChaines(horoscopeDuJour(THEME_REEL, jourAout(11), ephemeride));
    expect(chaines.length, "l'extracteur ne trouve rien — la garde serait vide").toBeGreaterThan(5);
    for (const s of chaines) {
      expect(s, `« ${s} » ressemble à une phrase`).toMatch(/^[a-z_]+$/);
    }
  });
});

/** Toutes les chaînes d'une structure, y compris imbriquées dans des tableaux. Éprouvé ci-dessus. */
function extraireChaines(valeur: unknown): string[] {
  const trouvees: string[] = [];
  const parcourir = (v: unknown) => {
    if (typeof v === "string") trouvees.push(v);
    else if (Array.isArray(v)) v.forEach(parcourir);
    else if (v && typeof v === "object" && !(v instanceof Date)) Object.values(v).forEach(parcourir);
  };
  parcourir(valeur);
  return trouvees;
}

describe("[T4 / D4 / P2] MESURE — un jour ne ressemble pas au précédent", () => {
  it("sur les 31 jours d'août 2026, la dominante change au moins 10 fois", () => {
    // C'EST LA GARDE QUI TUE LE MUTANT P2. Réintroduire Jupiter→Pluton dans `CORPS_TRANSITANTS`
    // verrouille la dominante sur un transit lent : elle cesserait de changer, et aucun test
    // ponctuel ne le verrait. Ici, la mesure le voit.
    const cle = (j: number) => {
      const d = horoscopeDuJour(THEME_REEL, jourAout(j), ephemeride).dominante;
      return d ? `${d.corpsTransitant}-${d.aspect}-${d.cible}` : "—";
    };
    const suite = Array.from({ length: 31 }, (_, k) => cle(k + 1));
    const changements = suite.filter((v, k) => k > 0 && v !== suite[k - 1]).length;
    expect(changements, `suite : ${suite.join(" ")}`).toBeGreaterThanOrEqual(10);
  });

  it("[MESURE] la Lune relative avance bien de 1 tous les ~2,5 jours", () => {
    const distances = Array.from({ length: 31 }, (_, k) => {
      const r = horoscopeDuJour(THEME_REEL, jourAout(k + 1), ephemeride).luneRelative;
      return r.statut === "calcule" ? r.distance : -1;
    });
    const changements = distances.filter((v, k) => k > 0 && v !== distances[k - 1]).length;
    // 31 jours / 2,5 ≈ 12 changements. On borne des deux côtés : trop peu = figée, trop = du bruit.
    expect(changements, `${distances.join(",")}`).toBeGreaterThanOrEqual(10);
    expect(changements).toBeLessThanOrEqual(14);
  });
});
