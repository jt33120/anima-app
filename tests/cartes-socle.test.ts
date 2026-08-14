import { describe, it, expect } from "vitest";
import {
  carteEnneagramme,
  carteHoroscope,
  carteMantra,
  carteNombres,
  carteTheme,
} from "@/lib/domain/cartes-socle";
import { estPresentable } from "@/lib/domain/bibliotheque";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { chercherConfusionVocabulaire } from "@/lib/domain/vocabulaire";
import { ecrit, NON_ECRIT } from "@/lib/corpus/port";
import { placer, type ThemeNatal, type PositionCorps } from "@/lib/astro/theme-natal";
import type { Corps } from "@/lib/astro/port";
import type { Numerologie } from "@/lib/astro/numerologie";

/**
 * cartes-socle.test.ts — LES CINQ CARTES DANS LEURS CAS RÉELS (Story 5.6, T5/T6).
 *
 * ⚠️ LE CAS « DÉGRADÉ » EST LE CAS NORMAL. 165 créneaux de corpus déclarés, 0 écrit : deux cartes
 * sur cinq n'ont rien à montrer aujourd'hui, et les trois autres montrent des faits sans
 * interprétation. Ces tests décrivent donc le produit tel qu'il est, pas tel qu'il sera.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Harnais
// ══════════════════════════════════════════════════════════════════════════════════════════════

function theme(o: {
  corps?: Partial<Record<Corps, number>>;
  ascendant?: number;
  precision?: "heure_connue" | "midi_par_defaut";
}): ThemeNatal {
  const positions: PositionCorps[] = [];
  for (const [corps, longitude] of Object.entries(o.corps ?? {})) {
    const { signe, degre } = placer(longitude as number);
    positions.push({ corps: corps as Corps, longitude: longitude as number, signe, degre });
  }
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
            milieuDuCiel: 0,
            maisons: Object.freeze(Array.from({ length: 12 }, (_, i) => i * 30)),
            systeme: "signes_entiers",
          },
    precision: o.precision ?? "heure_connue",
  };
}

function numerologie(nombres: Partial<Record<string, number>>): Numerologie {
  const table = Object.fromEntries(
    ["chemin_de_vie", "expression", "intime", "personnalite", "jour_de_naissance", "annee_personnelle"].map(
      (n) => [
        n,
        nombres[n] === undefined
          ? { statut: "non_calcule" as const, raison: "nom_absent" as const }
          : { statut: "calcule" as const, valeur: nombres[n] as number, maitre: false },
      ],
    ),
  );
  return {
    schema: 1,
    methodeCheminDeVie: "reduction_separee",
    regleY: "voyelle",
    basculeAnneePersonnelle: "premier_janvier",
    anneeDeReference: 2026,
    nombres: table as Numerologie["nombres"],
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC6 — aucun degré quand l'heure manque
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/AC6] sous `midi_par_defaut`, la carte du thème n'affiche AUCUN degré", () => {
  // 186,5° = Balance à 6,5°. Le signe est sûr ; le degré ne l'est pas quand l'instant est midi.
  const positions = { soleil: 186.5, lune: 100.2 };

  it("[LE TEST QUI COMPTE] heure inconnue ⇒ le signe seul, jamais le degré", () => {
    // Report explicite de la 5.3 : « afficher "Lune à 12°34' du Cancer" quand la vérité est
    // 12° ± 7° serait fabriquer de la précision ». Aucune garde ne l'imposait avant celle-ci.
    const c = carteTheme(theme({ corps: positions, precision: "midi_par_defaut" }));
    for (const f of c.faits) {
      expect(f.valeur, `« ${f.intitule} : ${f.valeur} » porte un degré sans heure`).not.toMatch(/°/);
    }
    expect(c.faits.map((f) => f.valeur)).toContain("Balance");
  });

  it("[CONTRÔLE] heure connue ⇒ le degré revient", () => {
    // Sans ce contrôle, supprimer purement et simplement l'affichage du degré passerait le test
    // ci-dessus — la garde ne prouverait plus rien.
    const c = carteTheme(theme({ corps: positions, precision: "heure_connue" }));
    expect(c.faits.map((f) => f.valeur).join(" ")).toMatch(/°/);
    expect(c.faits.find((f) => f.intitule === "Soleil")?.valeur).toBe("Balance, 6°");
  });

  it("l'ascendant suit la même règle, et n'existe pas sans angles", () => {
    const sans = carteTheme(theme({ corps: positions }));
    expect(sans.faits.map((f) => f.intitule)).not.toContain("Ascendant");

    const avec = carteTheme(theme({ corps: positions, ascendant: 45, precision: "heure_connue" }));
    expect(avec.faits.find((f) => f.intitule === "Ascendant")?.valeur).toBe("Taureau, 15°");
  });

  it("un thème indisponible ne fabrique aucun fait", () => {
    const c = carteTheme(null);
    expect(c.faits).toEqual([]);
    expect(estPresentable(c)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC5 — l'absence honnête
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/AC5] les deux cartes structurellement vides le sont, et le disent", () => {
  it("le mantra n'a AUCUN fait — il est son texte, et son texte n'est pas écrit", () => {
    const c = carteMantra(NON_ECRIT);
    expect(c.faits).toEqual([]);
    expect(c.texte.statut).toBe("non_ecrit");
    expect(estPresentable(c), "une carte muette ne peut pas être mise en avant").toBe(false);
  });

  it("le mantra devient présentable le jour où Anima écrit — sans changer une ligne de code", () => {
    expect(estPresentable(carteMantra(ecrit("Aujourd'hui, remarque ce qui tient.")))).toBe(true);
  });

  it("l'horoscope calculé n'expose JAMAIS ses clés de corpus comme des faits", () => {
    // Le mode d'échec réel : afficher « lune:3 » sur une carte d'accueil parce que c'est ce que le
    // calcul rend. Les clés servent à CHOISIR un texte, elles ne sont pas du texte.
    const c = carteHoroscope({
      jour: { a: 2026, m: 8, j: 13 },
      ciel: {} as never,
      configurations: [],
      luneRelative: { distance: 3 } as never,
    });
    expect(c.faits).toEqual([]);
    expect(JSON.stringify(c)).not.toMatch(/lune:|configuration:/);
  });

  it("un horoscope indisponible ne fabrique pas de texte de repli", () => {
    const c = carteHoroscope(null);
    expect(c.texte).toEqual(NON_ECRIT);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les nombres et l'ennéagramme — des chiffres qui ne sont pas des mesures
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6] les nombres : ce qui est calculé paraît, ce qui manque est ABSENT", () => {
  it("les nombres calculés paraissent dans l'ordre du socle", () => {
    const c = carteNombres(numerologie({ chemin_de_vie: 7, jour_de_naissance: 4, annee_personnelle: 9 }));
    expect(c.faits.map((f) => f.intitule)).toEqual([
      "Chemin de vie",
      "Jour de naissance",
      "Année personnelle",
    ]);
    expect(c.faits[0].valeur).toBe("7");
  });

  it("un nombre non calculé n'apparaît NI en creux NI comme « — »", () => {
    // La 5.2 a tranché : l'absence se dit dans la fiche du socle, pas en trous dans une liste.
    const c = carteNombres(numerologie({ chemin_de_vie: 7 }));
    expect(c.faits).toHaveLength(1);
    expect(JSON.stringify(c)).not.toMatch(/—|non disponible|indisponible/);
  });

  it("une numérologie indisponible donne une carte sans fait et sans texte", () => {
    const c = carteNombres(null);
    expect(c.faits).toEqual([]);
    expect(estPresentable(c)).toBe(false);
  });
});

describe("[5.6] l'ennéagramme : « sans type » n'est pas un incident", () => {
  it("un type retenu donne un fait, et le texte vient de la 5.5", () => {
    const c = carteEnneagramme(4, NON_ECRIT);
    expect(c.faits).toEqual([{ intitule: "Type", valeur: "4" }]);
    expect(c.texte.statut).toBe("non_ecrit");
    expect(estPresentable(c), "un fait suffit à être présentable").toBe(true);
  });

  it("`sans_type` est l'état de départ de tout le monde — carte muette, pas message d'erreur", () => {
    const c = carteEnneagramme(null, NON_ECRIT);
    expect(c.faits).toEqual([]);
    expect(JSON.stringify(c)).not.toMatch(/erreur|panne|impossible/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les contrôles transverses sur ce que les cartes écrivent
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6] tout ce que les cartes écrivent passe les contrôles bloquants", () => {
  const toutes = [
    carteMantra(NON_ECRIT),
    carteHoroscope(null),
    carteTheme(
      theme({ corps: { soleil: 186.5, lune: 100.2, mercure: 200, venus: 10, mars: 300 }, ascendant: 45 }),
    ),
    carteNombres(numerologie({ chemin_de_vie: 7 })),
    carteEnneagramme(4, NON_ECRIT),
  ];

  it("[CONTRÔLE DU CONTRÔLE] les cinq cartes sont bien construites", () => {
    expect(toutes).toHaveLength(5);
    expect(new Set(toutes.map((c) => c.cle)).size).toBe(5);
  });

  it("[FR-023 / NFR-008] aucun titre, aucun intitulé ne porte un interdit", () => {
    for (const c of toutes) {
      const mots = [c.titre, ...c.faits.flatMap((f) => [f.intitule, f.valeur])];
      for (const m of mots) {
        expect(chercherInterdits(m), `lexique interdit dans « ${m} »`).toEqual([]);
      }
    }
  });

  it("[FR-053] aucune prédiction n'entre par un libellé du socle", () => {
    for (const c of toutes) {
      const mots = [c.titre, ...c.faits.flatMap((f) => [f.intitule, f.valeur])];
      for (const m of mots) {
        expect(chercherPredictions(m), `prédiction dans « ${m} »`).toEqual([]);
      }
    }
  });

  it("[FR-080] une carte qui porte un terme ne nomme pas les deux autres", () => {
    for (const c of toutes) {
      if (c.terme === null) continue;
      expect(
        chercherConfusionVocabulaire(c.titre, c.terme),
        `« ${c.titre} » nomme un autre format que « ${c.terme} »`,
      ).toEqual([]);
    }
    // Contrôle positif : au moins une carte porte bien un terme, sinon la boucle serait vide.
    expect(toutes.filter((c) => c.terme !== null)).toHaveLength(1);
  });
});
