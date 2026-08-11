import { describe, it, expect } from "vitest";
import { fuseauDeCommune, normaliserLieu } from "@/lib/astro/lieux";
import { lieuxFrance, IDENTIFIANT_LIEUX_FRANCE } from "@/lib/astro/adapters/lieux-france";

/**
 * Story 5.3 (T2) — LE RÉFÉRENTIEL DES LIEUX DE NAISSANCE.
 *
 * ══ CE QUE CE FICHIER DOIT PROUVER, ET QUI N'EST PAS ÉVIDENT ═════════════════════════════════════
 *
 * Une table de fuseaux horaires écrite à la main est de la donnée FABRIQUÉE, au même titre qu'une
 * coordonnée écrite de mémoire — et elle échoue de la même façon : silencieusement, en produisant
 * un ascendant d'apparence normale. « America/Cayenne » et « America/Cayene » se ressemblent ; le
 * second n'existe pas, `Intl` jette, et `resoudreInstant` DÉGRADE proprement en `fuseau_invalide`.
 * Personne ne verrait jamais le défaut : la Guyane n'aurait simplement jamais d'ascendant.
 *
 * D'où le premier bloc : chaque identifiant de la table est confronté à la base de fuseaux de la
 * PLATEFORME (tzdb), et son décalage réel est mesuré à une date de référence. Ce qui serait sinon
 * « de mémoire » devient vérifié par quelque chose qui ne m'appartient pas.
 */

const lieux = lieuxFrance();

/** Décalage réel d'un fuseau à un instant, en minutes — même méthode que `theme-natal.ts`. */
function decalageMinutes(instant: Date, fuseau: string): number {
  const p: Record<string, string> = {};
  for (const { type, value } of new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant)) {
    p[type] = value;
  }
  const local = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
  );
  return Math.round((local - instant.getTime()) / 60000);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les fuseaux — confrontés à la base de fuseaux de la plateforme
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T2/DUR] fuseauDeCommune — chaque identifiant existe VRAIMENT et décale comme il doit", () => {
  // Le 15 JANVIER : hors heure d'été partout dans l'hémisphère nord, donc les décalages sont ceux
  // de l'heure normale et se lisent sans piège.
  const janvier = new Date("1990-01-15T12:00:00Z");

  /** `[territoire, code INSEE, latitude, décalage attendu en minutes le 15 janvier]` */
  const cas: readonly [string, string, number, number][] = [
    ["Bordeaux", "33063", 44.84, 60], // Europe/Paris → UTC+1 en janvier
    ["Guadeloupe", "97105", 16.24, -240], // UTC−4
    ["Martinique", "97209", 14.6, -240], // UTC−4
    ["Guyane", "97302", 4.94, -180], // UTC−3
    ["La Réunion", "97411", -20.88, 240], // UTC+4
    ["Saint-Pierre-et-Miquelon", "97502", 46.79, -180], // UTC−3
    ["Mayotte", "97601", -12.78, 180], // UTC+3
    ["Saint-Barthélemy", "97701", 17.92, -240], // UTC−4
    ["Saint-Martin", "97801", 18.09, -240], // UTC−4
    ["Wallis-et-Futuna", "98613", -13.28, 720], // UTC+12
    ["Tahiti", "98735", -17.53, -600], // UTC−10
    ["Marquises", "98731", -8.68, -570], // UTC−9:30 — la demi-heure qui vaut 7,5° d'ascendant
    ["Gambier", "98719", -22.04, -540], // UTC−9
    ["Nouvelle-Calédonie", "98818", -22.27, 660], // UTC+11
  ];

  it.each(cas)("%s (%s) décale bien de %d minutes", (_territoire, code, latitude, attendu) => {
    const fuseau = fuseauDeCommune(code, latitude);
    expect(fuseau, `aucun fuseau pour ${code}`).not.toBeNull();
    expect(
      decalageMinutes(janvier, fuseau!),
      `« ${fuseau} » ne décale pas de ${attendu} min — identifiant faux ou territoire mal rangé`,
    ).toBe(attendu);
  });

  it("[LE PIÈGE] un fuseau inexistant serait accepté par le code et REFUSÉ par Intl", () => {
    // La preuve que le test ci-dessus n'est pas creux : voilà à quoi ressemble un échec.
    expect(() => decalageMinutes(janvier, "America/Cayene")).toThrow();
  });

  it("la métropole n'est PAS un défaut appliqué aux territoires ultramarins", () => {
    // Mutation-cible : `return "Europe/Paris"` en tête de fonction. Un Europe/Paris posé sur
    // Cayenne décale de 4 h, soit ~60° d'ascendant : deux signes, et rien n'échoue.
    for (const [code, lat] of [
      ["97302", 4.94],
      ["98735", -17.53],
      ["97411", -20.88],
    ] as const) {
      expect(fuseauDeCommune(code, lat)).not.toBe("Europe/Paris");
    }
    expect(fuseauDeCommune("75056", 48.86)).toBe("Europe/Paris");
    expect(fuseauDeCommune("2A004", 41.93), "la Corse est métropolitaine").toBe("Europe/Paris");
  });

  it("là où personne ne naît, on ne DEVINE pas un fuseau", () => {
    expect(fuseauDeCommune("98412", -49.24), "Kerguelen").toBeNull();
    expect(fuseauDeCommune("98901", 10.3), "Clipperton").toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La normalisation
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T2] normaliserLieu — les frontières de mots sont EFFACÉES (l'inverse de la prose)", () => {
  it("les trois graphies d'un même nom se rejoignent", () => {
    const attendu = normaliserLieu("Saint-Étienne");
    expect(normaliserLieu("saint etienne")).toBe(attendu);
    expect(normaliserLieu("SAINTETIENNE")).toBe(attendu);
    expect(normaliserLieu("St-Étienne"), "« St » n'est pas « Saint »").not.toBe(attendu);
  });

  it("les apostrophes et les articles collés ne bloquent rien", () => {
    expect(normaliserLieu("L'Haÿ-les-Roses")).toBe(normaliserLieu("lhay les roses"));
  });

  it("[PIÈGE 5.2] les LIGATURES sont traitées — `NFD` ne les décompose pas", () => {
    // Vérifié en Story 5.2 : `"œ".normalize("NFD")` rend `"œ"`. Sans le remplacement explicite,
    // la commune d'Œutrange resterait introuvable pour qui la tape sans ligature.
    expect(normaliserLieu("Œutrange")).toBe("oeutrange");
    expect("œ".normalize("NFD"), "si ceci change un jour, le remplacement devient inutile").toBe("œ");
  });

  it("les chiffres survivent (Paris 15e, arrondissements)", () => {
    expect(normaliserLieu("Lyon 3e Arrondissement")).toContain("3");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'adaptateur
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T2] lieuxFrance — le référentiel réel", () => {
  it("[CONTRÔLE DU CONTRÔLE] le catalogue est chargé et il est massif", () => {
    // Sans cette assertion, un fichier de données tronqué (ou un import qui rend `{}`) rendrait
    // toutes les recherches vides — et toutes les assertions d'absence ci-dessous seraient vraies
    // pour rien. Le référentiel officiel compte ~35 000 communes.
    expect(lieux.chercher("a", 5), "une saisie d'un caractère ne cherche pas").toEqual([]);
    expect(lieux.chercher("saint", 20000).length).toBeGreaterThan(2000);
  });

  it("trouve une grande ville, avec ses coordonnées et son fuseau", () => {
    const [bordeaux] = lieux.chercher("Bordeaux", 1);
    expect(bordeaux.nom).toBe("Bordeaux");
    expect(bordeaux.code).toBe("33063");
    expect(bordeaux.fuseau).toBe("Europe/Paris");
    // Bordeaux est à ~44,84° N et ~0,58° O. On vérifie l'ordre de grandeur ET LE SIGNE : une
    // longitude prise pour une latitude (ou l'inverse) est l'erreur classique du GeoJSON, où les
    // coordonnées sont écrites [lon, lat] — et elle produit un ascendant parfaitement plausible.
    expect(bordeaux.latitude).toBeCloseTo(44.84, 1);
    expect(bordeaux.longitude).toBeCloseTo(-0.58, 1);
  });

  it("[DUR] latitude et longitude ne sont pas inversées, sur tout le référentiel", () => {
    // La France métropolitaine est entre 41° et 51° de latitude et entre −5° et 10° de longitude.
    // Une inversion globale ferait sortir toutes les latitudes de la plage.
    for (const nom of ["Lille", "Marseille", "Brest", "Strasbourg"]) {
      const [l] = lieux.chercher(nom, 1);
      expect(l.latitude, `${nom} : latitude hors de France`).toBeGreaterThan(41);
      expect(l.latitude).toBeLessThan(52);
      expect(l.longitude, `${nom} : longitude hors de France`).toBeGreaterThan(-5);
      expect(l.longitude).toBeLessThan(10);
    }
  });

  it("la ville elle-même passe AVANT ses composés", () => {
    expect(lieux.chercher("Nancy", 1)[0].nom).toBe("Nancy");
    expect(lieux.chercher("Lyon", 1)[0].nom).toBe("Lyon");
  });

  it("accents, tirets et casse ne changent rien au résultat", () => {
    const a = lieux.chercher("Saint-Étienne", 1)[0];
    const b = lieux.chercher("saint etienne", 1)[0];
    expect(a.code).toBe(b.code);
  });

  it("ce qui n'existe pas rend un tableau VIDE, jamais un lieu approchant", () => {
    // Un « à peu près » ici serait une naissance placée ailleurs sur Terre, gravée write-once.
    expect(lieux.chercher("Reykjavik", 5)).toEqual([]);
    expect(lieux.chercher("zzzzzzqqq", 5)).toEqual([]);
  });

  it("[DÉTERMINISME] deux recherches identiques rendent le même ordre", () => {
    const a = lieux.chercher("Saint-Martin", 10).map((l) => l.code);
    const b = lieux.chercher("Saint-Martin", 10).map((l) => l.code);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(1);
  });

  it("la limite est respectée", () => {
    expect(lieux.chercher("saint", 7)).toHaveLength(7);
    expect(lieux.chercher("saint", 0)).toEqual([]);
  });

  it("[DUR] aucune commune SANS fuseau ne peut être choisie", () => {
    // Mutation-cible : retirer le `continue` de `construireIndex`. Une commune proposable mais
    // dépourvue de fuseau ferait vivre le refus APRÈS un geste irréversible.
    expect(lieux.chercher("Kerguelen", 5)).toEqual([]);
    expect(lieux.chercher("Clipperton", 5)).toEqual([]);
    // …et les territoires qui ONT un fuseau restent, eux, parfaitement atteignables.
    expect(lieux.chercher("Papeete", 1)[0].fuseau).toBe("Pacific/Tahiti");
    expect(lieux.chercher("Nuku-Hiva", 1)[0].fuseau).toBe("Pacific/Marquesas");
  });

  it("[T7] trouverParCode résout EXACTEMENT, là où `chercher` interroge le nom", () => {
    // ⚠️ Cette méthode n'existait pas : le point d'écriture résolvait le code choisi par
    // `chercher(code)`. Aucune commune ne s'appelle « 33063 » — le formulaire refusait donc TOUTES
    // les saisies valides. Trouvé par `tests/heure-naissance-actions.test.ts`, pas à la lecture.
    const l = lieux.trouverParCode("33063");
    expect(l?.nom).toBe("Bordeaux");
    expect(l?.fuseau).toBe("Europe/Paris");
    // …et la preuve que les deux opérations sont bien distinctes :
    expect(lieux.chercher("33063", 5), "`chercher` ne devrait rien trouver sur un code").toEqual([]);
  });

  it("[T7/DUR] un code inconnu rend `null`, jamais une commune approchante", () => {
    expect(lieux.trouverParCode("99999")).toBeNull();
    expect(lieux.trouverParCode("")).toBeNull();
    expect(lieux.trouverParCode("3306")).toBeNull();
  });

  it("[T7/DUR] les communes SANS fuseau sont introuvables par code AUSSI", () => {
    // Deux sources (recherche / résolution) auraient fini par diverger, et la divergence aurait
    // laissé graver — irréversiblement — un lieu que l'interface ne propose jamais.
    expect(lieux.trouverParCode("98412"), "Kerguelen").toBeNull();
    expect(lieux.trouverParCode("98901"), "Clipperton").toBeNull();
    // Contre-exemple : un territoire ultramarin AVEC fuseau reste résoluble.
    expect(lieux.trouverParCode("97302")?.fuseau).toBe("America/Cayenne");
  });

  it("l'identifiant nomme la SOURCE (il entrera dans la traçabilité du lieu choisi)", () => {
    expect(lieux.identifiant).toBe(IDENTIFIANT_LIEUX_FRANCE);
    expect(lieux.identifiant).toMatch(/geo\.api\.gouv\.fr/);
  });
});
