import { describe, it, expect } from "vitest";
import { ANCRAGES, CLES_ANCRAGE, cleEtape, cleTitre } from "@/lib/corpus/ancrage";
import { clesEcrites, clesNonEcrites, corpus, ecrit, NON_ECRIT, textesEcrits } from "@/lib/corpus/port";
import { ETAPES } from "@/lib/domain/ancrage";
import { chercherConfusionVocabulaire } from "@/lib/domain/vocabulaire";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import * as copie from "@/lib/domain/copie-ancrage";

/**
 * ancrage-corpus.test.ts — LES CRÉNEAUX, ET LE VOCABULAIRE (Story 5.9, AC5/AC6/AC7).
 */

describe("[AC6] les 24 créneaux sont déclarés, et aucun n'est écrit", () => {
  it("4 ancrages × (1 titre + 5 temps) = 24 créneaux", () => {
    expect(CLES_ANCRAGE.length).toBe(4);
    expect(Object.keys(ANCRAGES.textes).length).toBe(4 * (1 + ETAPES.length));
    expect(Object.keys(ANCRAGES.textes).length).toBe(24);
  });

  it("chaque ancrage a son titre ET un créneau par temps du DOMAINE", () => {
    // C'est ce test qui empêche la séquence de se dédoubler : le corpus recopie les cinq chaînes
    // pour éviter un cycle d'import, et on vérifie ici qu'elles coïncident avec `ETAPES`.
    for (const cle of CLES_ANCRAGE) {
      expect(Object.hasOwn(ANCRAGES.textes, cleTitre(cle))).toBe(true);
      for (const etape of ETAPES) {
        expect(Object.hasOwn(ANCRAGES.textes, cleEtape(cle, etape))).toBe(true);
      }
    }
  });

  it("aucun créneau n'est écrit — Anima seule peut les écrire (FR-054 + FR-086)", () => {
    expect(clesEcrites(ANCRAGES)).toEqual([]);
    expect(clesNonEcrites(ANCRAGES).length).toBe(24);
  });

  it("la table est GELÉE — aucun module ne peut y déposer un texte sans auteur", () => {
    expect(Object.isFrozen(ANCRAGES.textes)).toBe(true);
    expect(() => {
      (ANCRAGES.textes as Record<string, unknown>)["ancrage-1:titre"] = ecrit("piraté");
    }).toThrow();
  });
});

describe("[AC5] le vocabulaire ne se confond jamais (FR-080)", () => {
  const textes = Object.entries(copie)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => [k, v as string] as const);

  it("la copie est bien découverte — la garde n'est pas vide", () => {
    expect(textes.length).toBeGreaterThanOrEqual(7);
  });

  it("aucun texte présenté sous « ancrage » ne nomme l'un des DEUX AUTRES formats", () => {
    for (const [nom, texte] of textes) {
      expect(chercherConfusionVocabulaire(texte, "ancrage"), `copie-ancrage.${nom}`).toEqual([]);
    }
  });

  /**
   * ⚠️ GARDE NON VACUE, sur un faux corpus fautif. Sans elle, le test ci-dessus serait vert même si
   * `chercherConfusionVocabulaire` rendait toujours `[]`.
   */
  it("une phrase fautive SERAIT attrapée", () => {
    expect(chercherConfusionVocabulaire("Ton mantra du jour t'attend.", "ancrage")).toContain("mantra");
    expect(chercherConfusionVocabulaire("Reprends ta lecture.", "ancrage")).toContain("lecture");
  });

  it("les créneaux du corpus, le jour où Anima les écrira, passeront la même garde", () => {
    // Aujourd'hui `textesEcrits` est vide : le test serait donc vacuement vrai. On prouve le
    // balayage sur un faux corpus qui, lui, contient un texte fautif.
    const faux = corpus("faux-ancrages", {
      "a:titre": ecrit("Le mantra du matin"),
      "a:arrivee": NON_ECRIT,
    });
    const fautifs = textesEcrits(faux).flatMap((t) => chercherConfusionVocabulaire(t, "ancrage"));
    expect(fautifs).toContain("mantra");
    // Et le vrai corpus, lui, n'a rien à redire (il est vide — l'assertion est explicite là-dessus).
    expect(textesEcrits(ANCRAGES)).toEqual([]);
  });
});

describe("[AC5] FR-023 — le mot proscrit n'apparaît nulle part", () => {
  it("aucun texte de la copie ne porte le lexique interdit", () => {
    for (const [nom, valeur] of Object.entries(copie)) {
      if (typeof valeur !== "string") continue;
      expect(chercherInterdits(valeur), `copie-ancrage.${nom}`).toEqual([]);
    }
  });

  /**
   * ⚠️ CETTE GARDE ET CELLE DU VOCABULAIRE NE SE COUVRENT PAS. La première refuse un mot interdit
   * PARTOUT, la seconde refuse un mot parfaitement licite ailleurs mais fautif ici. Les viser
   * séparément est ce qui fait mourir les deux mutants.
   */
  it("un texte fautif SERAIT attrapé", () => {
    expect(chercherInterdits("Un soin pour aujourd’hui").length).toBeGreaterThan(0);
  });
});

describe("[AC7] rien ne promet la variante audio", () => {
  it("aucune copie ne parle d'audio, de voix enregistrée ni de « bientôt »", () => {
    for (const [nom, valeur] of Object.entries(copie)) {
      if (typeof valeur !== "string") continue;
      expect(valeur, `copie-ancrage.${nom}`).not.toMatch(/audio|écoute[rz]?\b|bientôt|prochainement/i);
    }
  });
});
