import { describe, it, expect } from "vitest";
import * as Astronomy from "astronomy-engine";
import {
  calculerThemeNatal,
  resoudreInstant,
  normaliserDegres,
  placer,
  maisonDe,
  maisonsSignesEntiers,
  ascendantEtMilieuDuCiel,
  chaineEmpreinte,
  fenetreIncertitude,
  signeAmbigu,
  SIGNES,
  type EntreesNaissance,
} from "@/lib/astro/theme-natal";
import { CORPS, CORPS_CLASSIQUES, type Corps, type EphemerisPort, type LectureCorps } from "@/lib/astro/port";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";

/**
 * Story 5.1 (T7) — LE CALCUL LUI-MÊME.
 *
 * ══ CE QUI REND CE FICHIER DIFFÉRENT DES AUTRES TESTS DU DÉPÔT ══════════════════════════════════
 *
 * Presque tout le reste de la suite teste des règles que NOUS avons écrites : on peut donc les
 * relire pour vérifier le test. Ici on teste de l'ASTRONOMIE, où l'intuition ne sert à rien et où
 * une formule fausse ne plante jamais — elle rend un nombre plausible.
 *
 * Trois façons de s'en sortir, toutes employées ci-dessous :
 *
 *   (a) DES FAITS EXTÉRIEURS VÉRIFIABLES — à l'équinoxe de mars, le Soleil est à 0° du Bélier
 *       PAR DÉFINITION du zodiaque tropical. Aucun code ne peut me contredire là-dessus.
 *   (b) DEUX CHEMINS INDÉPENDANTS QUI DOIVENT CONCORDER — l'ascendant analytique (trigonométrie
 *       sphérique, notre formule) confronté aux matrices de rotation d'`astronomy-engine` : si
 *       l'ascendant est juste, il est à altitude ZÉRO sur l'horizon, à l'EST. Deux codes qui n'ont
 *       rien en commun et qui doivent tomber d'accord.
 *   (c) DES PROPRIÉTÉS STRUCTURELLES — déterminisme, bornes, monotonie : vraies quel que soit le
 *       ciel.
 *
 * ⚠️ Ce fichier importe `astronomy-engine` DIRECTEMENT, et c'est la seule exception au monopole de
 * `lib/astro/adapters/` (AC5). Elle est nécessaire — la vérification croisée (b) n'a aucun sens si
 * elle passe par le code qu'elle vérifie — et elle est INSCRITE dans la garde de frontière
 * (`tests/astro-architecture.test.ts`), pas tolérée en silence.
 */

const RAD = Math.PI / 180;
const ephemeride = ephemerideAstronomyEngine();

/** Port doublé, entièrement contrôlable : sert aux cas que le vrai ciel ne produit pas. */
function portDouble(
  longitudes: Partial<Record<Corps, LectureCorps>>,
  gast = 6,
  obliquite = 23.44,
): EphemerisPort {
  return {
    identifiant: "double@1",
    longitudeEcliptique: (corps: Corps) =>
      longitudes[corps] ?? { statut: "calcule", longitude: 0 },
    tempsSideralGreenwich: () => gast,
    obliquiteVraie: () => obliquite,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// (c) Les briques
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("normaliserDegres", () => {
  it("ramène dans [0, 360) — y compris les NÉGATIFS, que `%` seul laisserait passer", () => {
    // `-10 % 360` vaut `-10` en JavaScript. Un ascendant négatif donnerait `SIGNES[-1]`, donc
    // `undefined`, donc un thème avec un signe manquant sans que rien n'ait planté.
    expect(normaliserDegres(-10)).toBeCloseTo(350, 10);
    expect(normaliserDegres(370)).toBeCloseTo(10, 10);
    expect(normaliserDegres(0)).toBe(0);
    expect(normaliserDegres(-720.5)).toBeCloseTo(359.5, 10);
  });

  it("[DUR] jette sur une valeur non finie — jamais un 0 silencieux (P9)", () => {
    // 0° est une position PARFAITEMENT PLAUSIBLE (0° du Bélier). Replier NaN dessus fabriquerait
    // une position au lieu de signaler un défaut de calcul. C'est la faute `intensite` de la
    // revue 4.6, transposée aux degrés.
    expect(() => normaliserDegres(NaN)).toThrow();
    expect(() => normaliserDegres(Infinity)).toThrow();
    expect(() => normaliserDegres(-Infinity)).toThrow();
  });
});

describe("placer — signe et degré", () => {
  it("les douze frontières tombent juste", () => {
    for (let i = 0; i < 12; i++) {
      expect(placer(i * 30).signe).toBe(SIGNES[i]);
      expect(placer(i * 30).degre).toBeCloseTo(0, 10);
      expect(placer(i * 30 + 29.999).signe).toBe(SIGNES[i]);
    }
  });

  it("360° est 0° du Bélier, pas un treizième signe", () => {
    expect(placer(360)).toEqual({ signe: "belier", degre: 0 });
  });

  it("l'ordre du zodiaque est celui des longitudes croissantes", () => {
    expect(SIGNES).toHaveLength(12);
    expect(placer(0).signe).toBe("belier");
    expect(placer(90).signe).toBe("cancer");
    expect(placer(180).signe).toBe("balance");
    expect(placer(270).signe).toBe("capricorne");
  });
});

describe("maisons en signes entiers", () => {
  it("la maison I commence au 0° du SIGNE de l'ascendant, pas au degré de l'ascendant", () => {
    expect(maisonsSignesEntiers(127.4)).toEqual([120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60, 90]);
  });

  it("chaque longitude tombe dans exactement une maison, et elles couvrent le cercle", () => {
    const maisons = maisonsSignesEntiers(127.4);
    const vues = new Set<number>();
    for (let l = 0; l < 360; l += 0.5) vues.add(maisonDe(l, maisons));
    expect([...vues].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("l'ascendant lui-même est en maison I", () => {
    const asc = 127.4;
    expect(maisonDe(asc, maisonsSignesEntiers(asc))).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// (a) Des faits extérieurs vérifiables
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[FAIT EXTÉRIEUR] l'équinoxe de mars définit le 0° du Bélier", () => {
  it("le Soleil y est à 0°, à moins d'une minute d'arc", () => {
    // Ce n'est pas une convention interne : le zodiaque tropical EST défini par cet instant. Si
    // notre chaîne (géocentrique + apparente + écliptique de la date) était fausse quelque part,
    // ce test le dirait immédiatement.
    const equinoxe = new Date("2000-03-20T07:35:00Z");
    const lecture = ephemeride.longitudeEcliptique("soleil", equinoxe);
    expect(lecture.statut).toBe("calcule");
    if (lecture.statut !== "calcule") return;
    const ecart = Math.min(lecture.longitude, 360 - lecture.longitude);
    expect(ecart, `Soleil à ${lecture.longitude}° au lieu de 0°`).toBeLessThan(1 / 60);
  });

  it("[ANTI-HÉLIOCENTRIQUE] la position n'est PAS celle vue du Soleil", () => {
    // `Astronomy.EclipticLongitude()` est héliocentrique et porte le nom qu'on chercherait en
    // premier. Vue du Soleil, la Terre est à ~180° du Soleil vu de la Terre : ce test rougirait
    // instantanément si quelqu'un « simplifiait » l'adaptateur en l'appelant.
    const t = new Date("2026-08-07T12:00:00Z");
    const notre = ephemeride.longitudeEcliptique("soleil", t);
    expect(notre.statut).toBe("calcule");
    if (notre.statut !== "calcule") return;
    const heliocentriqueTerre = Astronomy.EclipticLongitude(Astronomy.Body.Earth, Astronomy.MakeTime(t));
    const ecart = Math.abs(normaliserDegres(notre.longitude - heliocentriqueTerre));
    expect(Math.abs(ecart - 180), "l'adaptateur rend de l'héliocentrique").toBeLessThan(1);
  });

  it("[ANTI-J2000] la position est celle DE LA DATE, pas de l'époque J2000", () => {
    // La précession vaut ~50,3″/an, soit ~0,37° en 2026 — un tiers de degré de zodiaque, qui
    // grandit d'année en année. `Rotation_EQJ_ECL()` (sans le `T` de « true of date ») donne
    // l'écliptique J2000 et perdrait exactement ce décalage, sans rien faire échouer.
    const t = new Date("2026-08-07T12:00:00Z");
    const notre = ephemeride.longitudeEcliptique("mars", t);
    expect(notre.statut).toBe("calcule");
    if (notre.statut !== "calcule") return;
    const j2000 = Astronomy.SphereFromVector(
      Astronomy.RotateVector(
        Astronomy.Rotation_EQJ_ECL(),
        Astronomy.GeoVector(Astronomy.Body.Mars, Astronomy.MakeTime(t), true),
      ),
    ).lon;
    const ecart = Math.abs(normaliserDegres(notre.longitude - j2000));
    expect(ecart, "l'adaptateur rend de l'écliptique J2000").toBeGreaterThan(0.2);
    expect(ecart, "et l'écart doit rester celui de la précession, pas n'importe quoi").toBeLessThan(0.6);
  });

  it("`Astronomy.Ecliptic()` est un chemin ÉQUIVALENT — et le confirme à la précision machine", () => {
    // Contrôle de la vérification : deux façons d'obtenir l'écliptique vrai de la date qui tombent
    // d'accord au 10⁻¹⁰ près. Si notre chaîne `GeoVector → Rotation_EQJ_ECT → SphereFromVector`
    // comportait une erreur de repère, cet accord n'existerait pas.
    const t = new Date("2026-08-07T12:00:00Z");
    const notre = ephemeride.longitudeEcliptique("mars", t);
    if (notre.statut !== "calcule") throw new Error("mars manquante");
    const autre = Astronomy.Ecliptic(
      Astronomy.GeoVector(Astronomy.Body.Mars, Astronomy.MakeTime(t), true),
    ).elon;
    expect(notre.longitude).toBeCloseTo(normaliserDegres(autre), 9);
  });
});

describe("[FAIT EXTÉRIEUR] les nœuds lunaires", () => {
  it("le nœud MOYEN vaut 125,04° à l'époque J2000 — c'est la définition du polynôme", () => {
    const l = ephemeride.longitudeEcliptique("noeud_moyen", new Date("2000-01-01T12:00:00Z"));
    expect(l.statut).toBe("calcule");
    if (l.statut !== "calcule") return;
    expect(l.longitude).toBeCloseTo(125.0445, 2);
  });

  it("le nœud VRAI oscille autour du moyen, à ±1,5° — jamais plus", () => {
    // C'est la libration réelle du nœud lunaire. Un écart plus grand signalerait une erreur de
    // signe dans le produit vectoriel ; un écart nul signalerait qu'on a livré deux fois le moyen.
    let ecartMax = 0;
    for (let jour = 0; jour < 400; jour += 7) {
      const t = new Date(Date.UTC(2020, 0, 1 + jour, 12));
      const moyen = ephemeride.longitudeEcliptique("noeud_moyen", t);
      const vrai = ephemeride.longitudeEcliptique("noeud_vrai", t);
      if (moyen.statut !== "calcule" || vrai.statut !== "calcule") throw new Error("nœud manquant");
      const d = normaliserDegres(vrai.longitude - moyen.longitude);
      ecartMax = Math.max(ecartMax, Math.min(d, 360 - d));
    }
    expect(ecartMax, "les deux nœuds sont identiques : l'un des deux est une copie").toBeGreaterThan(0.5);
    expect(ecartMax, "libration du nœud vrai hors de sa plage physique").toBeLessThan(2);
  });

  it("les nœuds RECULENT (mouvement rétrograde, ~19 ans par tour)", () => {
    const a = ephemeride.longitudeEcliptique("noeud_moyen", new Date("2020-01-01T12:00:00Z"));
    const b = ephemeride.longitudeEcliptique("noeud_moyen", new Date("2021-01-01T12:00:00Z"));
    if (a.statut !== "calcule" || b.statut !== "calcule") throw new Error("nœud manquant");
    // ~19,3 ans pour 360° ⇒ ~18,6° de recul par an.
    expect(normaliserDegres(a.longitude - b.longitude)).toBeCloseTo(19.35, 0);
  });
});

describe("[FAIT EXTÉRIEUR] l'obliquité de l'écliptique", () => {
  it("vaut ~23,44° et DÉCROÎT lentement — épingle `e_tilt` contre une régression de version", () => {
    // `e_tilt` porte un nom d'apparence interne. Si une version future le retirait ou changeait son
    // unité, tous les ascendants dériveraient en silence. Ce test le fait rougir à la place.
    const y2000 = ephemeride.obliquiteVraie(new Date("2000-01-01T12:00:00Z"));
    const y2100 = ephemeride.obliquiteVraie(new Date("2100-01-01T12:00:00Z"));
    expect(y2000).toBeCloseTo(23.4392, 2);
    expect(y2100, "l'obliquité décroît de ~47″ par siècle").toBeLessThan(y2000);
    expect(y2000 - y2100).toBeCloseTo(0.013, 2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// (b) Deux chemins indépendants qui doivent concorder
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Altitude et azimut d'un point de l'écliptique, calculés par les MATRICES DE ROTATION
 * d'`astronomy-engine` — un chemin qui ne partage pas une ligne avec notre trigonométrie sphérique.
 */
function altitudeAzimut(instant: Date, latitude: number, longitude: number, lambda: number) {
  const t = Astronomy.MakeTime(instant);
  const observateur = new Astronomy.Observer(latitude, longitude, 0);
  const ect = new Astronomy.Vector(Math.cos(lambda * RAD), Math.sin(lambda * RAD), 0, t);
  const eqd = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(t), ect);
  const hor = Astronomy.RotateVector(Astronomy.Rotation_EQD_HOR(t, observateur), eqd);
  // `null` = SANS réfraction atmosphérique. Indispensable : la réfraction relève l'horizon apparent
  // de ~0,48°, et l'ascendant serait alors « à 0,48° » au lieu de zéro — on mesurerait l'optique de
  // l'atmosphère au lieu de notre géométrie. Le typage de la bibliothèque annonce `string` là où le
  // code accepte aussi `null` ; le cast documente l'écart plutôt que de le contourner.
  const s = Astronomy.HorizonFromVector(hor, null as unknown as string);
  return { altitude: s.lat, azimut: s.lon };
}

describe("[VÉRIFICATION CROISÉE] l'ascendant et le milieu du ciel", () => {
  const lieux: readonly (readonly [string, string, number, number])[] = [
    ["Paris", "2026-08-07T09:30:00Z", 48.8566, 2.3522],
    ["Sydney (hémisphère sud)", "1990-06-15T05:12:00Z", -33.87, 151.21],
    ["New York (longitude ouest)", "2001-12-25T23:45:00Z", 40.71, -74.01],
    ["Tromsø (au-delà du cercle polaire)", "1975-11-03T02:20:00Z", 69.65, 18.96],
    ["Quito (équateur)", "2010-04-18T16:05:00Z", -0.18, -78.47],
  ];

  it.each(lieux)("%s — l'ascendant est SUR l'horizon (altitude nulle) et à l'EST", (_nom, iso, lat, lon) => {
    const instant = new Date(iso);
    const ramc = normaliserDegres(ephemeride.tempsSideralGreenwich(instant) * 15 + lon);
    const { ascendant } = ascendantEtMilieuDuCiel(ramc, lat, ephemeride.obliquiteVraie(instant));

    const { altitude, azimut } = altitudeAzimut(instant, lat, lon, ascendant);
    expect(Math.abs(altitude), "l'ascendant n'est pas sur l'horizon").toBeLessThan(1e-6);
    // Est = azimut dans ]0°, 180°[. Une erreur de quadrant (le piège d'`atan` au lieu d'`atan2`)
    // placerait le « descendant » ici, à 180° de là, et personne ne le verrait à la lecture.
    expect(azimut, "l'ascendant s'est levé à l'OUEST — quadrant inversé").toBeGreaterThan(0);
    expect(azimut).toBeLessThan(180);
  });

  it.each(lieux)("%s — le milieu du ciel est SUR le méridien", (_nom, iso, lat, lon) => {
    const instant = new Date(iso);
    const ramc = normaliserDegres(ephemeride.tempsSideralGreenwich(instant) * 15 + lon);
    const { milieuDuCiel } = ascendantEtMilieuDuCiel(ramc, lat, ephemeride.obliquiteVraie(instant));

    const { altitude, azimut } = altitudeAzimut(instant, lat, lon, milieuDuCiel);
    // Le méridien = azimut 0° (nord) ou 180° (sud), selon l'hémisphère et la déclinaison.
    const surLeMeridien = Math.min(Math.abs(azimut), Math.abs(azimut - 180), Math.abs(azimut - 360));
    expect(surLeMeridien, `MC hors méridien (azimut ${azimut}°)`).toBeLessThan(1e-6);
    expect(altitude, "le MC est sous l'horizon — c'est l'IC qu'on a calculé").toBeGreaterThan(0);
  });

  it("aux pôles exacts, l'ascendant n'existe pas et on le dit", () => {
    expect(() => ascendantEtMilieuDuCiel(0, 90, 23.44)).toThrow();
    expect(() => ascendantEtMilieuDuCiel(0, -90, 23.44)).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La résolution de l'instant
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("resoudreInstant", () => {
  it("sans heure NI fuseau : midi UTC, jamais minuit — la Lune parcourt 13° par jour", () => {
    const r = resoudreInstant({ date: "1990-06-15" });
    expect(r.heureConnue).toBe(false);
    expect(r.raisonSansHeure).toBe("heure_absente");
    // Sans fuseau il n'existe aucun « jour local » à viser : midi UTC est le seul point nommable.
    expect(r.instantUtc.toISOString()).toBe("1990-06-15T12:00:00.000Z");
  });

  // ── A7 (revue du 2026-08-12) — MIDI DU JOUR LOCAL, PAS MIDI UTC ────────────────────────────────
  //
  // Le jour de naissance est une date LOCALE. Midi UTC tombait n'importe où dans ce jour selon le
  // fuseau — et parfois EN DEHORS. La combinaison « pas d'heure + fuseau connu » n'était atteignable
  // par aucun écran quand le défaut a été trouvé (le formulaire écrivait heure et lieu ensemble) :
  // c'est A2, qui découple les deux, qui la rend possible. Corrigé dans cet ordre exprès.

  it("[A7] sans heure MAIS avec fuseau : midi LOCAL — à Paris en été, 10:00 UTC", () => {
    const r = resoudreInstant({ date: "1990-06-15", fuseau: "Europe/Paris" });
    expect(r.heureConnue).toBe(false);
    expect(r.raisonSansHeure).toBe("heure_absente");
    expect(r.instantUtc.toISOString()).toBe("1990-06-15T10:00:00.000Z");
  });

  it("[A7] le décalage suit la DATE, pas seulement le lieu : en hiver, midi local = 11:00 UTC", () => {
    // Même garde que pour l'heure connue : un décalage figé « +01:00 » se tromperait d'une heure la
    // moitié de l'année, et sur toutes les naissances françaises d'avant 1976.
    const r = resoudreInstant({ date: "1990-01-15", fuseau: "Europe/Paris" });
    expect(r.instantUtc.toISOString()).toBe("1990-01-15T11:00:00.000Z");
  });

  it("[A7 — LE CAS QUI FAISAIT MAL] à Kiribati (UTC+14), midi UTC tombait le LENDEMAIN local", () => {
    // Midi UTC le 15 juin 2000 est le 16 juin à 2 h du matin à Kiritimati : le point retenu n'était
    // même pas dans le jour de naissance, ni dans la fenêtre d'instants possibles calculée pour ce
    // même thème. Deux fonctions du même fichier ne parlaient pas du même jour.
    const r = resoudreInstant({ date: "2000-06-15", fuseau: "Pacific/Kiritimati" });
    expect(r.instantUtc.toISOString()).toBe("2000-06-14T22:00:00.000Z");
  });

  it("[A7/DUR] AVANT 1995, Kiribati était à UTC−10 : le même lieu, l'autre côté de la ligne", () => {
    // Kiritimati a SAUTÉ la ligne de changement de date le 1er janvier 1995 — l'île est passée de
    // UTC−10 à UTC+14 et le 31 décembre 1994 n'a jamais existé là-bas. Une naissance de 1990 s'y
    // résout donc dans l'autre sens. C'est la même leçon que « la France n'avait pas d'heure d'été
    // avant 1976 », poussée à son extrême : le fuseau est un identifiant, jamais un décalage.
    const r = resoudreInstant({ date: "1990-06-15", fuseau: "Pacific/Kiritimati" });
    expect(r.instantUtc.toISOString()).toBe("1990-06-15T22:00:00.000Z");
  });

  it("[A7] à Baker (UTC−12), midi local est APRÈS midi UTC — l'écart joue dans les deux sens", () => {
    const r = resoudreInstant({ date: "1990-06-15", fuseau: "Etc/GMT+12" });
    expect(r.instantUtc.toISOString()).toBe("1990-06-16T00:00:00.000Z");
  });

  it("[A7] l'instant retenu sans heure est TOUJOURS dans la fenêtre d'incertitude", () => {
    // C'est l'invariant que midi UTC violait. Il vaut pour tous les fuseaux, pas seulement ceux
    // qu'on a pensé à tester — c'est ce qui en fait un invariant et pas un exemple de plus.
    for (const fuseau of [
      "Europe/Paris",
      "Pacific/Kiritimati",
      "Etc/GMT+12",
      "America/New_York",
      "Asia/Kolkata",
      "Australia/Sydney",
    ]) {
      const r = resoudreInstant({ date: "1990-06-15", fuseau });
      const f = fenetreIncertitude({ date: "1990-06-15", fuseau });
      expect(r.instantUtc.getTime(), fuseau).toBeGreaterThanOrEqual(f.min.getTime());
      expect(r.instantUtc.getTime(), fuseau).toBeLessThanOrEqual(f.max.getTime());
    }
  });

  it("[A7] un fuseau INVALIDE sans heure retombe sur midi UTC, sans jeter", () => {
    const r = resoudreInstant({ date: "1990-06-15", fuseau: "Mars/Olympus_Mons" });
    expect(r.heureConnue).toBe(false);
    // La raison reste « heure_absente » : c'est l'heure qui manque d'abord, le fuseau ne servirait
    // à rien même valide. On ne renomme pas le défaut pour un champ qui n'aurait rien changé.
    expect(r.raisonSansHeure).toBe("heure_absente");
    expect(r.instantUtc.toISOString()).toBe("1990-06-15T12:00:00.000Z");
  });

  it("sans fuseau : l'heure est déclarée inexploitable plutôt que supposée UTC", () => {
    // Supposer UTC donnerait un ascendant faux de un à douze signes, avec l'air d'être juste.
    const r = resoudreInstant({ date: "1990-06-15", heure: "07:15" });
    expect(r.heureConnue).toBe(false);
    expect(r.raisonSansHeure).toBe("fuseau_absent");
  });

  it("fuseau invalide : nommé comme tel, distinct de « absent » (c'est un défaut de donnée)", () => {
    const r = resoudreInstant({ date: "1990-06-15", heure: "07:15", fuseau: "Mars/Olympus_Mons" });
    expect(r.heureConnue).toBe(false);
    expect(r.raisonSansHeure).toBe("fuseau_invalide");
  });

  it("HIVER à Paris (UTC+1) : 07:15 locales → 06:15 UTC", () => {
    const r = resoudreInstant({ date: "1990-01-15", heure: "07:15", fuseau: "Europe/Paris" });
    expect(r.heureConnue).toBe(true);
    expect(r.instantUtc.toISOString()).toBe("1990-01-15T06:15:00.000Z");
  });

  it("[DUR] ÉTÉ à Paris (UTC+2) : 07:15 locales → 05:15 UTC — le décalage n'est pas une constante", () => {
    // Stocker « +01:00 » au lieu d'un identifiant IANA rendrait ce cas faux d'une heure, soit
    // ~15° d'ascendant : un demi-signe, toute l'année, pour la moitié des gens.
    const r = resoudreInstant({ date: "1990-07-15", heure: "07:15", fuseau: "Europe/Paris" });
    expect(r.instantUtc.toISOString()).toBe("1990-07-15T05:15:00.000Z");
  });

  it("[DUR] AVANT 1976, la France n'avait pas d'heure d'été : 07:15 en juillet 1970 → 06:15 UTC", () => {
    // La preuve que le décalage dépend de la DATE et pas seulement du lieu. Une table pays→décalage
    // se tromperait sur toutes les naissances antérieures à 1976.
    const r = resoudreInstant({ date: "1970-07-15", heure: "07:15", fuseau: "Europe/Paris" });
    expect(r.instantUtc.toISOString()).toBe("1970-07-15T06:15:00.000Z");
  });

  it("un fuseau à l'ouest (New York) décale dans l'autre sens", () => {
    const r = resoudreInstant({ date: "1990-01-15", heure: "07:15", fuseau: "America/New_York" });
    expect(r.instantUtc.toISOString()).toBe("1990-01-15T12:15:00.000Z");
  });

  it("une date illisible est une erreur, jamais une date de repli", () => {
    expect(() => resoudreInstant({ date: "15/06/1990" })).toThrow();
    expect(() => resoudreInstant({ date: "1990-06-15", heure: "7h15", fuseau: "Europe/Paris" })).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le thème complet
// ══════════════════════════════════════════════════════════════════════════════════════════════

const complet: EntreesNaissance = {
  date: "1990-06-15",
  heure: "07:15",
  fuseau: "Europe/Paris",
  latitude: 48.8566,
  longitude: 2.3522,
};

describe("calculerThemeNatal — thème complet", () => {
  it("[DÉTERMINISME] rejoué, il rend STRICTEMENT le même résultat (FR-047)", () => {
    const a = calculerThemeNatal(complet, ephemeride);
    const b = calculerThemeNatal(complet, ephemeride);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("place les dix corps classiques et les deux nœuds, chacun dans une maison", () => {
    const theme = calculerThemeNatal(complet, ephemeride);
    const places = new Set(theme.positions.map((p) => p.corps));
    for (const c of CORPS_CLASSIQUES) expect(places, `${c} manquant`).toContain(c);
    expect(places).toContain("noeud_moyen");
    expect(places).toContain("noeud_vrai");
    for (const p of theme.positions) {
      expect(p.longitude).toBeGreaterThanOrEqual(0);
      expect(p.longitude).toBeLessThan(360);
      expect(p.degre).toBeGreaterThanOrEqual(0);
      expect(p.degre).toBeLessThan(30);
      expect(p.maison, `${p.corps} sans maison`).toBeGreaterThanOrEqual(1);
      expect(p.maison).toBeLessThanOrEqual(12);
    }
  });

  it("les angles sont calculés, et le système de maisons est INSCRIT (jamais supposé)", () => {
    const theme = calculerThemeNatal(complet, ephemeride);
    expect(theme.angles.statut).toBe("calcule");
    if (theme.angles.statut !== "calcule") return;
    expect(theme.angles.systeme).toBe("signes_entiers");
    expect(theme.angles.maisons).toHaveLength(12);
    expect(theme.precision).toBe("heure_connue");
  });

  it("l'adaptateur employé est inscrit dans le thème (il entre dans l'empreinte)", () => {
    expect(calculerThemeNatal(complet, ephemeride).adaptateur).toBe("astronomy-engine@2.1.19");
  });
});

describe("[AC6] calculerThemeNatal — les manques n'arrêtent rien", () => {
  it("sans heure : les dix corps et les nœuds sont là, les angles sont déclarés absents", () => {
    const theme = calculerThemeNatal({ date: "1990-06-15" }, ephemeride);
    expect(theme.positions.length).toBe(CORPS.length - 1); // tout sauf Chiron
    expect(theme.angles).toEqual({ statut: "non_calcule", raison: "heure_absente" });
    expect(theme.precision).toBe("midi_par_defaut");
  });

  it("heure mais pas de coordonnées : les angles manquent pour LEUR raison propre", () => {
    const theme = calculerThemeNatal(
      { date: "1990-06-15", heure: "07:15", fuseau: "Europe/Paris" },
      ephemeride,
    );
    expect(theme.angles).toEqual({ statut: "non_calcule", raison: "coordonnees_absentes" });
    expect(theme.precision, "l'heure était connue : la Lune est exacte").toBe("heure_connue");
  });

  it("naissance au pôle géographique : les corps sont là, l'ascendant est déclaré inexistant", () => {
    const theme = calculerThemeNatal({ ...complet, latitude: 90, longitude: 0 }, ephemeride);
    expect(theme.angles).toEqual({ statut: "non_calcule", raison: "latitude_polaire" });
    expect(theme.positions.length, "le pôle a fait échouer tout le thème").toBeGreaterThan(10);
  });

  it("au-delà du cercle polaire MAIS pas au pôle : les angles SONT calculés", () => {
    // Le cercle polaire casse Placidus, pas l'ascendant. Refuser ici serait un excès de prudence
    // qui priverait de son ascendant quiconque est né en Laponie.
    const theme = calculerThemeNatal({ ...complet, latitude: 69.65, longitude: 18.96 }, ephemeride);
    expect(theme.angles.statut).toBe("calcule");
  });

  it("aucune maison n'est attribuée quand les angles manquent — jamais une maison inventée", () => {
    const theme = calculerThemeNatal({ date: "1990-06-15" }, ephemeride);
    for (const p of theme.positions) expect(p.maison).toBeUndefined();
  });
});

describe("[P2/DUR] Chiron : déclaré, jamais fabriqué", () => {
  it("figure dans les ABSENTS avec sa raison, et jamais dans les positions", () => {
    const theme = calculerThemeNatal(complet, ephemeride);
    expect(theme.positions.map((p) => p.corps)).not.toContain("chiron");
    expect(theme.absents).toEqual([{ corps: "chiron", raison: "ephemeride_sans_asteroides" }]);
  });

  it("la raison reste DÉFINITIVE même hors de la plage temporelle", () => {
    // Dire « hors plage » pour Chiron laisserait croire qu'une autre date de naissance le donnerait.
    const theme = calculerThemeNatal({ date: "1650-03-02" }, ephemeride);
    const chiron = theme.absents.find((a) => a.corps === "chiron");
    expect(chiron?.raison).toBe("ephemeride_sans_asteroides");
  });

  it("le port le DÉCLARE quand même — le besoin est réel, c'est la source qui manque", () => {
    expect(CORPS).toContain("chiron");
  });
});

describe("[P9/DUR] une éphéméride qui déraille est un incident, pas une absence", () => {
  it("une longitude NaN fait ÉCHOUER le calcul — elle ne devient pas 0° du Bélier", () => {
    const port = portDouble({ mars: { statut: "calcule", longitude: NaN } });
    expect(() => calculerThemeNatal(complet, port)).toThrow();
  });

  it("une longitude infinie aussi", () => {
    const port = portDouble({ lune: { statut: "calcule", longitude: Infinity } });
    expect(() => calculerThemeNatal(complet, port)).toThrow();
  });

  it("une longitude hors bornes est simplement normalisée (400° = 40°) — ce n'est pas une panne", () => {
    const port = portDouble({ soleil: { statut: "calcule", longitude: 400 } });
    const theme = calculerThemeNatal(complet, port);
    const soleil = theme.positions.find((p) => p.corps === "soleil");
    expect(soleil?.longitude).toBeCloseTo(40, 10);
    expect(soleil?.signe).toBe("taureau");
  });
});

describe("[AC7/DUR] hors plage temporelle : refusé, jamais dégradé", () => {
  it("une naissance en 1650 ne rend AUCUNE position — toutes sont déclarées hors plage", () => {
    const theme = calculerThemeNatal({ date: "1650-03-02" }, ephemeride);
    expect(theme.positions).toEqual([]);
    const raisons = new Set(theme.absents.map((a) => a.raison));
    expect(raisons).toContain("hors_plage_ephemeride");
    expect(theme.absents).toHaveLength(CORPS.length);
  });

  it("les bornes 1700 et 2200 sont incluses", () => {
    expect(calculerThemeNatal({ date: "1700-01-02" }, ephemeride).positions.length).toBeGreaterThan(10);
    expect(calculerThemeNatal({ date: "2200-12-30" }, ephemeride).positions.length).toBeGreaterThan(10);
    expect(calculerThemeNatal({ date: "1699-12-31" }, ephemeride).positions).toEqual([]);
    expect(calculerThemeNatal({ date: "2201-01-01" }, ephemeride).positions).toEqual([]);
  });
});

describe("chaineEmpreinte", () => {
  it("change quand l'HEURE s'ajoute — c'est ce qui autorisera le recalcul de la Story 5.3", () => {
    const sans = chaineEmpreinte({ date: "1990-06-15" }, "a@1");
    const avec = chaineEmpreinte({ date: "1990-06-15", heure: "07:15", fuseau: "Europe/Paris" }, "a@1");
    expect(sans).not.toBe(avec);
  });

  it("[DUR] change quand l'ADAPTATEUR change, à entrées de naissance identiques", () => {
    // Sans ça, le jour où une source de Chiron arrive, le trigger de 0039 refuserait le recalcul :
    // les entrées de naissance, elles, n'auront pas bougé.
    expect(chaineEmpreinte(complet, "astronomy-engine@2.1.19")).not.toBe(
      chaineEmpreinte(complet, "swiss-ephemeris@2.10"),
    );
  });

  it("ne change pas quand le PRÉNOM change — il n'entre dans aucun calcul céleste", () => {
    // Corollaire de la décision de ne PAS figer `prenom` (write-once limité aux entrées
    // astronomiques) : corriger une faute de frappe ne doit pas invalider le thème.
    expect(chaineEmpreinte(complet, "a@1")).toBe(chaineEmpreinte({ ...complet }, "a@1"));
  });

  it("est stable pour des entrées identiques (sinon chaque lecture forcerait un recalcul)", () => {
    expect(chaineEmpreinte(complet, "a@1")).toBe(chaineEmpreinte(complet, "a@1"));
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 5.3 (T1) — LA FENÊTRE D'INCERTITUDE
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// Sans heure, `resoudreInstant` prend MIDI. Le calcul aboutit, la longitude est un nombre fini,
// `placer()` rend un signe — et RIEN ne signale que ce signe est un pari. La fenêtre est ce qui
// rend le pari visible : c'est l'intervalle d'instants où la naissance a RÉELLEMENT pu avoir lieu.

describe("[5.3 / D2] fenetreIncertitude — l'intervalle des instants possibles", () => {
  it("heure ET fuseau connus : la fenêtre est un POINT (aucun échantillonnage, aucun surcoût)", () => {
    const f = fenetreIncertitude(complet);
    expect(f.min.getTime()).toBe(f.max.getTime());
    expect(f.min.toISOString()).toBe("1990-06-15T05:15:00.000Z"); // Paris UTC+2 en juin
  });

  it("heure absente, fuseau CONNU : exactement le jour LOCAL, bornes comprises", () => {
    // Paris est à UTC+2 en juin : le jour local du 15 va de 22 h la veille à 22 h le jour même.
    const f = fenetreIncertitude({ date: "1990-06-15", fuseau: "Europe/Paris" });
    expect(f.min.toISOString()).toBe("1990-06-14T22:00:00.000Z");
    expect(f.max.toISOString()).toBe("1990-06-15T22:00:00.000Z");
  });

  it("[DUR] le jour local d'un changement d'heure ne dure PAS 24 h, et la fenêtre le sait", () => {
    // 25 mars 1990 : la France passe à l'heure d'été à 2 h du matin. Le jour local dure 23 h.
    // Une fenêtre codée « minuit + 24 h » déborderait d'une heure sur le jour suivant — une heure
    // pendant laquelle la Lune parcourt un demi-degré, largement de quoi fabriquer une ambiguïté
    // qui n'existe pas. On résout les DEUX bornes, on n'en additionne aucune.
    const f = fenetreIncertitude({ date: "1990-03-25", fuseau: "Europe/Paris" });
    expect(f.min.toISOString()).toBe("1990-03-24T23:00:00.000Z");
    expect(f.max.toISOString()).toBe("1990-03-25T22:00:00.000Z");
    expect(f.max.getTime() - f.min.getTime()).toBe(23 * 3600_000);
  });

  it("[P7/DUR] heure absente ET fuseau inconnu : 50 h, jamais 24 h", () => {
    // Le jour LOCAL n'est pas connu si le fuseau ne l'est pas. Les décalages réels vont de UTC−12
    // à UTC+14 : l'instant vrai est donc quelque part entre « minuit à UTC+14 » et « minuit du
    // lendemain à UTC−12 ». Prendre 24 h déclarerait « signe certain » des corps qui ne le sont pas.
    const f = fenetreIncertitude({ date: "1990-06-15" });
    expect(f.min.toISOString()).toBe("1990-06-14T10:00:00.000Z");
    expect(f.max.toISOString()).toBe("1990-06-16T12:00:00.000Z");
    expect(f.max.getTime() - f.min.getTime()).toBe(50 * 3600_000);
  });

  it("heure connue mais fuseau absent : 26 h — on ignore le décalage, pas l'heure", () => {
    const f = fenetreIncertitude({ date: "1990-06-15", heure: "07:15" });
    expect(f.max.getTime() - f.min.getTime()).toBe(26 * 3600_000);
    expect(f.min.toISOString()).toBe("1990-06-14T17:15:00.000Z");
    expect(f.max.toISOString()).toBe("1990-06-15T19:15:00.000Z");
  });

  it("un fuseau INVALIDE dégrade comme un fuseau absent (26 h), il ne fait pas tout échouer", () => {
    const f = fenetreIncertitude({ date: "1990-06-15", heure: "07:15", fuseau: "Mars/Olympus_Mons" });
    expect(f.max.getTime() - f.min.getTime()).toBe(26 * 3600_000);
  });

  it("une date illisible est une erreur, jamais une fenêtre de repli", () => {
    expect(() => fenetreIncertitude({ date: "15/06/1990" })).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 5.3 (T1 / D1) — L'AMBIGUÏTÉ DE SIGNE
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// FAITS EXTÉRIEURS VÉRIFIÉS (astronomy-engine, 2026-08-07) — ils ne dépendent d'aucun code à nous :
//   • jour local Paris du 1990-06-14 : la Lune passe du VERSEAU aux POISSONS ;
//   • jour local Paris du 1990-06-15 : la Lune reste en POISSONS de bout en bout ;
//   • jour local Paris du 1990-08-23 : le SOLEIL passe du LION à la VIERGE.

describe("[5.3 / D1] signeAmbigu — le signe est-il le même partout dans la fenêtre ?", () => {
  const paris = (date: string) => fenetreIncertitude({ date, fuseau: "Europe/Paris" });

  it("[PRÉSENCE AVANT ABSENCE] une fenêtre PONCTUELLE n'est jamais ambiguë", () => {
    // Sinon toutes les assertions d'ambiguïté seraient vraies pour rien.
    const f = fenetreIncertitude(complet);
    for (const corps of CORPS_CLASSIQUES) {
      expect(signeAmbigu(corps, f, ephemeride), `${corps} déclaré ambigu sur un instant unique`).toBe(false);
    }
  });

  it("[FAIT EXTÉRIEUR] la Lune du 14 juin 1990 à Paris est AMBIGUË (verseau → poissons)", () => {
    expect(signeAmbigu("lune", paris("1990-06-14"), ephemeride)).toBe(true);
  });

  it("[FAIT EXTÉRIEUR] la Lune du 15 juin 1990 à Paris ne l'est PAS — elle reste en poissons", () => {
    // Le contre-exemple compte autant que l'exemple : un détecteur qui rendrait toujours `true`
    // ferait disparaître la Lune de tous les thèmes sans heure, et passerait le test précédent.
    expect(signeAmbigu("lune", paris("1990-06-15"), ephemeride)).toBe(false);
  });

  it("[D1/DUR] ce n'est PAS un cas particulier de la Lune : le SOLEIL du 23 août 1990 est ambigu", () => {
    // Mutation-cible : `if (corps !== "lune") return false;`. Un Soleil sur trente change de signe
    // dans la journée — et le Soleil est LE nombre que tout le monde connaît.
    expect(signeAmbigu("soleil", paris("1990-08-23"), ephemeride)).toBe(true);
    expect(signeAmbigu("soleil", paris("1990-08-21"), ephemeride)).toBe(false);
  });

  it("un corps que l'éphéméride ignore n'est pas « ambigu » — il est absent pour sa raison", () => {
    expect(signeAmbigu("chiron", paris("1990-06-14"), ephemeride)).toBe(false);
  });

  it("[P5] l'échantillonnage est INTERNE, pas seulement aux deux bornes", () => {
    // Port doublé : mêmes signes aux deux bornes, autre signe au milieu. Un détecteur qui ne
    // regarderait que `min` et `max` rendrait `false` et laisserait passer le mensonge. Le cas réel
    // est une planète proche d'une station qui sort d'un signe et y revient.
    const debut = new Date("1990-06-15T00:00:00Z").getTime();
    const port: EphemerisPort = {
      identifiant: "double@1",
      // 10° du Bélier aux bornes, 40° (= 10° du Taureau) partout au milieu.
      longitudeEcliptique: (_corps: Corps, t: Date): LectureCorps => {
        const h = Math.round((t.getTime() - debut) / 3600_000);
        return { statut: "calcule", longitude: h === 0 || h === 24 ? 10 : 40 };
      },
      tempsSideralGreenwich: () => 6,
      obliquiteVraie: () => 23.44,
    };
    const f = { min: new Date(debut), max: new Date(debut + 24 * 3600_000) };
    expect(signeAmbigu("mars", f, port)).toBe(true);
  });
});

describe("[5.3 / AC1] calculerThemeNatal — un signe indéterminable est DÉCLARÉ, jamais deviné", () => {
  const sansHeure = (date: string): EntreesNaissance => ({
    date,
    fuseau: "Europe/Paris",
    latitude: 48.8566,
    longitude: 2.3522,
  });

  it("[LE CŒUR] la Lune du 14 juin 1990 sort des positions et entre dans les absents", () => {
    const theme = calculerThemeNatal(sansHeure("1990-06-14"), ephemeride);
    expect(theme.positions.map((p) => p.corps)).not.toContain("lune");
    expect(theme.absents).toContainEqual({ corps: "lune", raison: "signe_ambigu_sans_heure" });
  });

  it("le 15 juin, elle est là — l'absence est conditionnelle, pas systématique (FR-049)", () => {
    const theme = calculerThemeNatal(sansHeure("1990-06-15"), ephemeride);
    expect(theme.positions.map((p) => p.corps)).toContain("lune");
    expect(theme.absents.map((a) => a.corps)).not.toContain("lune");
  });

  it("[FR-049] « la quasi-totalité des planètes » : le soleil reste là un jour ordinaire", () => {
    const theme = calculerThemeNatal(sansHeure("1990-06-15"), ephemeride);
    expect(theme.positions.map((p) => p.corps)).toContain("soleil");
    // …et il s'absente le jour où il change de signe.
    const bascule = calculerThemeNatal(sansHeure("1990-08-23"), ephemeride);
    expect(bascule.absents).toContainEqual({ corps: "soleil", raison: "signe_ambigu_sans_heure" });
  });

  it("[DUR] avec l'heure, PLUS AUCUNE ambiguïté — la fenêtre est un point", () => {
    // Mutation-cible : échantillonner même quand l'heure est connue. Le thème complet perdrait des
    // corps sans raison, et le surcoût frapperait le cas nominal.
    const theme = calculerThemeNatal({ ...complet, date: "1990-06-14" }, ephemeride);
    expect(theme.positions.map((p) => p.corps)).toContain("lune");
    expect(theme.absents.map((a) => a.raison)).not.toContain("signe_ambigu_sans_heure");
  });

  it("Chiron garde SA raison — l'ambiguïté ne la recouvre pas", () => {
    const theme = calculerThemeNatal(sansHeure("1990-06-14"), ephemeride);
    expect(theme.absents).toContainEqual({ corps: "chiron", raison: "ephemeride_sans_asteroides" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 5.3 (T1 / D4 / P1) — LE LEVIER DE MIGRATION DE FORME
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / P1 / DUR] le numéro de SCHÉMA et le préfixe d'EMPREINTE sont liés", () => {
  /**
   * ⚠️ LE TEST LE PLUS IMPORTANT DE LA STORY 5.3.
   *
   * `themeExploitable` (couche data) refuse tout contenu dont le `schema` n'est pas celui du jour.
   * Le SEUL moyen de recalculer un thème déjà gravé est le trigger `theme_natal_recalcul_declare`
   * (0039), qui exige une EMPREINTE DIFFÉRENTE. Or l'empreinte ne dépend que des entrées de
   * naissance et de l'adaptateur : changer la forme du thème ne la change pas.
   *
   * Conséquence si l'on bumpe `schema` seul : le thème stocké devient inexploitable, le recalcul
   * est refusé par la base, et le socle est mort pour tous les comptes existants — SANS une seule
   * erreur nulle part. Le préfixe de `chaineEmpreinte` est le levier qui débloque exactement UN
   * recalcul par compte. Les deux se bumpent ensemble, ou pas du tout.
   */
  it("le préfixe d'empreinte porte le MÊME numéro que le schéma du thème", () => {
    const schema = calculerThemeNatal(complet, ephemeride).schema;
    const prefixe = chaineEmpreinte(complet, "a@1").split("|")[0];
    expect(
      prefixe,
      `schéma ${schema} mais empreinte « ${prefixe} » : bumper l'un sans l'autre brique tous les ` +
        `thèmes déjà gravés (Story 5.3, D4/P1). Bumpe les deux, ou aucun.`,
    ).toBe(`v${schema}`);
  });

  it("[NON-VACUITÉ] le préfixe est bien la PREMIÈRE composante, et elle n'est pas vide", () => {
    // Sans ça, un `split` qui ne trouverait rien rendrait `undefined` des deux côtés un jour.
    expect(chaineEmpreinte(complet, "a@1").split("|")[0]).toMatch(/^v\d+$/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B5 (revue du 2026-08-12) — UNE HEURE ILLISIBLE NE TUE PAS LE SOCLE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[B5] deux fonctions voisines, la même entrée, une seule décision", () => {
  /**
   * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════
   *
   * Avec `{ date, heure: "7h15" }` et AUCUN fuseau, `resoudreInstant` dégrade proprement : il rend
   * `fuseau_absent` et midi par défaut, sans jamais parser l'heure. Il a DÉCIDÉ qu'elle ne
   * servirait pas.
   *
   * `fenetreIncertitude`, dix lignes plus bas, la reparsait quand même — et `eclaterHeure` JETTE.
   * Donc `calculerThemeNatal`, dont l'en-tête promet qu'il « aboutit TOUJOURS avec ce qui est
   * disponible » (AC6/FR-049), mourait sur une entrée que son propre fichier venait de savoir
   * traiter. Deux fonctions du même module, la même donnée, deux décisions opposées.
   *
   * On suit celle qui dégrade : une heure illisible est une heure qu'on n'a pas.
   */
  it("[LE TEST QUI COMPTE] `calculerThemeNatal` aboutit sur une heure illisible sans fuseau", () => {
    const theme = calculerThemeNatal({ date: "1990-06-15", heure: "7h15" }, ephemerideAstronomyEngine());
    expect(theme.precision).toBe("midi_par_defaut");
    expect(theme.positions.length, "le socle doit sortir avec ce qu'il a").toBeGreaterThan(5);
  });

  it("`fenetreIncertitude` rend la fenêtre LARGE plutôt que de lever", () => {
    // Ni heure exploitable ni fuseau : l'instant vrai va de « minuit à UTC+14 » à « minuit du
    // lendemain à UTC−12 ». C'est l'aveu correct — 50 h, pas une fenêtre inventée de 24 h.
    const f = fenetreIncertitude({ date: "1990-06-15", heure: "7h15" });
    const heures = (f.max.getTime() - f.min.getTime()) / 3_600_000;
    expect(heures).toBe(50);
  });

  it("[CONTRÔLE] une heure LISIBLE sans fuseau garde sa fenêtre de 26 h", () => {
    // Sans ce contrôle, « tout élargir à 50 h » passerait le test précédent — et on perdrait la
    // précision que l'heure apporte réellement quand elle est lisible.
    const f = fenetreIncertitude({ date: "1990-06-15", heure: "07:15" });
    const heures = (f.max.getTime() - f.min.getTime()) / 3_600_000;
    expect(heures).toBe(26);
  });

  it("[NON-RÉGRESSION] `resoudreInstant` LÈVE toujours quand l'heure ET le fuseau sont donnés", () => {
    // La dégradation de `fenetreIncertitude` ne doit pas se propager en indulgence générale : quand
    // les deux champs sont là, une heure illisible EST un défaut de donnée, et il doit se voir.
    expect(() =>
      resoudreInstant({ date: "1990-06-15", heure: "7h15", fuseau: "Europe/Paris" }),
    ).toThrow();
  });

  it("une DATE illisible lève toujours — elle, rien ne peut la remplacer", () => {
    // FR-048 : la date de naissance est la seule entrée obligatoire. Lui inventer un repli
    // fabriquerait un thème entier pour quelqu'un d'autre.
    expect(() => calculerThemeNatal({ date: "15/06/1990" }, ephemerideAstronomyEngine())).toThrow();
  });
});
