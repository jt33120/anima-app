import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import {
  clesEcrites,
  clesNonEcrites,
  corpus,
  ecrit,
  lireTexte,
  textesEcrits,
  NON_ECRIT,
  type Corpus,
} from "@/lib/corpus/port";
import {
  CLES_NUMEROLOGIE,
  CORPUS_NUMEROLOGIE,
  cleNumerologie,
  texteDe,
  valeursPossibles,
} from "@/lib/corpus/numerologie";
import { NOMBRES } from "@/lib/astro/numerologie";

/**
 * Story 5.2 (T7) — LES INVARIANTS DE LA COUCHE CORPUS (FR-054, FR-086, FR-053, AD-1).
 *
 * ══ ⚠️ CE FICHIER EST UNE GARDE D'ABSENCE SUR UN CORPUS VIDE — LIRE AVANT DE LE MODIFIER ═══════
 *
 * Le corpus v1 ne contient AUCUN texte (voir `lib/corpus/numerologie.ts`). Une garde du type
 * « chaque texte écrit passe le contrôle » est donc VACUEMENT VRAIE aujourd'hui : elle serait verte
 * même si le balayage était cassé, même si le détecteur rendait toujours `[]`, même si la fonction
 * d'extraction ne trouvait rien. C'est exactement le mode d'échec relevé deux fois en revue 4.10 sur
 * `tronc-absence.test.ts`.
 *
 * Les trois disciplines s'appliquent donc, et la troisième demande un traitement particulier ici :
 *
 *   (a) LE DÉTECTEUR EST ÉPROUVÉ POUR LUI-MÊME, sur des chaînes fabriquées connues-mauvaises ET
 *       connues-bonnes, avant qu'on ne balaie quoi que ce soit ;
 *   (b) PRÉSENCE AVANT ABSENCE : le nombre de créneaux DÉCLARÉS est asserté non nul (69) — c'est ce
 *       qui reste vérifiable quand le nombre de créneaux ÉCRITS vaut zéro ;
 *   (c) LE BALAYAGE EST PROUVÉ SUR UN FAUX CORPUS. La même fonction `balayer` est appliquée à un
 *       corpus FABRIQUÉ contenant des textes connus-mauvais, et elle DOIT les rejeter. Sans ça, on
 *       ne saurait pas si le balayage mord — on saurait seulement qu'il ne trouve rien.
 *
 * Le jour où Anima écrit un texte, `textesEcrits` cesse d'être vide et le balayage se met à mordre
 * pour de bon, sans qu'une ligne change ici.
 */

const RACINE = process.cwd();

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function fichiersTs(dossier: string): string[] {
  const chemin = resolve(RACINE, dossier);
  if (!existsSync(chemin)) return [];
  return (readdirSync(chemin, { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts"))
    .map((f) => `${dossier}/${f}`);
}

const FICHIERS_CORPUS = fichiersTs("lib/corpus");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. La pureté de la couche (AD-1, AC9)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-1/DUR] lib/corpus est une couche PURE", () => {
  it("[CONTRÔLE DU CONTRÔLE] la couche a bien été balayée", () => {
    expect(FICHIERS_CORPUS.length, "aucun fichier trouvé dans lib/corpus — garde vide").toBe(2);
    expect(FICHIERS_CORPUS).toContain("lib/corpus/port.ts");
    expect(FICHIERS_CORPUS).toContain("lib/corpus/numerologie.ts");
  });

  it("[FR-054/FR-047] n'importe AUCUN modèle de langage — un corpus ne se génère pas", () => {
    for (const f of FICHIERS_CORPUS) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(src, `${f} importe lib/ai`).not.toMatch(/from\s+["']@?\/?lib\/ai/);
      expect(src, `${f} importe lib/ai`).not.toMatch(/from\s+["']\.\.?\/.*\bai\//);
    }
  });

  it("ne connaît ni base, ni serveur, ni rendu", () => {
    const INTERDITS: Array<[RegExp, string]> = [
      [/from\s+["']server-only["']/, "server-only"],
      [/from\s+["']@?\/?lib\/data/, "lib/data"],
      [/@supabase\//, "supabase"],
      [/from\s+["']@\/app\//, "app/"],
      [/from\s+["']@\/render\//, "render/"],
      [/from\s+["']next\//, "next"],
    ];
    for (const f of FICHIERS_CORPUS) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      for (const [motif, nom] of INTERDITS) {
        expect(motif.test(src), `${f} connaît ${nom}`).toBe(false);
      }
    }
  });

  it("[FR-054] n'est jamais exclu du contrôle de voix bloquant de la Story 2.8", () => {
    // La seule façon de perdre le contrôle de lexique sur les textes d'Anima serait d'ajouter
    // `lib/corpus` aux exclusions de `lexique-voix.test.ts`. La revue 4.9 en a déjà RETIRÉ quatre
    // qui ne se justifiaient plus ; on n'en rajoute pas une.
    const voix = readFileSync(resolve(RACINE, "tests/lexique-voix.test.ts"), "utf-8");
    const zoneExclusions = voix.slice(0, voix.indexOf("describe("));
    expect(zoneExclusions.length, "zone d'exclusions introuvable — contrôle vide").toBeGreaterThan(500);
    expect(zoneExclusions).not.toMatch(/lib\/corpus/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Le détecteur de prédiction, éprouvé POUR LUI-MÊME (discipline (a), FR-053)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[FR-053/(a)] le détecteur de prédiction attrape ce qu'il doit attraper", () => {
  const CONNUES_MAUVAISES = [
    "Tu vas rencontrer quelqu'un cette année.",
    "Tu vas découvrir une autre façon de faire.",
    "Ce nombre annonce une période de retrait.",
    "Cette année t'apportera une clarté nouvelle.",
    "Tu verras les choses autrement d'ici l'automne.",
    "Tu seras plus libre après cet été.",
    "Ton avenir se joue maintenant.",
    "Ce nombre te mènera vers une rupture.",
    "Voici ce qui t'attend.",
    "Ce nombre prédit une période de retrait.",
    "Les cartes présagent un changement.",
    "C'est une prophétie ancienne.",
  ];

  const CONNUES_BONNES = [
    "Ce nombre décrit une tendance à se retirer pour comprendre.",
    "On associe traditionnellement ce nombre à la patience.",
    "Ce serait une façon de le lire, parmi d'autres.",
    "Tu peux le lire comme une invitation, ou pas du tout.",
    "Les mois à venir sont un repère, rien de plus.",
    "Le nombre de destinée porte ce même mouvement.",
    "Une prédisposition n'est pas une trajectoire.",
    "Personne ne connaît l'avenir, et ce nombre non plus.",
    "Tu travailles souvent en retrait, et ça te va.",
    "Le cycle se refermera de lui-même.",
    "Tu vas bien, et ce nombre n'y change rien.",
    "Tu vas mieux quand tu ralentis.",
  ];

  it("rejette CHAQUE chaîne connue-mauvaise, en citant sa preuve", () => {
    for (const texte of CONNUES_MAUVAISES) {
      const trouve = chercherPredictions(texte);
      expect(trouve.length, `non détecté : « ${texte} »`).toBeGreaterThan(0);
      expect(trouve[0].terme.length, `terme vide sur « ${texte} »`).toBeGreaterThan(0);
    }
  });

  it("laisse passer CHAQUE chaîne connue-bonne — sans quoi le corpus serait inécrivable", () => {
    for (const texte of CONNUES_BONNES) {
      expect(chercherPredictions(texte), `faux positif sur « ${texte} »`).toEqual([]);
    }
  });

  it("épargne les mots piégés du futur français", () => {
    // Sans le préfixe de destinataire, ces mots feraient rougir du texte parfaitement légitime — et
    // on finirait par assouplir le détecteur jusqu'à ce qu'il n'attrape plus rien.
    for (const mot of ["embarras", "une caméra", "un affront", "le front", "un repas", "le fracas"]) {
      expect(chercherPredictions(`Ce nombre évoque ${mot}.`), mot).toEqual([]);
    }
  });

  it("est insensible à la casse et aux accents", () => {
    expect(chercherPredictions("TU VAS DÉCOUVRIR").length).toBeGreaterThan(0);
    expect(chercherPredictions("Ce nombre prédit tout").length).toBeGreaterThan(0);
    expect(chercherPredictions("Ce nombre predit tout").length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. Le balayage — prouvé sur un FAUX corpus (discipline (c))
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Le balayage, écrit UNE fois : le vrai corpus et le faux passent par exactement le même code. */
function balayer(c: Corpus): Array<{ texte: string; motif: string }> {
  const refus: Array<{ texte: string; motif: string }> = [];
  for (const texte of textesEcrits(c)) {
    for (const i of chercherInterdits(texte)) refus.push({ texte, motif: `${i.famille}:${i.terme}` });
    for (const p of chercherPredictions(texte)) refus.push({ texte, motif: `${p.famille}:${p.terme}` });
  }
  return refus;
}

describe("[(c)] le balayage MORD — prouvé sur un corpus fabriqué", () => {
  it("rejette un texte qui prédit", () => {
    const faux = corpus("faux", { "x:1": ecrit("Tu vas rencontrer quelqu'un.") });
    const refus = balayer(faux);
    expect(refus.length, "le balayage n'a rien vu — il est cassé").toBeGreaterThan(0);
    expect(refus[0].motif).toMatch(/^futur_adresse:/);
  });

  it("rejette un texte qui emploie le lexique médical interdit (Story 2.8)", () => {
    const faux = corpus("faux", { "x:1": ecrit("Ce nombre parle de ta santé mentale.") });
    const refus = balayer(faux);
    expect(refus.length, "le contrôle de voix ne mord pas sur le corpus").toBeGreaterThan(0);
  });

  it("laisse passer un texte propre — sinon le balayage rejetterait tout, ce qui ne prouve rien", () => {
    const faux = corpus("faux", { "x:1": ecrit("Ce nombre décrit un mouvement de retrait.") });
    expect(balayer(faux)).toEqual([]);
  });
});

describe("[FR-053/FR-054] le corpus réel passe le balayage", () => {
  it("aucun texte écrit ne prédit ni n'emploie un terme interdit", () => {
    expect(balayer(CORPUS_NUMEROLOGIE)).toEqual([]);
  });

  it("[(b) PRÉSENCE] les créneaux sont bien DÉCLARÉS, même si aucun n'est écrit", () => {
    // C'est ce qui reste vérifiable quand le nombre de textes vaut zéro : sans cette assertion,
    // l'assertion précédente serait verte sur un corpus inexistant.
    expect(CLES_NUMEROLOGIE.length).toBe(69);
    expect(Object.keys(CORPUS_NUMEROLOGIE.textes).length).toBe(69);
  });

  it("[porte pré-lancement] l'inventaire dit exactement où on en est", () => {
    const ecrites = clesEcrites(CORPUS_NUMEROLOGIE);
    const restantes = clesNonEcrites(CORPUS_NUMEROLOGIE);
    expect(ecrites.length + restantes.length).toBe(69);
    // ⚠️ Ce chiffre est VOULU. Il monte quand Anima écrit — jamais quand un modèle « aide ».
    expect(
      ecrites.length,
      "des textes sont apparus dans le corpus : vérifier qu'ils viennent bien d'Anima (FR-054/FR-086), " +
        "puis mettre à jour ce compte et le tableau de lib/corpus/README.md",
    ).toBe(0);
    expect(restantes.length).toBe(69);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. Le contrat du port
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC2] un créneau non écrit ne se déguise jamais en texte", () => {
  it("`ecrit()` refuse une chaîne vide à la construction", () => {
    // Un créneau vide déclaré « écrit » passerait le compte de complétude et n'afficherait rien :
    // le pire des deux mondes, et invisible.
    expect(() => ecrit("")).toThrow();
    expect(() => ecrit("   ")).toThrow();
    expect(ecrit("  du texte  ")).toEqual({ statut: "ecrit", texte: "du texte" });
  });

  it("`lireTexte` JETTE sur une clé non déclarée, au lieu de la faire passer pour non écrite", () => {
    // Rendre `non_ecrit` ferait passer une faute de frappe pour du travail d'écriture en attente :
    // elle resterait vide pour toujours et l'inventaire ne la compterait jamais.
    expect(() => lireTexte(CORPUS_NUMEROLOGIE, "chemin_de_vie:44")).toThrow(/non déclaré/);
    expect(() => lireTexte(CORPUS_NUMEROLOGIE, "nimporte:1")).toThrow();
    expect(lireTexte(CORPUS_NUMEROLOGIE, "chemin_de_vie:7")).toEqual(NON_ECRIT);
  });

  it("le corpus est GELÉ — personne n'y écrit à l'exécution", () => {
    expect(Object.isFrozen(CORPUS_NUMEROLOGIE)).toBe(true);
    expect(Object.isFrozen(CORPUS_NUMEROLOGIE.textes)).toBe(true);
    expect(() => {
      (CORPUS_NUMEROLOGIE.textes as Record<string, unknown>)["chemin_de_vie:7"] = ecrit("triché");
    }).toThrow();
  });
});

describe("[T1] les 69 créneaux sont dérivés, jamais recopiés", () => {
  it("chaque nombre déclare ses valeurs possibles", () => {
    for (const n of NOMBRES) {
      const v = valeursPossibles(n);
      expect(v.length, n).toBe(n === "annee_personnelle" ? 9 : 12);
      expect(v.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
    // L'année personnelle est la seule sans nombre maître — trois créneaux qu'Anima n'écrira jamais
    // pour rien, et un inventaire qui peut atteindre 100 %.
    expect(valeursPossibles("annee_personnelle")).not.toContain(11);
    expect(valeursPossibles("chemin_de_vie")).toContain(33);
  });

  it("le compte se recalcule : 5 × 12 + 9", () => {
    expect(5 * 12 + 9).toBe(CLES_NUMEROLOGIE.length);
    expect(new Set(CLES_NUMEROLOGIE).size, "des clés en double").toBe(69);
  });

  it("`cleNumerologie` refuse une valeur hors domaine", () => {
    expect(cleNumerologie("chemin_de_vie", 11)).toBe("chemin_de_vie:11");
    expect(() => cleNumerologie("chemin_de_vie", 44)).toThrow();
    expect(() => cleNumerologie("chemin_de_vie", 0)).toThrow();
    // Le cas qui compte : 11 est valide partout SAUF pour l'année personnelle.
    expect(() => cleNumerologie("annee_personnelle", 11)).toThrow();
  });
});

describe("[T5] la jonction nombre → texte ne fabrique rien", () => {
  it("un nombre calculé mène à son créneau", () => {
    const t = texteDe("chemin_de_vie", { statut: "calcule", valeur: 7, maitre: false });
    expect(t).toEqual(NON_ECRIT);
  });

  it("un nombre NON calculé n'a pas de créneau — on ne cherche pas le sens de ce qu'on n'a pas", () => {
    // Les deux absences restent distinctes de bout en bout : « je ne sais pas le calculer » n'est
    // pas « je ne l'ai pas encore écrit », et la 5.6 les affichera différemment.
    const t = texteDe("expression", { statut: "non_calcule", raison: "nom_absent" });
    expect(t).toBeNull();
  });

  it("ne rend JAMAIS une chaîne vide en guise de texte manquant", () => {
    for (const n of NOMBRES) {
      for (const v of valeursPossibles(n)) {
        const t = texteDe(n, { statut: "calcule", valeur: v, maitre: false });
        expect(t, `${n}:${v}`).not.toBeNull();
        expect(t!.statut, `${n}:${v}`).toBe("non_ecrit");
        expect("texte" in t!, `${n}:${v} porte un champ texte`).toBe(false);
      }
    }
  });
});
