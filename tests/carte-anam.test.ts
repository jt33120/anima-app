import { describe, it, expect } from "vitest";
import {
  carteAnam,
  ligneAnam,
  jourLisible,
  rognerLigne,
  LIGNE_ANAM_MAX,
  PRESENCE_ANAM,
  TITRE_CARTE_ANAM,
  type MotifAnamPresent,
} from "@/lib/domain/carte-anam";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";

/**
 * Story 6.3 (T5, AC6 / AC7 / AC8) — LA CARTE « ANAM », en pur domaine.
 *
 * Ce qui se prouve ici : la neutralité par défaut, la spécificité quand un motif existe, et le
 * fail-closed sur une charge utile incomplète. Ce qui NE s'y prouve pas : la garde AD-17, qui vit en
 * SQL (`branche_bloquee_par_detresse()`, migration 0054) et se prouve contre le vrai Postgres — la
 * prouver ici serait la prouver à l'endroit où elle n'est pas.
 */

const echeance = (titre: string | null, detail: string | null): MotifAnamPresent => ({
  motif: "echeance_intention",
  jour: "2026-08-15",
  titre,
  detail,
});

const synthese = (jour: string | null): MotifAnamPresent => ({
  motif: "synthese_prete",
  jour,
  titre: null,
  detail: null,
});

const proposition = (jour: string | null): MotifAnamPresent => ({
  motif: "proposition_branche",
  jour,
  titre: null,
  detail: null,
});

describe("[AC6] neutre par défaut", () => {
  it("aucun motif → aucune ligne, et la carte existe quand même", () => {
    // Mutation-cible : rendre `null` la carte entière plutôt que sa ligne. La carte DOIT rester à
    // l'écran : une carte qui apparaît et disparaît selon qu'Anam a quelque chose à dire EST une
    // pastille, simplement dessinée avec la carte au lieu d'un point rouge.
    expect(carteAnam([])).toEqual({ titre: TITRE_CARTE_ANAM, presence: PRESENCE_ANAM, ligne: null });
  });

  it("[FR-031] la carte neutre ne porte AUCUN chiffre", () => {
    // Mutation-cible : glisser un compte dans la phrase invariante (« 0 chose en attente »).
    const c = carteAnam([]);
    expect(`${c.titre} ${c.presence}`).not.toMatch(/\d/);
  });

  it("la phrase invariante est identique pour tout le monde — elle ne peut rien laisser fuir", () => {
    // Trois états radicalement différents, une seule et même phrase de présence.
    const etats = [[], [synthese("2026-08-15")], [echeance("j’ouvre l’app", "j’écris trois lignes")]];
    expect(new Set(etats.map((e) => carteAnam(e).presence)).size).toBe(1);
  });

  it("la copie de la carte passe le lexique interdit (2.8)", () => {
    for (const texte of [
      TITRE_CARTE_ANAM,
      PRESENCE_ANAM,
      ligneAnam([synthese("2026-08-15")]) ?? "",
      ligneAnam([proposition("2026-08-15")]) ?? "",
      ligneAnam([echeance("je bloque", "je note ce qui bloque")]) ?? "",
    ]) {
      expect(chercherInterdits(texte), `lexique interdit dans « ${texte} »`).toEqual([]);
    }
  });
});

describe("[AC6] la ligne est SPÉCIFIQUE, jamais un littéral identique pour tout le monde", () => {
  it("l’échéance porte SES MOTS, dans la forme « si … alors … »", () => {
    // Mutation-cible : remplacer les deux moitiés par une phrase générique (« Tu as une échéance
    // aujourd'hui. »). C'est exactement ce que l'AC3 interdit : la spécificité doit vivre dans l'app.
    const l = ligneAnam([echeance("je sens que je me ferme", "j’écris une phrase dans la conversation")])!;
    expect(l).toContain("je sens que je me ferme");
    expect(l).toContain("j’écris une phrase dans la conversation");
    expect(l).toContain("si ");
    expect(l).toContain("alors ");
  });

  it("la synthèse porte la DATE de fin de la période racontée", () => {
    expect(ligneAnam([synthese("2026-08-15")])).toContain("15 août 2026");
  });

  it("la proposition porte le JOUR — et AUCUN verbatim (minimisation héritée de la 4.5)", () => {
    // ⚠️ Mutation-cible : faire remonter le verbatim du journal dans cette ligne. `motifs_anam_du`
    // ne le rend même pas — mais si un jour elle le rendait, cette ligne doit continuer de ne porter
    // qu'une date. Le contrat est ici, pas seulement en SQL.
    const l = ligneAnam([{ ...proposition("2026-08-14"), titre: "VERBATIM", detail: "VERBATIM" }])!;
    expect(l).toContain("14 août 2026");
    expect(l).not.toContain("VERBATIM");
  });

  it("deux jours différents donnent deux lignes différentes", () => {
    // La garde qui empêche la ligne de redevenir un littéral : si elle l'était, ces deux-là seraient
    // égales et personne ne le verrait.
    expect(ligneAnam([synthese("2026-08-15")])).not.toBe(ligneAnam([synthese("2026-08-16")]));
  });

  it("[AC8] c’est le motif PRIORITAIRE qui parle, et lui seul", () => {
    // Les trois motifs présents en même temps : l'échéance gagne (rang 1). La ligne ne dit rien des
    // deux autres — le rendu ne reçoit jamais « 3 choses », parce qu'il ne reçoit jamais de 3.
    const l = ligneAnam([synthese("2026-08-15"), proposition("2026-08-14"), echeance("A", "B")])!;
    expect(l).toBe("Pour aujourd’hui : si A, alors B.");
  });
});

describe("[AD-15] fail-closed : une charge utile incomplète rend une carte NEUTRE, jamais une phrase à trous", () => {
  it("une échéance sans ses mots ne produit rien", () => {
    // Mutation-cible : retirer `if (!p.titre || !p.detail) return null;`. La carte afficherait alors
    // « Pour aujourd'hui : si null, alors undefined. » — et un build vert.
    expect(ligneAnam([echeance(null, "j’écris")])).toBeNull();
    expect(ligneAnam([echeance("je bloque", null)])).toBeNull();
    expect(ligneAnam([echeance(null, null)])).toBeNull();
  });

  it("une synthèse ou une proposition sans jour, ou avec un jour illisible, ne produit rien", () => {
    for (const mauvais of [null, "", "hier", "2026-08", "2026-13-01", "2026-08-45", "2026-08-00"]) {
      expect(ligneAnam([synthese(mauvais)]), `synthèse « ${mauvais} »`).toBeNull();
      expect(ligneAnam([proposition(mauvais)]), `proposition « ${mauvais} »`).toBeNull();
    }
  });

  it("[LE CŒUR] un motif prioritaire INCOMPLET ne bascule PAS sur le suivant", () => {
    // ⚠️ Le réflexe serait de « sauver la carte » en affichant la synthèse quand l'échéance est
    // cassée. Ce serait faire dire à la carte autre chose que ce que le courriel a annoncé — la
    // divergence exacte qu'AC8 existe pour empêcher. Neutre est la bonne réponse.
    expect(ligneAnam([echeance(null, null), synthese("2026-08-15")])).toBeNull();
  });

  it("un motif hors de l’ensemble fermé ne produit rien, et n’écrase pas un motif légitime", () => {
    expect(ligneAnam([{ motif: "reengagement", jour: "2026-08-15", titre: "reviens", detail: "!" }])).toBeNull();
    expect(
      ligneAnam([{ motif: "reengagement", jour: "2026-08-15", titre: null, detail: null }, synthese("2026-08-15")]),
    ).toContain("15 août 2026");
  });
});

describe("jourLisible — une date CIVILE, sans instant et sans fuseau", () => {
  it("écrit le jour, le mois en toutes lettres et l’année", () => {
    expect(jourLisible("2026-01-01")).toBe("1 janvier 2026");
    expect(jourLisible("2026-12-31")).toBe("31 décembre 2026");
    expect(jourLisible("2026-08-05")).toBe("5 août 2026");
  });

  it("[LE CŒUR] les douze mois sont dans l’ordre, sans décalage", () => {
    // Mutation-cible : `MOIS[Number(mois)]` au lieu de `- 1`. Un seul mois testé laisserait passer
    // la moitié des décalages ; les douze d'un coup n'en laissent passer aucun.
    const mois = Array.from({ length: 12 }, (_, i) => jourLisible(`2026-${String(i + 1).padStart(2, "0")}-10`));
    expect(mois).toEqual([
      "10 janvier 2026",
      "10 février 2026",
      "10 mars 2026",
      "10 avril 2026",
      "10 mai 2026",
      "10 juin 2026",
      "10 juillet 2026",
      "10 août 2026",
      "10 septembre 2026",
      "10 octobre 2026",
      "10 novembre 2026",
      "10 décembre 2026",
    ]);
  });

  it("le premier jour d’un mois ne bascule PAS sur la veille", () => {
    // La panne qu'aucune ancre à midi n'aurait à corriger, parce qu'il n'y a pas d'instant du tout :
    // le 1er août reste le 1er août, quel que soit le fuseau de la machine qui l'affiche.
    expect(jourLisible("2026-08-01")).toBe("1 août 2026");
    expect(jourLisible("2026-03-01")).toBe("1 mars 2026");
  });

  it("refuse tout ce qui n’est pas une date civile", () => {
    for (const mauvais of ["", "hier", "2026-08", "26-08-05", "2026-08-05T00:00:00Z", "2026-00-05", "2026-13-05"]) {
      expect(jourLisible(mauvais), `« ${mauvais} »`).toBeNull();
    }
  });
});

describe("rognerLigne — ses mots, bornés pour l’affichage", () => {
  it("en dessous de la borne, le texte est rendu INTACT", () => {
    expect(rognerLigne("court")).toBe("court");
    expect(rognerLigne("a".repeat(LIGNE_ANAM_MAX))).toBe("a".repeat(LIGNE_ANAM_MAX));
  });

  it("au-dessus, la coupe tombe sur un mot entier et se voit", () => {
    const texte = `${"mot ".repeat(60)}fin`;
    const rogne = rognerLigne(texte);
    expect(rogne.endsWith("…")).toBe(true);
    expect(rogne.length).toBeLessThanOrEqual(LIGNE_ANAM_MAX + 1);
    expect(rogne.endsWith(" …"), "aucune espace avant les points de suspension").toBe(false);
    expect(texte.startsWith(rogne.slice(0, -1)), "on ne rogne pas, on tronque").toBe(true);
  });

  it("un mot unique plus long que la borne est coupé FRANC, jamais réduit à « … »", () => {
    // Mutation-cible : retirer le repli `espace > max / 2`. Une suite sans espace — une adresse
    // collée — rendrait une chaîne vide suivie de points de suspension, qui se lit comme une panne.
    const rogne = rognerLigne("z".repeat(400));
    expect(rogne).toBe(`${"z".repeat(LIGNE_ANAM_MAX)}…`);
  });

  it("une intention de 300 + 300 caractères tient sur la carte", () => {
    const l = ligneAnam([echeance("d".repeat(300), "a".repeat(300))])!;
    expect(l.length).toBeLessThanOrEqual(LIGNE_ANAM_MAX + 1);
    expect(l.endsWith("…")).toBe(true);
  });
});
