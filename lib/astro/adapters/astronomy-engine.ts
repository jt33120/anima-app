import * as Astronomy from "astronomy-engine";
import type { Corps, CorpsClassique, EphemerisPort, LectureCorps } from "../port";

/**
 * astronomy-engine.ts — L'ADAPTATEUR D'ÉPHÉMÉRIDE (Story 5.1, AD-6 / AC5).
 *
 * ⚠️ **SEUL FICHIER DU DÉPÔT AUTORISÉ À IMPORTER `astronomy-engine`.** La garde est dans
 * `tests/astro-architecture.test.ts` et balaie `app/`, `lib/` et `render/`. Tout le reste du produit
 * ne connaît que `EphemerisPort` — c'est ce qui rend le moteur remplaçable sans toucher au domaine.
 *
 * ── POURQUOI CETTE BIBLIOTHÈQUE (décision D1, 2026-08-07) ──────────────────────────────────────
 *
 * `astronomy-engine@2.1.19` : **MIT**, aucune dépendance transitive, ±1 minute d'arc, fondée sur
 * VSOP87 et NOVAS C 3.1. Elle est choisie CONTRE Swiss Ephemeris pour une raison qui n'est pas
 * technique : `sweph` est **AGPL-3.0**, et l'employer dans un service en réseau obligerait à publier
 * tout Anima en open source. La licence professionnelle (700 CHF) lèverait cette contrainte ; elle
 * n'est pas nécessaire pour le calcul lui-même.
 *
 * ── CE QU'ELLE NE SAIT PAS FAIRE, ET QU'ON NE CONTOURNE PAS ────────────────────────────────────
 *
 * Son énumération `Body` ne contient **aucun astéroïde** — donc **pas de Chiron**, que le produit a
 * pourtant déclaré indispensable (2026-08-07). On rend `non_calcule` avec sa raison, et on
 * n'approxime RIEN : une propagation képlérienne à deux corps depuis des éléments osculateurs dérive
 * de plusieurs degrés en quelques décennies, donc de plusieurs SIGNES. Un Chiron faux est pire qu'un
 * Chiron absent — il est invérifiable et il a l'air juste. Le thème étant versionné (migration 0039),
 * l'arrivée d'une source de Chiron incrémentera la version sans rien réécrire.
 *
 * ── LES TROIS PIÈGES DE L'API, TOUS RENCONTRÉS EN ÉCRIVANT CE FICHIER ──────────────────────────
 *
 * 1. `Astronomy.EclipticLongitude()` est **HÉLIOCENTRIQUE** (« as seen from the center of the Sun »).
 *    Son nom la désigne comme la fonction évidente ; l'employer donne un thème vu depuis le Soleil.
 *    Tout serait faux et rien ne planterait. On passe par `GeoVector` → `Rotation_EQJ_ECT`.
 * 2. Le repère doit être l'écliptique **VRAI DE LA DATE**, pas J2000. `Rotation_EQJ_ECL()` — dont le
 *    nom ne diffère que par le `T` final de `Rotation_EQJ_ECT()` — donne le J2000 et perd la
 *    précession : ~0,37° en 2026, qui grandit d'année en année. Un tiers de degré de zodiaque
 *    envolé, sans rien faire échouer. (`Astronomy.Ecliptic()` est, elle, un chemin ÉQUIVALENT au
 *    nôtre : elle rend bien du vrai-de-la-date. `tests/theme-natal.test.ts` l'emploie comme
 *    contre-vérification, et les deux concordent à la précision machine.)
 * 3. La Lune a sa propre théorie (`EclipticGeoMoon`, Brown / Montenbruck-Pfleger) déjà exprimée en
 *    écliptique vrai de la date. Passer par le chemin générique lui ferait perdre en précision.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Plage couverte. Bornes PRODUIT, plus étroites que ce que la bibliothèque supporte : hors de là on
 * refuse plutôt que de servir un thème dégradé qui aurait l'air normal. Personne de vivant n'est né
 * avant 1700, et une date hors plage signale une saisie fautive bien plus souvent qu'une centenaire.
 */
const ANNEE_MIN = 1700;
const ANNEE_MAX = 2200;

export const IDENTIFIANT_ASTRONOMY_ENGINE = "astronomy-engine@2.1.19";

const CORPS_VERS_BODY: Readonly<Record<CorpsClassique, Astronomy.Body>> = Object.freeze({
  soleil: Astronomy.Body.Sun,
  lune: Astronomy.Body.Moon,
  mercure: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturne: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluton: Astronomy.Body.Pluto,
});

const RAD = Math.PI / 180;
const normaliser = (deg: number) => ((deg % 360) + 360) % 360;

function dansLaPlage(instantUtc: Date): boolean {
  const annee = instantUtc.getUTCFullYear();
  return annee >= ANNEE_MIN && annee <= ANNEE_MAX;
}

/**
 * Longitude écliptique géocentrique APPARENTE, écliptique vrai de la date.
 *
 * `GeoVector(body, t, true)` : le troisième argument active la correction d'aberration ET le
 * temps-lumière. Toute éphéméride astrologique travaille en position apparente ; sans ça les
 * planètes lointaines dérivent de plusieurs minutes d'arc.
 */
function longitudeGeocentrique(body: Astronomy.Body, temps: Astronomy.AstroTime): number {
  const eqj = Astronomy.GeoVector(body, temps, true);
  const ect = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECT(temps), eqj);
  return normaliser(Astronomy.SphereFromVector(ect).lon);
}

/**
 * Nœud lunaire MOYEN — polynôme de Meeus (*Astronomical Algorithms*, 47.7), en siècles juliens
 * depuis J2000 en **temps terrestre**. Domaine public, déterministe, sans données externes.
 *
 * Il lisse l'oscillation de ±1,5° du nœud vrai. Les deux sont livrés parce que les astrologues ne
 * les emploient pas indifféremment, et qu'ils diffèrent assez pour changer de degré, parfois de signe.
 */
function noeudMoyen(temps: Astronomy.AstroTime): number {
  const T = temps.tt / 36525;
  return normaliser(
    125.0445479 -
      1934.1362891 * T +
      0.0020754 * T * T +
      (T * T * T) / 467441 -
      (T * T * T * T) / 60616000,
  );
}

/**
 * Nœud lunaire VRAI, par le moment cinétique orbital instantané.
 *
 * On ne passe PAS par `SearchMoonNode`, qui donne l'INSTANT des passages au nœud : le nœud
 * ascendant le plus proche peut être à 13 jours, et le nœud recule de ~0,053°/jour — jusqu'à 0,7°
 * d'erreur, soit assez pour changer de degré affiché.
 *
 * Ici c'est exact et instantané : `h = r × v` est la normale au plan orbital ; la ligne des nœuds
 * est `ẑ × ĥ`, donc Ω = atan2(h_x, −h_y) en coordonnées écliptiques. Position ET vitesse sont
 * rapportées à l'écliptique vrai de la date avant le produit vectoriel — les mélanger (l'une en
 * J2000, l'autre de la date) fausserait la normale sans rien faire échouer.
 */
function noeudVrai(temps: Astronomy.AstroTime): number {
  const etat = Astronomy.GeoMoonState(temps);
  const rotation = Astronomy.Rotation_EQJ_ECT(temps);
  const r = Astronomy.RotateVector(rotation, new Astronomy.Vector(etat.x, etat.y, etat.z, temps));
  const v = Astronomy.RotateVector(
    rotation,
    new Astronomy.Vector(etat.vx, etat.vy, etat.vz, temps),
  );
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  return normaliser(Math.atan2(hx, -hy) / RAD);
}

/** L'adaptateur. Sans état : deux appels avec le même instant rendent la même chose (déterminisme). */
export function ephemerideAstronomyEngine(): EphemerisPort {
  return {
    identifiant: IDENTIFIANT_ASTRONOMY_ENGINE,

    longitudeEcliptique(corps: Corps, instantUtc: Date): LectureCorps {
      // Chiron d'abord : hors plage OU non, la réponse est la même, et la raison DÉFINITIVE prime
      // sur la raison conjoncturelle. Dire « hors plage » pour Chiron laisserait croire qu'une
      // autre date le donnerait.
      if (corps === "chiron") {
        return { statut: "non_calcule", raison: "ephemeride_sans_asteroides" };
      }
      if (!dansLaPlage(instantUtc)) {
        return { statut: "non_calcule", raison: "hors_plage_ephemeride" };
      }

      const temps = Astronomy.MakeTime(instantUtc);
      if (corps === "noeud_moyen") return { statut: "calcule", longitude: noeudMoyen(temps) };
      if (corps === "noeud_vrai") return { statut: "calcule", longitude: noeudVrai(temps) };
      // La Lune passe par sa théorie dédiée, déjà en écliptique vrai de la date (piège 3).
      if (corps === "lune") {
        return { statut: "calcule", longitude: normaliser(Astronomy.EclipticGeoMoon(temps).lon) };
      }
      return { statut: "calcule", longitude: longitudeGeocentrique(CORPS_VERS_BODY[corps], temps) };
    },

    tempsSideralGreenwich(instantUtc: Date): number {
      // GAST — apparent, corrigé de la précession ET de la nutation, en heures sidérales [0, 24).
      return Astronomy.SiderealTime(Astronomy.MakeTime(instantUtc));
    },

    obliquiteVraie(instantUtc: Date): number {
      // `tobl` = true obliquity (nutation incluse), cohérente avec le GAST apparent ci-dessus.
      // `e_tilt` porte un nom d'apparence interne mais il est exporté ET typé par la bibliothèque.
      // `tests/theme-natal.test.ts` épingle sa valeur : une version qui le retirerait ou le
      // changerait ferait rougir la suite au lieu de décaler silencieusement tous les ascendants.
      return Astronomy.e_tilt(Astronomy.MakeTime(instantUtc)).tobl;
    },
  };
}
