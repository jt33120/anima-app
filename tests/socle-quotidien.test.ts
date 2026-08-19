import { describe, it, expect } from "vitest";
import {
  CORPS_POUSSEE,
  TITRE_POUSSEE,
  MOTS_MAX_APERCU,
  RACINES_INTERDITES_APERCU,
  chercherFuitesApercu,
  compterMots,
  corpsDuJour,
  indexDuJour,
  HEURE_PAR_DEFAUT,
  HEURES_CHOISISSABLES,
  PREMIERE_HEURE_POUSSABLE,
  DERNIERE_HEURE_POUSSABLE,
  heureValide,
  heuresHonorables,
  heureHonorable,
  palierHonoreLHeure,
} from "@/lib/domain/socle-quotidien";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { PALIER, TICKS_MAX_PAR_JOUR, DERIVE_PLANIFICATION_MS } from "@/lib/domain/ordonnanceur-budget";
import * as COPIE_REGLAGES from "@/lib/domain/copie-reglages";

/**
 * Story 6.2 (T1) — LE DOMAINE DU SOCLE QUOTIDIEN.
 *
 * Ce fichier ne teste pas un mécanisme, il teste une COPIE et une ARITHMÉTIQUE. C'est délibéré : la
 * poussée ne porte aucune charge utile (D1), donc tout ce qui peut fuir sur un écran verrouillé est
 * déjà écrit ici, en clair, dans un tableau de sept lignes. Le seul endroit où NFR-015 peut se perdre
 * est ce tableau — d'où le fait que chaque ligne passe ici trois détecteurs plutôt qu'une relecture.
 */

describe("[6.2/AC2] chaque corps d’aperçu tient dans six mots", () => {
  it.each(CORPS_POUSSEE.map((c) => [c] as const))("« %s »", (corps) => {
    expect(compterMots(corps), `« ${corps} » compte ${compterMots(corps)} mots`).toBeLessThanOrEqual(
      MOTS_MAX_APERCU,
    );
  });

  it("[ANTI-VACUITÉ] `compterMots` compte VRAIMENT — sans quoi la garde ci-dessus est décorative", () => {
    // Une garde `≤ 6` est satisfaite par un compteur qui rend 0 pour tout. Celui-ci doit d'abord
    // savoir dire 7.
    expect(compterMots("un deux trois quatre cinq six sept")).toBe(7);
    expect(compterMots("  espaces   multiples  ")).toBe(2);
    expect(compterMots("")).toBe(0);
    expect(compterMots("aujourd’hui")).toBe(1);
  });
});

describe("[6.2/AC2] rien de ce qui s’affiche verrouillé ne trahit le produit", () => {
  it.each(CORPS_POUSSEE.map((c) => [c] as const))("aucune racine ésotérique dans « %s »", (corps) => {
    expect(chercherFuitesApercu(corps)).toEqual([]);
  });

  it.each(CORPS_POUSSEE.map((c) => [c] as const))("aucune prédiction dans « %s »", (corps) => {
    // Le détecteur de la 5.2 — celui qui police le corpus. Un aperçu quotidien est exactement la
    // surface où « aujourd'hui sera une belle journée » s'écrirait sans qu'on y pense.
    expect(chercherPredictions(corps)).toEqual([]);
  });

  it.each(CORPS_POUSSEE.map((c) => [c] as const))("aucun lexique interdit dans « %s »", (corps) => {
    // Le détecteur de la 2.8 — promesse médicale, affect prêté, emoji. Un emoji dans un aperçu
    // verrouillé est précisément ce que NFR-015 refuse : il se lit à trois mètres.
    expect(chercherInterdits(corps)).toEqual([]);
  });

  it("[LE CŒUR] le titre est le nom du produit, et il ne signe rien", () => {
    // ⚠️ Mutation-cible : « Anam te dit… ». L'AC1 exige que le socle ne soit JAMAIS signé d'Anam —
    // il est calculé, elle ne l'a pas écrit. Un titre qui la fait parler est une parole fabriquée
    // attribuée au personnage, le voisin immédiat de FR-086.
    expect(TITRE_POUSSEE).toBe("Anam");
    expect(chercherFuitesApercu(TITRE_POUSSEE)).toEqual([]);
    expect(compterMots(TITRE_POUSSEE)).toBe(1);
  });

  it("[LE CŒUR] aucun corps ne convoque (AC3 — aucun réengagement)", () => {
    // Ce que la liste de racines ne peut pas attraper, parce que ce ne sont pas des mots
    // ésotériques mais des mots ORDINAIRES employés pour ramener quelqu'un. Ils sont interdits par
    // l'AC3, et rien d'autre dans le dépôt ne les refuse.
    const convocations = [
      /\breviens\b/i,
      /\btu as manqu/i,
      /\bça fait longtemps\b/i,
      /\btu nous manques\b/i,
      /\bconnecte-toi\b/i,
      /\bouvre l’app/i,
      /\bne rate pas\b/i,
      /\bderni[eè]re chance\b/i,
      /\bd[eé]j[aà] \d+ jours?\b/i,
      /\bs[eé]rie\b/i,
    ];
    for (const corps of CORPS_POUSSEE) {
      for (const motif of convocations) {
        expect(motif.test(corps), `« ${corps} » convoque via ${motif}`).toBe(false);
      }
    }
  });

  it("[ANTI-VACUITÉ] les trois détecteurs mordent VRAIMENT sur des contre-exemples", () => {
    // Sans ce test, remplacer les sept corps par sept chaînes vides rendrait tout ce bloc vert.
    expect(chercherFuitesApercu("Ton horoscope du jour")).toContain("horoscope");
    expect(chercherFuitesApercu("La Lune entre en Bélier")).toContain("lune");
    // Accents pliés : « énergie » ne doit pas passer devant la racine sans accent.
    expect(chercherFuitesApercu("Ton énergie remonte")).toContain("energie");
    expect(chercherPredictions("Demain tu vas rencontrer quelqu’un").length).toBeGreaterThan(0);
    expect(CORPS_POUSSEE.length).toBeGreaterThan(0);
    expect(CORPS_POUSSEE.every((c) => c.trim().length > 0)).toBe(true);
  });

  it("[MÉTA] la liste de racines couvre les mots du produit lui-même", () => {
    // Le vrai risque n'est pas d'écrire « voyance » — c'est d'écrire un mot que le produit emploie
    // partout ailleurs sans réaliser qu'il est ésotérique dehors. On vérifie donc que le filet
    // attrape le vocabulaire MAISON, pas seulement un vocabulaire de dictionnaire.
    for (const maison of ["tirage", "carte", "ancrage rituel", "ennéagramme", "numérologie", "ascendant"]) {
      expect(chercherFuitesApercu(maison).length, `« ${maison} » passe le filet`).toBeGreaterThan(0);
    }
    expect(RACINES_INTERDITES_APERCU.every((r) => r === r.toLowerCase())).toBe(true);
  });
});

describe("[6.2/AC1] le corps du jour est CALCULÉ, et déterministe", () => {
  it("le même jour rend le même corps, et il vient de l’ensemble fini", () => {
    for (const jour of ["2026-08-15", "2027-01-01", "1999-12-31"]) {
      const corps = corpsDuJour(jour);
      expect(corpsDuJour(jour)).toBe(corps);
      expect(CORPS_POUSSEE).toContain(corps);
    }
  });

  it("[LE CŒUR] l’index NE SE RÉINITIALISE PAS au 1er janvier", () => {
    // ⚠️ Mutation-cible : `jourDeLAnnee % n`. Elle est tentante, plus courte, et fausse — au
    // 31 décembre l'index vaut (365 % 7) et au 1er janvier il retombe à 0, ce qui répète ou saute
    // une ligne chaque année. Le compte absolu de jours n'a pas de bord.
    const veille = indexDuJour("2026-12-31", CORPS_POUSSEE.length);
    const nouvelAn = indexDuJour("2027-01-01", CORPS_POUSSEE.length);
    expect(nouvelAn).toBe((veille + 1) % CORPS_POUSSEE.length);
  });

  it("[LE CŒUR] deux jours consécutifs ne rendent jamais le même corps", () => {
    // La propriété que « déterministe » ne garantit pas : une fonction constante est déterministe.
    // Elle tient tant que l'ensemble a plus d'un élément, et le pas est de 1.
    let precedent = indexDuJour("2026-08-01", CORPS_POUSSEE.length);
    for (let d = 2; d <= 31; d += 1) {
      const jour = `2026-08-${String(d).padStart(2, "0")}`;
      const courant = indexDuJour(jour, CORPS_POUSSEE.length);
      expect(courant, `${jour} répète la veille`).not.toBe(precedent);
      precedent = courant;
    }
  });

  it("[ANTI-VACUITÉ] TOUTES les lignes de l’ensemble sont atteignables", () => {
    // Sans ça, une erreur d'index (`% (n - 1)`, un `slice` de trop) laisserait une ligne relue mais
    // jamais affichée — un test de couverture qui n'existe nulle part ailleurs.
    const vus = new Set<string>();
    for (let d = 0; d < CORPS_POUSSEE.length * 3; d += 1) {
      const t = Date.UTC(2026, 0, 1) + d * 86_400_000;
      vus.add(corpsDuJour(new Date(t).toISOString().slice(0, 10)));
    }
    expect(vus.size).toBe(CORPS_POUSSEE.length);
  });

  it("l’index reste positif avant l’époque — un modulo négatif planterait l’accès au tableau", () => {
    expect(indexDuJour("1965-03-04", CORPS_POUSSEE.length)).toBeGreaterThanOrEqual(0);
    expect(CORPS_POUSSEE[indexDuJour("1965-03-04", CORPS_POUSSEE.length)]).toBeTypeOf("string");
  });
});

describe("[6.2/AC8] le palier décide si une heure choisie peut être honorée", () => {
  it("[R3] l’heure par défaut est 8 h, et la validation est bornée au CRÉNEAU DIURNE", () => {
    // ⚠️ LA BORNE ÉTAIT « UN JOUR CIVIL » (0 à 23), ET C'ÉTAIT LE DÉFAUT (revue Epic 6, R3).
    // `creneauDiurneOuvert` (6 h ≤ h < 21 h) n'était appliqué que par les deux jobs de COURRIEL ; le
    // canal de POUSSÉE — le seul qui allume un écran verrouillé — l'ignorait. Inerte sur `hobby`, et
    // réveillé au premier passage en `pro` : quelqu'un qui avait choisi 2 h aurait été réveillée à 2 h.
    expect(HEURE_PAR_DEFAUT).toBe(8);
    expect(heureValide(PREMIERE_HEURE_POUSSABLE)).toBe(true);
    expect(heureValide(DERNIERE_HEURE_POUSSABLE)).toBe(true);
    expect(heureValide(PREMIERE_HEURE_POUSSABLE - 1), "5 h est encore la nuit").toBe(false);
    expect(heureValide(DERNIERE_HEURE_POUSSABLE + 1), "21 h est hors créneau (h < FIN)").toBe(false);
    expect(heureValide(0)).toBe(false);
    expect(heureValide(23)).toBe(false);
    expect(heureValide(24)).toBe(false);
    expect(heureValide(-1)).toBe(false);
    expect(heureValide(8.5)).toBe(false);
    expect(heureValide(Number.NaN)).toBe(false);
  });

  it("[R3] les heures PROPOSABLES sont exactement le créneau, et le sélecteur ne décide de rien", () => {
    // `HEURES_CHOISISSABLES` est indépendant du palier — sur `hobby` l'ensemble honorable est vide,
    // et un sélecteur vide empêcherait de régler une préférence que la 6.2 accepte d'enregistrer.
    expect(HEURES_CHOISISSABLES[0]).toBe(PREMIERE_HEURE_POUSSABLE);
    expect(HEURES_CHOISISSABLES.at(-1)).toBe(DERNIERE_HEURE_POUSSABLE);
    expect(HEURES_CHOISISSABLES.every((h) => heureValide(h))).toBe(true);
    // ANTI-VACUITÉ : un ensemble vide satisferait `every` sans rien prouver.
    expect(HEURES_CHOISISSABLES.length).toBe(DERNIERE_HEURE_POUSSABLE - PREMIERE_HEURE_POUSSABLE + 1);
  });

  it("[LE CŒUR] `hobby` n’honore AUCUNE heure — un tick par jour ne couvre pas vingt-quatre heures", () => {
    // C'est toute la story dans une assertion. Le repli est le refus, pas « à peu près 8 h ».
    expect(heuresHonorables("hobby")).toEqual([]);
    // ⚠️ PLUS 24 (R3) : la cadence et le créneau diurne sont deux conditions indépendantes, et
    // l'ensemble honorable est leur INTERSECTION. Une cadence suffisante ne rend pas 3 h acceptable.
    expect(heuresHonorables("pro")).toEqual([...HEURES_CHOISISSABLES]);
  });

  it("[LE CŒUR] la DÉRIVE compte autant que la cadence — et c’est le terme qu’on oublie", () => {
    // ⚠️ Mutation-cible : ne garder que `ticksParJour >= 24`. Un palier qui déclencherait 24 fois par
    // jour à ±59 minutes passerait alors la garde — et déplacerait la notification de 8 h à 8 h 58 un
    // jour, 6 h 04 le lendemain. « L'heure choisie » deviendrait un mot pour « à peu près ».
    //
    // ⚠️ Ce test a EXIGÉ une refonte du code, et c'est la bonne façon de perdre un mutant : tant que
    // le prédicat lisait un PALIER, les deux conditions étaient intestables séparément — `hobby`
    // échoue les deux, `pro` les passe toutes les deux, donc une garde amputée rendait le même
    // verdict. Le prédicat prend maintenant les deux FAITS, et le palier hypothétique qui les sépare
    // s'écrit en une ligne.
    // ⚠️ LA BORNE EST À L'HEURE PLEINE, et pas plus tôt — c'est une correction que ce test a imposée.
    // On avait d'abord écrit que 59 minutes de dérive disqualifiaient : c'est FAUX. Sur une cadence
    // horaire déclenchée à la minute 0, une dérive de 59 minutes fait partir à 8 h 59 — toujours dans
    // l'heure choisie. Ce qui la fait sortir, c'est une dérive d'une heure ou plus.
    expect(heureHonorable(24, 59 * 60_000), "59 min restent DANS l’heure choisie").toBe(true);
    expect(heureHonorable(24, 3_600_000), "une heure pleine de dérive fait sortir de l’heure").toBe(false);
    // Le mutant que ces deux lignes tuent : supprimer le second terme du prédicat. Il rendrait `true`
    // sur la ligne du dessus.
    expect(heureHonorable(1, 60_000), "la cadence ne compte plus").toBe(false);
    expect(heureHonorable(24, 60_000)).toBe(true);

    // Les faits réels du dépôt, pour que la garde reste branchée sur eux.
    expect(TICKS_MAX_PAR_JOUR.hobby).toBeLessThan(24);
    expect(TICKS_MAX_PAR_JOUR.pro).toBeGreaterThanOrEqual(24);
    expect(DERIVE_PLANIFICATION_MS.pro).toBeLessThan(3_600_000);
  });

  it("[LE CŒUR] la garde ne connaît pas le mot « pro »", () => {
    // ⚠️ Mutation-cible : `return palier === "pro" ? … : []`. Elle passerait tous les tests
    // ci-dessus. Ce qu'elle casse est invisible aujourd'hui et le sera le jour où un palier
    // s'ajoute : la garde cesserait de mesurer la plateforme pour mesurer un nom.
    const source = String(heuresHonorables) + String(heureHonorable);
    expect(source).not.toMatch(/"pro"|'pro'/);
    expect(source).not.toMatch(/"hobby"|'hobby'/);
    expect(source).toMatch(/TICKS_MAX_PAR_JOUR|DERIVE_PLANIFICATION_MS/);
  });

  it("[LE CŒUR] le palier COURANT ne pousse rien — et le dépôt en porte la trace", () => {
    // Cette assertion changera de sens le jour du passage à `pro`, et c'est voulu : elle est le
    // rappel, en CI, que le mécanisme livré est inerte tant que le palier n'a pas bougé.
    expect(palierHonoreLHeure()).toBe(heuresHonorables(PALIER).length > 0);
    expect(palierHonoreLHeure()).toBe(false);
  });
});

describe("[6.2/AC4] la copie des réglages n’invente jamais une perte pour vendre une permission", () => {
  const copie = Object.entries(COPIE_REGLAGES).filter(([, v]) => typeof v === "string") as [string, string][];

  it.each(copie)("« %s » ne convoque pas, ne culpabilise pas, ne promet pas", (nom, texte) => {
    // ⚠️ Un écran de réglages est l'endroit NATUREL où s'écrit « activez les notifications pour ne
    // rien manquer » — c'est-à-dire une phrase qui invente une perte pour vendre une permission.
    // L'AC3 dit qu'aucun réengagement n'existe et l'AC4 qu'aucune bannière n'insiste : la règle vaut
    // donc AUSSI pour l'écran qui propose, pas seulement pour ce qui part.
    for (const interdit of [
      /ne (rien|pas) (manquer|rater)/i,
      /\bne rate pas\b/i,
      /\btu risques\b/i,
      /\bs[eé]rie\b/i,
      /\bchaque jour sans\b/i,
      /\brecommand[eé]\b/i,
      /\bindispensable\b/i,
      /\bprofite\b/i,
      /\bvite\b/i,
      /\bderni[eè]re chance\b/i,
    ]) {
      expect(interdit.test(texte), `${nom} : « ${texte} » correspond à ${interdit}`).toBe(false);
    }
    expect(chercherFuitesApercu(texte), `${nom} laisse fuir un mot du produit`).toEqual([]);
  });

  it("[ANTI-VACUITÉ] la copie existe, et le filet mord sur un contre-exemple", () => {
    expect(copie.length).toBeGreaterThanOrEqual(8);
    expect(/ne (rien|pas) (manquer|rater)/i.test("Activez pour ne rien manquer")).toBe(true);
  });

  it("[LE CŒUR] la description dit exactement ce qui va arriver, et rien de plus", () => {
    // C'est la seule promesse faite AVANT de demander la permission du navigateur — donc la seule
    // chose sur laquelle son consentement porte réellement.
    expect(COPIE_REGLAGES.DESCRIPTION_SOCLE).toMatch(/une fois par jour/i);
    expect(COPIE_REGLAGES.DESCRIPTION_SOCLE).toMatch(/l’heure que tu choisis/i);
    expect(COPIE_REGLAGES.DESCRIPTION_SOCLE, "elle doit dire que l’aperçu ne trahit rien").toMatch(
      /ne dit jamais/i,
    );
    expect(COPIE_REGLAGES.DESCRIPTION_SOCLE, "et que ça s’arrête quand elle veut").toMatch(/arrêter/i);
  });
});
