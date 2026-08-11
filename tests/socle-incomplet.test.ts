import { describe, it, expect } from "vitest";
import {
  manquantsDuSocle,
  manqueLHeure,
  reparableParLHeure,
  type Manquant,
} from "@/lib/domain/socle-incomplet";
import { MESSAGE_SANS_HEURE, OU_TROUVER_SON_HEURE } from "@/lib/domain/message-sans-heure";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { calculerThemeNatal, type EntreesNaissance } from "@/lib/astro/theme-natal";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";

/**
 * Story 5.3 (T3) — L'INVENTAIRE DE CE QUI MANQUE, ET CE QU'ANAM EN DIT.
 *
 * ══ LA QUESTION QUE CE FICHIER GARDE ═════════════════════════════════════════════════════════════
 *
 * Trois absences se ressemblent dans le thème et n'ont rien à voir pour l'utilisatrice : Chiron (que
 * personne ne peut calculer), l'ascendant sans heure (qu'ELLE peut débloquer), et l'ascendant au
 * pôle géographique (qui n'existe pas). Les confondre produit une invitation qui ne mène nulle part
 * — c'est-à-dire un reproche déguisé, la faute que la 4.10 a corrigée sur l'invitation d'intégration.
 */

const ephemeride = ephemerideAstronomyEngine();

const AVEC_HEURE: EntreesNaissance = {
  date: "1990-06-15",
  heure: "07:15",
  fuseau: "Europe/Paris",
  latitude: 48.8566,
  longitude: 2.3522,
};

const theme = (e: EntreesNaissance) => calculerThemeNatal(e, ephemeride);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'inventaire
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T3 / AC1] manquantsDuSocle — l'inventaire est complet et jamais silencieux", () => {
  it("[PRÉSENCE AVANT ABSENCE] un thème complet ne manque QUE de Chiron", () => {
    // Condition de validité de tout ce fichier : si l'inventaire rendait toujours `[]`, chaque
    // assertion d'absence ci-dessous serait vraie pour rien.
    const m = manquantsDuSocle(theme(AVEC_HEURE));
    expect(m).toEqual([{ quoi: "corps", corps: "chiron", raison: "ephemeride_sans_asteroides" }]);
  });

  it("sans heure : les angles manquent, avec LEUR raison", () => {
    const m = manquantsDuSocle(theme({ date: "1990-06-15" }));
    expect(m).toContainEqual({ quoi: "angles", raison: "heure_absente" });
  });

  it("heure et fuseau connus mais coordonnées absentes : la raison est celle-là, pas « heure »", () => {
    // Les confondre enverrait à la mairie quelqu'un qui a déjà son heure.
    const m = manquantsDuSocle(theme({ date: "1990-06-15", heure: "07:15", fuseau: "Europe/Paris" }));
    expect(m).toContainEqual({ quoi: "angles", raison: "coordonnees_absentes" });
  });

  it("un corps au signe indéterminable figure à l'inventaire avec sa propre raison", () => {
    // 14 juin 1990 à Paris : la Lune passe du verseau aux poissons dans la journée (fait vérifié
    // dans `tests/theme-natal.test.ts`).
    const m = manquantsDuSocle(theme({ date: "1990-06-14", fuseau: "Europe/Paris" }));
    expect(m).toContainEqual({ quoi: "corps", corps: "lune", raison: "signe_ambigu_sans_heure" });
  });

  it("l'inventaire est GELÉ — personne ne le complète après coup", () => {
    expect(Object.isFrozen(manquantsDuSocle(theme(AVEC_HEURE)))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// « Son heure réparerait-elle ça ? »
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T3/DUR] reparableParLHeure — ne jamais envoyer quelqu'un à la mairie pour rien", () => {
  const cas: readonly [string, Manquant, boolean][] = [
    ["l'heure manque", { quoi: "angles", raison: "heure_absente" }, true],
    ["le fuseau manque (donc le lieu)", { quoi: "angles", raison: "fuseau_absent" }, true],
    ["les coordonnées manquent", { quoi: "angles", raison: "coordonnees_absentes" }, true],
    [
      "un signe indéterminable sans l'heure",
      { quoi: "corps", corps: "lune", raison: "signe_ambigu_sans_heure" },
      true,
    ],
    // ── et tout ce qu'aucune heure au monde ne réparera ──
    ["le pôle géographique — l'ascendant n'y EXISTE pas", { quoi: "angles", raison: "latitude_polaire" }, false],
    [
      "Chiron — aucune source ne le calcule",
      { quoi: "corps", corps: "chiron", raison: "ephemeride_sans_asteroides" },
      false,
    ],
    [
      "une date hors plage d'éphéméride",
      { quoi: "corps", corps: "mars", raison: "hors_plage_ephemeride" },
      false,
    ],
    [
      "un fuseau invalide en base — un bogue, pas une info qu'elle n'a jamais donnée",
      { quoi: "angles", raison: "fuseau_invalide" },
      false,
    ],
  ];

  it.each(cas)("%s → %s", (_nom, manquant, attendu) => {
    expect(reparableParLHeure(manquant)).toBe(attendu);
  });
});

describe("[T3 / AC3 / P8] manqueLHeure — le prédicat du tronc", () => {
  it("thème complet : le tronc n'est PAS incomplet (Chiron ne compte pas)", () => {
    // Mutation-cible : `manqueLHeure = manquantsDuSocle(t).length > 0`. Chiron manque TOUJOURS —
    // le tronc serait incomplet pour tout le monde, à jamais, et la fiche inviterait chacune à
    // fournir une heure qu'elle a déjà donnée.
    expect(manqueLHeure(theme(AVEC_HEURE))).toBe(false);
  });

  it("sans heure : le tronc est incomplet", () => {
    expect(manqueLHeure(theme({ date: "1990-06-15" }))).toBe(true);
  });

  it("[P8/DUR] heure présente MAIS lieu absent : le tronc reste incomplet", () => {
    // AC7. Le prédicat n'est PAS « l'heure est renseignée » : une heure sans lieu ne produit aucun
    // angle. Le tronc qui passerait complet ici tiendrait la promesse mot à mot et serait faux.
    expect(manqueLHeure(theme({ date: "1990-06-15", heure: "07:15", fuseau: "Europe/Paris" }))).toBe(
      true,
    );
  });

  it("[LE CAS QUI DÉPARTAGE] naissance au pôle exact : les angles manquent, le tronc NON", () => {
    // Mutation-cible : `manqueLHeure = theme.angles.statut !== "calcule"`. Cette personne a donné
    // son heure ; lui dire « il me manque ton heure » serait faux, et la démarche inutile.
    const pole = theme({ ...AVEC_HEURE, latitude: 90, longitude: 0 });
    expect(pole.angles.statut).toBe("non_calcule");
    expect(manqueLHeure(pole)).toBe(false);
  });

  it("une Lune indéterminable suffit à rendre le tronc incomplet, même avec les angles", () => {
    // Cas théorique (angles calculés ⇒ heure connue ⇒ fenêtre ponctuelle), gardé pour que le
    // prédicat reste dérivé de l'INVENTAIRE et pas d'un raccourci sur les angles.
    expect(
      manqueLHeure({
        ...theme(AVEC_HEURE),
        absents: [{ corps: "lune", raison: "signe_ambigu_sans_heure" }],
      }),
    ).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Ce qu'Anam en dit (FR-050)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T3 / AC2 / FR-050] les phrases disent CE QUI MANQUE, POURQUOI, et OÙ CHERCHER", () => {
  it("[NON-VACUITÉ] les deux textes existent et sont substantiels", () => {
    // Une constante vide passerait toutes les assertions d'absence de ce bloc.
    expect(MESSAGE_SANS_HEURE.length).toBeGreaterThan(120);
    expect(OU_TROUVER_SON_HEURE.length).toBeGreaterThan(80);
  });

  it("l'aveu nomme ce qui manque ET ce qui reste", () => {
    expect(MESSAGE_SANS_HEURE).toMatch(/heure de naissance/i);
    expect(MESSAGE_SANS_HEURE).toMatch(/ascendant/i);
    expect(MESSAGE_SANS_HEURE).toMatch(/maisons/i);
    expect(MESSAGE_SANS_HEURE).toMatch(/lune/i);
    expect(MESSAGE_SANS_HEURE, "ne pas laisser quelqu'un sur un manque").toMatch(/soleil|numérolog/i);
  });

  it("[FR-050 mot pour mot] elle dit POURQUOI : « je préfère ne pas te l'inventer »", () => {
    expect(MESSAGE_SANS_HEURE).toMatch(/je préfère ne pas te l'inventer/i);
  });

  it("[FR-050] rien ne se bloque — l'absence n'est pas une porte fermée", () => {
    expect(MESSAGE_SANS_HEURE).toMatch(/rien ne se bloque/i);
  });

  it("[LE CŒUR / FR-050] où la trouver : la COPIE INTÉGRALE, et la mairie", () => {
    // C'est la seule moitié de FR-050 qui aide vraiment, et c'est celle qui manquait depuis la 2.7.
    expect(OU_TROUVER_SON_HEURE).toMatch(/copie intégrale/i);
    expect(OU_TROUVER_SON_HEURE).toMatch(/acte de naissance/i);
    expect(OU_TROUVER_SON_HEURE).toMatch(/mairie/i);
  });

  it("elle prévient que l'EXTRAIT SIMPLE ne suffit pas — sinon la démarche échoue", () => {
    // L'heure ne figure que sur la copie intégrale. Sans cette précision, elle fait la queue à la
    // mairie, obtient un extrait, et revient sans son heure.
    expect(OU_TROUVER_SON_HEURE).toMatch(/extrait|livret/i);
  });

  it("[5.2 / DUR] aucune des deux phrases ne porte de marque de prédiction", () => {
    // Le détecteur de la 5.2 s'applique ici aussi, et il n'est pas décoratif : il refuse « tu
    // pourras l'ajouter » (futur adressé) et impose « tu peux ». C'est la seconde surface qu'il
    // garde — la preuve qu'il n'était pas spécifique au corpus.
    for (const [nom, texte] of [
      ["MESSAGE_SANS_HEURE", MESSAGE_SANS_HEURE],
      ["OU_TROUVER_SON_HEURE", OU_TROUVER_SON_HEURE],
    ] as const) {
      const trouvees = chercherPredictions(texte);
      expect(trouvees, `${nom} : ${JSON.stringify(trouvees)}`).toEqual([]);
    }
  });

  it("[CONTRÔLE DU CONTRÔLE] le détecteur mordrait sur la version rejetée", () => {
    // Sans ça, l'assertion précédente serait satisfaite par un détecteur en panne.
    expect(chercherPredictions("Tu pourras l'ajouter plus tard.").length).toBeGreaterThan(0);
  });
});
