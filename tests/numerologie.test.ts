import { describe, it, expect } from "vitest";
import {
  MAITRES,
  NOMBRES,
  NOMBRES_DU_NOM,
  VOYELLES,
  anneePersonnelle,
  calculerNumerologie,
  cheminDeVie,
  estMaitre,
  expression,
  intime,
  jourDeNaissance,
  lettresDe,
  personnalite,
  reduire,
  reduireSansMaitre,
  valeurLettre,
  type NomNombre,
} from "@/lib/astro/numerologie";

/**
 * Story 5.2 (T2/T3) — LE CALCUL NUMÉROLOGIQUE.
 *
 * Ici, comme en astronomie, l'intuition ne sert à rien : une formule fausse ne plante jamais, elle
 * rend un nombre entre 1 et 33 qui a l'air d'un résultat. Trois recours, les mêmes qu'en 5.1 :
 *
 *   1. des CAS QUI SÉPARENT deux implémentations plausibles (le 28/11/1970, `Yves`, `Lœwenstein`) ;
 *   2. des PROPRIÉTÉS structurelles (déterminisme, bornes, monotonie de l'année personnelle) ;
 *   3. des INVARIANTS de domaine (la table de Pythagore a une périodicité de 9, pas 26 entrées).
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La réduction — le piège des nombres maîtres
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T2] la réduction conserve les nombres maîtres", () => {
  it("réduit les nombres ordinaires jusqu'à un chiffre", () => {
    expect(reduire(1)).toBe(1);
    expect(reduire(9)).toBe(9);
    expect(reduire(10)).toBe(1);
    expect(reduire(19)).toBe(1);
    expect(reduire(20)).toBe(2);
    expect(reduire(48)).toBe(3);
    expect(reduire(99)).toBe(9);
  });

  it("[LE PIÈGE] 11, 22 et 33 ne se réduisent PAS", () => {
    // Mutation-cible : `while (v > 9) v = somme(v)` — la formulation naïve, qui avale 11 → 2.
    // Elle ne plante jamais et détruit exactement ce qui fait la particularité d'un thème.
    expect(reduire(11)).toBe(11);
    expect(reduire(22)).toBe(22);
    expect(reduire(33)).toBe(33);
  });

  it("s'arrête sur un maître ATTEINT en cours de route, pas seulement fourni tel quel", () => {
    // 29 → 2+9 = 11 : le maître n'est pas l'entrée, il apparaît. Un test qui ne vérifierait que
    // `reduire(11)` passerait avec un contrôle placé APRÈS la boucle au lieu d'avant chaque tour.
    expect(reduire(29)).toBe(11);
    expect(reduire(38)).toBe(11);
    expect(reduire(499)).toBe(22);
  });

  it("`reduireSansMaitre` écrase les maîtres — et c'est son unique raison d'être", () => {
    expect(reduireSansMaitre(11)).toBe(2);
    expect(reduireSansMaitre(22)).toBe(4);
    expect(reduireSansMaitre(33)).toBe(6);
    expect(reduireSansMaitre(9)).toBe(9);
    // Un multiple de 9 rend 9, jamais 0 : la racine numérique n'est pas le modulo.
    expect(reduireSansMaitre(18)).toBe(9);
    expect(reduireSansMaitre(99)).toBe(9);
  });

  it("[P9] jette sur 0 ou sur un non-entier — une absence ne se déguise pas en résultat", () => {
    expect(() => reduire(0)).toThrow();
    expect(() => reduire(-5)).toThrow();
    expect(() => reduire(1.5)).toThrow();
    expect(() => reduireSansMaitre(0)).toThrow();
  });

  it("`estMaitre` et `MAITRES` disent la même chose", () => {
    expect([...MAITRES]).toEqual([11, 22, 33]);
    for (const m of MAITRES) expect(estMaitre(m)).toBe(true);
    for (const n of [1, 9, 10, 12, 21, 23, 32, 34]) expect(estMaitre(n)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le chemin de vie — LE cas qui sépare les deux écoles
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T2/P1] le chemin de vie est calculé par RÉDUCTION SÉPARÉE", () => {
  it("[LE TUEUR DE MUTANT] 28 novembre 1970 : séparée = 2, globale = 11", () => {
    // Ce test existe pour UNE raison : les deux méthodes rendent toutes les deux un nombre plausible
    // et aucune ne plante. Sans ce cas précis, on ne saurait pas laquelle est implémentée.
    //
    //   séparée : jour 28→10→1 · mois 11→11 (maître conservé) · année 1970→17→8 · 1+11+8 = 20 → 2
    //   globale : 2+8+1+1+1+9+7+0 = 29 → 11
    //
    // Mutation-cible : additionner tous les chiffres d'un coup. Elle rendrait 11 ici.
    expect(cheminDeVie("1970-11-28")).toBe(2);

    // Contrôle du contrôle : on calcule la méthode CONCURRENTE à la main et on vérifie qu'elle
    // donne bien autre chose — sinon ce cas ne séparerait rien et le test serait décoratif.
    const globale = reduire(
      [..."19701128"].reduce((a, c) => a + Number(c), 0),
    );
    expect(globale).toBe(11);
    expect(globale).not.toBe(cheminDeVie("1970-11-28"));
  });

  it("reste dans le domaine attendu sur un échantillon de dates", () => {
    const cas: Array<[string, number]> = [
      ["1990-01-01", 3],
      ["1979-09-24", 5],
      ["1988-02-29", 3],
      ["2000-12-31", 9],
      ["1985-07-15", 9],
    ];
    for (const [date, attendu] of cas) expect(cheminDeVie(date), date).toBe(attendu);
  });

  it("[fuseau] la date de naissance est CIVILE — jamais interprétée comme un instant UTC", () => {
    // Mutation-cible : `new Date("1970-11-28").getDate()`. En UTC c'est bien 28, mais pour un
    // exécutant à l'ouest de Greenwich, `.getDate()` rend 27 et tout le thème glisse d'un jour.
    // On vérifie donc que le jour utilisé est bien celui de la chaîne, quel que soit le fuseau.
    expect(jourDeNaissance("1970-11-28")).toBe(reduire(28));
    expect(jourDeNaissance("2000-01-01")).toBe(1);
  });

  it("refuse une date malformée plutôt que d'en deviner une", () => {
    for (const mauvais of ["28/11/1970", "1970-13-01", "1970-11-32", "", "1970-11"]) {
      expect(() => cheminDeVie(mauvais), mauvais).toThrow();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'année personnelle
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T2/P5] l'année personnelle prend son année en PARAMÈTRE", () => {
  it("avance d'un cran par année civile", () => {
    // Propriété structurelle : le cycle est de neuf ans, donc +1 chaque année (avec bouclage 9→1).
    expect(anneePersonnelle("1970-11-28", 2025)).toBe(3);
    expect(anneePersonnelle("1970-11-28", 2026)).toBe(4);
    expect(anneePersonnelle("1970-11-28", 2027)).toBe(5);
  });

  it("reste toujours entre 1 et 9 — jamais de nombre maître", () => {
    for (let annee = 2000; annee <= 2050; annee++) {
      for (const date of ["1970-11-28", "1990-01-01", "1988-02-29"]) {
        const v = anneePersonnelle(date, annee);
        expect(v, `${date} / ${annee}`).toBeGreaterThanOrEqual(1);
        expect(v, `${date} / ${annee}`).toBeLessThanOrEqual(9);
        expect(estMaitre(v)).toBe(false);
      }
    }
  });

  it("boucle bien de 9 à 1 sans passer par 0", () => {
    const suite = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028].map((a) =>
      anneePersonnelle("1990-01-01", a),
    );
    expect(new Set(suite).size).toBe(9); // les neuf valeurs, chacune une fois
    expect(suite).not.toContain(0);
  });

  it("refuse une année de référence absurde", () => {
    expect(() => anneePersonnelle("1970-11-28", 0)).toThrow();
    expect(() => anneePersonnelle("1970-11-28", 2026.5)).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les lettres françaises
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T3] la table de Pythagore", () => {
  it("a une périodicité de 9, pas 26 entrées recopiées", () => {
    const table = [..."abcdefghijklmnopqrstuvwxyz"].map(valeurLettre);
    expect(table.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]); // a → i
    expect(table.slice(9, 18)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]); // j → r
    expect(table.slice(18)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); //       s → z
    // Chaldéenne (l'autre table du domaine) n'a pas de 9 du tout : ce contrôle l'écarte.
    expect(table).toContain(9);
  });

  it("refuse ce qui n'est pas une lettre a-z normalisée", () => {
    for (const mauvais of ["é", "-", " ", "1", "Œ", "A"]) {
      expect(() => valeurLettre(mauvais), mauvais).toThrow();
    }
  });
});

describe("[T3/P3] la normalisation des noms français", () => {
  it("retire accents, espaces, traits d'union et apostrophes des deux sortes", () => {
    expect(lettresDe("Zoé")).toBe("zoe");
    expect(lettresDe("François")).toBe("francois");
    expect(lettresDe("Anaïs")).toBe("anais");
    expect(lettresDe("Jean-Pierre")).toBe("jeanpierre");
    expect(lettresDe("D'Artagnan")).toBe("dartagnan");
    expect(lettresDe("D’Artagnan")).toBe("dartagnan"); // apostrophe typographique
    expect(lettresDe("MARIE  DUPONT")).toBe("mariedupont");
  });

  it("[LE PIÈGE VÉRIFIÉ] déplie les ligatures, que NFD ne décompose PAS", () => {
    // Contrôle du contrôle, d'abord : on prouve que le trou existe vraiment dans NFD, sinon ce test
    // protégerait contre un danger imaginaire.
    expect("œ".normalize("NFD").replace(/[̀-ͯ]/g, "")).toBe("œ");
    expect("æ".normalize("NFD").replace(/[̀-ͯ]/g, "")).toBe("æ");

    expect(lettresDe("Lœwenstein")).toBe("loewenstein");
    expect(lettresDe("Æsop")).toBe("aesop");
    expect(lettresDe("Straße")).toBe("strasse");

    // LA preuve qui compte : une ligature avalée retirerait DEUX lettres de la somme. Le nombre
    // d'expression de « Lœwenstein » DOIT donc être celui de « Loewenstein », et pas celui de
    // « Lwenstein » — que l'on calcule ici pour montrer qu'ils diffèrent.
    expect(expression("Lœwenstein")).toBe(expression("Loewenstein"));
    expect(expression("Lœwenstein")).not.toBe(expression("Lwenstein"));
  });

  it("rend une chaîne vide quand il n'y a aucune lettre", () => {
    expect(lettresDe("---")).toBe("");
    expect(lettresDe("1970")).toBe("");
    expect(lettresDe("   ")).toBe("");
  });
});

describe("[T3/P4] `Y` est une voyelle — et ce choix change DEUX nombres", () => {
  it("est déclaré dans `VOYELLES`", () => {
    expect(VOYELLES).toBe("aeiouy");
  });

  it("[LE TUEUR DE MUTANT] « Yves » : intime 3 et personnalité 5", () => {
    // y=7, v=4, e=5, s=1.
    //   Y voyelle  → intime = y+e = 12 → 3 ; personnalité = v+s = 5
    //   Y consonne → intime = e  = 5      ; personnalité = y+v+s = 12 → 3
    // Les deux valeurs s'ÉCHANGENT : basculer la règle est donc immédiatement visible ici, et
    // nulle part ailleurs dans la suite.
    expect(intime("Yves")).toBe(3);
    expect(personnalite("Yves")).toBe(5);
  });

  it("un nom sans voyelle et un nom sans consonne se signalent, jamais 0", () => {
    expect(() => intime("Brrr")).toThrow();
    expect(() => personnalite("Aia")).toThrow();
    expect(() => expression("---")).toThrow();
  });
});

describe("[T3] les trois nombres du nom", () => {
  it("expression = toutes les lettres, intime = voyelles, personnalité = consonnes", () => {
    const cas: Array<[string, number, number, number]> = [
      ["Zoé", 1, 11, 8],
      ["Joël", 6, 11, 4],
      ["François", 4, 7, 6],
      ["Anaïs", 8, 11, 6],
      ["Jean-Pierre", 11, 7, 4],
      ["D'Artagnan", 8, 3, 5],
      ["MARIE DUPONT", 1, 6, 4],
    ];
    for (const [nom, e, i, p] of cas) {
      expect(expression(nom), `${nom} expression`).toBe(e);
      expect(intime(nom), `${nom} intime`).toBe(i);
      expect(personnalite(nom), `${nom} personnalité`).toBe(p);
    }
  });

  it("conserve un nombre maître apparu dans un nom", () => {
    // « Zoé » : o=6, e=5 → 11. Si la réduction avalait les maîtres, ce serait 2.
    expect(intime("Zoé")).toBe(11);
    expect(expression("Jean-Pierre")).toBe(11);
  });

  it("est insensible à la casse et aux espaces surnuméraires", () => {
    expect(expression("Marie Dupont")).toBe(expression("MARIE  DUPONT"));
    expect(intime("marie dupont")).toBe(intime("Marie Dupont"));
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'assemblage
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T5/AC1] `calculerNumerologie` aboutit toujours avec ce qui est disponible", () => {
  const AVEC = { date: "1970-11-28", nomComplet: "Marie Dupont" };
  const SANS = { date: "1970-11-28" };

  it("rend les SIX nombres, toujours, quelle que soit l'entrée", () => {
    for (const entrees of [AVEC, SANS, { date: "1970-11-28", nomComplet: "---" }]) {
      const n = calculerNumerologie(entrees, 2026);
      expect(Object.keys(n.nombres).sort()).toEqual([...NOMBRES].sort());
    }
  });

  it("[FR-048] sans nom complet : les trois nombres de date aboutissent, les trois du nom non", () => {
    const n = calculerNumerologie(SANS, 2026);
    expect(n.nombres.chemin_de_vie).toEqual({ statut: "calcule", valeur: 2, maitre: false });
    expect(n.nombres.jour_de_naissance.statut).toBe("calcule");
    expect(n.nombres.annee_personnelle.statut).toBe("calcule");
    for (const nom of NOMBRES_DU_NOM) {
      expect(n.nombres[nom], nom).toEqual({ statut: "non_calcule", raison: "nom_absent" });
    }
  });

  it("distingue « jamais renseigné » de « renseigné mais inexploitable »", () => {
    // Les confondre ferait passer un défaut de saisie pour un champ optionnel laissé vide, et
    // personne n'irait le chercher.
    const vide = calculerNumerologie({ date: "1970-11-28", nomComplet: "  " }, 2026);
    const illisible = calculerNumerologie({ date: "1970-11-28", nomComplet: "---" }, 2026);
    for (const nom of NOMBRES_DU_NOM) {
      expect(vide.nombres[nom]).toEqual({ statut: "non_calcule", raison: "nom_absent" });
      expect(illisible.nombres[nom]).toEqual({ statut: "non_calcule", raison: "nom_sans_lettre" });
    }
  });

  it("signale séparément l'absence de voyelle et l'absence de consonne", () => {
    const sansVoyelle = calculerNumerologie({ date: "1970-11-28", nomComplet: "Brrr" }, 2026);
    expect(sansVoyelle.nombres.intime).toEqual({
      statut: "non_calcule",
      raison: "nom_sans_voyelle",
    });
    expect(sansVoyelle.nombres.expression.statut).toBe("calcule");

    const sansConsonne = calculerNumerologie({ date: "1970-11-28", nomComplet: "Aia" }, 2026);
    expect(sansConsonne.nombres.personnalite).toEqual({
      statut: "non_calcule",
      raison: "nom_sans_consonne",
    });
    expect(sansConsonne.nombres.intime.statut).toBe("calcule");
  });

  it("[FR-053 structurel] ne rend AUCUN champ de texte libre", () => {
    // Même garde qu'en 5.1 : la sortie est faite de nombres et d'énumérations FERMÉES, donc il
    // n'existe aucun endroit où une prédiction pourrait s'écrire. Le jour où quelqu'un ajoute un
    // `commentaire: string`, ce test rougit — pas parce qu'il aura reconnu une prédiction, mais
    // parce qu'il aura vu apparaître un endroit où en écrire une.
    const n = calculerNumerologie(AVEC, 2026);
    const AUTORISEES = new Set([
      "reduction_separee",
      "voyelle",
      "premier_janvier",
      "calcule",
      "non_calcule",
      "nom_absent",
      "nom_sans_lettre",
      "nom_sans_voyelle",
      "nom_sans_consonne",
    ]);
    const chaines: string[] = [];
    const parcourir = (v: unknown): void => {
      if (typeof v === "string") chaines.push(v);
      else if (Array.isArray(v)) v.forEach(parcourir);
      else if (v && typeof v === "object") Object.values(v).forEach(parcourir);
    };
    parcourir(n);
    // (a) l'extracteur est éprouvé pour lui-même, (b) présence avant absence :
    expect(parcourir, "l'extracteur existe").toBeTypeOf("function");
    expect(chaines.length, "aucune chaîne trouvée — garde vide").toBeGreaterThan(0);
    expect(chaines).toContain("reduction_separee");
    // (c) l'absence, seulement maintenant :
    for (const c of chaines) expect(AUTORISEES.has(c), `chaîne inattendue : « ${c} »`).toBe(true);
  });

  it("inscrit ses conventions dans la sortie — elles ne se devinent pas", () => {
    const n = calculerNumerologie(AVEC, 2026);
    expect(n.methodeCheminDeVie).toBe("reduction_separee");
    expect(n.regleY).toBe("voyelle");
    expect(n.basculeAnneePersonnelle).toBe("premier_janvier");
    expect(n.anneeDeReference).toBe(2026);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le déterminisme (AC3)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3] le déterminisme est mesuré, pas affirmé", () => {
  it("deux calculs identiques rendent un JSON strictement identique", () => {
    const e = { date: "1970-11-28", nomComplet: "Marie Dupont" };
    const a = JSON.stringify(calculerNumerologie(e, 2026));
    const b = JSON.stringify(calculerNumerologie(e, 2026));
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(50); // garde non-vacue : on compare bien quelque chose
  });

  it("cent calculs sur un échantillon varié ne divergent jamais", () => {
    const echantillon = [
      { date: "1970-11-28", nomComplet: "Marie Dupont" },
      { date: "1990-01-01" },
      { date: "2000-12-31", nomComplet: "Jean-Pierre D'Artagnan" },
      { date: "1988-02-29", nomComplet: "Lœwenstein" },
    ];
    for (const e of echantillon) {
      const reference = JSON.stringify(calculerNumerologie(e, 2026));
      for (let i = 0; i < 25; i++) {
        expect(JSON.stringify(calculerNumerologie(e, 2026)), e.date).toBe(reference);
      }
    }
  });

  it("la sortie est gelée — personne ne la retouche après coup", () => {
    const n = calculerNumerologie({ date: "1990-01-01" }, 2026);
    expect(Object.isFrozen(n)).toBe(true);
    expect(Object.isFrozen(n.nombres)).toBe(true);
    expect(() => {
      (n.nombres as Record<NomNombre, unknown>).chemin_de_vie = null;
    }).toThrow();
  });
});
