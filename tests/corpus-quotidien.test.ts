import { describe, it, expect } from "vitest";
import { clesEcrites, clesNonEcrites, corpus, ecrit, textesEcrits, type Corpus } from "@/lib/corpus/port";
import {
  CARDINAL_MANTRA,
  CLES_MANTRA,
  CORPUS_MANTRA,
  cleMantra,
  cleMantraDuJour,
  mantraDuJour,
} from "@/lib/corpus/mantra";
import {
  CLES_HOROSCOPE,
  CORPUS_HOROSCOPE,
  DISTANCES_LUNE,
  cleAspect,
  cleLuneRelative,
  texteConfiguration,
  texteLuneRelative,
} from "@/lib/corpus/horoscope";
import { ASPECTS, CIBLES_NATALES, indiceDuJour, type JourCivil } from "@/lib/astro/quotidien";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";

/**
 * Story 5.4 (T5, T6) — LES DEUX CORPUS DU SOCLE QUOTIDIEN (FR-033, FR-053, FR-054, FR-080, FR-086).
 *
 * ══ ⚠️ GARDE D'ABSENCE SUR DES CORPUS VIDES — LIRE AVANT DE MODIFIER ══════════════════════════════
 *
 * Les 87 créneaux sont déclarés, AUCUN n'est écrit. Toute garde du type « chaque texte écrit passe
 * le contrôle » est donc VACUEMENT VRAIE : elle serait verte même si le balayage était cassé, même
 * si les détecteurs rendaient toujours `[]`. C'est le mode d'échec relevé deux fois en revue 4.10 et
 * traité en 5.2 — on applique ici les trois mêmes disciplines :
 *
 *   (a) CHAQUE DÉTECTEUR EST ÉPROUVÉ POUR LUI-MÊME, sur des chaînes connues-mauvaises ET
 *       connues-bonnes, avant qu'on ne balaie quoi que ce soit ;
 *   (b) PRÉSENCE AVANT ABSENCE : le nombre de créneaux DÉCLARÉS est asserté (60 et 27) — c'est ce
 *       qui reste vérifiable quand le nombre de créneaux ÉCRITS vaut zéro ;
 *   (c) LE BALAYAGE EST PROUVÉ SUR UN FAUX CORPUS contenant des textes connus-mauvais, et il DOIT
 *       les rejeter. Sans ça, on ne saurait pas si le balayage mord — seulement qu'il ne trouve rien.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// (b) PRÉSENCE AVANT ABSENCE — les créneaux existent, et en nombre connu
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T5/T6 / (b)] les créneaux sont DÉCLARÉS — la complétude est mesurable", () => {
  it("60 mantras, 27 créneaux d'horoscope, aucun doublon", () => {
    expect(CLES_MANTRA.length).toBe(60);
    expect(CARDINAL_MANTRA).toBe(60);
    expect(new Set(CLES_MANTRA).size).toBe(60);

    expect(CLES_HOROSCOPE.length).toBe(27);
    expect(new Set(CLES_HOROSCOPE).size).toBe(27);
    // 12 de Lune relative + 5 aspects × 3 cibles = 27. Le compte est DÉRIVÉ, pas recopié.
    expect(DISTANCES_LUNE.length + ASPECTS.length * CIBLES_NATALES.length).toBe(27);
  });

  it("toutes les clés déclarées sont bien dans la table du corpus", () => {
    // Une clé déclarée dans `CLES_*` mais absente de la table ferait jeter `lireTexte` à
    // l'exécution — un plantage en production pour un jour précis du cycle.
    expect(clesNonEcrites(CORPUS_MANTRA).length).toBe(60);
    expect(clesNonEcrites(CORPUS_HOROSCOPE).length).toBe(27);
  });

  it("[PORTE PRÉ-LANCEMENT] aucun créneau n'est écrit — et c'est la seule forme conforme", () => {
    // FR-054 + FR-086 : seule Anima peut écrire ces textes. Le jour où elle en dépose un, ce test
    // change de valeur et les balayages ci-dessous se mettent à mordre pour de bon.
    expect(clesEcrites(CORPUS_MANTRA)).toEqual([]);
    expect(clesEcrites(CORPUS_HOROSCOPE)).toEqual([]);
    expect(textesEcrits(CORPUS_MANTRA)).toEqual([]);
    expect(textesEcrits(CORPUS_HOROSCOPE)).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les constructeurs de clé jettent hors domaine
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T5/T6] une clé hors domaine est un défaut de CODE, pas un texte en attente", () => {
  it("cleMantra refuse un rang hors 1..60", () => {
    expect(cleMantra(1)).toBe("mantra:1");
    expect(cleMantra(60)).toBe("mantra:60");
    for (const mauvais of [0, 61, -1, 2.5, Number.NaN]) {
      expect(() => cleMantra(mauvais), `${mauvais}`).toThrow(/rang/i);
    }
  });

  it("cleLuneRelative refuse une distance hors 0..11", () => {
    expect(cleLuneRelative(0)).toBe("lune_relative:0");
    expect(cleLuneRelative(11)).toBe("lune_relative:11");
    for (const mauvais of [-1, 12, 1.5]) {
      expect(() => cleLuneRelative(mauvais), `${mauvais}`).toThrow(/distance/i);
    }
  });

  it("cleAspect refuse un aspect inconnu ET une cible hors périmètre", () => {
    expect(cleAspect("carre", "soleil")).toBe("aspect:carre:soleil");
    // @ts-expect-error — aspect mineur volontairement hors v1
    expect(() => cleAspect("quinconce", "soleil")).toThrow(/aspect/i);
    // Mars est un corps parfaitement réel, et il PASSE le typage (`CibleNatale = Corps |
    // "ascendant"`) — mais ce n'est pas une cible du texte du jour (D6). Le type ne peut pas
    // l'attraper sans rendre `longitudeNatale` impossible à écrire ; le contrôle est donc à
    // l'exécution, et c'est exactement pour ça qu'il est testé.
    expect(() => cleAspect("carre", "mars")).toThrow(/cible/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La rotation du mantra (D8, P8)
// ══════════════════════════════════════════════════════════════════════════════════════════════

const jour = (a: number, m: number, j: number): JourCivil => ({ a, m, j });

describe("[T5 / D8 / P8] le mantra du jour ne dépend QUE du jour", () => {
  it("le même jour rend toujours le même mantra", () => {
    expect(mantraDuJour(jour(2026, 8, 11))).toEqual(mantraDuJour(jour(2026, 8, 11)));
  });

  it("[CONTRÔLE POSITIF] la rotation couvre les 60 créneaux en 60 jours, sans trou ni doublon", () => {
    const servis = Array.from({ length: 60 }, (_, k) => {
      const d = new Date(Date.UTC(2026, 7, 11));
      d.setUTCDate(d.getUTCDate() + k);
      return mantraDuJour(jour(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
    });
    // Tous non écrits aujourd'hui, donc indiscernables par leur contenu : on compare les INDICES.
    expect(servis.every((t) => t.statut === "non_ecrit")).toBe(true);

    const indices = Array.from({ length: 60 }, (_, k) => {
      const d = new Date(Date.UTC(2026, 7, 11));
      d.setUTCDate(d.getUTCDate() + k);
      return indiceServi(jour(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
    });
    expect(new Set(indices).size).toBe(60);
  });

  it("[DUR] la CLÉ servie change réellement d'un jour à l'autre, et couvre les 60", () => {
    // ⚠️ CE TEST EXISTE PARCE QUE LE PRÉCÉDENT NE SUFFIT PAS. Tant qu'aucun texte n'est écrit, deux
    // mantras sont `{statut:"non_ecrit"}` des deux côtés : une rotation figée sur `CLES_MANTRA[0]`
    // rendrait exactement la même chose 60 jours d'affilée sans qu'aucune comparaison de CONTENU ne
    // s'en aperçoive. Trouvé par la campagne de mutation (M18), pas à la relecture.
    const cles = Array.from({ length: 60 }, (_, k) => {
      const d = new Date(Date.UTC(2026, 7, 11));
      d.setUTCDate(d.getUTCDate() + k);
      return cleMantraDuJour(jour(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
    });
    expect(new Set(cles).size).toBe(60);
    expect([...cles].sort()).toEqual([...CLES_MANTRA].sort());
    expect(cles[0]).not.toBe(cles[1]);
  });

  it("le 61ᵉ jour ramène le mantra du 1ᵉʳ — le cycle boucle", () => {
    expect(indiceServi(jour(2026, 8, 11))).toBe(indiceServi(jour(2026, 10, 10)));
    expect(cleMantraDuJour(jour(2026, 8, 11))).toBe(cleMantraDuJour(jour(2026, 10, 10)));
    expect(cleMantraDuJour(jour(2026, 8, 11))).not.toBe(cleMantraDuJour(jour(2026, 10, 9)));
  });

  it("[DUR / FR-033] la signature de `mantraDuJour` n'accepte AUCUNE donnée personnelle", () => {
    // C'est la garantie structurelle de « ne référence jamais le journal, une branche ou un
    // échange » : il n'existe aucun paramètre par lequel ils pourraient entrer. Le mutant serait
    // d'ajouter un `utilisatriceId` « pour varier un peu » — et FR-033 tomberait.
    expect(mantraDuJour.length).toBe(1);
  });
});

/**
 * L'indice réellement servi pour un jour.
 *
 * Deux mantras non écrits sont indiscernables par leur contenu (`{statut:"non_ecrit"}` des deux
 * côtés) : impossible de prouver la rotation en comparant ce que rend `mantraDuJour`. On recalcule
 * donc l'indice par la MÊME voie publique que le module — c'est bien la composition qui est testée,
 * et le jour où Anima écrit, la comparaison de contenu deviendra possible en plus.
 */
function indiceServi(j: JourCivil): number {
  return indiceDuJour(j, CARDINAL_MANTRA);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les jonctions calcul → texte
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T6] les jonctions distinguent « pas calculé » de « pas écrit »", () => {
  it("une Lune relative non calculée n'a PAS de créneau — on ne cherche pas le sens d'une absence", () => {
    expect(texteLuneRelative({ statut: "non_calcule", raison: "soleil_natal_absent" })).toBeNull();
    expect(texteLuneRelative({ statut: "non_calcule", raison: "lune_du_jour_absente" })).toBeNull();
  });

  it("une Lune relative calculée rend un créneau DÉCLARÉ (non écrit aujourd'hui)", () => {
    for (const distance of DISTANCES_LUNE) {
      expect(texteLuneRelative({ statut: "calcule", distance })).toEqual({ statut: "non_ecrit" });
    }
  });

  it("l'absence de configuration dominante rend `null` — un jour calme est un vrai jour", () => {
    expect(texteConfiguration(undefined)).toBeNull();
  });

  it("les 15 couples aspect × cible ont tous leur créneau", () => {
    for (const a of ASPECTS) {
      for (const cible of CIBLES_NATALES) {
        expect(
          texteConfiguration({ corpsTransitant: "lune", aspect: a.nom, cible, orbe: 1 }),
          `${a.nom}/${cible}`,
        ).toEqual({ statut: "non_ecrit" });
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// (a) LES DÉTECTEURS, ÉPROUVÉS POUR EUX-MÊMES
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Ce qu'un texte du socle quotidien ne doit JAMAIS porter (FR-033) :
 *   • une signature d'Anam — un mantra est un texte posé, pas une parole adressée ;
 *   • un marqueur de SÉRIE ou d'assiduité — « tu as manqué hier », « jour 3 », « ta série ».
 *     C'est le contrat qui rend le rythme quotidien acceptable : il n'exige rien.
 */
function chercherMarqueursQuotidiens(texte: string): string[] {
  const normalise = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʼ`]/g, "'")
    .toLowerCase();
  const MOTIFS: Array<[RegExp, string]> = [
    [/\banam\b/, "signature d'Anam"],
    [/\bserie\b/, "série"],
    [/\bd'affilee\b/, "assiduité"],
    [/\bjour\s+\d+\b/, "compteur de jours"],
    [/\bhier\b/, "référence à hier"],
    [/\bregulierement\b/, "assiduité"],
    [/\bchaque jour\b/, "assiduité"],
  ];
  return MOTIFS.filter(([m]) => m.test(normalise)).map(([, nom]) => nom);
}

describe("[(a) / FR-033] le détecteur de marqueurs quotidiens attrape ce qu'il doit attraper", () => {
  const CONNUES_MAUVAISES: readonly string[] = [
    "Anam te souhaite une belle journée.",
    "Tu as manqué hier, reprends aujourd'hui.",
    "Jour 12 de ta pratique.",
    "Ta série continue.",
    "Reviens chaque jour pour en profiter.",
    "Trois jours d'affilée, c'est déjà beaucoup.",
  ];

  const CONNUES_BONNES: readonly string[] = [
    "Ce qui pousse et ce qui retient tiennent parfois la même racine.",
    "Un jour ne demande rien pour exister.",
    "Il y a de la place pour ce qui n'est pas encore nommé.",
  ];

  it("mord sur TOUTES les connues-mauvaises", () => {
    for (const t of CONNUES_MAUVAISES) {
      expect(chercherMarqueursQuotidiens(t), `RATÉ : « ${t} »`).not.toEqual([]);
    }
  });

  it("épargne les connues-bonnes — sinon le corpus serait inécrivable", () => {
    for (const t of CONNUES_BONNES) {
      expect(chercherMarqueursQuotidiens(t), `FAUX POSITIF : « ${t} »`).toEqual([]);
    }
  });

  it("mord malgré les accents et la casse", () => {
    expect(chercherMarqueursQuotidiens("Ta SÉRIE continue.")).not.toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// (c) LE BALAYAGE, PROUVÉ SUR UN FAUX CORPUS
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Le balayage réel : la MÊME fonction est appliquée aux vrais corpus et au faux. */
function balayer(c: Corpus): string[] {
  const defauts: string[] = [];
  for (const texte of textesEcrits(c)) {
    for (const p of chercherPredictions(texte)) defauts.push(`${c.identifiant} : prédiction « ${p.terme} »`);
    for (const i of chercherInterdits(texte)) defauts.push(`${c.identifiant} : interdit « ${i.terme} »`);
    for (const m of chercherMarqueursQuotidiens(texte)) defauts.push(`${c.identifiant} : ${m}`);
  }
  return defauts;
}

describe("[(c)] le balayage MORD — prouvé sur un faux corpus connu-mauvais", () => {
  it("un faux corpus truffé de défauts est rejeté, défaut par défaut", () => {
    const faux = corpus("faux-quotidien", {
      "mantra:1": ecrit("Tu vas rencontrer quelqu'un aujourd'hui."), // prédiction
      // ⚠️ « soin » NOM est permis — sinon « be-soin » sauterait. `lexique-interdit.ts` (2.8) bannit
      // le VERBE et la locution. Un faux texte mal choisi ferait croire que le balayage ne mord pas.
      "mantra:2": ecrit("Un moment pour te soigner."), // lexique interdit (FR-023, famille « soigner »)
      "mantra:3": ecrit("Anam pense à toi."), // signature
      "mantra:4": ecrit("Tu as manqué hier."), // assiduité
    });
    const defauts = balayer(faux);
    expect(defauts.length).toBeGreaterThanOrEqual(4);
    expect(defauts.join(" | ")).toMatch(/prédiction/);
    expect(defauts.join(" | ")).toMatch(/interdit/);
    expect(defauts.join(" | ")).toMatch(/Anam/);
  });

  it("[CONTRE-ÉPREUVE] un faux corpus PROPRE passe — le balayage n'est pas bloqué en rouge", () => {
    const propre = corpus("faux-propre", {
      "mantra:1": ecrit("Ce qui pousse et ce qui retient tiennent parfois la même racine."),
      "mantra:2": ecrit("Il y a de la place pour ce qui n'est pas encore nommé."),
    });
    expect(balayer(propre)).toEqual([]);
  });

  it("[LE BALAYAGE RÉEL] les deux corpus du socle quotidien sont propres", () => {
    // Vacuement vrai aujourd'hui (0 texte). Le jour où Anima écrit, ce test devient le contrôle.
    expect(balayer(CORPUS_MANTRA)).toEqual([]);
    expect(balayer(CORPUS_HOROSCOPE)).toEqual([]);
  });
});
