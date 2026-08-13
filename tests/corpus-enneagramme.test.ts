import { describe, it, expect, vi } from "vitest";
import * as portCorpus from "@/lib/corpus/port";
import {
  CARDINAL_ENNEAGRAMME,
  CLES_ENNEAGRAMME,
  CORPUS_ENNEAGRAMME,
  cleEnneagramme,
  texteDuType,
  texteDuTypeRetenu,
} from "@/lib/corpus/enneagramme";
import { clesEcrites, clesNonEcrites, lireTexte, ecrit, corpus } from "@/lib/corpus/port";
import { TYPES, type ResultatTest } from "@/lib/domain/enneagramme";

/**
 * corpus-enneagramme.test.ts — LES NEUF INTERPRÉTATIONS (Story 5.5, AC1 — FR-054).
 *
 * ⚠️ LE PIÈGE LÉGUÉ NOMMÉMENT À CETTE STORY. Les neuf créneaux naissent tous `non_ecrit`, donc
 * `texteDuType(4)` et `texteDuType(7)` rendent LA MÊME VALEUR. Tout test de la forme « deux types
 * donnent des textes différents » est vrai de n'importe quelle implémentation, y compris d'une
 * constante figée. Deux mutants ont survécu à la campagne de la 5.4 pour exactement cette raison, et
 * `deferred-work.md` a écrit la parade à l'intention de la 5.5 : **asserter la CLÉ demandée, jamais
 * le texte rendu**.
 */

describe("[5.5/AC1] la forme du corpus", () => {
  it("[CONTRÔLE DU CONTRÔLE] neuf créneaux DÉCLARÉS, pas zéro", () => {
    // Sans ce témoin, tous les tests d'absence ci-dessous seraient vrais d'un corpus vide.
    expect(CARDINAL_ENNEAGRAMME).toBe(9);
    expect(CLES_ENNEAGRAMME).toHaveLength(9);
    expect(Object.keys(CORPUS_ENNEAGRAMME.textes)).toHaveLength(9);
  });

  it("un créneau par type, au format « <domaine>:<valeur> » décidé en 5.2", () => {
    expect([...CLES_ENNEAGRAMME]).toEqual(TYPES.map((t) => `enneagramme:${t}`));
  });

  it("ZÉRO écrit — Anima seule a le droit d'écrire ici", () => {
    expect(clesEcrites(CORPUS_ENNEAGRAMME)).toEqual([]);
    expect(clesNonEcrites(CORPUS_ENNEAGRAMME)).toHaveLength(9);
  });

  it("le corpus et ses créneaux sont GELÉS", () => {
    expect(Object.isFrozen(CORPUS_ENNEAGRAMME)).toBe(true);
    expect(Object.isFrozen(CORPUS_ENNEAGRAMME.textes)).toBe(true);
  });

  it("l'identifiant nomme le corpus dans les inventaires", () => {
    expect(CORPUS_ENNEAGRAMME.identifiant).toBe("enneagramme");
  });
});

describe("[5.5/AC1] la clé JETTE hors domaine — une clé fabriquée n'est pas une absence de texte", () => {
  it("accepte 1..9", () => {
    for (const t of TYPES) expect(cleEnneagramme(t)).toBe(`enneagramme:${t}`);
  });

  it("refuse tout le reste, y compris les valeurs qui « ressemblent » à un type", () => {
    for (const v of [0, 10, -1, 4.5, NaN, Infinity]) {
      expect(() => cleEnneagramme(v), String(v)).toThrow(/hors domaine/);
    }
  });
});

describe("[5.5/AC1] la jonction distingue TROIS états, jamais deux", () => {
  it("[LE CŒUR] un type retenu rend un créneau non écrit — pas `null`", () => {
    const retenu: ResultatTest = { statut: "retenu", type: 4 };
    expect(texteDuType(retenu)).toEqual({ statut: "non_ecrit" });
  });

  it("[LE CŒUR] un ex æquo rend `null` — il n'y a rien à écrire, pas un texte en attente", () => {
    // Confondre les deux ferait promettre « ce texte n'est pas encore écrit » à quelqu'un dont le
    // test n'a désigné personne.
    const indecis: ResultatTest = { statut: "indecis", exaequo: [3, 8] };
    expect(texteDuType(indecis)).toBeNull();
  });

  it("un test incomplet rend `null` lui aussi", () => {
    const incomplet: ResultatTest = { statut: "incomplet", manquants: ["e1a"] };
    expect(texteDuType(incomplet)).toBeNull();
  });
});

describe("[5.5/AC1] LA GARDE QUI SURVIT AU CORPUS VIDE : on assère la CLÉ, pas le texte", () => {
  it("[LE TEST QUI COMPTE] chaque type demande SA propre clé au corpus", () => {
    // Le mutant visé — « rendre toujours le créneau du type 1 » — est INVISIBLE sur les textes,
    // puisque neuf créneaux non écrits sont égaux. Il ne se voit qu'à l'argument passé au port.
    const espion = vi.spyOn(portCorpus, "lireTexte");
    try {
      for (const t of TYPES) {
        espion.mockClear();
        texteDuTypeRetenu(t);
        expect(espion, `type ${t}`).toHaveBeenCalledWith(CORPUS_ENNEAGRAMME, `enneagramme:${t}`);
      }
    } finally {
      espion.mockRestore();
    }
  });

  it("[CONTRÔLE] deux types demandent des clés DIFFÉRENTES", () => {
    // La formulation directe de la même propriété, sans espion : elle tomberait si la clé était
    // constante, alors qu'une comparaison de textes ne tomberait pas.
    expect(cleEnneagramme(4)).not.toBe(cleEnneagramme(7));
  });

  it("[CONTRÔLE NÉGATIF] la comparaison de TEXTES, elle, ne prouve rien — et on le montre", () => {
    // Ce test existe pour documenter le piège plutôt que pour garder quoi que ce soit : il PASSE
    // aujourd'hui, et il passerait tout autant si le corpus rendait toujours le même créneau.
    expect(texteDuTypeRetenu(4)).toEqual(texteDuTypeRetenu(7));
  });
});

describe("[5.5/AC1] le jour où Anima écrit, la machinerie sert le bon texte", () => {
  it("un corpus fabriqué avec des textes distincts rend bien celui du type demandé", () => {
    // La preuve que la sélection fonctionne VRAIMENT, obtenue sur un faux corpus — puisque le vrai
    // ne peut pas la donner tant qu'il est vide.
    const faux = corpus("faux", {
      "enneagramme:4": ecrit("le texte du quatre"),
      "enneagramme:7": ecrit("le texte du sept"),
    });
    expect(lireTexte(faux, cleEnneagramme(4))).toEqual({ statut: "ecrit", texte: "le texte du quatre" });
    expect(lireTexte(faux, cleEnneagramme(7))).toEqual({ statut: "ecrit", texte: "le texte du sept" });
  });
});
